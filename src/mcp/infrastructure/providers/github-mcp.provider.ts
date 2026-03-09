import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpProviderPort, McpToolDefinition, McpToolInvocationResult } from '../../domain/ports/mcp-provider.port';

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

    return response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolInvocationResult> {
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
    if (!this.client) {
      return { connected: false, details: 'Client is not connected yet' };
    }

    try {
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

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race<T>([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(`MCP request timeout after ${this.timeoutMs}ms`)), this.timeoutMs);
      })
    ]);
  }
}
