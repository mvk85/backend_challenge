import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsString, Matches, Max, Min } from 'class-validator';

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
}
