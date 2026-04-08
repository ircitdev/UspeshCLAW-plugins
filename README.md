# UspeshCLAW Plugins

Набор кастомных плагинов для [Paperclip](https://github.com/paperclipai/paperclip) + deploy-конфиги для развёртывания мультиагентной AI-платформы на VPS.

## Содержимое

```text
UspeshCLAW-plugins/
├── plugins/                    # 4 плагина Paperclip
│   ├── sitechist-devices/      # Аккаунты, прокси, OAuth, Telegram-боты, sync с OpenClaw
│   ├── sitechist-cloudflare/   # Управление субдоменами через Cloudflare API
│   ├── sitechist-reports/      # Генерация отчётов
│   └── sitechist-smm/          # SMM: VK/Telegram/Telegraph publish, Imagen 4 covers
├── deploy/                     # Deploy-конфиги для prod
│   ├── docker-compose.yml                              # Paperclip + Postgres
│   ├── openclaw-gateway.docker-compose.yml.example     # OpenClaw Gateway (gateway + cli + studio)
│   ├── openclaw-gateway.env.example                    # env-шаблон для gateway
│   ├── cover-overlay-module.js                         # ImageMagick overlay для SMM-обложек
│   └── cover-overlay-endpoint.js
├── tools/                      # Admin REST API (санитайзенные шаблоны)
│   ├── admin-api.js.example    # Node.js http-сервер: агенты, OAuth, publish, cover-overlay
│   ├── cover-overlay.js.example# ImageMagick + GCS upload, подключается из admin-api
│   ├── .env.example            # Все настройки через переменные окружения
│   └── README.md               # Установка, эндпоинты, PM2 запуск
├── agent-instructions/         # Примеры JSON-инструкций для агентов (шаблоны)
└── HANDOFF-CLONE-INSTRUCTIONS.md   # Полный гайд развёртывания
```

## Быстрый старт

Открой [HANDOFF-CLONE-INSTRUCTIONS.md](HANDOFF-CLONE-INSTRUCTIONS.md) в Claude Code, заполни переменные (имя проекта, домен, токены) и скажи Claude действовать пошагово. Гайд ведёт от чистого VPS Ubuntu до работающей платформы с 4 плагинами и 11 AI-агентами в Telegram.

## Что понадобится

- VPS: Ubuntu 22.04+/Debian 12, 2+ vCPU, 4+ GB RAM
- Домен (с управлением через Cloudflare)
- 11 Telegram-ботов (опционально — можно меньше)
- Хотя бы один AI-ключ: ChatGPT Plus OAuth / Anthropic API / OpenRouter
- Gemini API key для Imagen 4 (обложки SMM)

## Upstream компоненты (всё публичный opensource)

Этот репо содержит **только дельту** — 4 кастомных плагина, admin-api, deploy-конфиги и инструкцию. Базовые рантаймы берутся у upstream:

| Компонент | Репо | Образ / инсталл |
|---|---|---|
| Paperclip (админка плагинов) | [paperclipai/paperclip](https://github.com/paperclipai/paperclip) | Собирается локально из исходников |
| OpenClaw Gateway (рантайм агентов) | [openclaw/openclaw](https://github.com/openclaw/openclaw) · [docs.openclaw.ai](https://docs.openclaw.ai) | `docker pull ghcr.io/openclaw/openclaw:latest` |

Оба под MIT-совместимыми лицензиями. Никаких закрытых компонентов — друг может развернуть всё без доступа к чьему-либо приватному репо.

## Наименование плагинов

Папки плагинов называются `sitechist-*` — это историческое имя владельца. При деплое гайд автоматически переименует пакеты `@sitechist/plugin-*` → `@${PROJECT_NAME}/plugin-*` через `sed`. Сами папки остаются с префиксом `sitechist-` для совпадения с production-версией на сервере владельца.

## Лицензия

Исходники Paperclip — по лицензии upstream. Кастомные плагины в этом репо — MIT (если не указано иное в `package.json` конкретного плагина).
