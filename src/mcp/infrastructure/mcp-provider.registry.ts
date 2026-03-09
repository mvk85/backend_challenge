import { Injectable, NotFoundException } from '@nestjs/common';
import { McpProviderRegistryPort } from '../domain/ports/mcp-provider-registry.port';
import { McpProviderId, McpProviderPort } from '../domain/ports/mcp-provider.port';

@Injectable()
export class McpProviderRegistry implements McpProviderRegistryPort {
  private readonly providersById: Map<McpProviderId, McpProviderPort>;

  constructor(providers: McpProviderPort[]) {
    this.providersById = new Map(providers.map((provider) => [provider.providerId, provider]));
  }

  listProviderIds(): McpProviderId[] {
    return [...this.providersById.keys()];
  }

  resolve(providerId: McpProviderId): McpProviderPort {
    const provider = this.providersById.get(providerId);
    if (!provider) {
      throw new NotFoundException(`MCP provider '${providerId}' is not registered`);
    }

    return provider;
  }
}
