import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../../../../../../lib/auth.js';
import prisma from '../../../../../../lib/prisma.js';
import { slugifyToolName } from '../../../../../../lib/tool-utils.js';

function cleanString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

async function requireSession() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id);
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { userId };
}

async function getServerForUser(userId, params) {
  const serverId = Number(params?.serverId);
  if (!serverId) {
    throw new Error('serverId is required');
  }

  const server = await prisma.mcpServer.findFirst({ where: { id: serverId, userId } });
  if (!server) {
    throw new Error('MCP server not found');
  }

  return server;
}

export async function PATCH(req, context) {
  const { userId, error } = await requireSession();
  if (!userId) return error;

  let server;
  try {
    server = await getServerForUser(userId, context?.params);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }

  const toolId = Number(context?.params?.toolId);
  if (!toolId) {
    return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
  }

  const tool = await prisma.mcpTool.findFirst({ where: { id: toolId, serverId: server.id } });
  if (!tool) {
    return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates = {};

  if (body.name !== undefined) {
    const name = slugifyToolName(body.name);
    const conflict = await prisma.mcpTool.findFirst({
      where: { serverId: server.id, name, NOT: { id: tool.id } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ error: 'Tool name already in use for this server' }, { status: 400 });
    }
    updates.name = name;
  }

  if (body.description !== undefined) updates.description = cleanString(body.description);
  if (body.httpMethod !== undefined) updates.httpMethod = String(body.httpMethod || 'GET').toUpperCase();
  if (body.pathTemplate !== undefined) updates.pathTemplate = cleanString(body.pathTemplate);
  if (body.baseUrl !== undefined) updates.baseUrl = cleanString(body.baseUrl);
  if (body.enabled !== undefined) updates.enabled = Boolean(body.enabled);

  if (body.queryMapping !== undefined) updates.queryMapping = body.queryMapping;
  if (body.bodyMapping !== undefined) updates.bodyMapping = body.bodyMapping;
  if (body.headersMapping !== undefined) updates.headersMapping = body.headersMapping;
  if (body.inputSchema !== undefined) updates.inputSchema = body.inputSchema;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No changes submitted' }, { status: 400 });
  }

  const updated = await prisma.mcpTool.update({ where: { id: tool.id }, data: updates });
  return NextResponse.json({ tool: updated });
}
