import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { RagIndexDocument } from '../domain/rag.types';

@Injectable()
export class IndexJsonRepository {
  private readonly indexDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDir = this.configService.get<string>('RAG_INDEX_DIR') ?? './storage/indexes';
    this.indexDir = path.resolve(process.cwd(), configuredDir);
  }

  async save(index: RagIndexDocument): Promise<string> {
    await fs.mkdir(this.indexDir, { recursive: true });

    const fileName = `${index.index_meta.index_id}.json`;
    const fullPath = path.join(this.indexDir, fileName);

    await fs.writeFile(fullPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8');
    return fullPath;
  }

  async read(indexId: string): Promise<RagIndexDocument> {
    const fullPath = this.getPathById(indexId);

    let raw: string;
    try {
      raw = await fs.readFile(fullPath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException(`Index '${indexId}' not found`);
      }
      throw error;
    }

    return JSON.parse(raw) as RagIndexDocument;
  }

  getPathById(indexId: string): string {
    return path.join(this.indexDir, `${indexId}.json`);
  }

  getStorageDir(): string {
    return this.indexDir;
  }
}
