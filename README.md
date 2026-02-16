# Nexus v2.0 - AI Media Archive

Production-ready media processing and archival system with semantic search and RAG-based chat.

## Features

- 🎙️ **Audio Recording & Upload** - Record directly or upload audio files
- 🔗 **URL Processing** - Extract audio from YouTube, podcasts, and more
- 🎯 **Audio Deduplication** - Chromaprint fingerprinting to avoid duplicates
- 🗣️ **Whisper Transcription** - Fast, accurate STT using faster-whisper
- 🤖 **AI Enrichment** - Automatic summaries and tags via Gemini Flash
- 🔍 **Semantic Search** - Vector-based search with pgvector
- 💬 **RAG Chat** - Ask questions about your archive
- ⚡ **Real-time Updates** - WebSocket-based progress tracking
- 🐳 **Docker-ready** - Full stack in docker-compose

## Architecture

```
Frontend (React + Vite)
    ↓ HTTP/WebSocket
Gateway (FastAPI)
    ↓ Redis Queue
Workers (Celery)
    ↓
PostgreSQL + pgvector | MinIO (S3)
```

### Pipeline

1. **Extract** → yt-dlp downloads audio
2. **Deduplicate** → chromaprint fingerprint check
3. **Transcribe** → faster-whisper STT
4. **Enrich** → Gemini summary + tags + embeddings
5. **Store** → PostgreSQL metadata + MinIO audio

## Quick Start

### Prerequisites

- Docker & Docker Compose
- OpenAI API key (for Whisper API fallback, optional)
- Google Gemini API key

### 1. Clone & Configure

```bash
git clone https://github.com/kitgriului/nexus-chat.git
cd nexus-chat
```

Create `.env` file:

```env
# Database
POSTGRES_USER=nexus
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=nexus
DATABASE_URL=postgresql://nexus:your_secure_password@postgres:5432/nexus

# Redis
REDIS_URL=redis://redis:6379/0

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=nexus-media

# API Keys
GEMINI_API_KEY=your_gemini_key_here

# Optional: Whisper API fallback
OPENAI_API_KEY=your_openai_key

# API
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```

### 2. Start Services

```bash
docker-compose up -d
```

Services:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs
- MinIO Console: http://localhost:9001

### 3. Use the App

1. **Record** - Click "Record" button, speak, click "Stop"
2. **Upload** - Click "Upload" and select audio file
3. **Add Link** - Go to "LINK" tab, paste YouTube/podcast URL
4. **Search** - Use semantic search to find content
5. **Chat** - Ask questions about your archive in "CHAT" tab

## Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run gateway
uvicorn gateway.main:app --reload

# Run worker
celery -A workers.tasks worker --loglevel=info
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
nexus-chat/
├── backend/
│   ├── config/          # Settings & environment
│   ├── db/              # SQLAlchemy models
│   ├── gateway/         # FastAPI app & routers
│   ├── services/        # Media, Whisper, Gemini, etc.
│   ├── storage/         # MinIO client
│   └── workers/         # Celery tasks
├── frontend/
│   ├── api/             # API client
│   ├── components/      # React components
│   ├── services/        # WebSocket service
│   └── App.tsx          # Main app
├── docs/                # Architecture & guides
├── docker-compose.yml   # Full stack
└── README.md
```

## API Endpoints

### Media
- `POST /api/media/process/url` - Process media from URL
- `POST /api/media/process/upload` - Upload and process file
- `GET /api/media` - List all media
- `GET /api/media/{id}` - Get media details
- `DELETE /api/media/{id}` - Delete media
- `GET /api/media/{id}/job` - Get processing job status

### Search
- `POST /api/search` - Semantic search
- `POST /api/search/tags` - Tag-based search

### Chat
- `POST /api/chat` - Ask question (RAG)
- `GET /api/chat/history` - Get chat history

### WebSocket
- `WS /ws` - Real-time job status updates

## Configuration

See `backend/config/settings.py` for all available settings.

Key settings:
- `WHISPER_MODEL` - Whisper model size (tiny/base/small/medium/large)
- `GEMINI_MODEL` - Gemini model (gemini-2.0-flash-exp)
- `VECTOR_DIMENSION` - Embedding dimension (768 for Gemini)
- `CELERY_BROKER_URL` - Redis URL for Celery

## Deployment

### Production Checklist

- [ ] Change default passwords in `.env`
- [ ] Set `DEBUG=false`
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS (nginx reverse proxy)
- [ ] Configure database backups
- [ ] Set up monitoring (Sentry, Prometheus)
- [ ] Configure log aggregation
- [ ] Set resource limits in docker-compose

### Scaling

- **Horizontal**: Add more Celery workers
- **Database**: Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
- **Storage**: Use S3-compatible cloud storage
- **Cache**: Add Redis caching layer
- **CDN**: Serve frontend through CDN

## Troubleshooting

### Database connection issues
```bash
docker-compose logs postgres
```

### Celery tasks not running
```bash
docker-compose logs worker
celery -A workers.tasks inspect active
```

### Audio extraction fails
- Check yt-dlp is up to date: `pip install -U yt-dlp`
- Check ffmpeg is installed
- Verify URL is accessible

### Transcription quality issues
- Try larger Whisper model (medium/large)
- Check audio quality
- Verify language parameter

## License

MIT

## Contributing

PRs welcome! Please:
1. Fork the repo
2. Create feature branch
3. Add tests
4. Submit PR

## Credits

Built with:
- [FastAPI](https://fastapi.tiangolo.com/)
- [Celery](https://docs.celeryproject.org/)
- [faster-whisper](https://github.com/guillaumekln/faster-whisper)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [pgvector](https://github.com/pgvector/pgvector)
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)

---

Made with ❤️ for personal knowledge management
