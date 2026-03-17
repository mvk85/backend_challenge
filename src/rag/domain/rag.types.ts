export type ChunkingStrategy = 'fixed' | 'structured';

export interface ChunkMetadata {
  source: string;
  file: string;
  title: string;
  section: string;
  chunk_id: string;
  strategy: ChunkingStrategy;
  token_count: number;
}

export interface ChunkRecord {
  chunk_id: string;
  text: string;
  embedding: number[];
  metadata: ChunkMetadata;
}

export interface IndexMeta {
  index_id: string;
  source: string;
  file_path: string;
  title: string;
  strategy: ChunkingStrategy;
  model: string;
  created_at: string;
  dimensions: number;
  chunks_count: number;
}

export interface RagIndexDocument {
  index_meta: IndexMeta;
  chunks: ChunkRecord[];
}

export interface ChunkBuildContext {
  source: string;
  filePath: string;
  title: string;
  strategy: ChunkingStrategy;
}

export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
}

export interface ChunkDraft {
  text: string;
  section: string;
  tokenCount: number;
}

export interface Chunker {
  chunk(text: string, options: ChunkingOptions): ChunkDraft[];
}
