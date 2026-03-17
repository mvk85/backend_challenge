import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ToolInvocationService } from './application/tool-invocation.service';
import { InvokeToolRequestDto } from './interfaces/dto/invoke-tool-request.dto';
import { McpProviderParamDto } from './interfaces/dto/mcp-provider-param.dto';
import { McpToolParamDto } from './interfaces/dto/mcp-tool-param.dto';

@ApiTags('mcp')
@Controller('mcp')
export class McpController {
  constructor(private readonly toolInvocationService: ToolInvocationService) {}

  @ApiOperation({ summary: 'List available MCP providers' })
  @ApiOkResponse({ description: 'List of provider ids' })
  @Get('providers')
  getProviders(): { providers: string[] } {
    const providers = this.toolInvocationService.listProviders().map((providerId) => String(providerId));
    return { providers };
  }

  @ApiOperation({ summary: 'List tools for provider' })
  @ApiParam({ name: 'provider', description: 'MCP provider id' })
  @ApiOkResponse({ description: 'Tools available in selected provider' })
  @Get(':provider/tools')
  async getProviderTools(@Param() params: McpProviderParamDto): Promise<{ tools: unknown[] }> {
    const tools = await this.toolInvocationService.listTools(params.provider);
    return { tools };
  }

  @ApiOperation({ summary: 'Invoke tool in provider' })
  @ApiParam({ name: 'provider', description: 'MCP provider id' })
  @ApiParam({ name: 'toolName', description: 'Tool name to invoke' })
  @ApiBody({ type: InvokeToolRequestDto })
  @ApiOkResponse({ description: 'Tool invocation result' })
  @Post(':provider/tools/:toolName/invoke')
  async invokeProviderTool(
    @Param() params: McpToolParamDto,
    @Body() body: InvokeToolRequestDto
  ): Promise<{ result: unknown }> {
    const result = await this.toolInvocationService.invokeTool(params.provider, params.toolName, body.args ?? {});
    return { result };
  }

  @ApiOperation({ summary: 'Check provider health' })
  @ApiParam({ name: 'provider', description: 'MCP provider id' })
  @ApiOkResponse({ description: 'Provider health payload' })
  @Get(':provider/health')
  async providerHealth(@Param() params: McpProviderParamDto): Promise<{ status: unknown }> {
    const status = await this.toolInvocationService.health(params.provider);
    return { status };
  }
}
