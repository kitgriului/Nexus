FROM python:3.11-slim

# Install system dependencies
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

# Expose port
EXPOSE 8000

# Run FastAPI
CMD ["uvicorn", "backend.gateway.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
