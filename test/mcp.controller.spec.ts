import { Test, TestingModule } from '@nestjs/testing';
import { McpController } from '../src/mcp/mcp.controller';
import { ToolInvocationService } from '../src/mcp/application/tool-invocation.service';

describe('McpController', () => {
  let controller: McpController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [McpController],
      providers: [
        {
          provide: ToolInvocationService,
          useValue: {
            listProviders: jest.fn().mockReturnValue(['github']),
            listTools: jest.fn().mockResolvedValue([{ name: 'search_repositories' }]),
            invokeTool: jest.fn().mockResolvedValue({ raw: { ok: true } }),
            health: jest.fn().mockResolvedValue({ connected: true })
          }
        }
      ]
    }).compile();

    controller = moduleRef.get<McpController>(McpController);
  });

  it('returns registered providers', () => {
    expect(controller.getProviders()).toEqual({ providers: ['github'] });
  });
});
