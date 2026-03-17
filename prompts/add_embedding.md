# Add Embedding Pipeline Prompt

Задача: реализовать отдельный RAG-модуль (не в `src/mcp`) с локальной индексацией документов.

## Цели

1. Добавить пайплайн индексации текста:
- chunking
- генерация embeddings
- сохранение JSON-индекса

2. Реализовать две стратегии chunking и их сравнение:
- fixed-size
- structured (по заголовкам/разделам)

3. Добавить метаданные к каждому чанку:
- `source`
- `file`/`title`
- `section`
- `chunk_id`

4. Поддержать HTTP endpoint'ы для LLM-агента:
- `POST /rag/indexes/build`
- `POST /rag/indexes/compare`
- `POST /rag/retrieve`
- `GET /rag/indexes/:indexId`
- `GET /rag/health`

5. Все endpoint'ы должны быть описаны в Swagger с примерами request/response.

## Конфиг

Использовать переменные окружения:
- `PROXYAPI_OPENAI_API_KEY`
- `PROXYAPI_OPENAI_API_URL` (как base URL)
- `PROXYAPI_OPENAI_EMBEDDING_MODEL` (по умолчанию `text-embedding-3-small`)
- `RAG_INDEX_DIR`

## Пример запроса к embeddings

```bash
curl https://api.proxyapi.ru/openai/v1/embeddings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <КЛЮЧ>" \
  -d '{
    "input": "Your text string goes here",
    "model": "text-embedding-3-small"
  }'
```

## Критерий готовности

- Сервис строит локальные JSON-индексы с embedding-векторами и метаданными.
- Доступно сравнение fixed и structured chunking.
- Доступен retrieval по локальному индексу.
- В Swagger отображаются все RAG endpoint'ы с примерами.
