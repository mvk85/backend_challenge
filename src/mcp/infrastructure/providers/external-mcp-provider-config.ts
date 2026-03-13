import { ConfigService } from '@nestjs/config';
import { StdioMcpProviderConfig } from './stdio-mcp.provider';

interface ExternalProviderRawConfig {
  id?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  timeoutMs?: unknown;
}

const DEFAULT_TIMEOUT_MS = 20000;

export function loadExternalMcpProviderConfigs(configService: ConfigService): StdioMcpProviderConfig[] {
  const raw = configService.get<string>('MCP_EXTERNAL_PROVIDERS_JSON');
  if (!raw || raw.trim().length === 0) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('MCP_EXTERNAL_PROVIDERS_JSON must be a JSON array');
  }

  return parsed.map((entry, index) => normalizeProviderConfig(entry as ExternalProviderRawConfig, index));
}

function normalizeProviderConfig(rawConfig: ExternalProviderRawConfig, index: number): StdioMcpProviderConfig {
  const id = readRequiredString(rawConfig.id, 'id', index);
  const command = readRequiredString(rawConfig.command, 'command', index);
  const args = normalizeArgs(rawConfig.args, index);
  const env = normalizeEnv(rawConfig.env, index);
  const timeoutMs = normalizeTimeout(rawConfig.timeoutMs);

  return {
    id,
    command,
    args,
    env,
    timeoutMs
  };
}

function readRequiredString(value: unknown, fieldName: string, index: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`MCP provider config at index ${index} has invalid '${fieldName}'`);
  }

  return value.trim();
}

function normalizeArgs(value: unknown, index: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const args = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  if (args.length !== value.length) {
    throw new Error(`MCP provider config at index ${index} has non-string values in 'args'`);
  }

  return args;
}

function normalizeEnv(value: unknown, index: number): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`MCP provider config at index ${index} has invalid 'env'`);
  }

  const rawEntries = Object.entries(value);
  const env: Record<string, string> = {};
  for (const [key, rawEntryValue] of rawEntries) {
    if (typeof rawEntryValue !== 'string') {
      throw new Error(`MCP provider config at index ${index} has non-string env value for '${key}'`);
    }
    env[key] = rawEntryValue;
  }

  return env;
}

function normalizeTimeout(value: unknown): number {
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return numericValue;
  }

  return DEFAULT_TIMEOUT_MS;
}
