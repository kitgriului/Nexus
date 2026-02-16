# 🚀 Пошаговая инструкция запуска Nexus v2.0

## Что нужно сделать:

### 1️⃣ Получить API ключи

#### Gemini API Key (ОБЯЗАТЕЛЬНО)
1. Открой: https://aistudio.google.com/app/apikey
2. Нажми **"Create API Key"**
3. Скопируй ключ (выглядит как `AIzaSy...`)

#### OpenAI API Key (ОПЦИОНАЛЬНО)
Нужен только если хочешь использовать Whisper API вместо локального faster-whisper.

1. Открой: https://platform.openai.com/api-keys
2. Создай ключ
3. Скопируй (выглядит как `sk-...`)

---

### 2️⃣ Клонировать проект

```bash
git clone https://github.com/kitgriului/Nexus.git
cd Nexus
```

---

### 3️⃣ Создать файл `.env`

**Вариант A: Скопировать пример**
```bash
cp .env.example .env
```

**Вариант B: Создать вручную**
```bash
nano .env  # или любой редактор
```

#### Вставь в `.env`:

```env
# DATABASE
POSTGRES_USER=nexus
POSTGRES_PASSWORD=nexus_secure_password_123
POSTGRES_DB=nexus
DATABASE_URL=postgresql://nexus:nexus_secure_password_123@postgres:5432/nexus

# REDIS
REDIS_URL=redis://redis:6379/0

# MINIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=nexus-media
MINIO_SECURE=false

# API KEYS - ВСТАВЬ СВОИ КЛЮЧИ СЮДА! 👇
GEMINI_API_KEY=AIzaSy...твой_ключ_сюда
OPENAI_API_KEY=sk-...твой_ключ_сюда_или_оставь_пустым

# API
API_HOST=0.0.0.0
API_PORT=8000
API_PREFIX=/api
DEBUG=false
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173","http://localhost:8000"]

# WHISPER
WHISPER_MODEL=small
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8

# GEMINI
GEMINI_MODEL=gemini-2.0-flash-exp
VECTOR_DIMENSION=768

# CELERY
CELERY_BROKER_URL=redis://redis:6379/0
CELERY_RESULT_BACKEND=redis://redis:6379/0

# LOGGING
LOG_LEVEL=INFO
```

**ВАЖНО**: Замени `GEMINI_API_KEY=AIzaSy...` на свой настоящий ключ!

---

### 4️⃣ Запустить Docker

```bash
docker-compose up -d
```

Это запустит:
- ✅ PostgreSQL (база данных)
- ✅ Redis (очередь задач)
- ✅ MinIO (хранилище файлов)
- ✅ FastAPI Gateway (API сервер)
- ✅ Celery Worker (обработка медиа)
- ✅ Frontend (React приложение)

---

### 5️⃣ Проверить что всё запустилось

```bash
docker-compose ps
```

Должны быть все сервисы в статусе `Up`.

Если что-то не запустилось:
```bash
docker-compose logs [имя_сервиса]
# Например:
docker-compose logs gateway
docker-compose logs worker
```

---

### 6️⃣ Открыть приложение

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001
  - Login: `minioadmin`
  - Password: `minioadmin123`

---

## 🎯 Быстрый тест

1. Открой http://localhost:5173
2. Нажми **"Record"** (разреши микрофон)
3. Скажи что-нибудь
4. Нажми **"Stop"**
5. Увидишь прогресс обработки (WebSocket в реальном времени!)
6. Через 10-30 секунд появится транскрипция + AI summary + теги

---

## 🐛 Проблемы?

### База данных не запускается
```bash
docker-compose down
docker volume rm nexus_postgres_data
docker-compose up -d
```

### Worker не обрабатывает задачи
```bash
docker-compose logs worker
# Проверь что Gemini API key правильный
```

### Frontend не подключается к API
Проверь в `.env`:
```env
CORS_ORIGINS=["http://localhost:5173"]
```

### Transcription не работает
- Проверь что ffmpeg установлен в worker контейнере
- Попробуй меньшую модель Whisper: `WHISPER_MODEL=tiny`

---

## 📊 Мониторинг

### Celery задачи
```bash
docker-compose exec worker celery -A workers.tasks inspect active
```

### Логи в реальном времени
```bash
docker-compose logs -f gateway
docker-compose logs -f worker
```

### Статус базы данных
```bash
docker-compose exec postgres psql -U nexus -d nexus -c "SELECT COUNT(*) FROM media_items;"
```

---

## 🛑 Остановить всё

```bash
docker-compose down
```

Удалить все данные (база, файлы):
```bash
docker-compose down -v
```

---

## ✅ Checklist "Готово к работе"

- [ ] Docker установлен и запущен
- [ ] Получен Gemini API key
- [ ] Создан файл `.env` с ключами
- [ ] Запущен `docker-compose up -d`
- [ ] Все сервисы в статусе `Up`
- [ ] Frontend открывается на http://localhost:5173
- [ ] API docs доступны на http://localhost:8000/docs
- [ ] Тестовая запись обработалась успешно

---

Если всё ✅ — **приложение готово к использованию!** 🎉
