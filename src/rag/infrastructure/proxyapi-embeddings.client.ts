import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmbeddingResponse {
  data?: Array<{ embedding?: number[] }>;
}

@Injectable()
export class ProxyApiEmbeddingsClient {
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = Number(this.configService.get('MCP_CALL_TIMEOUT_MS') ?? 20000);
  }

  async embedTexts(texts: string[]): Promise<{ embeddings: number[][]; model: string; dimensions: number }> {
    if (texts.length === 0) {
      return { embeddings: [], model: this.resolveModel(), dimensions: 0 };
    }

    const response = await this.withTimeout(
      fetch(this.resolveEmbeddingsUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resolveApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          input: texts,
          model: this.resolveModel()
        })
      })
    );

    const body = (await response.json().catch(() => null)) as EmbeddingResponse | null;

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Embedding request failed with status ${response.status}: ${response.statusText}`
      );
    }

    if (!body || !Array.isArray(body.data) || body.data.length !== texts.length) {
      throw new ServiceUnavailableException('Embedding response has invalid shape or mismatched data length');
    }

    const embeddings = body.data.map((item) => {
      if (!item || !Array.isArray(item.embedding) || item.embedding.length === 0) {
        throw new ServiceUnavailableException('Embedding response contains invalid vector');
      }
      return item.embedding;
    });

    return {
      embeddings,
      model: this.resolveModel(),
      dimensions: embeddings[0]?.length ?? 0
    };
  }

  getHealth(): { configured: boolean; url: string; model: string } {
    const key = this.configService.get<string>('PROXYAPI_OPENAI_API_KEY')?.trim() ?? '';
    return {
      configured: key.length > 0,
      url: this.resolveEmbeddingsUrl(),
      model: this.resolveModel()
    };
  }

  private resolveApiKey(): string {
    const key = this.configService.get<string>('PROXYAPI_OPENAI_API_KEY')?.trim() ?? '';
    if (!key) {
      throw new ServiceUnavailableException('PROXYAPI_OPENAI_API_KEY is not configured');
    }

    return key;
  }

  private resolveEmbeddingsUrl(): string {
    const raw =
      this.configService.get<string>('PROXYAPI_OPENAI_API_URL')?.trim() ||
      'https://api.proxyapi.ru/openai/v1';

    const normalized = raw.replace(/\/+$/u, '');
    if (normalized.endsWith('/embeddings')) {
      return normalized;
    }

    return `${normalized}/embeddings`;
  }

  private resolveModel(): string {
    const model = this.configService.get<string>('PROXYAPI_OPENAI_EMBEDDING_MODEL')?.trim() || 'text-embedding-3-small';
    return model;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`Request timeout after ${this.timeoutMs}ms`)), this.timeoutMs);
        })
      ]);
    } catch (error) {
      throw new ServiceUnavailableException((error as Error).message);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
