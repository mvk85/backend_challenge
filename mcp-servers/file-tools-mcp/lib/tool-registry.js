class ToolRegistry {
  constructor() {
    this.entries = [];
  }

  register(entry) {
    this.entries.push(entry);
  }

  install(server) {
    for (const entry of this.entries) {
      server.registerTool(
        entry.name,
        {
          description: entry.description,
          inputSchema: entry.inputSchema
        },
        entry.handler
      );
    }
  }
}

module.exports = {
  ToolRegistry
};
