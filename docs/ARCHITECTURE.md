# Nexus Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend (React)                     │
│  - User Interface (SPA)                                      │
│  - File Upload / URL Input / Mic Recording                   │
│  - Real-time Status Updates (WebSocket)                      │
│  - Search & Chat Interface                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │ HTTP/WebSocket
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              Backend Gateway (FastAPI)                       │
│  - REST API Endpoints                                        │
│  - WebSocket Status Updates                                  │
│  - Authentication & Rate Limiting                            │
│  - Job Submission to Queue                                   │
└──────────────────┬──────────────────────────────────────────┘
                   │ Enqueue Tasks
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Redis Queue (Celery)                       │
│  - Task Distribution                                         │
│  - Priority Management                                       │
│  - Retry Logic                                               │
└──────────────────┬──────────────────────────────────────────┘
                   │ Pull Tasks
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker Services                          │
│                                                              │
│  ┌─────────────────────────────────────────────────┐        │
│  │ 1. Media Extractor Worker                       │        │
│  │    - yt-dlp for URL extraction                  │        │
│  │    - ffmpeg for media conversion                │        │
│  │    - Download → Convert → Store in MinIO        │        │
│  └─────────────────────────────────────────────────┘        │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────┐        │
│  │ 2. Audio Hash & Deduplication Worker            │        │
│  │    - Generate chromaprint fingerprint           │        │
│  │    - Check PostgreSQL for duplicates            │        │
│  │    - Skip if duplicate found                    │        │
│  └─────────────────────────────────────────────────┘        │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────┐        │
│  │ 3. Whisper STT Worker                           │        │
│  │    - faster-whisper (local) or OpenAI API       │        │
│  │    - Transcribe audio → raw text                │        │
│  │    - Extract speaker turns (if available)       │        │
│  └─────────────────────────────────────────────────┘        │
│                          │                                   │
│                          ▼                                   │
│  ┌─────────────────────────────────────────────────┐        │
│  │ 4. Gemini Enrichment Worker                     │        │
│  │    - Generate summary                            │        │
│  │    - Extract tags                                │        │
│  │    - Generate embeddings (pgvector)              │        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
└──────────────────┬──────────────────────────────────────────┘
                   │ Store Results
                   ▼
┌─────────────────────────────────────────────────────────────┐
│                  Storage Layer                               │
│                                                              │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │  PostgreSQL + pgvector│  │    MinIO (S3)        │        │
│  │  - Media metadata     │  │  - Audio files       │        │
│  │  - Transcripts        │  │  - Video files       │        │
│  │  - Summaries          │  │  - Thumbnails        │        │
│  │  - Tags               │  │                      │        │
│  │  - Embeddings (vector)│  │                      │        │
│  │  - Audio hashes       │  │                      │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

## Processing Pipeline

### Flow: User Input → Final Result

```
1. User Action (Frontend)
   ↓
2. API Request (Gateway)
   POST /api/media/process
   {
     "source": "url|file|mic",
     "data": "..."
   }
   ↓
3. Create Job Record (PostgreSQL)
   status: "pending"
   ↓
4. Enqueue Task (Redis/Celery)
   task_id = worker.process_media.delay(job_id)
   ↓
5. Worker Chain Execution:
   
   A. Media Extraction
      - Download/receive media
      - Convert to standard format (wav/mp3)
      - Upload to MinIO
      - Update job: status="extracting"
   
   B. Audio Hashing
      - Generate chromaprint fingerprint
      - Query PostgreSQL for existing hash
      - If duplicate found:
        * Link to existing item
        * Mark job as "duplicate"
        * STOP pipeline
      - Else: continue
   
   C. Whisper Transcription
      - Download audio from MinIO
      - Run faster-whisper or call API
      - Extract text + speaker turns
      - Update job: status="transcribing"
   
   D. Gemini Enrichment
      - Send transcript to Gemini
      - Get: summary, tags, refined speakers
      - Generate embeddings
      - Update job: status="enriching"
   
   E. Finalization
      - Store all results in PostgreSQL
      - Update job: status="completed"
      - Notify frontend via WebSocket
   
   ↓
6. Frontend Update
   - Receive status via WebSocket
   - Show new item in feed
```

## Component Details

### Backend Gateway (FastAPI)

**Responsibilities:**
- HTTP REST API
- WebSocket for real-time updates
- Job submission to Celery
- Authentication (future)
- Rate limiting (future)

**Key Endpoints:**
```
POST   /api/media/process          # Submit new media
GET    /api/media                  # List all media
GET    /api/media/{id}             # Get single item
DELETE /api/media/{id}             # Delete item
POST   /api/search                 # Semantic search
POST   /api/chat                   # Chat with archive
WS     /ws/status/{job_id}         # Real-time job status
```

### Worker Services (Celery)

