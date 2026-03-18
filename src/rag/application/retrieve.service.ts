import { Injectable } from '@nestjs/common';
import { ChunkMetadata } from '../domain/rag.types';
import { IndexJsonRepository } from '../infrastructure/index-json.repository';
import { ProxyApiEmbeddingsClient } from '../infrastructure/proxyapi-embeddings.client';
import { RetrieveMultiRequestDto } from '../interfaces/dto/retrieve-multi.request.dto';
import { RetrieveRequestDto } from '../interfaces/dto/retrieve.request.dto';

interface RetrieveMatch {
  score: number;
  text: string;
  metadata: ChunkMetadata;
}

type RetrieveMatchWithIndexId = RetrieveMatch & { indexId: string };

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
    matches: RetrieveMatchWithIndexId[];
  }> {
    const index = await this.indexRepository.read(request.indexId);
    const { embeddings } = await this.embeddingsClient.embedTexts([request.query]);
    const queryEmbedding = embeddings[0] ?? [];

    const ranked = this.rankChunks(index.chunks, queryEmbedding).slice(0, request.topK);

    return {
      indexId: request.indexId,
      query: request.query,
      topK: request.topK,
      matches: ranked.map((match) => ({
        ...match,
        indexId: request.indexId
      }))
    };
  }

  async retrieveMulti(request: RetrieveMultiRequestDto): Promise<{
    indexIds: string[];
    query: string;
    topK: number;
    searchedIndexIds: string[];
    missingIndexIds: string[];
    matches: RetrieveMatchWithIndexId[];
  }> {
    const uniqueIndexIds = [...new Set(request.indexIds)];
    const availableIndexes = await this.indexRepository.list();
    const availableById = new Map(availableIndexes.map((index) => [index.indexId, index]));

    const searchedIndexIds = uniqueIndexIds.filter((indexId) => availableById.has(indexId));
    const missingIndexIds = uniqueIndexIds.filter((indexId) => !availableById.has(indexId));

    if (searchedIndexIds.length === 0) {
      return {
        indexIds: uniqueIndexIds,
        query: request.query,
        topK: request.topK,
        searchedIndexIds: [],
        missingIndexIds,
        matches: []
      };
    }

    const { embeddings } = await this.embeddingsClient.embedTexts([request.query]);
    const queryEmbedding = embeddings[0] ?? [];

    const perIndexResults = await Promise.all(
      searchedIndexIds.map(async (indexId) => {
        const index = await this.indexRepository.read(indexId);
        return this.rankChunks(index.chunks, queryEmbedding).map((match) => ({
          ...match,
          indexId
        }));
      })
    );

    const merged = perIndexResults.flat().sort((a, b) => b.score - a.score).slice(0, request.topK);

    return {
      indexIds: uniqueIndexIds,
      query: request.query,
      topK: request.topK,
      searchedIndexIds,
      missingIndexIds,
      matches: merged
    };
  }

  private rankChunks(chunks: Array<{ text: string; embedding: number[]; metadata: ChunkMetadata }>, queryEmbedding: number[]): RetrieveMatch[] {
    return chunks
      .map((chunk) => ({
        score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
        text: chunk.text,
        metadata: chunk.metadata
      }))
      .sort((a, b) => b.score - a.score);
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
