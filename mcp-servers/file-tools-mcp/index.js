const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ToolRegistry } = require('./lib/tool-registry');
const { FileStorage } = require('./lib/file-storage');
const { registerSaveTextToFileTool } = require('./tools/save-text-to-file.tool');

async function bootstrap() {
  const mcpServer = new McpServer(
    {
      name: 'file-tools-mcp',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const toolRegistry = new ToolRegistry();
  const fileStorage = new FileStorage();

  registerSaveTextToFileTool(toolRegistry, fileStorage);
  toolRegistry.install(mcpServer);

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

bootstrap().catch((error) => {
  process.stderr.write(`file-tools-mcp failed to start: ${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exit(1);
});
