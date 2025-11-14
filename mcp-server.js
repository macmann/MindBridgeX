import { createMcpRouter } from './mcp-express.js';

export function mountMcp(app, options = {}) {
  if (!app || typeof app.use !== 'function') {
    throw new Error('A valid Express app instance is required to mount MCP');
  }

  const serverId = options.serverId || process.env.MCP_SERVER_ID || 'default-mcp';
  const mockBaseUrl = options.mockBaseUrl || process.env.MOCK_BASE_URL;
  const basePath = options.basePath || '/mcp';

  const router = createMcpRouter({ serverId, mockBaseUrl });
  app.use(basePath, router);

  console.log(`[MCP] Mounted at ${basePath} (serverId=${serverId})`);
  return router;
}
