import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CompareChunkingRequestDto {
  @ApiProperty({
    description: 'Source system identifier',
    example: 'local-file'
  })
  @IsString()
  source!: string;

  @ApiProperty({
    description: 'Path to local text file',
    example: './storage/files/knowledge-base.txt'
  })
  @IsString()
  filePath!: string;

  @ApiPropertyOptional({
    description: 'Optional title override; defaults to file name',
    example: 'Knowledge Base v1'
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Chunk size in characters',
    example: 1200,
    default: 1200
  })
  @IsOptional()
  @IsInt()
  @Min(200)
  chunkSize?: number;

  @ApiPropertyOptional({
    description: 'Chunk overlap in characters',
    example: 200,
    default: 200
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  chunkOverlap?: number;
}
