# tools/ — Admin API

Этот каталог содержит **санитайзенные шаблоны** скриптов, которые крутятся на VPS владельца в составе OpenClaw Gateway и обслуживают админку Paperclip.

## Содержимое

| Файл | Назначение |
|------|-----------|
| `admin-api.js.example` | REST API на чистом Node.js (без Express). Управление агентами, OAuth, публикация HTML, cover-overlay endpoint |
| `cover-overlay.js.example` | ImageMagick overlay + GCS upload. Подключается из `admin-api.js` через `require("./cover-overlay")` |
| `.env.example` | Все настройки через переменные окружения. Пути, токены, GCS, container name |

Файлы с суффиксом `.example` — шаблоны. Переименуй без `.example` и заполни `.env`.

## Установка

```bash
# 1. Клонируешь репо (или скопировал файлы любым способом)
mkdir -p /opt/myproject/tools
cd /opt/myproject/tools

# 2. Шаблоны → рабочие имена
cp admin-api.js.example admin-api.js
cp cover-overlay.js.example cover-overlay.js
cp .env.example .env

# 3. Сгенерь токен и запиши в .env
echo "ADMIN_API_TOKEN=$(openssl rand -hex 32)" >> .env

# 4. Отредактируй .env под свои пути (PROJECT_ROOT, GATEWAY_CONTAINER, DOMAIN и т.д.)
vi .env

# 5. Node.js 18+ нужен для native fetch в cover-overlay.js
node --version

# 6. Запуск вручную (проверка)
node -r dotenv/config admin-api.js
# должно вывести: Admin API listening on 127.0.0.1:18791

# 7. Запуск через PM2 (продакшн)
npm install dotenv
pm2 start admin-api.js --name admin-api --node-args="-r dotenv/config"
pm2 save
pm2 startup systemd   # следуй инструкции
```

## Проверка

```bash
# Без токена — 401
curl http://127.0.0.1:18791/api/status
# {"error":"unauthorized"}

# С токеном — работает
TOKEN=$(grep ADMIN_API_TOKEN .env | cut -d= -f2)
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:18791/api/status
# {"gateway":"...","health":"ok","pm2":[...],"proxyIP":"..."}
```

## Эндпоинты

| Path | Метод | Назначение |
|------|-------|-----------|
| `/api/agents` | GET | Список агентов с размером SOUL.md и количеством memory-файлов |
| `/api/agents/:id/soul` | GET/PUT | Чтение/запись SOUL.md конкретного агента |
| `/api/agents/:id/memory` | GET | Список memory-файлов агента |
| `/api/agents/:id/memory/:file` | GET | Чтение конкретного memory-файла |
| `/api/status` | GET | Статус gateway контейнера, health, PM2-процессы, внешний IP прокси |
| `/api/devices` | GET | Список Telegram-устройств (через `openclaw devices list`) |
| `/api/devices/approve` | POST | Одобрить pending device request |
| `/api/pairing/approve` | POST | Одобрить Telegram pairing code |
| `/api/restart` | POST | Рестарт gateway контейнера |
| `/api/logs` | GET | Последние N строк логов gateway (query `?lines=30`) |
| `/api/subdomains` | GET | Список поддоменов в `$WWW_ROOT` |
| `/api/subdomains/create` | POST | Создать новый поддомен (вызов `create-subdomain.sh`) |
| `/api/subdomains/:name/files` | GET | Дерево файлов поддомена |
| `/api/subdomains/:name/file` | GET/PUT | Чтение/запись файла внутри поддомена |
| `/api/clone` | POST | Клонировать сайт по URL (вызов `clone-site.sh`) |
| `/api/clone/status` | GET | Статус асинхронного клонирования |
| `/api/config` | GET/PUT | Чтение/запись `openclaw.json` |
| `/api/chat` | POST | One-shot сообщение агенту (через `docker exec openclaw agent`) |
| `/api/publish-html` | POST | Загрузить HTML-отчёт в GCS, получить публичный URL |
| `/api/cover/overlay` | POST | Сгенерировать обложку: ImageMagick + GCS upload |
| `/api/telegram-stats` | GET | Список активных Telegram-сессий |
| `/api/auth-profiles` | GET | Legacy: профили OAuth одного агента |
| `/api/auth/start` | POST | Запустить OAuth flow (`auth-helper.py`) |
| `/api/auth/status/:sid` | GET | Статус OAuth session |
| `/api/auth/profiles` | GET | Профили через `get-auth-profiles.py` |
| `/api/auth/callback-forward` | POST | Проброс OAuth callback внутрь gateway контейнера |
| `/api/auth/set-profile` | POST | Записать профиль во все агенты (`manage-auth-profiles.py`) |
| `/api/auth/delete-profile` | POST | Удалить профиль из всех агентов |
| `/api/openclaw/agents` | GET | Агенты с их моделями + статусами auth-профилей |
| `/api/openclaw/agent-config` | POST | Изменить model / name / emoji агента |
| `/api/openclaw/agent-profile-assign` | POST | Назначить профиль конкретному агенту |

Все запросы требуют заголовок `Authorization: Bearer $ADMIN_API_TOKEN`.

## Что НЕ входит в этот репо

Админ-API вызывает несколько вспомогательных Python-скриптов (они тоже живут в `tools/` на VPS, но не включены сюда — специфика OpenClaw):

- `auth-helper.py` — запускает OAuth daemon на `:1455`, используется `/api/auth/start` и `/api/auth/status/:sid`
- `get-auth-profiles.py` — агрегирует профили со всех агентов
- `manage-auth-profiles.py` — записывает/удаляет профиль во все агенты сразу
- `oauth-exchange.py` — обмен authorization code на токены
- `create-subdomain.sh` — создаёт папку в `/var/www/`, Caddy подхватывает по wildcard
- `clone-site.sh` — `wget -m` клон сайта в поддомен
- `host-exec.sh`, `write-html.sh`, `publish-html.js`, `subdomain-api.js` — утилиты

Без этих скриптов часть эндпоинтов вернёт ошибку, но остальные (agents, SOUL, memory, status, logs, openclaw/*) работают независимо.

## Адаптация под свой проект

1. Открой `admin-api.js`, проверь все `process.env.*` — всё ли покрыто твоим `.env`
2. Если какой-то эндпоинт тебе не нужен — просто удали блок `else if`, это stateless-код
3. Если нужен новый эндпоинт — добавь ещё один `else if (p === "/api/mything")` перед финальным `else { json(res, {error:"not found"}, 404); }`
4. Логи проверяй через `pm2 logs admin-api`
