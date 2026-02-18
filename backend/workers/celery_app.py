"""
Celery application configuration
"""
from celery import Celery
from backend.config.settings import settings

# Create Celery app
app = Celery(
    'nexus_workers',
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=['backend.workers.tasks']
)

# Configuration
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    task_soft_time_limit=3300,  # 55 minutes soft limit
    worker_prefetch_multiplier=1,  # Process one task at a time
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks (memory cleanup)
)

app.conf.beat_schedule = {
    'sync-subscriptions-daily': {
        'task': 'backend.workers.tasks.sync_subscriptions_task',
        'schedule': 60 * 60 * 24,
    }
}

# Task routes (optional: split tasks across different queues)
app.conf.task_routes = {
    'backend.workers.tasks.extract_media': {'queue': 'extraction'},
    'backend.workers.tasks.transcribe_audio': {'queue': 'transcription'},
    'backend.workers.tasks.enrich_with_gemini': {'queue': 'enrichment'},
}

if __name__ == '__main__':
    app.start()
