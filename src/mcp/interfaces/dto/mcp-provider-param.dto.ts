import { IsString, Matches } from 'class-validator';

export class McpProviderParamDto {
  @IsString()
  @Matches(/^[a-z0-9-_]+$/i)
  provider!: string;
}
