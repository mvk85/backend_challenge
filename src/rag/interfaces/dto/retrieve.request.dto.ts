import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, Max, Min } from 'class-validator';

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
}
