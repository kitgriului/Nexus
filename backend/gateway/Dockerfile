FROM python:3.11-slim

# Install minimal system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy lightweight requirements (no ML/torch/whisper)
COPY backend/requirements-gateway.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements-gateway.txt

# Copy application code
COPY backend /app/backend

# Expose port
EXPOSE 8000

# Run FastAPI
CMD ["uvicorn", "backend.gateway.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
