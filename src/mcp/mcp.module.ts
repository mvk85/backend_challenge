import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ToolInvocationService } from './application/tool-invocation.service';
import { McpProviderRegistry } from './infrastructure/mcp-provider.registry';
import { GithubMcpProvider } from './infrastructure/providers/github-mcp.provider';
import { McpController } from './mcp.controller';
import { McpProviderPort } from './domain/ports/mcp-provider.port';

const MCP_PROVIDERS = 'MCP_PROVIDERS';

@Module({
  imports: [ConfigModule],
  controllers: [McpController],
  providers: [
    ToolInvocationService,
    GithubMcpProvider,
    {
      provide: MCP_PROVIDERS,
      inject: [GithubMcpProvider],
      useFactory: (githubProvider: GithubMcpProvider): McpProviderPort[] => [githubProvider]
    },
    {
      provide: McpProviderRegistry,
      inject: [MCP_PROVIDERS],
      useFactory: (providers: McpProviderPort[]): McpProviderRegistry => new McpProviderRegistry(providers)
    }
  ]
})
export class McpModule {}
