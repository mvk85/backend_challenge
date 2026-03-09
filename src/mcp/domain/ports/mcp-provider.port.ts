export type McpProviderId = 'github' | string;

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

export interface McpToolInvocationResult {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
  raw: unknown;
}

export interface McpProviderPort {
  readonly providerId: McpProviderId;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<McpToolDefinition[]>;
  callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolInvocationResult>;
  healthCheck(): Promise<{ connected: boolean; details?: unknown }>;
}
