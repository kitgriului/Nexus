# Changelog

All notable changes to Nexus will be documented in this file.

## [2.1.0] - 2026-02-17

### 🐛 Critical Bug Fixes

#### Chat Endpoint 502 Error Resolution
- **Issue**: Chat endpoint (`POST /api/chat`) returning 502 Bad Gateway despite valid API key
- **Root Cause**: Configuration used model `gemini-2.0-flash-exp` which doesn't exist in Gemini API
- **Solution**: Updated to valid model `gemini-2.0-flash` in `backend/config/settings.py`
- **Impact**: Chat functionality now fully operational across all environments

#### Testing & Verification
- ✅ All API endpoints operational (health, media, search, chat)
- ✅ Database vector search working correctly
- ✅ Gemini API integration stable with valid model
- ✅ Complete end-to-end functionality validated

### 📝 Documentation Updates
- Added comprehensive resolution summary with diagnostics
- Updated DONE.md with v2.1 release notes
- Documented Gemini model discovery and fix process

### 🔧 Technical Details
- Validated 35+ available Gemini models via API
- Confirmed model `gemini-2.0-flash` is stable and supported
- No performance impact from model switch (same tier)

---

## [2.0.0] - 2026-02-17

### 🔧 Bug Fixes & Production Readiness

Critical fixes to ensure proper deployment and functionality:

#### Fixed Issues
- **Frontend Port**: Corrected Vite dev server port from 3000 to 5173 (matches docker-compose mapping)
- **SQLAlchemy 2.x**: All raw SQL queries now wrapped in `text()` for compatibility  
- **Gemini Integration**: Updated to google-genai client library
- **Database Indexes**: Resolved duplicate index name conflicts
- **API Routing**: Fixed relative paths for proper Docker networking
- **Whisper Mode**: Switched to local mode by default (no API key required)

#### Status
- ✅ Docker builds and all services start successfully
- ✅ API endpoints functional at http://localhost:8000/docs
- ✅ Frontend accessible at http://localhost:5173
- ⚠️ AI features require GEMINI_API_KEY (set in .env)

---

## [2.0.0 Initial] - 2026-02-16

### 🎉 Complete Architecture Rewrite

Production-ready refactoring from browser-only SPA to full-stack application.

### ✨ Added

#### Backend
- **FastAPI Gateway** (`backend/gateway/`)
  - RESTful API with automatic OpenAPI docs
  - CORS middleware for frontend integration
  - WebSocket endpoint for real-time updates (`/ws`)
  - Health check, media, search, chat routers
  
- **Celery Workers** (`backend/workers/`)
  - Async task pipeline: extract → dedupe → transcribe → enrich
  - Job status tracking in PostgreSQL
  - Error handling and retry logic
  
- **Service Layer** (`backend/services/`)
  - `media_extractor.py` - yt-dlp wrapper for audio extraction
  - `audio_dedup.py` - Chromaprint fingerprinting
  - `whisper_service.py` - faster-whisper integration
  - `gemini_service.py` - AI summaries, tags, embeddings
  - `embedding_service.py` - Text embedding generation
  - `chat_service.py` - RAG-based chat with vector search
  
- **Database Layer** (`backend/db/`)
  - SQLAlchemy models with pgvector support
  - Tables: MediaItem, ProcessingJob, ChatMessage, Subscription
  - Vector similarity search indexes
  
- **Storage** (`backend/storage/`)
  - MinIO S3-compatible object storage for audio files

#### Frontend
- **WebSocket Service** (`frontend/services/websocket.ts`)
  - Real-time job status updates
  - Automatic reconnection with exponential backoff
  - Subscribe/unsubscribe to specific jobs
  
- **JobStatus Component** (`frontend/components/JobStatus.tsx`)
  - Visual progress tracking with progress bar
  - Status icons (⏳ pending, ⚙️ processing, ✅ completed, ❌ failed)
  - Error message display
  
- **Updated API Client** (`frontend/api/client.ts`)
  - Full backend integration
  - TypeScript interfaces for all endpoints
  - Proper error handling

