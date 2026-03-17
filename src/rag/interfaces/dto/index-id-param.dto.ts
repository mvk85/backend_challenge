import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class IndexIdParamDto {
  @ApiProperty({
    description: 'Index identifier',
    pattern: '^[a-z0-9-_]+$',
    example: 'knowledge-base-fixed-20260316-214455'
  })
  @IsString()
  @Matches(/^[a-z0-9-_]+$/i)
  indexId!: string;
}
