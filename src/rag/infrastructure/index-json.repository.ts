import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { RagIndexDocument } from '../domain/rag.types';

@Injectable()
export class IndexJsonRepository {
  private readonly indexDir: string;
  private readonly fileStorageDir: string;

  constructor(private readonly configService: ConfigService) {
    const configuredIndexDir = this.configService.get<string>('RAG_INDEX_DIR') ?? './storage/indexes';
    const configuredFileDir = this.configService.get<string>('FILE_STORAGE_DIR') ?? './storage/files';
    this.indexDir = path.resolve(process.cwd(), configuredIndexDir);
    this.fileStorageDir = path.resolve(process.cwd(), configuredFileDir);
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

  async list(): Promise<Array<{ indexId: string; indexPath: string; indexMeta: RagIndexDocument['index_meta'] }>> {
    await fs.mkdir(this.indexDir, { recursive: true });
    const entries = await fs.readdir(this.indexDir, { withFileTypes: true });
    const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name);

    const indexes = await Promise.all(
      jsonFiles.map(async (fileName) => {
        const indexId = fileName.replace(/\.json$/u, '');
        const indexPath = path.join(this.indexDir, fileName);
        const index = await this.read(indexId);
        return {
          indexId,
          indexPath,
          indexMeta: index.index_meta
        };
      })
    );

    return indexes.sort((a, b) => b.indexMeta.created_at.localeCompare(a.indexMeta.created_at));
  }

  async delete(
    indexId: string
  ): Promise<{ deleted: boolean; indexId: string; indexPath: string; sourceFileDeleted: boolean; sourceFilePath?: string }> {
    const index = await this.read(indexId);
    const fullPath = this.getPathById(indexId);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new NotFoundException(`Index '${indexId}' not found`);
      }
      throw error;
    }

    const sourceFileDeleted = await this.tryDeleteSourceFile(index, indexId);

    return {
      deleted: true,
      indexId,
      indexPath: fullPath,
      sourceFileDeleted,
      ...(sourceFileDeleted ? { sourceFilePath: index.index_meta.file_path } : {})
    };
  }

  getPathById(indexId: string): string {
    return path.join(this.indexDir, `${indexId}.json`);
  }

  getStorageDir(): string {
    return this.indexDir;
  }

  private async tryDeleteSourceFile(index: RagIndexDocument, deletedIndexId: string): Promise<boolean> {
    if (!this.isSourceOwningIndex(index)) {
      return false;
    }

    const sourceFilePath = path.resolve(index.index_meta.file_path);
    if (!this.isWithinDirectory(sourceFilePath, this.fileStorageDir)) {
      return false;
    }

    const stillReferenced = await this.hasRemainingSourceReference(sourceFilePath, deletedIndexId);
    if (stillReferenced) {
      return false;
    }

    try {
      await fs.unlink(sourceFilePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }

      throw error;
    }
  }

  private async hasRemainingSourceReference(sourceFilePath: string, deletedIndexId: string): Promise<boolean> {
    await fs.mkdir(this.indexDir, { recursive: true });
    const entries = await fs.readdir(this.indexDir, { withFileTypes: true });
    const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name);

    for (const fileName of jsonFiles) {
      const indexId = fileName.replace(/\.json$/u, '');
      if (indexId === deletedIndexId) {
        continue;
      }

      try {
        const index = await this.read(indexId);
        if (!this.isSourceOwningIndex(index)) {
          continue;
        }

        if (path.resolve(index.index_meta.file_path) === sourceFilePath) {
          return true;
        }
      } catch {
        continue;
      }
    }

    return false;
  }

  private isSourceOwningIndex(index: RagIndexDocument): boolean {
    return index.index_meta.chunks_count > 0;
  }

  private isWithinDirectory(targetPath: string, directoryPath: string): boolean {
    const normalizedDir = directoryPath.endsWith(path.sep) ? directoryPath : `${directoryPath}${path.sep}`;
    return targetPath === directoryPath || targetPath.startsWith(normalizedDir);
  }
}
