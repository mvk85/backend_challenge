import { Injectable } from '@nestjs/common';
import { ChunkDraft, Chunker, ChunkingOptions } from '../../domain/rag.types';

interface SectionBlock {
  name: string;
  body: string;
}

@Injectable()
export class StructuredChunker implements Chunker {
  chunk(text: string, options: ChunkingOptions): ChunkDraft[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) {
      return [];
    }

    const sections = this.splitByStructure(normalized);
    const chunkSize = Math.max(200, options.chunkSize);
    const overlap = Math.max(0, Math.min(options.chunkOverlap, Math.floor(chunkSize / 2)));
    const chunks: ChunkDraft[] = [];

    for (const section of sections) {
      const sectionText = section.body.trim();
      if (!sectionText) {
        continue;
      }

      if (sectionText.length <= chunkSize) {
        chunks.push({
          text: sectionText,
          section: section.name,
          tokenCount: this.estimateTokens(sectionText)
        });
        continue;
      }

      let start = 0;
      while (start < sectionText.length) {
        const end = Math.min(start + chunkSize, sectionText.length);
        const piece = sectionText.slice(start, end).trim();
        if (piece.length > 0) {
          chunks.push({
            text: piece,
            section: section.name,
            tokenCount: this.estimateTokens(piece)
          });
        }

        if (end >= sectionText.length) {
          break;
        }

        start = Math.max(end - overlap, start + 1);
      }
    }

    return chunks;
  }

  private splitByStructure(text: string): SectionBlock[] {
    const lines = text.split('\n');
    const sections: SectionBlock[] = [];

    let currentTitle = 'introduction';
    let currentBody: string[] = [];

    for (const line of lines) {
      const heading = this.extractHeading(line);
      if (heading) {
        if (currentBody.length > 0) {
          sections.push({
            name: currentTitle,
            body: currentBody.join('\n').trim()
          });
        }

        currentTitle = heading;
        currentBody = [];
        continue;
      }

      currentBody.push(line);
    }

    if (currentBody.length > 0) {
      sections.push({
        name: currentTitle,
        body: currentBody.join('\n').trim()
      });
    }

    return sections.length > 0 ? sections : [{ name: 'full_document', body: text }];
  }

  private extractHeading(line: string): string | null {
    const trimmed = line.trim();
    if (!trimmed) {
      return null;
    }

    const markdownMatch = /^#{1,6}\s+(.+)$/u.exec(trimmed);
    if (markdownMatch && markdownMatch[1]) {
      return markdownMatch[1].trim();
    }

    const numberedMatch = /^(\d+(?:\.\d+)*)[.)]?\s+(.+)$/u.exec(trimmed);
    if (numberedMatch && numberedMatch[2]) {
      return `${numberedMatch[1]} ${numberedMatch[2].trim()}`.trim();
    }

    const uppercaseMatch = /^[A-ZА-Я][A-ZА-Я0-9\s\-]{3,}$/u.exec(trimmed);
    if (uppercaseMatch) {
      return trimmed;
    }

    return null;
  }

  private estimateTokens(text: string): number {
    const words = text.split(/\s+/).filter((item) => item.length > 0);
    return Math.max(1, Math.round(words.length * 1.3));
  }
}
