import http from 'http';
import { app } from './server.js';
import { startMcpServer } from './mcp-server.js';

const PORT = process.env.PORT || 3000;

function startWebServer() {
  const srv = http.createServer(app);
  srv.listen(PORT, () => {
    console.log(`[WEB] Mock API Tool listening on port ${PORT}`);
  });
  return srv;
}

function maybeStartMcp() {
  if (process.env.MCP_SERVER_ENABLED !== 'true') {
    console.log('[MCP] Disabled (set MCP_SERVER_ENABLED=true to enable).');
    return;
  }

  const mockBaseUrl = process.env.MOCK_BASE_URL || `http://localhost:${PORT}`;

  startMcpServer({
    port: process.env.MCP_PORT || 3030,
    serverId: process.env.MCP_SERVER_ID || 'default-mcp',
    mockBaseUrl
  });

  console.log(
    `[MCP] Enabled. Internal MCP port: ${process.env.MCP_PORT || 3030}. mockBaseUrl=${mockBaseUrl}`
  );
}

function main() {
  startWebServer();
  maybeStartMcp();
}

main();
