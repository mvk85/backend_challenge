import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GithubMcpProvider } from '../src/mcp/infrastructure/providers/github-mcp.provider';

describe('GithubMcpProvider', () => {
  const configValues: Record<string, string> = {
    MCP_CALL_TIMEOUT_MS: '20000',
    GITHUB_PERSONAL_ACCESS_TOKEN: 'token-123'
  };

  const createProvider = (): GithubMcpProvider => {
    const configService = {
      get: jest.fn((key: string) => configValues[key])
    } as unknown as ConfigService;

    return new GithubMcpProvider(configService);
  };

  it('adds local get_repository tool to listed tools', async () => {
    const provider = createProvider();
    const mockedClient = {
      listTools: jest.fn().mockResolvedValue({
        tools: [
          {
            name: 'search_repositories',
            description: 'Search repos',
            inputSchema: { type: 'object' }
          }
        ]
      })
    };
    (provider as unknown as { client: unknown }).client = mockedClient;

    const tools = await provider.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['search_repositories', 'get_repository', 'get_repo_stars'])
    );
    const getRepositoryTool = tools.find((tool) => tool.name === 'get_repository');
    expect(getRepositoryTool).toBeDefined();
    expect(getRepositoryTool?.inputSchema).toMatchObject({
      required: ['owner', 'repo']
    });
  });

  it('calls GitHub REST API for get_repository tool', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'x-ratelimit-remaining': '4999' }),
      json: jest.fn().mockResolvedValue({ id: 1, full_name: 'octocat/Hello-World' })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.callTool('get_repository', { owner: 'octocat', repo: 'Hello-World' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/octocat/Hello-World',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer token-123'
        })
      })
    );
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: '{\n  "id": 1,\n  "full_name": "octocat/Hello-World"\n}'
      }
    ]);
    expect(result.raw).toEqual({
      content: [
        {
          type: 'text',
          text: '{\n  "id": 1,\n  "full_name": "octocat/Hello-World"\n}'
        }
      ],
      isError: false
    });
  });

  it('returns only stars count for get_repo_stars tool', async () => {
    const provider = createProvider();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: 1, full_name: 'octocat/Hello-World', stargazers_count: 42 })
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await provider.callTool('get_repo_stars', { owner: 'octocat', repo: 'Hello-World' });

    expect(result.isError).toBe(false);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: '{\n  "stars_count": 42\n}'
      }
    ]);
    expect(result.raw).toEqual({
      content: [
        {
          type: 'text',
          text: '{\n  "stars_count": 42\n}'
        }
      ],
      isError: false
    });
  });

  it('validates required args for get_repository tool', async () => {
    const provider = createProvider();

    await expect(provider.callTool('get_repository', { owner: 'octocat' })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
