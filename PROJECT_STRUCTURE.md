# Nexus v2.0 - Project Structure

```
Nexus/
│
├── 📁 backend/                    # Python Backend
│   ├── 📁 gateway/                # FastAPI Gateway
│   │   ├── main.py               # Main FastAPI app
│   │   ├── Dockerfile            # Gateway container
│   │   └── 📁 routers/           # API endpoints
│   │       ├── __init__.py
│   │       ├── health.py         # Health checks
│   │       ├── media.py          # Media processing API
│   │       ├── search.py         # Semantic search API
│   │       └── chat.py           # Chat with archive API
│   │
│   ├── 📁 workers/                # Celery Workers
│   │   ├── celery_app.py         # Celery config
│   │   ├── tasks.py              # Processing pipeline tasks
│   │   ├── Dockerfile            # Worker container
│   │   └── __init__.py
│   │
│   ├── 📁 services/               # Business Logic
│   │   ├── media_extractor.py    # yt-dlp + ffmpeg
│   │   ├── audio_dedup.py        # chromaprint fingerprinting
│   │   ├── whisper_service.py    # Whisper STT (API/local)
│   │   ├── gemini_service.py     # Gemini AI enrichment
│   │   ├── embeddings.py         # sentence-transformers
│   │   ├── chat_service.py       # RAG implementation
│   │   └── __init__.py
│   │
│   ├── 📁 db/                     # Database
│   │   ├── models.py             # SQLAlchemy models
│   │   ├── database.py           # Connection & session
│   │   └── __init__.py
│   │
│   ├── 📁 storage/                # Object Storage
│   │   ├── minio_client.py       # MinIO/S3 client
│   │   └── __init__.py
│   │
│   ├── 📁 config/                 # Configuration
│   │   ├── settings.py           # Pydantic settings
│   │   └── __init__.py
│   │
│   ├── requirements.txt          # Python dependencies
│   └── __init__.py
│
├── 📁 frontend/                   # React Frontend
│   ├── App.tsx                   # Main component
│   ├── index.tsx                 # Entry point
│   ├── types.ts                  # TypeScript types
│   ├── 📁 components/            # UI components
│   │   ├── Recorder.tsx
│   │   ├── FeedItem.tsx
│   │   └── Icons.tsx
│   ├── db.ts                     # ⚠️ OLD - to be replaced
│   ├── geminiService.ts          # ⚠️ OLD - to be replaced
│   ├── transcriptionService.ts   # ⚠️ OLD - to be replaced
│   ├── whisperService.ts         # ⚠️ OLD - to be replaced
│   ├── package.json              # Node dependencies
│   ├── vite.config.ts            # Vite config
│   ├── tsconfig.json             # TypeScript config
│   ├── index.html                # HTML template
│   └── Dockerfile                # Frontend container
│
├── 📁 docs/                       # Documentation
│   ├── ARCHITECTURE.md           # System architecture
│   └── IMPLEMENTATION_STATUS.md  # Implementation status
│
├── 📁 scripts/                    # Utility scripts
│   └── init.sh                   # Initialization script
│
├── docker-compose.yml            # Docker services
├── .env.example                  # Environment template
├── .gitignore                    # Git ignore rules
├── README.md                     # Main documentation
├── SUMMARY.md                    # Project summary
└── PROJECT_STRUCTURE.md          # This file
```

## 📊 File Count

| Category | Count | Lines of Code |
|----------|-------|---------------|
| Python files | 27 | ~3,500 |
| TypeScript/React | 12 | ~2,000 |
| Docker configs | 4 | ~150 |
| Documentation | 5 | ~1,500 |
| **Total** | **48** | **~7,150** |

## 🔑 Key Files

### Critical Backend Files

1. **backend/gateway/main.py** (157 lines)
   - FastAPI application
   - CORS configuration
   - Router registration
   - Lifespan events

2. **backend/workers/tasks.py** (250+ lines)
   - Complete processing pipeline
   - Celery task chain orchestration
   - Error handling & retry logic

3. **backend/db/models.py** (210 lines)
   - SQLAlchemy models
   - pgvector integration
   - Relationships & indexes

