import { ConfigService } from '@nestjs/config';
import { loadExternalMcpProviderConfigs } from '../src/mcp/infrastructure/providers/external-mcp-provider-config';

describe('loadExternalMcpProviderConfigs', () => {
  it('returns parsed provider configs', () => {
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'MCP_EXTERNAL_PROVIDERS_JSON') {
          return JSON.stringify([
            {
              id: 'file-tools',
              command: 'node',
              args: ['mcp-servers/file-tools-mcp/index.js'],
              env: {
                FILE_TOOLS_STORAGE_DIR: './storage/files',
                FILE_TOOLS_PUBLIC_BASE_URL: 'http://localhost:3001'
              },
              timeoutMs: 15000
            }
          ]);
        }

        return undefined;
      })
    } as unknown as ConfigService;

    const providers = loadExternalMcpProviderConfigs(configService);

    expect(providers).toEqual([
      {
        id: 'file-tools',
        command: 'node',
        args: ['mcp-servers/file-tools-mcp/index.js'],
        env: {
          FILE_TOOLS_STORAGE_DIR: './storage/files',
          FILE_TOOLS_PUBLIC_BASE_URL: 'http://localhost:3001'
        },
        timeoutMs: 15000
      }
    ]);
  });

  it('returns empty array when config is empty', () => {
    const configService = {
      get: jest.fn(() => '')
    } as unknown as ConfigService;

    expect(loadExternalMcpProviderConfigs(configService)).toEqual([]);
  });

  it('throws for invalid JSON structure', () => {
    const configService = {
      get: jest.fn(() => '{"id":"not-array"}')
    } as unknown as ConfigService;

    expect(() => loadExternalMcpProviderConfigs(configService)).toThrow('must be a JSON array');
  });
});