#### Infrastructure
- **Docker Compose** (`docker-compose.yml`)
  - Multi-service orchestration
  - Services: postgres, redis, minio, gateway, worker, frontend
  - Volume persistence for data
  - Health checks for all services
  
- **Documentation**
  - `README.md` - Complete setup and usage guide
  - `docs/ARCHITECTURE.md` - System architecture overview
  - `QUICKSTART.md` - Quick start guide
  - `PUSH_TO_GITHUB.md` - Deployment instructions

### 🔥 Removed

- `frontend/db.ts` - Replaced with backend PostgreSQL
- `frontend/geminiService.ts` - Moved to backend services
- `frontend/whisperService.ts` - Moved to backend services
- `frontend/transcriptionService.ts` - Consolidated into backend
- `frontend/App-old.tsx` - Cleaned up old version
- Direct API calls from frontend (security issue)
- Exposed API keys in frontend code

### 🔄 Changed

#### Processing Pipeline
- **Old**: Recording → Whisper API → Gemini → IndexedDB
- **New**: URL/file → extract → dedupe → transcribe → enrich → PostgreSQL+MinIO

#### Data Storage
- **Old**: IndexedDB (browser-only, limited)
- **New**: PostgreSQL with pgvector (persistent, scalable, searchable)

#### Transcription
- **Old**: OpenAI Whisper API (expensive, API-dependent)
- **New**: faster-whisper (local, fast, cost-effective)

#### Real-time Updates
- **Old**: Manual polling with `pollJobStatus()`
- **New**: WebSocket push notifications

### 🎯 Technical Details

#### Tech Stack
- **Backend**: FastAPI, Celery, SQLAlchemy, Alembic
- **Workers**: Celery with Redis broker
- **Database**: PostgreSQL 15 with pgvector extension
- **Storage**: MinIO (S3-compatible)
- **STT**: faster-whisper (CTranslate2-optimized Whisper)
- **AI**: Google Gemini 2.0 Flash Exp
- **Frontend**: React 18, TypeScript, Vite
- **Container**: Docker & Docker Compose

#### Performance Improvements
- Async processing pipeline (non-blocking)
- Audio deduplication (saves processing time/cost)
- Local Whisper model (no API rate limits)
- Vector search with HNSW indexes (fast semantic search)
- MinIO object storage (scalable media storage)

#### Security Improvements
- API keys moved to backend `.env`
- No sensitive data in frontend code
- CORS properly configured
- Secure file upload handling
- Job ownership and access control ready

### 🐛 Bug Fixes
- Fixed CORS issues with proper middleware
- Resolved duplicate processing with fingerprinting
- Fixed memory leaks in WebSocket connections
- Proper error propagation from workers to frontend

### 📝 Migration Notes

For users upgrading from v1.x:

1. **Data Migration Required**: IndexedDB data won't auto-migrate
   - Export existing data before upgrading
   - Re-process audio through new pipeline
   
2. **Environment Setup**: Create `.env` file with required variables
   - See `README.md` for full list
   
3. **Docker Required**: New version runs in containers
   - Install Docker and Docker Compose
   
4. **API Keys**: Move API keys from frontend to backend `.env`

### 🚀 What's Next (v2.1)

- [ ] Authentication & authorization
- [ ] Rate limiting
- [ ] Webhook support for external integrations
- [ ] Mobile app (React Native)
- [ ] Advanced search filters
- [ ] Batch processing UI
- [ ] Export functionality (JSON, CSV, PDF)
- [ ] Podcast feed subscription
- [ ] Audio player with timestamps
- [ ] Collaborative features (share archives)

---

## [1.0.0] - 2025 (Legacy)

Initial browser-only SPA version.

### Features
- Audio recording
- Whisper API transcription
- Gemini enrichment
- IndexedDB storage
- Basic search

### Known Issues
- Browser-only (no backend)
- Exposed API keys
- No deduplication
- Limited storage
- No real-time updates
