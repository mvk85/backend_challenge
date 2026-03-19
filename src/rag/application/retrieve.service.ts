import { Injectable } from '@nestjs/common';
import { ChunkMetadata } from '../domain/rag.types';
import { IndexJsonRepository } from '../infrastructure/index-json.repository';
import { ProxyApiEmbeddingsClient } from '../infrastructure/proxyapi-embeddings.client';
import { RetrieveMultiRequestDto } from '../interfaces/dto/retrieve-multi.request.dto';
import { RetrievalMode, RetrieveRequestDto } from '../interfaces/dto/retrieve.request.dto';

interface RetrieveMatch {
  score: number;
  vectorScore?: number;
  lexicalScore?: number;
  text: string;
  metadata: ChunkMetadata;
}

type RetrieveMatchWithIndexId = RetrieveMatch & { indexId: string };
type ModeComparisonItem = { indexId: string; chunkId: string; score: number };
type ModeComparison = Record<RetrievalMode, ModeComparisonItem[]>;

type RetrievalOptions = {
  topK: number;
  candidateTopK: number;
  mode: RetrievalMode;
  minScore: number;
  compareModes: boolean;
};

type RankedMatch = RetrieveMatchWithIndexId & {
  vectorScore: number;
};

@Injectable()
export class RetrieveService {
  private static readonly DEFAULT_MIN_SCORE = 0.5;

