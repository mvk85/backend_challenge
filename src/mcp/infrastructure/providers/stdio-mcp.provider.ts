import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpProviderId, McpProviderPort, McpToolDefinition, McpToolInvocationResult } from '../../domain/ports/mcp-provider.port';

export interface StdioMcpProviderConfig {
  id: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  timeoutMs: number;
}

export class StdioMcpProvider implements McpProviderPort {
  readonly providerId: McpProviderId;

  private readonly logger: Logger;
  private readonly timeoutMs: number;

  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  constructor(private readonly config: StdioMcpProviderConfig) {
    this.providerId = config.id;
    this.timeoutMs = config.timeoutMs;
    this.logger = new Logger(`StdioMcpProvider(${config.id})`);
  }

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = new Client(
      {
        name: `firstai-backend-client-${this.providerId}`,
        version: '0.1.0'
      },
      {
        capabilities: {}
      }
    );

    this.transport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      env: {
        ...this.config.env
      },
      stderr: 'pipe'
    });

    if (this.transport.stderr) {
      this.transport.stderr.on('data', (chunk: Buffer | string) => {
        this.logger.debug(`${this.providerId} stderr: ${String(chunk).trim()}`);
      });
    }

    try {
      await this.withTimeout(this.client.connect(this.transport));
    } catch (error) {
      await this.disconnect();
      throw new ServiceUnavailableException(
        `Unable to connect MCP provider '${this.providerId}': ${(error as Error).message}`
      );
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
      throw new ServiceUnavailableException(`MCP provider '${this.providerId}' is not connected`);
    }

    return this.client;
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
