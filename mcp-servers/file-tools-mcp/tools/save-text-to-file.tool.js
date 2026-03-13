const z = require('zod/v4');

function registerSaveTextToFileTool(toolRegistry, fileStorage) {
  toolRegistry.register({
    name: 'save_text_to_file',
    description: 'Save incoming text as a file and return a download URL.',
    inputSchema: {
      text: z.string().min(1).describe('Text payload to store.'),
      fileName: z.string().optional().describe('Optional preferred file name, without path.')
    },
    handler: async ({ text, fileName }) => {
      const result = await fileStorage.saveText(text, fileName);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ],
        structuredContent: result,
        isError: false
      };
    }
  });
}

module.exports = {
  registerSaveTextToFileTool
};