4. **backend/services/** (7 files)
   - Core business logic
   - External API integrations
   - Processing algorithms

### Critical Frontend Files

1. **frontend/App.tsx** (300+ lines)
   - Main UI component
   - ⚠️ Needs refactoring for new API

2. **frontend/types.ts** (60 lines)
   - TypeScript interfaces
   - Can be reused with new backend

### Configuration Files

1. **docker-compose.yml**
   - All services orchestration
   - Environment configuration
   - Volume management

2. **.env.example**
   - All configuration options
   - API keys placeholders

## 🔄 Data Flow

```
User Upload/URL
      ↓
Frontend (React)
      ↓
[HTTP POST /api/media/process]
      ↓
Gateway (FastAPI)
      ↓
Create Job in PostgreSQL
      ↓
Enqueue Task to Redis
      ↓
Worker picks up task
      ↓
Pipeline Execution:
  1. Extract Media (yt-dlp)
  2. Check Duplicate (chromaprint)
  3. Transcribe (Whisper)
  4. Enrich (Gemini)
  5. Generate Embeddings
      ↓
Store Results:
  - Audio → MinIO
  - Metadata → PostgreSQL
  - Vectors → pgvector
      ↓
Frontend polls job status
      ↓
Display in feed
```

## 🎨 Frontend Structure (Current)

```
frontend/
├── App.tsx                      # Main app (needs refactoring)
├── components/
│   ├── Recorder.tsx             # Audio recording UI
│   ├── FeedItem.tsx             # Media item display
│   └── Icons.tsx                # Icon components
├── OLD (to remove):
│   ├── db.ts                    # IndexedDB wrapper
│   ├── geminiService.ts         # Direct Gemini calls
│   ├── transcriptionService.ts  # Client-side transcription
│   └── whisperService.ts        # Client-side Whisper API
└── NEW (to create):
    ├── api/
    │   └── client.ts            # HTTP client for backend
    └── hooks/
        └── useJobStatus.ts      # Job status polling
```

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| postgres | 5432 | PostgreSQL + pgvector |
| redis | 6379 | Celery broker |
| minio | 9000, 9001 | Object storage + console |
| gateway | 8000 | FastAPI API |
| worker | - | Celery worker |
| frontend | 5173 | Vite dev server |

## 📦 Dependencies

### Backend (Python)

**Core:**
- fastapi - Web framework
- sqlalchemy - ORM
- psycopg2 - PostgreSQL driver
- pgvector - Vector similarity
- celery - Task queue
- redis - Queue broker

**Media Processing:**
- yt-dlp - Video download
- ffmpeg-python - Audio conversion
- pyacoustid - Audio fingerprinting
- faster-whisper - Local STT
- openai - Whisper API

**AI:**
- google-genai - Gemini API
- sentence-transformers - Embeddings

**Storage:**
- minio - S3 client

### Frontend (Node)

**Core:**
- react - UI library
- typescript - Type safety
- vite - Build tool

**UI:**
- tailwindcss - Styling
- lucide-react - Icons (via CDN)

**API:**
- To be added: axios or fetch wrapper

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables |
| `backend/config/settings.py` | Pydantic settings |
| `docker-compose.yml` | Service orchestration |
| `frontend/vite.config.ts` | Vite configuration |
| `frontend/tsconfig.json` | TypeScript config |

## 📝 Documentation Files

| File | Description |
|------|-------------|
| `README.md` | Main documentation |
| `SUMMARY.md` | Project overview |
| `PROJECT_STRUCTURE.md` | This file |
| `docs/ARCHITECTURE.md` | Detailed architecture |
| `docs/IMPLEMENTATION_STATUS.md` | Status & roadmap |

## ✅ Status Legend

- ✅ **Implemented** - Code written, ready to run
- ⚠️ **Needs Update** - Exists but needs refactoring
- ❌ **TODO** - Not implemented yet

### Backend Status
- ✅ Gateway API
- ✅ Worker tasks
- ✅ All services
- ✅ Database models
- ✅ Docker setup
- ❌ WebSocket
- ❌ Tests

### Frontend Status
- ⚠️ UI components (need API update)
- ❌ New API client
- ❌ Job status polling
- ❌ WebSocket connection

## 🎯 Next Steps

1. **Frontend Integration** (HIGH)
   - Create `frontend/api/client.ts`
   - Update `App.tsx` to use new API
   - Remove old IndexedDB code

2. **Testing** (MEDIUM)
   - Add `backend/tests/`
   - Unit tests for services
   - Integration tests for API

3. **WebSocket** (MEDIUM)
   - Add `backend/gateway/routers/websocket.py`
   - Real-time job updates

4. **Production** (LOW)
   - Add authentication
   - Add monitoring
   - Deploy configuration
