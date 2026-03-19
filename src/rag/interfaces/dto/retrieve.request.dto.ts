import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export const RETRIEVAL_MODES = ['baseline', 'threshold', 'heuristic'] as const;
export type RetrievalMode = (typeof RETRIEVAL_MODES)[number];

export class RetrieveRequestDto {
  @ApiProperty({
    description: 'Index id to query',
    example: 'knowledge-base-fixed-20260316-214455'
  })
  @IsString()
  indexId!: string;

  @ApiProperty({
    description: 'User query for semantic retrieval',
    example: 'Как настраивается OAuth токен?'
  })
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Number of top matches',
    example: 5,
    default: 5
  })
  @IsInt()
  @Min(1)
  @Max(20)
  topK = 5;

  @ApiPropertyOptional({
    description: 'Number of candidates before filtering/reranking',
    example: 20
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  candidateTopK?: number;

  @ApiPropertyOptional({
    description: 'Retrieval mode',
    enum: RETRIEVAL_MODES,
    default: 'baseline'
  })
  @IsOptional()
  @IsIn(RETRIEVAL_MODES)
  mode?: RetrievalMode;

  @ApiPropertyOptional({
    description: 'Minimum score threshold for threshold/heuristic modes (0..1)',
    example: 0.5
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  @ApiPropertyOptional({
    description: 'Rewrite user query before retrieval',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  rewriteQuery?: boolean;

  @ApiPropertyOptional({
    description: 'Include comparison diagnostics for all retrieval modes',
    default: false
  })
  @IsOptional()
  @IsBoolean()
  compareModes?: boolean;
}
