import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { RETRIEVAL_MODES, RetrievalMode } from './retrieve.request.dto';

export class RetrieveMultiRequestDto {
  @ApiProperty({
    description: 'List of index ids to query',
    type: [String],
    example: ['factory-fixed-20260317192046', 'patterns-structured-20260317193001']
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @Matches(/^[a-z0-9-_]+$/i, { each: true })
  indexIds!: string[];

  @ApiProperty({
    description: 'User query for semantic retrieval',
    example: 'Что такое фабричный метод?'
  })
  @IsString()
  query!: string;

  @ApiPropertyOptional({
    description: 'Number of top matches in merged result',
    example: 8,
    default: 5
  })
  @IsInt()
  @Min(1)
  @Max(50)
  topK = 5;

  @ApiPropertyOptional({
    description: 'Number of candidates before filtering/reranking',
    example: 30
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
