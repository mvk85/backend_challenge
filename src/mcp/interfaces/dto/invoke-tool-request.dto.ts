import { IsObject, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InvokeToolRequestDto {
  @ApiPropertyOptional({
    description: 'Tool arguments passed to MCP provider',
    type: 'object',
    additionalProperties: true
  })
  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
