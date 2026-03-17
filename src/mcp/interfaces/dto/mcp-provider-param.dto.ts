import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class McpProviderParamDto {
  @ApiProperty({
    description: 'MCP provider id',
    pattern: '^[a-z0-9-_]+$',
    example: 'github'
  })
  @IsString()
  @Matches(/^[a-z0-9-_]+$/i)
  provider!: string;
}
