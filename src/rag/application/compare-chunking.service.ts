import { Injectable } from '@nestjs/common';
import { RagIndexDocument } from '../domain/rag.types';
import { CompareChunkingRequestDto } from '../interfaces/dto/compare-chunking.request.dto';
import { IndexBuilderService } from './index-builder.service';
import { IndexJsonRepository } from '../infrastructure/index-json.repository';

interface ChunkStats {
  chunks_count: number;
  avg_length: number;
  median_length: number;
  min_length: number;
  max_length: number;
}

@Injectable()
export class CompareChunkingService {
  constructor(
    private readonly indexBuilderService: IndexBuilderService,
    private readonly indexRepository: IndexJsonRepository
  ) {}

  async compare(request: CompareChunkingRequestDto): Promise<{
    fixed: { indexId: string; indexPath: string; stats: ChunkStats };
    structured: { indexId: string; indexPath: string; stats: ChunkStats };
    reportPath: string;
  }> {
    const fixedResult = await this.indexBuilderService.build({
      ...request,
      strategy: 'fixed'
    });

    const structuredResult = await this.indexBuilderService.build({
      ...request,
      strategy: 'structured'
    });

    const fixedDoc = await this.indexRepository.read(fixedResult.indexId);
    const structuredDoc = await this.indexRepository.read(structuredResult.indexId);

    const report = {
      generated_at: new Date().toISOString(),
      source: request.source,
      file_path: request.filePath,
      fixed: {
        index_id: fixedResult.indexId,
        index_path: fixedResult.indexPath,
        stats: this.calculateStats(fixedDoc.chunks.map((item) => item.text.length))
      },
      structured: {
        index_id: structuredResult.indexId,
        index_path: structuredResult.indexPath,
        stats: this.calculateStats(structuredDoc.chunks.map((item) => item.text.length))
      }
    };

    const reportId = `${fixedResult.indexId}-vs-${structuredResult.indexId}`;
    const reportDoc: RagIndexDocument = {
      index_meta: {
        index_id: reportId,
        source: request.source,
        file_path: fixedDoc.index_meta.file_path,
        title: fixedDoc.index_meta.title,
        strategy: 'fixed',
        model: fixedDoc.index_meta.model,
        created_at: report.generated_at,
        dimensions: fixedDoc.index_meta.dimensions,
        chunks_count: 0
      },
      chunks: [
        {
          chunk_id: `${reportId}_summary`,
          text: JSON.stringify(report, null, 2),
          embedding: [],
          metadata: {
            source: request.source,
            file: 'comparison-report.json',
            title: 'Chunking Comparison Report',
            section: 'summary',
            chunk_id: `${reportId}_summary`,
            strategy: 'fixed',
            token_count: 0
          }
        }
      ]
    };

    const reportPath = await this.indexRepository.save(reportDoc);

    return {
      fixed: {
        indexId: fixedResult.indexId,
        indexPath: fixedResult.indexPath,
        stats: report.fixed.stats
      },
      structured: {
        indexId: structuredResult.indexId,
        indexPath: structuredResult.indexPath,
        stats: report.structured.stats
      },
      reportPath
    };
  }

  private calculateStats(lengths: number[]): ChunkStats {
    if (lengths.length === 0) {
      return { chunks_count: 0, avg_length: 0, median_length: 0, min_length: 0, max_length: 0 };
    }

    const sorted = [...lengths].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, item) => acc + item, 0);
    const mid = Math.floor(sorted.length / 2);
    const median =
      sorted.length % 2 === 0 ? Math.round((sorted[mid - 1]! + sorted[mid]!) / 2) : (sorted[mid] ?? 0);

    return {
      chunks_count: sorted.length,
      avg_length: Math.round(sum / sorted.length),
      median_length: median,
      min_length: sorted[0] ?? 0,
      max_length: sorted[sorted.length - 1] ?? 0
    };
  }
}
