import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmMcpProvider } from '../src/mcp/infrastructure/providers/llm-mcp.provider';

describe('LlmMcpProvider', () => {
  const configValues: Record<string, string> = {
    MCP_CALL_TIMEOUT_MS: '20000',
    PROXYAPI_OPENAI_API_KEY: 'proxy-token',
    PROXYAPI_OPENAI_API_URL: 'https://openai.api.proxyapi.ru/v1/chat/completions',
    PROXYAPI_OPENAI_MODEL: 'gpt-5.1'
  };

  const createProvider = (overrideValues?: Record<string, string>): LlmMcpProvider => {
    const mergedValues = { ...configValues, ...(overrideValues ?? {}) };
    const configService = {
      get: jest.fn((key: string) => mergedValues[key])
    } as unknown as ConfigService;

    return new LlmMcpProvider(configService);
  };

  it('lists summary_json tool for llm provider', async () => {
    const provider = createProvider();

    const tools = await provider.listTools();

    expect(tools).toHaveLength(1);
    expect(tools[0]).toMatchObject({
      name: 'summary_json'
    });
  });

  it('invokes ProxyAPI and returns summary payload', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        model: 'gpt-5.1',
        choices: [
          {
            message: {
              content: 'Сводка по theme: есть 2 ключевые проблемы.'
            }
          }
        ],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120
        }
      })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.callTool('summary_json', {
      issues: [{ theme: 'auth', count: 2 }],
      prompt: 'суммаризация по полю theme'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://openai.api.proxyapi.ru/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer proxy-token'
        })
      })
    );
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toMatchObject({
      summary: 'Сводка по theme: есть 2 ключевые проблемы.',
      model: 'gpt-5.1'
    });
  });

  it('throws when prompt is missing', async () => {
    const provider = createProvider();

    await expect(provider.callTool('summary_json', { issues: [] })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws for unknown tool name', async () => {
    const provider = createProvider();

    await expect(provider.callTool('unknown_tool', {})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails health check when API key is missing', async () => {
    const provider = createProvider({ PROXYAPI_OPENAI_API_KEY: '' });

    const health = await provider.healthCheck();

    expect(health.connected).toBe(false);
    expect(String(health.details)).toContain('ProxyAPI API key is not configured');
  });

  it('returns error payload when ProxyAPI responds with error status', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      json: jest.fn().mockResolvedValue({ error: { message: 'rate limit' } })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.callTool('summary_json', {
      issues: [{ theme: 'auth' }],
      prompt: 'summary'
    });

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({
      error: 'ProxyAPI request failed',
      status: 429
    });
  });

  it('throws when successful response has empty content', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: ''
            }
          }
        ]
      })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      provider.callTool('summary_json', {
        issues: [{ theme: 'auth' }],
        prompt: 'summary'
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
