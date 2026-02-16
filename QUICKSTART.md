# Nexus v2.0 - Quick Start Guide

## 🚀 Быстрый старт (MVP)

### Шаг 1: Получи код

**Вариант A: Через Git (рекомендуется)**
```bash
git clone https://github.com/kitgriului/Nexus.git
cd Nexus
git pull origin main  # Убедись что последняя версия
```

**Вариант B: Скачай архив из Telegram**
- Распакуй `nexus-v2-complete.tar.gz`
- Перейди в папку `Nexus`

---

### Шаг 2: Настрой окружение

```bash
# Создай .env файл
cp .env.example .env
```

**Отредактируй `.env`** - добавь свои API ключи:
```env
OPENAI_API_KEY=sk-proj-your-key-here
GEMINI_API_KEY=your-gemini-key-here
```

---

### Шаг 3: Запусти через Docker

**Убедись что Docker Desktop запущен**, затем:

```bash
# Запусти всё одной командой
docker-compose up -d

# Подожди ~30 секунд пока всё поднимется

# Инициализируй базу данных
docker-compose exec gateway python -c "from backend.db.database import init_db; init_db()"
```

---

### Шаг 4: Открой приложение

Открой в браузере:
- **Frontend (UI)**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **MinIO Console**: http://localhost:9001 (login: minioadmin / minioadmin)

---

## ✅ Проверка что всё работает

### Проверь статус сервисов
```bash
docker-compose ps
```

Все должны быть `Up`:
- nexus-postgres
- nexus-redis
- nexus-minio
- nexus-gateway
- nexus-worker
- nexus-frontend

### Проверь логи
```bash
# Все логи
docker-compose logs

# Только gateway
docker-compose logs gateway

# Только worker
docker-compose logs worker

# Follow mode (real-time)
docker-compose logs -f gateway
```

---

## 🎬 Как использовать (MVP)

### 1. Запись с микрофона
1. Открой http://localhost:5173
2. Нажми на иконку микрофона (красная кнопка)
3. Разреши доступ к микрофону
4. Говори что-нибудь
5. Нажми снова чтобы остановить
6. Подожди ~30 секунд - увидишь прогресс обработки
7. Готово! Транскрипт появится в ленте

### 2. YouTube URL
1. Открой http://localhost:5173
2. Введи YouTube URL в поле ввода, например:
   `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
3. Нажми Enter или кнопку со стрелкой
4. Подожди 1-3 минуты (зависит от длины видео)
5. Готово! Транскрипт появится в ленте

### 3. Чат с архивом
1. Переключись на вкладку "CHAT"
2. Задай вопрос, например:
   "О чём было последнее видео?"
3. AI ответит используя контекст из твоего архива

### 4. Семантический поиск
- API endpoint: `POST http://localhost:8000/api/search`
- Body: `{"query": "твой запрос", "limit": 10}`
- Найдёт похожие по смыслу записи

---

## 🐛 Troubleshooting

### Проблема: "Cannot connect to Docker daemon"
**Решение:**
- Запусти Docker Desktop
- Windows: проверь что WSL 2 включен
- Mac: проверь что Docker Desktop запущен

### Проблема: "Port 5173 already in use"
**Решение:**
```bash
# Останови что занимает порт
docker-compose down

# Или измени порт в docker-compose.yml
# frontend -> ports: "5174:5173"
```

### Проблема: "Connection refused to localhost:8000"
**Решение:**
```bash
# Проверь что gateway запущен
docker-compose ps gateway

# Проверь логи
docker-compose logs gateway

# Перезапусти
docker-compose restart gateway
```

### Проблема: Worker не обрабатывает задачи
**Решение:**
```bash
# Проверь логи worker
docker-compose logs worker

# Проверь что Redis работает
docker-compose ps redis

# Перезапусти worker
docker-compose restart worker
```

### Проблема: "Whisper transcription failed"
**Решение:**
1. Проверь что OPENAI_API_KEY правильный в `.env`
2. Перезапусти worker: `docker-compose restart worker`
3. Или переключись на local mode:
   ```env
   WHISPER_MODE=local
   WHISPER_MODEL=base
   ```

### Проблема: MinIO upload failed
**Решение:**
```bash
# Открой MinIO console
# http://localhost:9001 (admin/admin)

# Проверь что bucket существует
# Если нет - создай bucket с именем: nexus-media

# Или перезапусти MinIO
docker-compose restart minio
```

---

## 🛑 Как остановить

```bash
# Остановить все сервисы
docker-compose down

# Остановить + удалить данные
docker-compose down -v
```

---

## 🔄 Обновление кода

```bash
# Pull latest changes
git pull origin main

# Rebuild containers
docker-compose up -d --build

# Re-init database if needed
docker-compose exec gateway python -c "from backend.db.database import init_db; init_db()"
```

---

## 📊 Мониторинг

### Проверь здоровье API
```bash
curl http://localhost:8000/api/health
```

### Проверь задачи в очереди (через Redis CLI)
```bash
docker-compose exec redis redis-cli
> LLEN celery
> exit
```

### Проверь БД
```bash
docker-compose exec postgres psql -U nexus -d nexus
> \dt  # Список таблиц
> SELECT count(*) FROM media_items;
> \q
```

---

## 📱 Тест API через curl

### Process URL
```bash
curl -X POST http://localhost:8000/api/media/process/url \
  -H "Content-Type: application/json" \
  -d '{"url": "https://youtube.com/watch?v=..."}'
```

### Get media list
```bash
curl http://localhost:8000/api/media
```

### Search
```bash
curl -X POST http://localhost:8000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "искусственный интеллект"}'
```

### Chat
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "О чём говорили в последнем видео?"}'
```

---

## 🎯 Что дальше?

После того как MVP заработал:

1. **Добавь больше контента** - загрузи свои аудио/видео
2. **Протестируй поиск** - семантический поиск работает после 3-5 записей
3. **Попробуй чат** - задай вопросы по архиву
4. **Настрой под себя** - измени UI, добавь функции

---

## 📚 Полезные ссылки

- **Документация**: `README.md`
- **Архитектура**: `docs/ARCHITECTURE.md`
- **API Docs (interactive)**: http://localhost:8000/docs
- **Git**: https://github.com/kitgriului/Nexus

---

## 🆘 Помощь

Если что-то не работает:

1. Проверь логи: `docker-compose logs`
2. Проверь `.env` файл - все ли ключи на месте
3. Перезапусти: `docker-compose restart`
4. Почитай `docs/IMPLEMENTATION_STATUS.md`

Удачи! 🚀
