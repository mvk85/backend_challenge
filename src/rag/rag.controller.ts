import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { BuildIndexRequestDto } from './interfaces/dto/build-index.request.dto';
import { CompareChunkingRequestDto } from './interfaces/dto/compare-chunking.request.dto';
import { RetrieveRequestDto } from './interfaces/dto/retrieve.request.dto';
import { IndexIdParamDto } from './interfaces/dto/index-id-param.dto';
import { IndexBuilderService } from './application/index-builder.service';
import { CompareChunkingService } from './application/compare-chunking.service';
import { RetrieveService } from './application/retrieve.service';
import { IndexJsonRepository } from './infrastructure/index-json.repository';
import { ProxyApiEmbeddingsClient } from './infrastructure/proxyapi-embeddings.client';

@ApiTags('rag')
@Controller('rag')
export class RagController {
  constructor(
    private readonly indexBuilderService: IndexBuilderService,
    private readonly compareChunkingService: CompareChunkingService,
    private readonly retrieveService: RetrieveService,
    private readonly indexRepository: IndexJsonRepository,
    private readonly embeddingsClient: ProxyApiEmbeddingsClient
  ) {}

  @ApiOperation({ summary: 'Build local JSON index with embeddings for one strategy' })
  @ApiBody({
    type: BuildIndexRequestDto,
    examples: {
      fixed: {
        summary: 'Fixed-size chunking',
        value: {
          source: 'local-file',
          filePath: './storage/files/knowledge-base.txt',
          title: 'Knowledge Base v1',
          strategy: 'fixed',
          chunkSize: 1200,
          chunkOverlap: 200
        }
      },
      structured: {
        summary: 'Structured chunking',
        value: {
          source: 'local-file',
          filePath: './storage/files/knowledge-base.txt',
          strategy: 'structured',
          chunkSize: 1200,
          chunkOverlap: 200
        }
      }
    }
  })
  @ApiOkResponse({
    description: 'Index build result',
    schema: {
      example: {
        indexId: 'knowledge-base-v1-fixed-20260316214258',
        indexPath: '/app/storage/indexes/knowledge-base-v1-fixed-20260316214258.json',
        chunksCount: 19,
        model: 'text-embedding-3-small',
        dimensions: 1536,
        createdAt: '2026-03-16T21:42:58.562Z'
      }
    }
  })
  @Post('indexes/build')
  async buildIndex(@Body() request: BuildIndexRequestDto): Promise<unknown> {
    return this.indexBuilderService.build(request);
  }

  @ApiOperation({ summary: 'Build indexes for fixed and structured strategies and compare them' })
  @ApiBody({
    type: CompareChunkingRequestDto,
    examples: {
      default: {
        summary: 'Compare two chunking strategies',
        value: {
          source: 'local-file',
          filePath: './storage/files/knowledge-base.txt',
          title: 'Knowledge Base v1',
          chunkSize: 1200,
          chunkOverlap: 200
        }
      }
    }
  })
  @ApiOkResponse({
    description: 'Chunking comparison result',
    schema: {
      example: {
        fixed: {
          indexId: 'knowledge-base-v1-fixed-20260316214512',
          indexPath: '/app/storage/indexes/knowledge-base-v1-fixed-20260316214512.json',
          stats: {
            chunks_count: 19,
            avg_length: 1140,
            median_length: 1187,
            min_length: 408,
            max_length: 1200
          }
        },
        structured: {
          indexId: 'knowledge-base-v1-structured-20260316214516',
          indexPath: '/app/storage/indexes/knowledge-base-v1-structured-20260316214516.json',
          stats: {
            chunks_count: 14,
            avg_length: 1089,
            median_length: 1123,
            min_length: 302,
            max_length: 1200
          }
        },
        reportPath: '/app/storage/indexes/knowledge-base-v1-fixed-20260316214512-vs-knowledge-base-v1-structured-20260316214516.json'
      }
    }
  })
  @Post('indexes/compare')
  async compareChunking(@Body() request: CompareChunkingRequestDto): Promise<unknown> {
    return this.compareChunkingService.compare(request);
  }

  @ApiOperation({ summary: 'Semantic retrieval from local index by query' })
  @ApiBody({
    type: RetrieveRequestDto,
    examples: {
      default: {
        summary: 'Retrieve top chunks',
        value: {
          indexId: 'knowledge-base-v1-fixed-20260316214258',
          query: 'How to configure OAuth token in backend?',
          topK: 5
        }
      }
    }
  })
  @ApiOkResponse({
    description: 'Top matching chunks',
    schema: {
      example: {
        indexId: 'knowledge-base-v1-fixed-20260316214258',
        query: 'How to configure OAuth token in backend?',
        topK: 5,
        matches: [
          {
            score: 0.8345,
            text: 'To configure OAuth token set GITHUB_PERSONAL_ACCESS_TOKEN in .env...',
            metadata: {
              source: 'local-file',
              file: 'knowledge-base.txt',
              title: 'Knowledge Base v1',
              section: 'Authentication',
              chunk_id: 'knowledge-base-v1-fixed-20260316214258_0003',
              strategy: 'fixed',
              token_count: 221
            }
          }
        ]
      }
    }
  })
  @Post('retrieve')
  async retrieve(@Body() request: RetrieveRequestDto): Promise<unknown> {
    return this.retrieveService.retrieve(request);
  }

  @ApiOperation({ summary: 'Get index metadata and storage path' })
  @ApiParam({ name: 'indexId', description: 'Index identifier' })
  @ApiOkResponse({
    description: 'Index details',
    schema: {
      example: {
        index_meta: {
          index_id: 'knowledge-base-v1-fixed-20260316214258',
          source: 'local-file',
          file_path: '/app/storage/files/knowledge-base.txt',
          title: 'Knowledge Base v1',
          strategy: 'fixed',
          model: 'text-embedding-3-small',
          created_at: '2026-03-16T21:42:58.562Z',
          dimensions: 1536,
          chunks_count: 19
        },
        indexPath: '/app/storage/indexes/knowledge-base-v1-fixed-20260316214258.json'
      }
    }
  })
  @Get('indexes/:indexId')
  async getIndex(@Param() params: IndexIdParamDto): Promise<unknown> {
    const index = await this.indexRepository.read(params.indexId);
    return {
      index_meta: index.index_meta,
      indexPath: this.indexRepository.getPathById(params.indexId)
    };
  }

  @ApiOperation({ summary: 'Check RAG module health and embedding config' })
  @ApiOkResponse({
    description: 'Health status',
    schema: {
      example: {
        status: 'ok',
        embeddings: {
          configured: true,
          url: 'https://api.proxyapi.ru/openai/v1/embeddings',
          model: 'text-embedding-3-small'
        },
        storageDir: '/app/storage/indexes'
      }
    }
  })
  @Get('health')
  health(): unknown {
    return {
      status: 'ok',
      embeddings: this.embeddingsClient.getHealth(),
      storageDir: this.indexRepository.getStorageDir()
    };
  }
}
