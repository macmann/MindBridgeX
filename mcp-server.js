import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  getMcpServer,
  listMcpToolsWithEndpoints
} from './gui-mock-api/db.js';

const MCP_SERVER_ID = process.env.MCP_SERVER_ID;
if (!MCP_SERVER_ID) {
  console.error('MCP_SERVER_ID env var is required');
  process.exit(1);
}

const mcpServerConfig = getMcpServer(MCP_SERVER_ID);
if (!mcpServerConfig || !mcpServerConfig.is_enabled) {
  console.error('MCP server not found or not enabled:', MCP_SERVER_ID);
  process.exit(1);
}

const toolsConfig = listMcpToolsWithEndpoints(MCP_SERVER_ID);
const BASE_URL = process.env.MOCK_BASE_URL || mcpServerConfig.base_url || 'http://localhost:3000';

const server = new Server(
  {
    name: mcpServerConfig.name || 'mock-api-mcp',
    version: '0.1.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Helper: fill :params in path
function buildPath(pathTemplate, args) {
  let path = pathTemplate;
  const usedKeys = new Set();
  if (!args) return { path, usedKeys };
  for (const [k, v] of Object.entries(args)) {
    const token = `:${k}`;
    if (path.includes(token)) {
      path = path.replace(token, encodeURIComponent(String(v)));
      usedKeys.add(k);
    }
  }
  return { path, usedKeys };
}

// Register tools
for (const t of toolsConfig) {
  let inputSchema;
  try {
    inputSchema = JSON.parse(t.arg_schema || '{"type":"object","properties":{},"required":[]}');
  } catch {
    inputSchema = { type: 'object', properties: {}, required: [] };
  }

  const zodSchema = z.any(); // keep simple; skip strict validation for now

  server.tool(
    t.name,
    zodSchema,
    async (input) => {
      const args = input ?? {};
      const { path, usedKeys } = buildPath(t.path, args);

      // Build query from remaining args
      const queryParams = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (usedKeys.has(k)) continue;
        if (v === undefined || v === null) continue;
        queryParams.append(k, String(v));
      }
      const url = new URL(path, BASE_URL);
      if ([...queryParams.keys()].length > 0) {
        url.search = queryParams.toString();
      }

      const method = (t.method || 'GET').toUpperCase();
      const headers = { 'Content-Type': 'application/json' };
      if (mcpServerConfig.api_key_header && mcpServerConfig.api_key_value) {
        headers[mcpServerConfig.api_key_header] = mcpServerConfig.api_key_value;
      }

      let body;
      if (['POST', 'PUT', 'PATCH'].includes(method)) {
        body = JSON.stringify(args);
      }

      const res = await fetch(url.toString(), {
        method,
        headers,
        body
      });

      const text = await res.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                status: res.status,
                url: url.toString(),
                data: parsed
              },
              null,
              2
            )
          }
        ]
      };
    },
    {
      description: t.description || `Proxy for ${t.method} ${t.path}`,
      inputSchema
    }
  );
}

(async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
})();
