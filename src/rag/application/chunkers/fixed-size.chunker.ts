import { Injectable } from '@nestjs/common';
import { ChunkDraft, Chunker, ChunkingOptions } from '../../domain/rag.types';

@Injectable()
export class FixedSizeChunker implements Chunker {
  chunk(text: string, options: ChunkingOptions): ChunkDraft[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    const chunks: ChunkDraft[] = [];
    const chunkSize = Math.max(200, options.chunkSize);
    const overlap = Math.max(0, Math.min(options.chunkOverlap, Math.floor(chunkSize / 2)));

    let start = 0;
    while (start < normalized.length) {
      const end = Math.min(start + chunkSize, normalized.length);
      const piece = normalized.slice(start, end).trim();
      if (piece.length > 0) {
        chunks.push({
          text: piece,
          section: 'full_document',
          tokenCount: this.estimateTokens(piece)
        });
      }

      if (end >= normalized.length) {
        break;
      }

      start = Math.max(end - overlap, start + 1);
    }

    return chunks;
  }

  private estimateTokens(text: string): number {
    const words = text.split(/\s+/).filter((item) => item.length > 0);
    return Math.max(1, Math.round(words.length * 1.3));
  }
}
