import { Injectable } from '@nestjs/common';
import { McpProviderId, McpToolDefinition, McpToolInvocationResult } from '../domain/ports/mcp-provider.port';
import { McpProviderRegistry } from '../infrastructure/mcp-provider.registry';

@Injectable()
export class ToolInvocationService {
  constructor(private readonly providerRegistry: McpProviderRegistry) {}

  listProviders(): McpProviderId[] {
    return this.providerRegistry.listProviderIds();
  }

  async listTools(providerId: McpProviderId): Promise<McpToolDefinition[]> {
    const provider = this.providerRegistry.resolve(providerId);
    await provider.connect();
    return provider.listTools();
  }

  async invokeTool(
    providerId: McpProviderId,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<McpToolInvocationResult> {
    const provider = this.providerRegistry.resolve(providerId);
    await provider.connect();
    return provider.callTool(toolName, args);
  }

  async health(providerId: McpProviderId): Promise<{ connected: boolean; details?: unknown }> {
    const provider = this.providerRegistry.resolve(providerId);
    return provider.healthCheck();
  }
}
