import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { FileDownloadService } from '../src/mcp/application/file-download.service';

describe('FileDownloadService', () => {
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'file-download-service-'));
  });

  afterEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('opens existing file for download', async () => {
    const fileId = 'sample.txt';
    const fullPath = path.join(tempDirectory, fileId);
    await writeFile(fullPath, 'hello', 'utf8');

    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'FILE_STORAGE_DIR') {
          return tempDirectory;
        }
        return undefined;
      })
    } as unknown as ConfigService;

    const service = new FileDownloadService(configService);
    const result = await service.openForRead(fileId);

    expect(result.file.fileName).toBe(fileId);
    expect(result.file.fullPath).toBe(fullPath);
    expect(result.file.contentType).toBe('text/plain; charset=utf-8');
  });

  it('throws not found for invalid file id', async () => {
    const configService = {
      get: jest.fn(() => tempDirectory)
    } as unknown as ConfigService;

    const service = new FileDownloadService(configService);

    await expect(service.openForRead('../secret.txt')).rejects.toBeInstanceOf(NotFoundException);
  });
});
