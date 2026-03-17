import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class McpToolParamDto {
  @ApiProperty({
    description: 'MCP provider id',
    pattern: '^[a-z0-9-_]+$',
    example: 'github'
  })
  @IsString()
  @Matches(/^[a-z0-9-_]+$/i)
  provider!: string;

  @ApiProperty({
    description: 'Tool name inside selected MCP provider',
    pattern: '^[a-z0-9-_.]+$',
    example: 'create_issue'
  })
  @IsString()
  @Matches(/^[a-z0-9-_.]+$/i)
  toolName!: string;
}
