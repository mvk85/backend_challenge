import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

export interface DownloadableFile {
  fileName: string;
  fullPath: string;
  contentType: string;
}

const FILE_ID_PATTERN = /^[a-zA-Z0-9._-]+$/;

@Injectable()
export class FileDownloadService {
  private readonly storageDirectory: string;

  constructor(private readonly configService: ConfigService) {
    const configuredDirectory = this.configService.get<string>('FILE_STORAGE_DIR') ?? './storage/files';
    this.storageDirectory = path.resolve(process.cwd(), configuredDirectory);
  }

  async openForRead(fileId: string): Promise<{ stream: Readable; file: DownloadableFile }> {
    const file = await this.resolveDownloadableFile(fileId);
    return {
      stream: createReadStream(file.fullPath),
      file
    };
  }

  private async resolveDownloadableFile(fileId: string): Promise<DownloadableFile> {
    if (!FILE_ID_PATTERN.test(fileId)) {
      throw new NotFoundException('File was not found');
    }

    const fileName = path.basename(fileId);
    const fullPath = path.resolve(this.storageDirectory, fileName);

    if (!fullPath.startsWith(this.storageDirectory)) {
      throw new NotFoundException('File was not found');
    }

    try {
      await access(fullPath, constants.R_OK);
    } catch {
      throw new NotFoundException('File was not found');
    }

    return {
      fileName,
      fullPath,
      contentType: this.resolveContentType(fileName)
    };
  }

  private resolveContentType(fileName: string): string {
    if (fileName.toLowerCase().endsWith('.txt')) {
      return 'text/plain; charset=utf-8';
    }

    if (fileName.toLowerCase().endsWith('.json')) {
      return 'application/json; charset=utf-8';
    }

    return 'application/octet-stream';
  }
}
