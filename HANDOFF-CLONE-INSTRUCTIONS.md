# Multi-Agent AI Platform — инструкция для клонирования

> **Что это:** Полный self-contained prompt для Claude Code, чтобы развернуть точную копию мультиагентной AI-платформы (Paperclip + OpenClaw + 11 агентов в Telegram) на новом VPS под собственным брендом и доменом.
>
> **Как использовать:**
> 1. Скопируй весь файл в Claude Code (или скорми как контекст)
> 2. Заполни раздел `## 2. Переменные` своими данными (имя проекта, домен, ключи)
> 3. Скажи Claude: *"Действуй по этому гайду, шаг за шагом. После каждой части показывай результаты команд и жди подтверждения."*
>
> **Результат:** рабочая копия платформы под твоим доменом с 4 плагинами и 11 AI-агентами, связанными с Telegram.

---

## 0. Что это за проект (контекст для Claude)

**Платформа** — это мультиагентная AI-система на базе открытого фреймворка [Paperclip](https://github.com/paperclipai/paperclip) с кастомными плагинами и оркестрацией агентов через OpenClaw. Стек:

| Слой | Технология | Назначение |
|------|-----------|-----------|
| **Paperclip** | Docker (Node.js + Postgres 17) | Админка плагинов/агентов, UI на `admin.*` |
| **OpenClaw Gateway** | Docker (Node.js) | Среда исполнения 11 AI-агентов с Telegram-ботами |
| **admin-api** | PM2 (Node.js) | REST API для управления агентами и OAuth, `studio.*` |
| **Caddy** | Systemd | Reverse-proxy + статика + автоматический HTTPS |
| **Cloudflare** | DNS | Домены и SSL-termination |
| **ImageMagick** | CLI | Оверлей текста на обложки для SMM |

**Агенты (11 штук, роли — кастомизируй под свой бизнес):**

- `main` — Main Bot (общий вход в систему)
- `orchestrator` — маршрутизатор задач между агентами
- `concierge` — консультант на сайте, квалификация лидов
- `hunter` — исследователь: мониторинг VK/Telegram, сбор лидов
- `closer` — продажник: дожим в мессенджерах, follow-up
- `crm` — CRM-менеджер: пайплайн, аналитика клиентов
- `critic` — QA-валидатор: проверка корректности ответов
- `developer` — техподдержка и инфраструктура
- `designer` — визуальный дизайн и UI
- `smm` — социальные сети: контент, публикации
- `analytics` — отчёты и аналитика

Имена и роли агентов — просто дефолты, ты переименуешь их под свой проект на этапе настройки.

**Плагины Paperclip (4 штуки):**

| Плагин | Версия | Описание |
|--------|--------|----------|
| `devices` | 0.3.0 | Аккаунты, прокси, OAuth-сессии, Telegram-боты, синхронизация с OpenClaw |
| `cloudflare` | 0.1.0 | Управление субдоменами, публикация сайтов через Cloudflare API |
| `reports` | 0.1.0 | Генерация отчётов (PDF/HTML) |
| `smm` | 0.1.0 | SMM: publish-post (VK/Telegram/Telegraph), Imagen 4 обложки, брендинг |

---

## 1. Что должен подготовить пользователь ДО старта

Без этих данных Claude не сможет продолжить. Собери всё заранее.

### 1.1. Инфраструктура
- [ ] **VPS:** Ubuntu 22.04+/Debian 12, 2+ vCPU, 4+ GB RAM, 40+ GB SSD, публичный IPv4
- [ ] **SSH-доступ:** root + твой SSH-ключ (`ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_newvds`)
- [ ] **Домен:** придумай свой (например `myproject.com`) — управляется через Cloudflare (бесплатный план)
- [ ] **Cloudflare API Token** с правами: `Zone:DNS:Edit` + `Zone:Zone:Read` для твоей зоны

### 1.2. Имя проекта и брендинг

- [ ] **Короткое имя проекта** (латиницей, для файлов/контейнеров): например `myproject`
- [ ] **Префикс Telegram-ботов**: например `myproject` → `myproject_main_bot`, `myproject_concierge_bot`...
- [ ] **Основной домен**: `myproject.com` (будут созданы 4 поддомена: `admin.`, `studio.`, `panel.`, `claw.`)

### 1.3. Telegram
Через [@BotFather](https://t.me/BotFather) создай **11 ботов** с выбранным префиксом и сохрани токены:
```
{prefix}_bot               → main (основной вход)
{prefix}_orchestrator_bot  → orchestrator
{prefix}_concierge_bot     → concierge
{prefix}_hunter_bot        → hunter
{prefix}_closer_bot        → closer
{prefix}_crm_bot           → crm
{prefix}_critic_bot        → critic
{prefix}_developer_bot     → developer
{prefix}_designer_bot      → designer
{prefix}_smm_bot           → smm
{prefix}_analytics_bot     → analytics
```
Также узнай свой Telegram `user_id` через [@userinfobot](https://t.me/userinfobot) — будет admin для всех ботов.

> Если 11 ботов тебе не нужны — можешь создать только часть (например, `main` + `concierge` + `smm`). Остальные агенты будут работать внутри платформы без Telegram-фронта.

### 1.4. AI-ключи (минимум один из трёх)
- [ ] **ChatGPT Plus аккаунт** (OAuth через `openai-codex/gpt-5.4`) — предпочтительно, бесплатно
- [ ] **Anthropic API key** или `claude setup-token` (Claude Sonnet 4.6 fallback)
- [ ] **OpenRouter API key** (платный резерв)
- [ ] **Gemini API key** для Imagen 4 (обложки SMM) — бесплатный уровень Google AI Studio

### 1.5. Социальные сети (для SMM-плагина, опционально)
- [ ] **VK access_token** (Implicit Flow, scope: `wall,photos,groups,offline`)
- [ ] **Telegram Channel ID + Bot token** для публикаций в канал
- [ ] **Telegraph access_token** (получается автоматически плагином при первом запуске)

---

## 2. Переменные (заполнить перед запуском Claude)

```bash
# === Проект ===
export PROJECT_NAME="myproject"          # короткое имя (латиницей)
export TG_BOT_PREFIX="myproject"         # префикс для 11 Telegram-ботов

# === VPS ===
export VPS_IP="1.2.3.4"
export VPS_USER="root"
export SSH_KEY="~/.ssh/id_ed25519_newvds"

# === Домены ===
export DOMAIN="myproject.com"
export ADMIN_HOST="admin.${DOMAIN}"      # Paperclip UI
export STUDIO_HOST="studio.${DOMAIN}"    # admin-api REST
export PANEL_HOST="panel.${DOMAIN}"      # OpenClaw panel
export CLAW_HOST="claw.${DOMAIN}"        # статика (guide/roles)

# === Cloudflare ===
export CF_API_TOKEN="..."
export CF_ZONE_ID="..."

# === Секреты ===
export BETTER_AUTH_SECRET="$(openssl rand -hex 32)"
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"

# === Telegram ===
export TG_ADMIN_ID="123456789"           # твой user_id
export TG_MAIN_TOKEN="..."
export TG_ORCHESTRATOR_TOKEN="..."
export TG_CONCIERGE_TOKEN="..."
export TG_HUNTER_TOKEN="..."
export TG_CLOSER_TOKEN="..."
export TG_CRM_TOKEN="..."
export TG_CRITIC_TOKEN="..."
export TG_DEVELOPER_TOKEN="..."
export TG_DESIGNER_TOKEN="..."
export TG_SMM_TOKEN="..."
export TG_ANALYTICS_TOKEN="..."

# === AI ===
export ANTHROPIC_API_KEY="..."
export OPENROUTER_API_KEY="..."
export GEMINI_API_KEY="..."

# === Опционально: SMM ===
export VK_ACCESS_TOKEN="..."
export TG_CHANNEL_ID="@mychannel"
```

---

## 3. Что должен сделать Claude (пошагово)

**Важно для Claude:** после каждой части показывай вывод ключевых команд (`docker ps`, `curl -I`, `systemctl status`) и жди подтверждения пользователя, прежде чем переходить к следующей части. Не пропускай проверки.

### Часть A. Получение исходников с GitHub

Исходники состоят из двух частей:

1. **Upstream Paperclip** — открытый фреймворк от [paperclipai/paperclip](https://github.com/paperclipai/paperclip)
2. **Кастомные плагины и deploy-конфиги** — публичный репо: **[github.com/ircitdev/UspeshCLAW-plugins](https://github.com/ircitdev/UspeshCLAW-plugins)**

На VPS:

```bash
mkdir -p /opt
cd /opt

# 1. Клон upstream Paperclip
git clone https://github.com/paperclipai/paperclip.git
cd paperclip

# 2. Клон кастомных плагинов
cd /tmp
git clone https://github.com/ircitdev/UspeshCLAW-plugins.git
cd UspeshCLAW-plugins

# 3. Копируем 4 кастомных плагина в Paperclip
#    (в репо папки называются sitechist-*, переименовываем в короткие имена)
cp -r plugins/sitechist-devices    /opt/paperclip/packages/plugins/devices
cp -r plugins/sitechist-cloudflare /opt/paperclip/packages/plugins/cloudflare
cp -r plugins/sitechist-reports    /opt/paperclip/packages/plugins/reports
cp -r plugins/sitechist-smm        /opt/paperclip/packages/plugins/smm

# 4. Переименуй package.json каждого плагина: @sitechist/plugin-X → @${PROJECT_NAME}/plugin-X
for p in devices cloudflare reports smm; do
  sed -i "s|@sitechist/plugin-${p}|@${PROJECT_NAME}/plugin-${p}|g" /opt/paperclip/packages/plugins/${p}/package.json
done

# 5. Deploy-файлы (docker-compose для prod, cover-overlay для SMM)
cp deploy/docker-compose.yml /opt/paperclip-deploy.docker-compose.yml
mkdir -p /opt/${PROJECT_NAME}/tools
cp deploy/cover-overlay-module.js /opt/${PROJECT_NAME}/tools/
cp deploy/cover-overlay-endpoint.js /opt/${PROJECT_NAME}/tools/

# 6. Примеры инструкций агентов (шаблоны — отредактируешь под свой проект)
mkdir -p /opt/paperclip/tmp_instructions
cp agent-instructions/*.json /opt/paperclip/tmp_instructions/ 2>/dev/null || true
```

**Проверка:**
```bash
ls /opt/paperclip/packages/plugins/ | grep -E 'devices|cloudflare|reports|smm'
# должно вывести все 4 плагина
```

### Часть B. Подготовка VPS

```bash
ssh -i $SSH_KEY $VPS_USER@$VPS_IP

# Обновление
apt update && apt upgrade -y

# Системные пакеты
apt install -y curl git build-essential imagemagick ffmpeg \
    python3 python3-pip python3-venv ca-certificates gnupg lsb-release ufw

# Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version

# Node.js 20 LTS + PM2 + pnpm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm i -g pm2 pnpm

# Caddy (reverse-proxy)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Firewall
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable

# Структура
mkdir -p /opt/${PROJECT_NAME} /root/.ssh
```

**Проверка:** `docker ps`, `caddy version`, `node -v` (v20+), `pm2 -v`.

### Часть C. Cloudflare DNS

Через API Cloudflare добавь 4 A-записи:

```bash
for sub in admin studio panel claw; do
  curl -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"A\",\"name\":\"$sub\",\"content\":\"$VPS_IP\",\"ttl\":300,\"proxied\":false}"
done
```

`proxied=false` обязательно — Caddy сам получит Let's Encrypt сертификат. Позже можно включить оранжевое облако, когда всё заработает.

### Часть D. Paperclip (Docker + Postgres)

Создай `/opt/paperclip/.env`:
```
BETTER_AUTH_SECRET=...          # из переменных (openssl rand -hex 32)
POSTGRES_PASSWORD=...
PAPERCLIP_PUBLIC_URL=https://admin.myproject.com    # свой $ADMIN_HOST
```

Создай `/opt/paperclip/docker-compose.yml` (основан на upstream, с поправкой на внешний URL):

```yaml
services:
  db:
    image: postgres:17-alpine
    container_name: ${PROJECT_NAME}-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: paperclip
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: paperclip
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U paperclip -d paperclip"]
      interval: 2s
      timeout: 5s
      retries: 30
    ports:
      - "127.0.0.1:5433:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  server:
    build:
      context: ./paperclip
      dockerfile: Dockerfile
    container_name: ${PROJECT_NAME}-server
    restart: unless-stopped
    ports:
      - "127.0.0.1:4100:3100"
    environment:
      DATABASE_URL: postgres://paperclip:${POSTGRES_PASSWORD}@db:5432/paperclip
      PORT: "3100"
      HOST: "0.0.0.0"
      SERVE_UI: "true"
      PAPERCLIP_DEPLOYMENT_MODE: "authenticated"
      PAPERCLIP_DEPLOYMENT_EXPOSURE: "private"
      PAPERCLIP_PUBLIC_URL: "${PAPERCLIP_PUBLIC_URL}"
      BETTER_AUTH_SECRET: "${BETTER_AUTH_SECRET}"
      PAPERCLIP_HOME: "/paperclip"
    volumes:
      - paperclip-data:/paperclip
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
  paperclip-data:
```

Запуск:

```bash
cd /opt/paperclip
docker compose build
docker compose up -d
docker compose logs server --tail=100 -f   # дождаться "Server listening"
```

**Проверка:** `curl -I http://127.0.0.1:4100/` → `200 OK`.

### Часть E. Сборка и установка 4 плагинов

```bash
cd /opt/paperclip
pnpm install --frozen-lockfile
node scripts/build-all.mjs        # билд всех пакетов включая плагины
```

Для каждого из 4 плагинов (`devices`, `cloudflare`, `reports`, `smm`):

```bash
PLUGIN=devices    # повторить для cloudflare / reports / smm
CONTAINER=$(docker ps -qf name=${PROJECT_NAME}-server)

docker exec -u root $CONTAINER sh -c "mkdir -p /paperclip/instances/default/plugins/$PLUGIN"
docker cp packages/plugins/$PLUGIN/dist/.       $CONTAINER:/paperclip/instances/default/plugins/$PLUGIN/dist/
docker cp packages/plugins/$PLUGIN/package.json $CONTAINER:/paperclip/instances/default/plugins/$PLUGIN/package.json

docker exec -u root $CONTAINER sh -c "
  mkdir -p /paperclip/instances/default/plugins/$PLUGIN/node_modules/@paperclipai
  ln -sf /app/packages/plugins/sdk /paperclip/instances/default/plugins/$PLUGIN/node_modules/@paperclipai/plugin-sdk
  chown -R 1000:1000 /paperclip/instances/default/plugins/$PLUGIN/
"
```

После всех 4 плагинов: `docker compose restart server`.

**Проверка:** открой `https://$ADMIN_HOST` (или временно `http://$VPS_IP:4100` через SSH-туннель) — в UI должны появиться 4 плагина со статусом `ready`. Если висят в `error`:
```bash
docker compose exec db psql -U paperclip -d paperclip -c "UPDATE plugins SET status='ready' WHERE status='error';"
docker compose restart server
```

### Часть F. admin-api (PM2)

```bash
mkdir -p /opt/${PROJECT_NAME}/tools
cd /opt/${PROJECT_NAME}/tools
# cover-overlay-module.js и cover-overlay-endpoint.js уже скопированы в Части A
npm init -y
npm install express body-parser node-fetch form-data @google-cloud/storage
```

Создай `/opt/${PROJECT_NAME}/tools/.env`:
```
PORT=18791
PAPERCLIP_CONTAINER=${PROJECT_NAME}-server
GEMINI_API_KEY=...
```

> **Claude:** файл `admin-api.js` НЕ входит в публичные исходники — это кастомный скрипт владельца. Запроси его у владельца (или вместе напишите минимальную версию: Express + 5 endpoint'ов из таблицы ниже). Без admin-api часть UI-функций не работает, но Paperclip и плагины сами по себе функциональны.

Минимальный набор endpoints (можно сгенерировать по описанию):

| Endpoint | Метод | Назначение |
|----------|-------|-----------|
| `/api/openclaw/agents` | GET | Список агентов + auth-profiles |
| `/api/openclaw/agent-config` | POST | Изменить модель/имя/emoji агента |
| `/api/openclaw/agent-profile-assign` | POST | Назначить профиль конкретному агенту |
| `/api/auth/callback-forward` | POST | Проброс OAuth callback в Docker |
| `/api/auth/set-profile` | POST | Записать профиль во ВСЕ агенты |
| `/api/cover/overlay` | POST | ImageMagick overlay + GCS upload |

Запусти через PM2:
```bash
pm2 start admin-api.js --name admin-api
pm2 save
pm2 startup systemd   # следовать инструкции
```

**Проверка:** `curl http://127.0.0.1:18791/api/openclaw/agents`.

### Часть G. OpenClaw Gateway (11 агентов)

> **Claude:** OpenClaw — это закрытый компонент владельца (не публичный opensource). Если исходников нет в архиве — уточни у владельца доступ. Альтернативно можно запустить платформу БЕЗ OpenClaw: 4 плагина и admin-api будут работать, но 11 агентов с Telegram-фронтом не будут оркестрироваться.

Если доступ есть:

```bash
cd /opt/${PROJECT_NAME}
# docker-compose.yml для gateway с переменными окружения на 11 ботов
docker compose up -d
docker compose logs gateway --tail=50
```

Для каждого из 11 агентов настрой Telegram-бот-токен через UI Paperclip: **Plugins → devices → Agents → Add bot**.

### Часть H. Caddy

Создай `/etc/caddy/Caddyfile` (подставь свой `$DOMAIN` вручную — Caddy не раскрывает bash-переменные):

```caddy
{
    email admin@myproject.com
}

admin.myproject.com {
    reverse_proxy 127.0.0.1:4100
}

studio.myproject.com {
    reverse_proxy 127.0.0.1:18791
}

panel.myproject.com {
    reverse_proxy 127.0.0.1:18789
}

claw.myproject.com {
    root * /var/www/claw
    file_server
}
```

Замени `myproject.com` на реальный домен:
```bash
sed -i "s|myproject.com|$DOMAIN|g" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl status caddy
```

**Проверка:**
```bash
curl -I https://$ADMIN_HOST
curl -I https://$STUDIO_HOST/api/openclaw/agents
```
Оба должны отвечать `200` или `401`, **не** `502`.

### Часть I. Telegram webhooks для 11 ботов

Для каждого бота (замени `$TG_TOKEN` на соответствующий токен и `$AGENT_ID` на имя агента):

```bash
curl "https://api.telegram.org/bot$TG_TOKEN/setWebhook?url=https://$PANEL_HOST/webhook/$AGENT_ID"
```

Проверь через `/getWebhookInfo` — должен вернуть последний адрес без ошибок.

### Часть J. Агент-инструкции

Инструкции агентов — это JSON-файлы с системным промптом и описанием tools. В исходниках есть 3 примера (`sitechist.json`, `developer.json`, `crm.json`) — используй как шаблоны, перепиши под свой проект:

```bash
CONTAINER=$(docker ps -qf name=${PROJECT_NAME}-server)

# Пример: адаптировать файлы под свой бренд и залить
for f in /opt/paperclip/tmp_instructions/*.json; do
  AGENT=$(basename $f .json)
  docker cp $f $CONTAINER:/paperclip/instances/default/agents/$AGENT/instructions.json
done
docker compose restart server
```

**Claude:** если пользователь хочет переименовать агентов (например `sitechist` → `orchestrator`), предложи сначала отредактировать JSON-файлы локально — там system prompt, routing rules и описание tools.

### Часть K. OAuth для AI-моделей

1. Зайди в Paperclip UI → **Settings → Auth Profiles**
2. Добавь профиль **GPT Plus** (OAuth) — система выдаст URL, авторизуйся в браузере, callback придёт через `/api/auth/callback-forward`
3. Добавь профиль **Claude** — вставь токен из `claude setup-token`
4. (опционально) **OpenRouter** — вставь API-ключ
5. Назначь профили всем 11 агентам: **Agents → Assign Profile → All**

### Часть L. Валидация (обязательно)

Claude должен выполнить и показать все эти команды:

```bash
# 1. Docker здоров
docker ps --format "table {{.Names}}\t{{.Status}}"

# 2. PM2 здоров
pm2 list

# 3. Caddy здоров
systemctl is-active caddy

# 4. HTTPS работает на всех 4 доменах
for host in $ADMIN_HOST $STUDIO_HOST $PANEL_HOST $CLAW_HOST; do
  echo "=== $host ==="
  curl -sI "https://$host" | head -2
done

# 5. Плагины в Paperclip ready
docker compose -f /opt/paperclip/docker-compose.yml exec db \
  psql -U paperclip -d paperclip -c "SELECT id, status FROM plugins;"

# 6. admin-api отдаёт список агентов
curl -s http://127.0.0.1:18791/api/openclaw/agents | head

# 7. Telegram главный бот живой
curl "https://api.telegram.org/bot$TG_MAIN_TOKEN/getMe"
```

**Финальная проверка руками:** напиши `/start` главному боту в Telegram, задай тестовый вопрос — должен сработать маршрутизатор и ответить один из агентов.

---

## 4. Частые проблемы и решения

| Симптом | Причина | Решение |
|---------|---------|---------|
| Paperclip плагин в `status=error` | Не настроен symlink на SDK | `ln -sf /app/packages/plugins/sdk /paperclip/instances/default/plugins/$PLUGIN/node_modules/@paperclipai/plugin-sdk` |
| Caddy `502 Bad Gateway` | Сервис не слушает 127.0.0.1 | Проверь `ss -tlnp \| grep -E '4100\|18791\|18789'` |
| Let's Encrypt rate limit | Много рестартов Caddy за час | Подожди 1 час либо используй staging endpoint в Caddyfile |
| Telegram webhook `bad webhook` | Self-signed / HTTP | Используй только `https://` и валидный Let's Encrypt сертификат |
| OAuth GPT Plus callback 404 | admin-api не запущен или не проксирован | Проверь `pm2 logs admin-api` и `/api/auth/callback-forward` |
| Imagen 4 `PERMISSION_DENIED` | Gemini API key без billing | Включи billing в Google Cloud Console для Imagen |
| `EACCES` в контейнере | Файлы плагина owned by root | `docker exec -u root ... chown -R 1000:1000 /paperclip/instances/default/plugins/` |
| Sparse checkout не тянет файлы | Старый git (<2.25) | `apt install -y git` или `git clone` без фильтров и удали лишнее |

---

## 5. Что НЕ входит в автоклонирование

Эти части требуют ручной настройки или доступа владельца:

- **OpenClaw Gateway исходники** — закрытый компонент, нужен отдельный доступ от владельца
- **admin-api.js** — кастомный скрипт, запроси у владельца или напиши минимальную версию
- **OAuth-сессии ChatGPT Plus** — привязаны к конкретным аккаунтам, нужна повторная авторизация на новом VPS
- **Исторические данные Paperclip БД** — не копируем, стартуем с чистой БД
- **Прокси для аккаунтов** — нужны отдельные прокси-сервера (настраивается в `devices` плагине)
- **Натренированные данные агентов** (память, learnings) — уникальны для каждой инсталляции, копируются отдельно при желании

---

## 6. Стоп-сигналы для Claude

**Если Claude столкнулся с одним из этих — остановись и спроси пользователя:**

1. `docker compose up -d` возвращает ошибку билда → показать лог, не фиксить наугад
2. Caddy не получает сертификат Let's Encrypt → проверить DNS propagation, не хакать configs
3. Отсутствуют исходники OpenClaw Gateway или admin-api.js → спросить владельца, где взять
4. Переменные `$BETTER_AUTH_SECRET` или `$CF_API_TOKEN` пустые → не генерировать заглушки
5. Нужно удалить существующие файлы на VPS (`rm -rf`) → подтвердить у пользователя
6. Нужно `docker compose down -v` (стирает volumes) → подтвердить у пользователя

**Правило золотое:** любые деструктивные команды (`rm`, `docker volume rm`, `DROP`, `--force`) — только после явного подтверждения пользователя в чате.

---

## 7. Финальный чек-лист

После того как Claude завершит все части:

- [ ] `https://admin.$DOMAIN` открывает Paperclip UI, виден логин
- [ ] 4 плагина (`devices`, `cloudflare`, `reports`, `smm`) в статусе `ready`
- [ ] `https://studio.$DOMAIN/api/openclaw/agents` возвращает JSON со списком (если admin-api настроен)
- [ ] Telegram-боты отвечают на `/start`
- [ ] Главный бот маршрутизирует тестовый вопрос к профильному агенту
- [ ] SMM: тестовая публикация в VK/TG проходит (если настроены токены)
- [ ] Caddy автоматически обновляет HTTPS-сертификаты (`systemctl status caddy`)

Если все галочки стоят — у тебя рабочая копия платформы. Дальше кастомизируй: переименуй агентов под свой бизнес, отредактируй JSON-инструкции, добавь собственные плагины, настрой брендинг SMM-обложек.

---

**Источник исходников:** [github.com/ircitdev/UspeshCLAW-plugins](https://github.com/ircitdev/UspeshCLAW-plugins)
**Upstream Paperclip:** [github.com/paperclipai/paperclip](https://github.com/paperclipai/paperclip)
**Версия гайда:** 2026-04-08
