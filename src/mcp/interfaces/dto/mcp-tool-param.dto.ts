import { IsString, Matches } from 'class-validator';

export class McpToolParamDto {
  @IsString()
  @Matches(/^[a-z0-9-_]+$/i)
  provider!: string;

  @IsString()
  @Matches(/^[a-z0-9-_.]+$/i)
  toolName!: string;
}
