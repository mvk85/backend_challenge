import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { FixedSizeChunker } from './chunkers/fixed-size.chunker';
import { StructuredChunker } from './chunkers/structured.chunker';
import { ChunkingStrategy, RagIndexDocument } from '../domain/rag.types';
import { ProxyApiEmbeddingsClient } from '../infrastructure/proxyapi-embeddings.client';
import { IndexJsonRepository } from '../infrastructure/index-json.repository';
import { BuildIndexRequestDto } from '../interfaces/dto/build-index.request.dto';

interface BuildIndexResult {
  indexId: string;
  indexPath: string;
  chunksCount: number;
  model: string;
  dimensions: number;
  createdAt: string;
}

@Injectable()
export class IndexBuilderService {
  constructor(
    private readonly fixedSizeChunker: FixedSizeChunker,
    private readonly structuredChunker: StructuredChunker,
    private readonly embeddingsClient: ProxyApiEmbeddingsClient,
    private readonly indexRepository: IndexJsonRepository
  ) {}

  async build(request: BuildIndexRequestDto): Promise<BuildIndexResult> {
    const fullPath = path.resolve(process.cwd(), request.filePath);
    const rawText = await this.readFileText(fullPath);
    const title = request.title?.trim() || path.basename(fullPath);

    const chunkSize = request.chunkSize ?? 1200;
    const chunkOverlap = request.chunkOverlap ?? 200;

    const chunker = this.resolveChunker(request.strategy);
    const chunkDrafts = chunker.chunk(rawText, { chunkSize, chunkOverlap });
    if (chunkDrafts.length === 0) {
      throw new BadRequestException('Input file produced 0 chunks. Provide a non-empty text document.');
    }

    const texts = chunkDrafts.map((item) => item.text);
    const { embeddings, model, dimensions } = await this.embeddingsClient.embedTexts(texts);

    const createdAt = new Date().toISOString();
    const indexId = this.createIndexId(fullPath, request.strategy, createdAt);

    const chunks = chunkDrafts.map((draft, index) => {
      const chunkId = `${indexId}_${String(index + 1).padStart(4, '0')}`;
      return {
        chunk_id: chunkId,
        text: draft.text,
        embedding: embeddings[index] ?? [],
        metadata: {
          source: request.source,
          file: path.basename(fullPath),
          title,
          section: draft.section,
          chunk_id: chunkId,
          strategy: request.strategy,
          token_count: draft.tokenCount
        }
      };
    });

    const indexDoc: RagIndexDocument = {
      index_meta: {
        index_id: indexId,
        source: request.source,
        file_path: fullPath,
        title,
        strategy: request.strategy,
        model,
        created_at: createdAt,
        dimensions,
        chunks_count: chunks.length
      },
      chunks
    };

    const indexPath = await this.indexRepository.save(indexDoc);

    return {
      indexId,
      indexPath,
      chunksCount: chunks.length,
      model,
      dimensions,
      createdAt
    };
  }

  private resolveChunker(strategy: ChunkingStrategy): FixedSizeChunker | StructuredChunker {
    if (strategy === 'fixed') {
      return this.fixedSizeChunker;
    }

    return this.structuredChunker;
  }

  private async readFileText(fullPath: string): Promise<string> {
    try {
      return await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        throw new BadRequestException(`File not found: ${fullPath}`);
      }

      throw error;
    }
  }

  private createIndexId(filePath: string, strategy: ChunkingStrategy, createdAt: string): string {
    const sourceName = path.basename(filePath, path.extname(filePath));
    const slug = sourceName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'document';

    const ts = createdAt.replace(/[-:TZ.]/g, '').slice(0, 14);
    return `${slug}-${strategy}-${ts}`;
  }
}
