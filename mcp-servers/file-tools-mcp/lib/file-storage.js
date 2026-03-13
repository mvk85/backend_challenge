const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_TEXT_SIZE_LIMIT = 1_000_000;

class FileStorage {
  constructor() {
    const configuredStorageDirectory = process.env.FILE_TOOLS_STORAGE_DIR || './storage/files';
    this.storageDirectory = path.resolve(process.cwd(), configuredStorageDirectory);
    this.publicBaseUrl = (process.env.FILE_TOOLS_PUBLIC_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
    this.maxTextSize = Number(process.env.FILE_TOOLS_MAX_TEXT_SIZE || DEFAULT_TEXT_SIZE_LIMIT);
  }

  async saveText(text, requestedFileName) {
    const normalizedText = typeof text === 'string' ? text : String(text);
    const textSize = Buffer.byteLength(normalizedText, 'utf8');
    if (textSize === 0) {
      throw new Error('text must not be empty');
    }
    if (Number.isFinite(this.maxTextSize) && this.maxTextSize > 0 && textSize > this.maxTextSize) {
      throw new Error(`text size exceeds limit of ${this.maxTextSize} bytes`);
    }

    await fs.mkdir(this.storageDirectory, { recursive: true });

    const safeBaseName = this.makeSafeBaseName(requestedFileName);
    const fileId = `${crypto.randomUUID()}-${safeBaseName}.txt`;
    const fullPath = path.resolve(this.storageDirectory, fileId);

    await fs.writeFile(fullPath, normalizedText, { encoding: 'utf8' });

    return {
      fileId,
      bytes: textSize,
      downloadUrl: `${this.publicBaseUrl}/downloads/${encodeURIComponent(fileId)}`,
      createdAt: new Date().toISOString()
    };
  }

  makeSafeBaseName(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return 'text';
    }

    const normalized = value
      .toLowerCase()
      .trim()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!normalized) {
      return 'text';
    }

    return normalized.slice(0, 64);
  }
}

module.exports = {
  FileStorage
};
