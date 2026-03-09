import { IsObject, IsOptional } from 'class-validator';

export class InvokeToolRequestDto {
  @IsOptional()
  @IsObject()
  args?: Record<string, unknown>;
}
