import { Injectable } from '@nestjs/common';
import { ChunkMetadata } from '../domain/rag.types';
import { IndexJsonRepository } from '../infrastructure/index-json.repository';
import { ProxyApiEmbeddingsClient } from '../infrastructure/proxyapi-embeddings.client';
import { RetrieveRequestDto } from '../interfaces/dto/retrieve.request.dto';

@Injectable()
export class RetrieveService {
  constructor(
    private readonly indexRepository: IndexJsonRepository,
    private readonly embeddingsClient: ProxyApiEmbeddingsClient
  ) {}

  async retrieve(request: RetrieveRequestDto): Promise<{
    indexId: string;
    query: string;
    topK: number;
    matches: Array<{ score: number; text: string; metadata: ChunkMetadata }>;
  }> {
    const index = await this.indexRepository.read(request.indexId);
    const { embeddings } = await this.embeddingsClient.embedTexts([request.query]);
    const queryEmbedding = embeddings[0] ?? [];

    const ranked = index.chunks
      .map((chunk) => ({
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
        text: chunk.text,
        metadata: chunk.metadata
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, request.topK);

    return {
      indexId: request.indexId,
      query: request.query,
      topK: request.topK,
      matches: ranked
    };
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0 || a.length !== b.length) {
      return 0;
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let index = 0; index < a.length; index += 1) {
      const av = a[index] ?? 0;
      const bv = b[index] ?? 0;
      dot += av * bv;
      normA += av * av;
      normB += bv * bv;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