  private static readonly STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'to',
    'with', 'что', 'это', 'как', 'для', 'или', 'и', 'в', 'на', 'по', 'о', 'об', 'а', 'но', 'не', 'из', 'у', 'к', 'за', 'от'
  ]);

  constructor(
    private readonly indexRepository: IndexJsonRepository,
    private readonly embeddingsClient: ProxyApiEmbeddingsClient
  ) {}

  async retrieve(request: RetrieveRequestDto): Promise<{
    indexId: string;
    query: string;
    topK: number;
    candidateTopK: number;
    mode: RetrievalMode;
    minScore: number;
    rewrite: { enabled: boolean; originalQuery: string; effectiveQuery: string; wasRewritten: boolean };
    matches: RetrieveMatchWithIndexId[];
    modeComparison?: ModeComparison;
  }> {
    const index = await this.indexRepository.read(request.indexId);
    const queryPlan = this.resolveQueryPlan(request.query, request.rewriteQuery === true);
    const retrieval = this.resolveRetrievalOptions(request);
    const { embeddings } = await this.embeddingsClient.embedTexts([queryPlan.effectiveQuery]);
    const queryEmbedding = embeddings[0] ?? [];
    const ranked = this.rankChunks(index.chunks, queryEmbedding, request.indexId).slice(0, retrieval.candidateTopK);
    const { selected, modeComparison } = this.applyModeSelection(ranked, queryPlan.effectiveQuery, retrieval);

    return {
      indexId: request.indexId,
      query: request.query,
      topK: retrieval.topK,
      candidateTopK: retrieval.candidateTopK,
      mode: retrieval.mode,
      minScore: retrieval.minScore,
      rewrite: {
        enabled: request.rewriteQuery === true,
        originalQuery: queryPlan.originalQuery,
        effectiveQuery: queryPlan.effectiveQuery,
        wasRewritten: queryPlan.wasRewritten
      },
      matches: selected.map((match) => ({
        ...match,
        indexId: request.indexId
      })),
      ...(modeComparison ? { modeComparison } : {})
    };
  }

  async retrieveMulti(request: RetrieveMultiRequestDto): Promise<{
    indexIds: string[];
    query: string;
    topK: number;
    candidateTopK: number;
    mode: RetrievalMode;
    minScore: number;
    rewrite: { enabled: boolean; originalQuery: string; effectiveQuery: string; wasRewritten: boolean };
    searchedIndexIds: string[];
    missingIndexIds: string[];
    matches: RetrieveMatchWithIndexId[];
    modeComparison?: ModeComparison;
  }> {
    const uniqueIndexIds = [...new Set(request.indexIds)];
    const availableIndexes = await this.indexRepository.list();
    const availableById = new Map(availableIndexes.map((index) => [index.indexId, index]));
    const queryPlan = this.resolveQueryPlan(request.query, request.rewriteQuery === true);
    const retrieval = this.resolveRetrievalOptions(request);

    const searchedIndexIds = uniqueIndexIds.filter((indexId) => availableById.has(indexId));
    const missingIndexIds = uniqueIndexIds.filter((indexId) => !availableById.has(indexId));

    if (searchedIndexIds.length === 0) {
      return {
        indexIds: uniqueIndexIds,
        query: request.query,
        topK: retrieval.topK,
        candidateTopK: retrieval.candidateTopK,
        mode: retrieval.mode,
        minScore: retrieval.minScore,
        rewrite: {
          enabled: request.rewriteQuery === true,
          originalQuery: queryPlan.originalQuery,
          effectiveQuery: queryPlan.effectiveQuery,
          wasRewritten: queryPlan.wasRewritten
        },
        searchedIndexIds: [],
        missingIndexIds,
        matches: [],
        ...(retrieval.compareModes ? { modeComparison: { baseline: [], threshold: [], heuristic: [] } } : {})
      };
    }

    const { embeddings } = await this.embeddingsClient.embedTexts([queryPlan.effectiveQuery]);
    const queryEmbedding = embeddings[0] ?? [];

    const perIndexResults = await Promise.all(
      searchedIndexIds.map(async (indexId) => {
        const index = await this.indexRepository.read(indexId);
        return this.rankChunks(index.chunks, queryEmbedding, indexId);
      })
    );

    const mergedCandidates = perIndexResults
      .flat()
      .sort((a, b) => b.vectorScore - a.vectorScore)
      .slice(0, retrieval.candidateTopK);
    const { selected, modeComparison } = this.applyModeSelection(mergedCandidates, queryPlan.effectiveQuery, retrieval);

    return {
      indexIds: uniqueIndexIds,
      query: request.query,
      topK: retrieval.topK,
      candidateTopK: retrieval.candidateTopK,
      mode: retrieval.mode,
      minScore: retrieval.minScore,
      rewrite: {
        enabled: request.rewriteQuery === true,
        originalQuery: queryPlan.originalQuery,
        effectiveQuery: queryPlan.effectiveQuery,
        wasRewritten: queryPlan.wasRewritten
      },
      searchedIndexIds,
      missingIndexIds,
      matches: selected,
      ...(modeComparison ? { modeComparison } : {})
    };
  }

  private resolveRetrievalOptions(request: {
    topK: number;
    candidateTopK?: number;
    mode?: RetrievalMode;
    minScore?: number;
    compareModes?: boolean;
  }): RetrievalOptions {
    const topK = request.topK;
    const requestedCandidateTopK = request.candidateTopK ?? Math.min(topK * 4, 100);
    const candidateTopK = Math.max(topK, requestedCandidateTopK);
    const mode = request.mode ?? 'baseline';
    const minScore = this.clamp01(request.minScore ?? RetrieveService.DEFAULT_MIN_SCORE);
    return {
      topK,
      candidateTopK,
      mode,
      minScore,
      compareModes: request.compareModes === true
    };
  }

  private resolveQueryPlan(query: string, rewriteEnabled: boolean): { originalQuery: string; effectiveQuery: string; wasRewritten: boolean } {
    const originalQuery = query.trim();
    if (!rewriteEnabled) {
      return { originalQuery, effectiveQuery: originalQuery, wasRewritten: false };
    }
    const rewritten = this.rewriteQuery(originalQuery);
    return {
      originalQuery,
      effectiveQuery: rewritten,
      wasRewritten: rewritten !== originalQuery
    };
  }

  private rewriteQuery(query: string): string {
    const normalized = query.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return normalized;
    }
    const withoutPolitePrefix = normalized
      .replace(/^(please|could you|расскажи|объясни|подскажи|пожалуйста|можешь)\s+/iu, '')
      .replace(/[!?.,;:]+$/u, '')
      .trim();
    return withoutPolitePrefix || normalized;
  }

  private applyModeSelection(
    candidates: RankedMatch[],
    effectiveQuery: string,
    options: RetrievalOptions
  ): { selected: RetrieveMatchWithIndexId[]; modeComparison?: ModeComparison } {
    const baseline = this.buildModeMatches(candidates, 'baseline', effectiveQuery, options.minScore, options.topK);
    const threshold = this.buildModeMatches(candidates, 'threshold', effectiveQuery, options.minScore, options.topK);
    const heuristic = this.buildModeMatches(candidates, 'heuristic', effectiveQuery, options.minScore, options.topK);
    const selectedByMode: Record<RetrievalMode, RetrieveMatchWithIndexId[]> = {
      baseline,
      threshold,
      heuristic
    };

    if (!options.compareModes) {
      return { selected: selectedByMode[options.mode] };
    }

    const modeComparison: ModeComparison = {
      baseline: baseline.map((match) => this.toModeComparisonItem(match)),
      threshold: threshold.map((match) => this.toModeComparisonItem(match)),
      heuristic: heuristic.map((match) => this.toModeComparisonItem(match))
    };

    return {
      selected: selectedByMode[options.mode],
      modeComparison
    };
  }

  private toModeComparisonItem(match: RetrieveMatchWithIndexId): ModeComparisonItem {
    return {
      indexId: match.indexId,
      chunkId: match.metadata.chunk_id,
      score: Number(match.score.toFixed(6))
    };
  }

  private buildModeMatches(
    candidates: RankedMatch[],
    mode: RetrievalMode,
    effectiveQuery: string,
    minScore: number,
    topK: number
  ): RetrieveMatchWithIndexId[] {
    const rescored = candidates.map((candidate) => {
      const lexicalScore = mode === 'heuristic' ? this.lexicalSimilarity(effectiveQuery, candidate.text, candidate.metadata) : undefined;
      const score =
        mode === 'heuristic' && typeof lexicalScore === 'number'
          ? 0.75 * candidate.vectorScore + 0.25 * lexicalScore
          : candidate.vectorScore;
      return {
        indexId: candidate.indexId,
        score,
        vectorScore: candidate.vectorScore,
        lexicalScore,
        text: candidate.text,
        metadata: candidate.metadata
      };
    });

    const filtered = mode === 'baseline' ? rescored : rescored.filter((item) => item.score >= minScore);
    return filtered.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private lexicalSimilarity(query: string, text: string, metadata: ChunkMetadata): number {
    const queryTokens = this.tokenize(query);
    if (queryTokens.size === 0) {
      return 0;
    }
    const docTokens = this.tokenize(`${metadata.title} ${metadata.section} ${text}`);
    if (docTokens.size === 0) {
      return 0;
    }

    let overlap = 0;
    for (const token of queryTokens) {
      if (docTokens.has(token)) {
        overlap += 1;
      }
    }

    const overlapScore = overlap / queryTokens.size;
    const phraseBonus = text.toLocaleLowerCase().includes(query.toLocaleLowerCase()) ? 0.15 : 0;
    return this.clamp01(overlapScore + phraseBonus);
  }

  private tokenize(value: string): Set<string> {
    const normalized = value.toLocaleLowerCase();
    const tokens = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
    return new Set(tokens.filter((token) => token.length >= 2 && !RetrieveService.STOPWORDS.has(token)));
  }

  private clamp01(value: number): number {
    if (value < 0) {
      return 0;
    }
    if (value > 1) {
      return 1;
    }
    return value;
  }

  private rankChunks(
    chunks: Array<{ text: string; embedding: number[]; metadata: ChunkMetadata }>,
    queryEmbedding: number[],
    indexId: string
  ): RankedMatch[] {
    return chunks
      .map((chunk) => {
        const vectorScore = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          score: vectorScore,
          vectorScore,
          text: chunk.text,
          metadata: chunk.metadata,
          indexId
        };
      })
      .sort((a, b) => b.vectorScore - a.vectorScore);
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
