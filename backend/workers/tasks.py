"""
Celery tasks for media processing pipeline
"""
import os
from typing import Optional
from celery import chain
from backend.workers.celery_app import app
from backend.db.database import get_db_context
from backend.db.models import MediaItem, ProcessingJob
from backend.services.media_extractor import MediaExtractor
from backend.services.web_extractor import WebExtractor
from backend.services.audio_dedup import AudioDeduplicator
from backend.services.whisper_service import WhisperService
from backend.services.gemini_service import GeminiService
from backend.services.embeddings import generate_embedding
from backend.storage.minio_client import MinIOClient


@app.task(bind=True, name='backend.workers.tasks.process_media_task')
def process_media_task(self, job_id: str):
    """
    Main orchestrator task - chains all processing steps
    """
    with get_db_context() as db:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        media = db.query(MediaItem).filter(MediaItem.id == job.media_id).first()
        
        # Get source_type before session closes
        source_type = media.source_type

    # Now safe to use source_type after context closes
    if source_type in ['web_url', 'rss_url']:
        pipeline = chain(
            extract_web_content.s(job_id),
            enrich_with_gemini.s(job_id),
            finalize_processing.s(job_id)
        )
    else:
        pipeline = chain(
            extract_media.s(job_id),
            check_duplicate.s(job_id),
            transcribe_audio.s(job_id),
            enrich_with_gemini.s(job_id),
            finalize_processing.s(job_id)
        )

    return pipeline()


@app.task(bind=True, name='backend.workers.tasks.extract_web_content')
def extract_web_content(self, job_id: str):
    """
    Extract text from web page or feed
    """
    with get_db_context() as db:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        media = db.query(MediaItem).filter(MediaItem.id == job.media_id).first()

        job.status = 'extracting'
        job.current_stage = 'Web Extraction'
        job.progress_percent = 10
        db.commit()

        try:
            extractor = WebExtractor()
            result = extractor.extract(media.source_url)

            media.title = result.get('title') or media.title
            media.raw_text = result.get('text')
            job.progress_percent = 40
            db.commit()

            return {
                'raw_text': media.raw_text,
            }
        except Exception as e:
            job.status = 'error'
            job.error_message = f"Web extraction failed: {str(e)}"
            media.status = 'error'
            db.commit()
            raise


@app.task(bind=True, name='backend.workers.tasks.extract_media')
def extract_media(self, job_id: str):
    """
    Step 1: Extract/Download media and upload to MinIO
    
    Returns: dict with minio_path, duration, title
    """
    with get_db_context() as db:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        media = db.query(MediaItem).filter(MediaItem.id == job.media_id).first()
        
        # Update status
        job.status = 'extracting'
        job.current_stage = 'Media Extraction'
        job.progress_percent = 10
        db.commit()
        
        try:
            extractor = MediaExtractor()
            minio_client = MinIOClient()
            
            # Check if file already uploaded (has minio_path)
            if media.minio_path:
                # File already in MinIO (uploaded file)
                # Just get duration
                local_path = minio_client.download_audio(media.minio_path)
                duration = extractor.get_audio_duration(local_path)
                os.remove(local_path)
                
                media.duration = duration
                job.progress_percent = 20
                db.commit()
                
                return {
                    'minio_path': media.minio_path,
                    'duration': duration,
                    'title': media.title
                }
            else:
                # Download from URL (yt-dlp)
                result = extractor.download_url(media.source_url)
                audio_path = result['audio_path']
                title = result['title']
                duration = result['duration']
                media.title = title
                
                # Upload to MinIO
                minio_path = minio_client.upload_audio(
                    file_path=audio_path,
                    media_id=media.id
                )
                
                # Update media item
                media.minio_path = minio_path
                media.duration = duration
                job.progress_percent = 20
                db.commit()
                
                # Clean up local file
                os.remove(audio_path)
                
                return {
                    'minio_path': minio_path,
                    'duration': duration,
                    'title': title
                }
            
        except Exception as e:
            job.status = 'error'
            job.error_message = f"Extraction failed: {str(e)}"
            media.status = 'error'
            db.commit()
            raise


