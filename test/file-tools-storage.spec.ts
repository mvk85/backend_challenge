import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const { FileStorage } = require('../mcp-servers/file-tools-mcp/lib/file-storage');

describe('file-tools FileStorage', () => {
  const originalStorageDirectory = process.env.FILE_TOOLS_STORAGE_DIR;
  const originalPublicBaseUrl = process.env.FILE_TOOLS_PUBLIC_BASE_URL;

  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'file-tools-storage-'));
    process.env.FILE_TOOLS_STORAGE_DIR = tempDirectory;
    process.env.FILE_TOOLS_PUBLIC_BASE_URL = 'http://localhost:3001';
  });

  afterEach(async () => {
    process.env.FILE_TOOLS_STORAGE_DIR = originalStorageDirectory;
    process.env.FILE_TOOLS_PUBLIC_BASE_URL = originalPublicBaseUrl;
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('saves text to file and returns download url', async () => {
    const fileStorage = new FileStorage();

    const result = await fileStorage.saveText('hello from tool', 'report');

    expect(result.fileId).toMatch(/\.txt$/);
    expect(result.downloadUrl).toBe(`http://localhost:3001/downloads/${encodeURIComponent(result.fileId)}`);

    const saved = await readFile(path.join(tempDirectory, result.fileId), 'utf8');
    expect(saved).toBe('hello from tool');
  });
});
