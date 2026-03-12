#!/bin/bash
# =============================================================================
# Nexus MVP — скрипт запуска всего стека на хосте
# =============================================================================
# Требования:
#   - Docker запущен (sudo dockerd &)
#   - PostgreSQL, Redis, MinIO — в Docker
#   - Gateway и Celery worker — на хосте (для доступа к интернету)
#   - Frontend — в Docker
#
# Использование:
#   chmod +x scripts/start-mvp.sh
#   ./scripts/start-mvp.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🚀 Запуск Nexus MVP..."

# ─── 1. Переменные окружения ──────────────────────────────────────────────────
export DATABASE_URL="postgresql://nexus:nexus@localhost:5433/nexus"
export REDIS_URL="redis://localhost:6380/0"
export CELERY_BROKER_URL="redis://localhost:6380/0"
export CELERY_RESULT_BACKEND="redis://localhost:6380/1"
export MINIO_ENDPOINT="localhost:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
export ENV="development"
export WHISPER_MODE="api"

# OPENAI_API_KEY и OPENAI_BASE_URL должны быть в окружении или в .env
if [ -f "$PROJECT_DIR/.env" ]; then
    set -a
    source "$PROJECT_DIR/.env"
    set +a
fi

if [ -z "$OPENAI_API_KEY" ]; then
    echo "❌ OPENAI_API_KEY не задан! Добавьте его в .env или окружение."
    exit 1
fi

# ─── 2. Остановка старых процессов ───────────────────────────────────────────
echo "🛑 Останавливаем старые процессы..."
pkill -f "uvicorn backend.gateway" 2>/dev/null || true
pkill -f "celery.*worker" 2>/dev/null || true
sleep 2

# ─── 3. Инфраструктура (Docker) ──────────────────────────────────────────────
echo "🐳 Запускаем инфраструктуру (PostgreSQL, Redis, MinIO)..."
sudo -E docker compose up -d postgres redis minio 2>&1 | tail -5

# Ждём готовности PostgreSQL
echo "⏳ Ожидаем PostgreSQL..."
for i in $(seq 1 30); do
    if sudo docker exec nexus-postgres pg_isready -U nexus -d nexus -q 2>/dev/null; then
        echo "✅ PostgreSQL готов"
        break
    fi
    sleep 1
done

# ─── 4. Gateway (FastAPI) ─────────────────────────────────────────────────────
echo "🌐 Запускаем Gateway (FastAPI)..."
nohup python3 -m uvicorn backend.gateway.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --reload \
    > /tmp/gateway.log 2>&1 &
GATEWAY_PID=$!
echo "   Gateway PID: $GATEWAY_PID"

# Ждём запуска gateway
for i in $(seq 1 20); do
    if curl -s --max-time 2 http://localhost:8000/api/health > /dev/null 2>&1; then
        echo "✅ Gateway запущен на http://localhost:8000"
        break
    fi
    sleep 1
done

# ─── 5. Celery Worker ─────────────────────────────────────────────────────────
echo "⚙️  Запускаем Celery Worker..."
nohup python3 -m celery -A backend.workers.celery_app worker \
    --loglevel=warning \
    --concurrency=2 \
    -Q celery,default,extraction,transcription,enrichment \
    > /tmp/celery.log 2>&1 &
WORKER_PID=$!
echo "   Worker PID: $WORKER_PID"

# ─── 6. Frontend (Docker) ─────────────────────────────────────────────────────
echo "🎨 Запускаем Frontend..."
sudo -E docker compose up -d frontend 2>&1 | tail -3

sleep 3

# ─── 7. Итог ─────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "✅ Nexus MVP запущен!"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "  🌐 Frontend:  http://localhost:5173"
echo "  🔌 API:       http://localhost:8000"
echo "  📚 API Docs:  http://localhost:8000/docs"
echo ""
echo "  Логи Gateway: tail -f /tmp/gateway.log"
echo "  Логи Worker:  tail -f /tmp/celery.log"
echo ""
echo "  Для остановки: pkill -f uvicorn; pkill -f celery"
echo "═══════════════════════════════════════════════════════"
