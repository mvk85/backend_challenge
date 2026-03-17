import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpProviderPort, McpToolDefinition, McpToolInvocationResult } from '../../domain/ports/mcp-provider.port';

const SUMMARY_JSON_TOOL_NAME = 'summary_json';
const DEFAULT_PROXYAPI_URL = 'https://api.proxyapi.ru/openai/v1';
const DEFAULT_PROXYAPI_MODEL = 'gpt-5.1';

@Injectable()
export class LlmMcpProvider implements McpProviderPort {
  readonly providerId = 'llm' as const;

  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.timeoutMs = Number(this.configService.get('MCP_CALL_TIMEOUT_MS') ?? 20000);
  }

  async connect(): Promise<void> {
    return;
  }

  async disconnect(): Promise<void> {
    return;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    return [this.getSummaryJsonToolDefinition()];
  }

  async callTool(toolName: string, args: Record<string, unknown>): Promise<McpToolInvocationResult> {
    if (toolName !== SUMMARY_JSON_TOOL_NAME) {
      throw new NotFoundException(`Tool '${toolName}' is not supported by MCP provider '${this.providerId}'`);
    }

    return this.callSummaryJson(args);
  }

  async healthCheck(): Promise<{ connected: boolean; details?: unknown }> {
    try {
      const apiKey = this.resolveApiKey();
      return {
        connected: true,
        details: {
          toolsCount: 1,
          apiUrl: this.resolveApiUrl(),
          defaultModel: this.resolveDefaultModel(),
          apiKeyConfigured: apiKey.length > 0
        }
      };
    } catch (error) {
      return {
        connected: false,
        details: (error as Error).message
      };
    }
  }

  private getSummaryJsonToolDefinition(): McpToolDefinition {
    return {
      name: SUMMARY_JSON_TOOL_NAME,
      description: 'Summarize JSON payload according to instruction prompt using ProxyAPI/OpenAI-compatible chat endpoint.',
      inputSchema: {
        type: 'object',
        properties: {
          issues: {
            oneOf: [{ type: 'object' }, { type: 'array' }, { type: 'string' }],
            description: 'JSON payload to summarize (object/array) or a JSON string.'
          },
          prompt: {
            type: 'string',
            description: 'Instruction for summary generation, e.g. "суммаризация по полю theme".'
          },
          model: {
            type: 'string',
            description: 'Optional model override.'
          },
          temperature: {
            type: 'number',
            description: 'Optional temperature override.'
          }
        },
        required: ['issues', 'prompt'],
        additionalProperties: false
      }
    };
  }

  private async callSummaryJson(args: Record<string, unknown>): Promise<McpToolInvocationResult> {
    const prompt = this.readRequiredStringArg(args, 'prompt', SUMMARY_JSON_TOOL_NAME);
    const issues = this.readRequiredArg(args, 'issues', SUMMARY_JSON_TOOL_NAME);
    const model = this.readOptionalStringArg(args, 'model') ?? this.resolveDefaultModel();
    const temperature = this.readOptionalNumberArg(args, 'temperature');

    const requestBody = {
      model,
      messages: [
        {
          role: 'system',
          content:
            'Ты сервис суммаризации JSON-данных. Выполняй только инструкцию пользователя и возвращай итоговую суммаризацию без markdown.'
        },
        {
          role: 'user',
          content: this.buildUserPrompt(prompt, issues)
        }
      ],
      ...(typeof temperature === 'number' ? { temperature } : {})
    };

    const response = await this.withTimeout(
      fetch(this.resolveApiUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.resolveApiKey()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
    );

    const responseBody = await response.json().catch(() => null);

    if (!response.ok) {
      return this.toMcpResult(
        {
          error: 'ProxyAPI request failed',
          status: response.status,
          statusText: response.statusText,
          body: responseBody
        },
        true
      );
    }

    const summary = this.readAssistantContent(responseBody);
    const usage = this.readUsage(responseBody);
    const responseModel = this.readOptionalString(responseBody, 'model') ?? model;

    return this.toMcpResult(
      {
        summary,
        model: responseModel,
        usage
      },
      false
    );
  }

  private buildUserPrompt(prompt: string, issues: unknown): string {
    const normalizedIssues = this.serializeAsJsonText(issues);
    return ['Instruction:', prompt, '', 'JSON data:', normalizedIssues].join('\n');
  }

  private readAssistantContent(responseBody: unknown): string {
    if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) {
      throw new ServiceUnavailableException('ProxyAPI response has invalid JSON format');
    }

    const choices = (responseBody as { choices?: unknown }).choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new ServiceUnavailableException('ProxyAPI response does not contain choices');
    }

    const firstChoice = choices[0];
    if (!firstChoice || typeof firstChoice !== 'object' || Array.isArray(firstChoice)) {
      throw new ServiceUnavailableException('ProxyAPI choice payload is invalid');
    }

    const message = (firstChoice as { message?: unknown }).message;
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
      throw new ServiceUnavailableException('ProxyAPI choice message is missing');
    }

    const content = (message as { content?: unknown }).content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new ServiceUnavailableException('ProxyAPI returned empty summary content');
    }

    return content.trim();
  }

  private readUsage(responseBody: unknown): { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null {
    if (!responseBody || typeof responseBody !== 'object' || Array.isArray(responseBody)) {
      return null;
    }

    const usage = (responseBody as { usage?: unknown }).usage;
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
      return null;
    }

    const promptTokens = this.readOptionalNumber(usage, 'prompt_tokens');
    const completionTokens = this.readOptionalNumber(usage, 'completion_tokens');
    const totalTokens = this.readOptionalNumber(usage, 'total_tokens');

    return {
      ...(typeof promptTokens === 'number' ? { prompt_tokens: promptTokens } : {}),
      ...(typeof completionTokens === 'number' ? { completion_tokens: completionTokens } : {}),
      ...(typeof totalTokens === 'number' ? { total_tokens: totalTokens } : {})
    };
  }

  private toMcpResult(payload: unknown, isError: boolean): McpToolInvocationResult {
    const textPayload = this.serializeAsJsonText(payload);

    return {
      content: [
        {
          type: 'text',
          text: textPayload
        }
      ],
      structuredContent: payload,
      isError,
      raw: {
        content: [
          {
            type: 'text',
            text: textPayload
          }
        ],
        structuredContent: payload,
        isError
      }
    };
  }

  private serializeAsJsonText(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  private resolveApiKey(): string {
    const apiKeyCandidates = [
      this.configService.get<string>('PROXYAPI_OPENAI_API_KEY'),
      this.configService.get<string>('OPENAI_API_KEY'),
      this.configService.get<string>('VITE_OPENAI_API_KEY'),
      this.configService.get<string>('VITE_PROXYAPI_API_KEY')
    ];

    const apiKey = apiKeyCandidates
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .find((value) => value.length > 0);

    if (!apiKey) {
      throw new ServiceUnavailableException(
        'ProxyAPI API key is not configured. Set PROXYAPI_OPENAI_API_KEY, OPENAI_API_KEY, or VITE_OPENAI_API_KEY.'
      );
    }

    return apiKey;
  }

  private resolveApiUrl(): string {
    const rawApiUrl =
      this.configService.get<string>('PROXYAPI_OPENAI_API_URL') ??
      this.configService.get<string>('OPENAI_API_URL') ??
      this.configService.get<string>('VITE_OPENAI_API_URL') ??
      DEFAULT_PROXYAPI_URL;

    const normalized = (rawApiUrl.trim().length > 0 ? rawApiUrl.trim() : DEFAULT_PROXYAPI_URL).replace(/\/+$/u, '');
    if (normalized.endsWith('/chat/completions')) {
      return normalized;
    }

    return `${normalized}/chat/completions`;
  }

  private resolveDefaultModel(): string {
    const rawModel =
      this.configService.get<string>('PROXYAPI_OPENAI_MODEL') ??
      this.configService.get<string>('OPENAI_MODEL') ??
      this.configService.get<string>('VITE_OPENAI_MODEL') ??
      DEFAULT_PROXYAPI_MODEL;

    return rawModel.trim().length > 0 ? rawModel.trim() : DEFAULT_PROXYAPI_MODEL;
  }

  private readRequiredStringArg(args: Record<string, unknown>, key: string, toolName: string): string {
    const value = args[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`Tool '${toolName}' requires non-empty string argument '${key}'`);
    }

    return value.trim();
  }

  private readRequiredArg(args: Record<string, unknown>, key: string, toolName: string): unknown {
    if (!(key in args)) {
      throw new BadRequestException(`Tool '${toolName}' requires argument '${key}'`);
    }

    return args[key];
  }

  private readOptionalStringArg(args: Record<string, unknown>, key: string): string | null {
    const value = args[key];
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException(`Argument '${key}' must be a string`);
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readOptionalNumberArg(args: Record<string, unknown>, key: string): number | null {
    const value = args[key];
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`Argument '${key}' must be a finite number`);
    }

    return value;
  }

  private readOptionalString(value: unknown, key: string): string | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const raw = (value as Record<string, unknown>)[key];
    if (typeof raw !== 'string') {
      return null;
    }

    const normalized = raw.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private readOptionalNumber(value: unknown, key: string): number | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const raw = (value as Record<string, unknown>)[key];
    return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;

    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => reject(new Error(`MCP request timeout after ${this.timeoutMs}ms`)), this.timeoutMs);
        })
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
