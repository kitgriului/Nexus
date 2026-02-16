"""
Whisper STT service - supports both local (faster-whisper) and API mode
"""
from typing import Dict, List
from backend.config.settings import settings


class WhisperService:
    """Transcribe audio using Whisper"""
    
    def __init__(self):
        self.mode = settings.WHISPER_MODE  # 'local' or 'api'
        self.model_name = settings.WHISPER_MODEL
        
        if self.mode == 'local':
            from faster_whisper import WhisperModel
            self.model = WhisperModel(
                self.model_name,
                device="cpu",  # or "cuda" for GPU
                compute_type="int8"
            )
        elif self.mode == 'api':
            from openai import OpenAI
            self.client = OpenAI(api_key=settings.OPENAI_API_KEY)
    
    def transcribe(self, audio_path: str) -> Dict[str, any]:
        """
        Transcribe audio file
        
        Returns:
            dict: {
                'text': str,  # Full transcript
                'turns': list[dict]  # Speaker turns (if available)
            }
        """
        if self.mode == 'local':
            return self._transcribe_local(audio_path)
        elif self.mode == 'api':
            return self._transcribe_api(audio_path)
        else:
            raise ValueError(f"Invalid whisper mode: {self.mode}")
    
    def _transcribe_local(self, audio_path: str) -> Dict[str, any]:
        """Transcribe using faster-whisper (local)"""
        segments, info = self.model.transcribe(
            audio_path,
            language="ru",  # or None for auto-detect
            beam_size=5
        )
        
        # Collect segments
        full_text = []
        turns = []
        
        for segment in segments:
            full_text.append(segment.text)
            turns.append({
                'speaker': 'Speaker',  # faster-whisper doesn't do diarization by default
                'text': segment.text,
                'start_time': segment.start,
                'end_time': segment.end
            })
        
        return {
            'text': ' '.join(full_text),
            'turns': turns
        }
    
    def _transcribe_api(self, audio_path: str) -> Dict[str, any]:
        """Transcribe using OpenAI Whisper API"""
        with open(audio_path, 'rb') as audio_file:
            response = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )
        
        # Extract segments
        turns = []
        if hasattr(response, 'segments') and response.segments:
            for segment in response.segments:
                turns.append({
                    'speaker': 'Speaker',
                    'text': segment['text'],
                    'start_time': segment['start'],
                    'end_time': segment['end']
                })
        
        return {
            'text': response.text,
            'turns': turns if turns else [{
                'speaker': 'Speaker',
                'text': response.text,
                'start_time': 0,
                'end_time': 0
            }]
        }
