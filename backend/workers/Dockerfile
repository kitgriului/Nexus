FROM python:3.11-slim

# Install system dependencies (ffmpeg, yt-dlp, chromaprint)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libchromaprint-tools \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY backend /app/backend

# Default command (can be overridden in docker-compose)
CMD ["celery", "-A", "backend.workers.celery_app", "worker", "--loglevel=info"]
