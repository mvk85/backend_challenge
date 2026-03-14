import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ToolInvocationService } from './application/tool-invocation.service';
import { McpProviderRegistry } from './infrastructure/mcp-provider.registry';
import { GithubMcpProvider } from './infrastructure/providers/github-mcp.provider';
import { LlmMcpProvider } from './infrastructure/providers/llm-mcp.provider';
import { StdioMcpProvider } from './infrastructure/providers/stdio-mcp.provider';
import { loadExternalMcpProviderConfigs } from './infrastructure/providers/external-mcp-provider-config';
import { McpController } from './mcp.controller';
import { McpProviderPort } from './domain/ports/mcp-provider.port';
import { DownloadsController } from './downloads.controller';
import { FileDownloadService } from './application/file-download.service';
import { ConfigService } from '@nestjs/config';

const MCP_PROVIDERS = 'MCP_PROVIDERS';

@Module({
  imports: [ConfigModule],
  controllers: [McpController, DownloadsController],
  providers: [
    ToolInvocationService,
    FileDownloadService,
    GithubMcpProvider,
    LlmMcpProvider,
    {
      provide: MCP_PROVIDERS,
      inject: [GithubMcpProvider, LlmMcpProvider, ConfigService],
      useFactory: (githubProvider: GithubMcpProvider, llmProvider: LlmMcpProvider, configService: ConfigService): McpProviderPort[] => {
        const externalProviders = loadExternalMcpProviderConfigs(configService).map(
          (providerConfig) => new StdioMcpProvider(providerConfig)
        );

        return [githubProvider, llmProvider, ...externalProviders];
      }
    },
    {
      provide: McpProviderRegistry,
      inject: [MCP_PROVIDERS],
      useFactory: (providers: McpProviderPort[]): McpProviderRegistry => new McpProviderRegistry(providers)
    }
  ]
})
export class McpModule {}
