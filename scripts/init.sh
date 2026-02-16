#!/bin/bash
# Nexus initialization script

set -e

echo "🚀 Initializing Nexus..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your API keys:"
    echo "   - OPENAI_API_KEY"
    echo "   - GEMINI_API_KEY"
    exit 1
fi

# Start services
echo "🐳 Starting Docker services..."
docker-compose up -d postgres redis minio

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Initialize database
echo "🗄️  Initializing database..."
docker-compose exec -T gateway python -c "from backend.db.database import init_db; init_db()" || echo "Database already initialized"

# Start all services
echo "✅ Starting all services..."
docker-compose up -d

echo ""
echo "✅ Nexus is ready!"
echo ""
echo "📍 Access points:"
echo "   Frontend:     http://localhost:5173"
echo "   API Docs:     http://localhost:8000/docs"
echo "   MinIO Console: http://localhost:9001 (admin/admin)"
echo ""
echo "📊 Check status:"
echo "   docker-compose ps"
echo "   docker-compose logs -f gateway"
echo ""
