import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpProviderPort, McpToolDefinition, McpToolInvocationResult } from '../../domain/ports/mcp-provider.port';

const GET_REPOSITORY_TOOL_NAME = 'get_repository';
const GET_REPO_STARS_TOOL_NAME = 'get_repo_stars';

@Injectable()
export class GithubMcpProvider implements McpProviderPort {
  readonly providerId = 'github' as const;

  private readonly logger = new Logger(GithubMcpProvider.name);
  private readonly timeoutMs: number;

  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = Number(this.configService.get('MCP_CALL_TIMEOUT_MS') ?? 20000);
  }

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const token = this.configService.get<string>('GITHUB_PERSONAL_ACCESS_TOKEN');
    if (!token) {
      throw new ServiceUnavailableException('GITHUB_PERSONAL_ACCESS_TOKEN is not configured');
    }

    const command = this.configService.get<string>('MCP_GITHUB_COMMAND') ?? 'npx';
    const argsRaw = this.configService.get<string>('MCP_GITHUB_ARGS') ?? '-y @modelcontextprotocol/server-github';
    const args = argsRaw
      .split(' ')
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length > 0);

    this.client = new Client(
      {
        name: 'firstai-backend-client',
        version: '0.1.0'
      },
      {
        capabilities: {}
      }
    );

    this.transport = new StdioClientTransport({
      command,
      args,
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: token
      },
      stderr: 'pipe'
    });

    if (this.transport.stderr) {
      this.transport.stderr.on('data', (chunk: Buffer | string) => {
        this.logger.debug(`github-mcp stderr: ${String(chunk).trim()}`);
      });
    }

    try {
      await this.withTimeout(this.client.connect(this.transport));
    } catch (error) {
      await this.disconnect();
      throw new ServiceUnavailableException(`Unable to connect GitHub MCP: ${(error as Error).message}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.transport?.close().catch(() => undefined);
    this.client = null;
    this.transport = null;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const client = this.ensureClient();
    const response = await this.withTimeout(client.listTools());

    const remoteTools: McpToolDefinition[] = response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));

    return [...remoteTools, this.getRepositoryToolDefinition(), this.getRepoStarsToolDefinition()];
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolInvocationResult> {
    if (toolName === GET_REPOSITORY_TOOL_NAME) {
      return this.callGetRepository(args);
    }
    if (toolName === GET_REPO_STARS_TOOL_NAME) {
      return this.callGetRepoStars(args);
    }

    const client = this.ensureClient();
    const response = await this.withTimeout(client.callTool({ name: toolName, arguments: args }));

    return {
      content: response.content,
      structuredContent: response.structuredContent,
      isError: typeof response.isError === 'boolean' ? response.isError : undefined,
      raw: response
    };
  }

  async healthCheck(): Promise<{ connected: boolean; details?: unknown }> {
    try {
      await this.connect();
      const tools = await this.listTools();
      return {
        connected: true,
        details: {
          toolsCount: tools.length
        }
      };
    } catch (error) {
      return {
        connected: false,
        details: (error as Error).message
      };
    }
  }

  private ensureClient(): Client {
    if (!this.client) {
      throw new ServiceUnavailableException('GitHub MCP client is not connected');
    }

    return this.client;
  }

  private getRepositoryToolDefinition(): McpToolDefinition {
    return {
      name: GET_REPOSITORY_TOOL_NAME,
      description: 'Fetch a GitHub repository by owner and repo name via GitHub REST API.',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner login'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          }
        },
        required: ['owner', 'repo'],
        additionalProperties: false
      }
    };
  }

  private getRepoStarsToolDefinition(): McpToolDefinition {
    return {
      name: GET_REPO_STARS_TOOL_NAME,
      description: 'Fetch only repository stars count by owner and repo name.',
      inputSchema: {
        type: 'object',
        properties: {
          owner: {
            type: 'string',
            description: 'Repository owner login'
          },
          repo: {
            type: 'string',
            description: 'Repository name'
          }
        },
        required: ['owner', 'repo'],
        additionalProperties: false
      }
    };
  }

  private async callGetRepository(args: Record<string, unknown>): Promise<McpToolInvocationResult> {
    const response = await this.fetchRepository(args, GET_REPOSITORY_TOOL_NAME);
    return this.toMcpTextResult(await response.json().catch(() => null), !response.ok);
  }

  private async callGetRepoStars(args: Record<string, unknown>): Promise<McpToolInvocationResult> {
    const response = await this.fetchRepository(args, GET_REPO_STARS_TOOL_NAME);
    const responseBody = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    const starsCount = this.readStarsCount(responseBody);
    return this.toMcpTextResult({ stars_count: starsCount }, !response.ok);
  }

  private readStarsCount(responseBody: Record<string, unknown> | null): number | null {
    const rawStars = responseBody?.stargazers_count;
    return typeof rawStars === 'number' ? rawStars : null;
  }

  private async fetchRepository(args: Record<string, unknown>, toolName: string): Promise<Response> {
    const owner = this.readRequiredStringArg(args, 'owner', toolName);
    const repo = this.readRequiredStringArg(args, 'repo', toolName);
    const token = this.configService.get<string>('GITHUB_PERSONAL_ACCESS_TOKEN');

    if (!token) {
      throw new ServiceUnavailableException('GITHUB_PERSONAL_ACCESS_TOKEN is not configured');
    }

    return this.withTimeout(
      fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`
        }
      })
    );
  }

  private toMcpTextResult(payload: unknown, isError: boolean): McpToolInvocationResult {
    const responseBody = payload;
    const textPayload = this.serializeAsMcpText(responseBody);
    const content = [
      {
        type: 'text',
        text: textPayload
      }
    ];

    return {
      content,
      isError,
      raw: {
        content,
        isError
      }
    };
  }

  private readRequiredStringArg(args: Record<string, unknown>, key: string, toolName: string): string {
    const rawValue = args[key];
    if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
      throw new ServiceUnavailableException(`Tool '${toolName}' requires string argument '${key}'`);
    }

    return rawValue.trim();
  }

  private serializeAsMcpText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`MCP request timeout after ${this.timeoutMs}ms`)), this.timeoutMs);
        })
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
