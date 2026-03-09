import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ToolInvocationService } from './application/tool-invocation.service';
import { InvokeToolRequestDto } from './interfaces/dto/invoke-tool-request.dto';
import { McpProviderParamDto } from './interfaces/dto/mcp-provider-param.dto';
import { McpToolParamDto } from './interfaces/dto/mcp-tool-param.dto';

@Controller('mcp')
export class McpController {
  constructor(private readonly toolInvocationService: ToolInvocationService) {}

  @Get('providers')
  getProviders(): { providers: string[] } {
    const providers = this.toolInvocationService.listProviders().map((providerId) => String(providerId));
    return { providers };
  }

  @Get(':provider/tools')
  async getProviderTools(@Param() params: McpProviderParamDto): Promise<{ tools: unknown[] }> {
    const tools = await this.toolInvocationService.listTools(params.provider);
    return { tools };
  }

  @Post(':provider/tools/:toolName/invoke')
  async invokeProviderTool(
    @Param() params: McpToolParamDto,
    @Body() body: InvokeToolRequestDto
  ): Promise<{ result: unknown }> {
    const result = await this.toolInvocationService.invokeTool(params.provider, params.toolName, body.args ?? {});
    return { result };
  }

  @Get(':provider/health')
  async providerHealth(@Param() params: McpProviderParamDto): Promise<{ status: unknown }> {
    const status = await this.toolInvocationService.health(params.provider);
    return { status };
  }
}