@app.task(bind=True, name='backend.workers.tasks.check_duplicate')
def check_duplicate(self, extract_result: dict, job_id: str):
    """
    Step 2: Generate audio hash and check for duplicates
    
    Returns: extract_result if not duplicate, raises error if duplicate
    """
    with get_db_context() as db:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        media = db.query(MediaItem).filter(MediaItem.id == job.media_id).first()
        
        job.status = 'hashing'
        job.current_stage = 'Duplicate Check'
        job.progress_percent = 30
        db.commit()
        
        try:
            deduplicator = AudioDeduplicator()
            minio_client = MinIOClient()
            
            # Download audio from MinIO
            local_path = minio_client.download_audio(media.minio_path)
            
            # Generate audio hash
            audio_hash = deduplicator.generate_hash(local_path)
            media.audio_hash = audio_hash
            db.commit()
            
            # Check for duplicates
            existing = db.query(MediaItem).filter(
                MediaItem.audio_hash == audio_hash,
                MediaItem.id != media.id,
                MediaItem.status == 'completed'
            ).first()
            
            if existing:
                # Duplicate found - link to existing
                media.status = 'duplicate'
                media.raw_text = existing.raw_text
                media.transcript = existing.transcript
                media.ai_summary = existing.ai_summary
                media.tags = existing.tags
                media.embedding = existing.embedding
                job.status = 'completed'
                job.current_stage = 'Duplicate (linked)'
                job.progress_percent = 100
                db.commit()
                
                # Stop pipeline
                raise Exception(f"Duplicate of media {existing.id}")
            
            # Not a duplicate - continue
            job.progress_percent = 40
            db.commit()
            os.remove(local_path)
            
            return extract_result
            
        except Exception as e:
            if "Duplicate of media" in str(e):
                # This is expected - duplicate found
                return None
            # Real error
            job.status = 'error'
            job.error_message = f"Deduplication failed: {str(e)}"
            media.status = 'error'
            db.commit()
            raise


@app.task(bind=True, name='backend.workers.tasks.transcribe_audio')
def transcribe_audio(self, dedup_result: Optional[dict], job_id: str):
    """
    Step 3: Transcribe audio using Whisper
    
    Returns: dict with raw_text, transcript (speaker turns)
    """
    if dedup_result is None:
        # Skip if duplicate
        return None
    
    with get_db_context() as db:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        media = db.query(MediaItem).filter(MediaItem.id == job.media_id).first()
        
        job.status = 'transcribing'
        job.current_stage = 'Whisper Transcription'
        job.progress_percent = 50
        db.commit()
        
        try:
            whisper = WhisperService()
            minio_client = MinIOClient()
            
            # Download audio from MinIO
            local_path = minio_client.download_audio(media.minio_path)
            
            # Transcribe
            result = whisper.transcribe(local_path)
            
            # Update media
            media.raw_text = result['text']
            media.transcript = result['turns']
            job.progress_percent = 70
            db.commit()
            
            os.remove(local_path)
            
            return {
                'raw_text': result['text'],
                'transcript': result['turns']
            }
            
        except Exception as e:
            job.status = 'error'
            job.error_message = f"Transcription failed: {str(e)}"
            media.status = 'error'
            db.commit()
            raise


@app.task(bind=True, name='backend.workers.tasks.enrich_with_gemini')
def enrich_with_gemini(self, transcribe_result: Optional[dict], job_id: str):
    """
    Step 4: Enrich with Gemini (summary, tags, embeddings)
    
    Returns: dict with ai_summary, tags, embedding
    """
    if transcribe_result is None:
        return None
    
    with get_db_context() as db:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        media = db.query(MediaItem).filter(MediaItem.id == job.media_id).first()
        
        job.status = 'enriching'
        job.current_stage = 'Gemini Analysis'
        job.progress_percent = 80
        db.commit()
        
        try:
            gemini = GeminiService()
            
            # Get enrichment from Gemini
            enrichment = gemini.enrich_transcript(transcribe_result['raw_text'])
            
            # Generate embedding
            embedding = generate_embedding(transcribe_result['raw_text'])
            
            # Update media
            media.ai_summary = enrichment['ai_summary']
            media.tags = enrichment['tags']
            media.embedding = embedding
            job.progress_percent = 90
            db.commit()
            
            return {
                'ai_summary': enrichment['ai_summary'],
                'tags': enrichment['tags'],
                'embedding': embedding
            }
            
        except Exception as e:
            job.status = 'error'
            job.error_message = f"Enrichment failed: {str(e)}"
            media.status = 'error'
            db.commit()
            raise


@app.task(bind=True, name='backend.workers.tasks.finalize_processing')
def finalize_processing(self, enrich_result: Optional[dict], job_id: str):
    """
    Step 5: Finalize processing - mark as completed
    """
    with get_db_context() as db:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        media = db.query(MediaItem).filter(MediaItem.id == job.media_id).first()
        
        if job.status != 'error':
            if media.status != 'duplicate':
                media.status = 'completed'
            job.status = 'completed'
            job.current_stage = 'Completed'
            job.progress_percent = 100
            db.commit()
        
        return {'status': 'completed', 'media_id': media.id}
