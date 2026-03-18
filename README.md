# firstai-backend

NestJS backend для работы с MCP-провайдерами и скачивания файлов.

## Требования

- Node.js 20+
- npm

## Установка

```bash
npm install
```

## Настройка окружения

1. Скопируйте пример:

```bash
cp .env.example .env
```

2. Заполните минимум:
- `PORT` (по умолчанию `5001`)
- `GITHUB_PERSONAL_ACCESS_TOKEN` (если используете GitHub MCP provider)
- при необходимости `MCP_EXTERNAL_PROVIDERS_JSON`
- для RAG/LLM через ProxyAPI: `PROXYAPI_OPENAI_API_KEY`, `PROXYAPI_OPENAI_API_URL` (base URL, например `https://api.proxyapi.ru/openai/v1`)

Swagger:
- `SWAGGER_PATH=docs` задает путь для UI документации (например `/docs`).

## Запуск

Режим разработки:

```bash
npm run start:dev
```

Production build:

```bash
npm run build
npm run start
```

## Swagger

После запуска API документация доступна по адресу:

- `http://localhost:5001/docs`

Если меняете `PORT` или `SWAGGER_PATH`, URL будет:

- `http://localhost:<PORT>/<SWAGGER_PATH>`

## Основные маршруты API

- `GET /mcp/providers` — список провайдеров
- `GET /mcp/:provider/tools` — список инструментов провайдера
- `POST /mcp/:provider/tools/:toolName/invoke` — вызов инструмента
- `GET /mcp/:provider/health` — health-check провайдера
- `GET /downloads/:fileId` — скачивание файла
- `POST /rag/indexes/build` — построение JSON-индекса (fixed/structured)
- `POST /rag/indexes/compare` — сравнение двух стратегий chunking
- `POST /rag/retrieve` — семантический поиск по локальному индексу
- `POST /rag/retrieve/multi` — семантический поиск сразу по нескольким индексам
- `POST /rag/files/upload` — загрузка файла из браузера (multipart/form-data)
- `GET /rag/indexes` — список доступных индексов
- `GET /rag/indexes/:indexId` — метаданные индекса
- `DELETE /rag/indexes/:indexId` — удаление индекса по `indexId`
- `GET /rag/health` — health-check RAG и embedding-конфига

### Пример загрузки файла и сборки индекса

```bash
curl -X POST "http://localhost:3001/rag/files/upload" \
  -F "file=@/Users/maksim/learn_ai/firstai/backend/example/factory.txt"
```

Из ответа возьмите `filePath` и передайте его в `POST /rag/indexes/build`.

## Полезные команды

```bash
npm run test
npm run lint
```
