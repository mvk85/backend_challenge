import { McpProviderId, McpProviderPort } from './mcp-provider.port';

export interface McpProviderRegistryPort {
  listProviderIds(): McpProviderId[];
  resolve(providerId: McpProviderId): McpProviderPort;
}
