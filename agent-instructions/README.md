# Agent Instructions — шаблоны

Здесь примеры JSON-инструкций для агентов Paperclip. Это **шаблоны** — перепиши под свой проект.

## Формат

Каждый файл — JSON с полями:
```json
{
  "path": "SOUL.md",
  "content": "# Agent Name\n\n<system prompt в markdown>",
  "clearLegacyPromptTemplate": true
}
```

Поле `content` содержит system prompt агента (роль, правила, список tools, примеры). Поле `path` указывает, куда Paperclip запишет этот файл внутри workspace агента.

## Как применить к работающей системе

```bash
CONTAINER=$(docker ps -qf name=${PROJECT_NAME}-server)
for f in agent-instructions/*.json; do
  AGENT=$(basename $f .json)
  docker cp $f $CONTAINER:/paperclip/instances/default/agents/$AGENT/instructions.json
done
docker compose restart server
```

## Доступные шаблоны

- `orchestrator.json` — маршрутизатор задач между агентами (routing rules + escalation)
- `crm.json` — CRM-менеджер (аналитика пайплайна, отчёты)

## Совет

Начни с минимального набора (только `orchestrator.json` и `concierge.json`), добавляй остальных агентов по мере роста проекта. Paperclip стартует агента без инструкции с дефолтным поведением.
