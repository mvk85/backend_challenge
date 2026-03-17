import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RagController } from './rag.controller';
import { FixedSizeChunker } from './application/chunkers/fixed-size.chunker';
import { StructuredChunker } from './application/chunkers/structured.chunker';
import { IndexBuilderService } from './application/index-builder.service';
import { CompareChunkingService } from './application/compare-chunking.service';
import { RetrieveService } from './application/retrieve.service';
import { ProxyApiEmbeddingsClient } from './infrastructure/proxyapi-embeddings.client';
import { IndexJsonRepository } from './infrastructure/index-json.repository';

@Module({
  imports: [ConfigModule],
  controllers: [RagController],
  providers: [
    FixedSizeChunker,
    StructuredChunker,
    IndexBuilderService,
    CompareChunkingService,
    RetrieveService,
    ProxyApiEmbeddingsClient,
    IndexJsonRepository
  ]
})
export class RagModule {}
