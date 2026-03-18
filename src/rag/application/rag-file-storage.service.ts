import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface UploadedRagFileInfo {
  fileId: string;
  filePath: string;
  originalName: string;
  size: number;
  mimeType: string;
}

interface UploadedFilePayload {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
}

@Injectable()
export class RagFileStorageService {
  private readonly storageDirectory: string;
  private readonly maxFileBytes: number;

  constructor(private readonly configService: ConfigService) {
    const configuredDirectory = this.configService.get<string>('FILE_STORAGE_DIR') ?? './storage/files';
    this.storageDirectory = path.resolve(process.cwd(), configuredDirectory);
    this.maxFileBytes = Number(this.configService.get('RAG_UPLOAD_MAX_BYTES') ?? 5 * 1024 * 1024);
  }

  async saveUpload(file: UploadedFilePayload | undefined): Promise<UploadedRagFileInfo> {
    if (!file) {
      throw new BadRequestException("Multipart field 'file' is required");
    }

    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (file.buffer.length > this.maxFileBytes) {
      throw new BadRequestException(`File is too large. Limit is ${this.maxFileBytes} bytes`);
    }

    await fs.mkdir(this.storageDirectory, { recursive: true });

    const extension = this.resolveExtension(file.originalname);
    const fileId = this.buildFileId(file.originalname, extension);
    const fullPath = path.join(this.storageDirectory, fileId);

    await fs.writeFile(fullPath, file.buffer);

    return {
      fileId,
      filePath: fullPath,
      originalName: file.originalname,
      size: file.size,
      mimeType: file.mimetype
    };
  }

  private resolveExtension(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    if (!ext || ext.length > 12 || /[^.a-z0-9]/u.test(ext)) {
      return '.txt';
    }

    return ext;
  }

  private buildFileId(originalName: string, extension: string): string {
    const base = path
      .basename(originalName, path.extname(originalName))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'document';

    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 8);
    return `${base}-${stamp}-${random}${extension}`;
  }
}