**Task Structure:**
```python
# Main orchestrator task
@app.task
def process_media(job_id: str):
    """Main pipeline orchestrator"""
    # Chain: extract → hash → transcribe → enrich
    chain = (
        extract_media.s(job_id) |
        check_duplicate.s() |
        transcribe_audio.s() |
        enrich_with_gemini.s()
    )
    return chain()

# Individual worker tasks
@app.task
def extract_media(job_id: str) -> dict:
    """Download and convert media"""
    pass

@app.task
def check_duplicate(extract_result: dict) -> dict:
    """Check audio fingerprint for duplicates"""
    pass

@app.task
def transcribe_audio(dedup_result: dict) -> dict:
    """Whisper STT"""
    pass

@app.task
def enrich_with_gemini(transcript_result: dict) -> dict:
    """Generate summary, tags, embeddings"""
    pass
```

### Database Schema (PostgreSQL + pgvector)

```sql
-- Media items table
CREATE TABLE media_items (
    id UUID PRIMARY KEY,
    title VARCHAR(500),
    type VARCHAR(50),  -- audio, video, youtube, etc.
    source_type VARCHAR(50),  -- mic_audio, uploaded_audio, youtube_url, link
    source_url TEXT,
    duration INTEGER,
    audio_hash VARCHAR(64),  -- chromaprint fingerprint
    raw_text TEXT,
    transcript JSONB,  -- speaker turns
    ai_summary TEXT,
    tags TEXT[],
    embedding VECTOR(768),  -- pgvector for semantic search
    status VARCHAR(50),
    created_at TIMESTAMP,
    imported_at TIMESTAMP,
    minio_path VARCHAR(500)
);

-- Audio hash index for deduplication
CREATE INDEX idx_audio_hash ON media_items(audio_hash);

-- Vector similarity search index
CREATE INDEX idx_embedding ON media_items USING ivfflat (embedding vector_cosine_ops);

-- Processing jobs table
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY,
    media_id UUID REFERENCES media_items(id),
    status VARCHAR(50),  -- pending, extracting, transcribing, enriching, completed, error
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    celery_task_id VARCHAR(255)
);

-- Chat history table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    role VARCHAR(20),  -- user, assistant
    text TEXT,
    timestamp TIMESTAMP,
    context_media_ids UUID[]  -- which media items were used for context
);
```

### Storage Layer (MinIO)

**Bucket Structure:**
```
nexus-media/
├── audio/
│   ├── {media_id}.wav
│   └── {media_id}.mp3
├── video/
│   └── {media_id}.mp4
└── thumbnails/
    └── {media_id}.jpg
```

## Technology Stack

### Backend
- **Framework**: FastAPI (async HTTP/WebSocket)
- **Task Queue**: Celery + Redis
- **ORM**: SQLAlchemy
- **Migrations**: Alembic

### Workers
- **Media Extraction**: yt-dlp, ffmpeg
- **STT**: faster-whisper (local) or OpenAI Whisper API
- **Audio Fingerprinting**: chromaprint (pyacoustid)
- **LLM**: Google Gemini Flash API
- **Embeddings**: sentence-transformers or Gemini embeddings

### Storage
- **Database**: PostgreSQL 15+
- **Vector Search**: pgvector extension
- **Object Storage**: MinIO (S3-compatible)

### Frontend
- **Framework**: React 19 + TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS
- **State**: React hooks + Context API

## Deployment

### Development (Docker Compose)
```yaml
services:
  postgres:
    image: pgvector/pgvector:pg15
  redis:
    image: redis:7-alpine
  minio:
    image: minio/minio
  backend:
    build: ./backend/gateway
  worker:
    build: ./backend/workers
  frontend:
    build: ./frontend
```

### Production
- **Backend**: Kubernetes or Docker Swarm
- **Database**: Managed PostgreSQL (AWS RDS, Supabase)
- **Storage**: AWS S3 or self-hosted MinIO
- **Queue**: Managed Redis (AWS ElastiCache)
- **Frontend**: Vercel or Cloudflare Pages

## Security Considerations

- API keys stored in environment variables
- Rate limiting on API endpoints
- Authentication with JWT (future)
- Input validation and sanitization
- CORS properly configured
- Audio file size limits
- Storage quota management

## Performance Optimizations

- Celery worker concurrency tuning
- PostgreSQL connection pooling
- MinIO CDN integration
- Frontend lazy loading
- Batch embeddings generation
- Query result caching (Redis)

## Migration from Current System

### Data Migration Script
```python
# Migrate from IndexedDB to PostgreSQL
# 1. Export IndexedDB data
# 2. Transform to new schema
# 3. Import into PostgreSQL
# 4. Re-generate embeddings
```

## Next Steps

1. **Phase 1**: Core Backend (Gateway + Basic Workers)
2. **Phase 2**: Deduplication & MinIO Integration
3. **Phase 3**: Vector Search & Embeddings
4. **Phase 4**: Frontend Integration
5. **Phase 5**: Production Deployment
