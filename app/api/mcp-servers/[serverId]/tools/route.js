import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../../../../../lib/auth.js';
import prisma from '../../../../../lib/prisma.js';
import {
  ensureUniqueToolName,
  extractPathParams,
  buildInputSchema,
} from '../../../../../lib/tool-utils.js';

function cleanString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeBaseUrl(value, fallback = '') {
  const trimmed = cleanString(value);
  return trimmed || fallback || '';
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

async function loadExistingNames(serverId) {
  const existing = await prisma.mcpTool.findMany({
    where: { serverId },
    select: { name: true },
  });
  return new Set(existing.map((tool) => tool.name));
}

function normalizeRouteSelection(selection) {
  const routeId = Number(selection?.routeId);
  if (!routeId) return null;
  const toolName = cleanString(selection?.toolName);
  return {
    routeId,
    toolName,
    description: cleanString(selection?.description),
  };
}

function normalizeOperationSelection(selection) {
  const method = String(selection?.method || 'GET').toUpperCase();
  const path = cleanString(selection?.path);
  if (!path) return null;
  const queryParams = Array.isArray(selection?.queryParams)
    ? selection.queryParams
        .map((param) => ({
          name: cleanString(param?.name),
          type: cleanString(param?.type) || 'string',
          description: cleanString(param?.description),
          required: Boolean(param?.required),
        }))
        .filter((param) => param.name)
    : [];
  const bodyProperties = Array.isArray(selection?.bodyProperties)
    ? selection.bodyProperties
        .map((prop) => ({
          name: cleanString(prop?.name),
          type: cleanString(prop?.type) || 'string',
          description: cleanString(prop?.description),
          required: Boolean(prop?.required),
        }))
        .filter((prop) => prop.name)
    : [];
  const pathParams = Array.isArray(selection?.pathParams) && selection.pathParams.length > 0
    ? selection.pathParams
        .map((param) => (typeof param === 'string' ? param : cleanString(param?.name)))
        .filter(Boolean)
    : extractPathParams(path);

  return {
    operationId: cleanString(selection?.operationId) || `${method}_${path}`,
    method,
    path,
    toolName: cleanString(selection?.toolName),
    description: cleanString(selection?.description) || cleanString(selection?.summary),
    summary: cleanString(selection?.summary),
    queryParams,
    bodyProperties,
    pathParams,
  };
}

async function createToolsFromRoutes({ server, selections }) {
  const validSelections = selections
    .map(normalizeRouteSelection)
    .filter(Boolean);

  if (validSelections.length === 0) {
    throw new Error('Select at least one route to continue');
  }

  const routeIds = validSelections.map((selection) => selection.routeId);
  const routes = await prisma.mockRoute.findMany({
    where: {
      id: { in: routeIds },
      userId: server.userId,
      projectId: server.projectId,
    },
  });
  const routeMap = new Map(routes.map((route) => [route.id, route]));
  const usedNames = await loadExistingNames(server.id);
  const creations = [];

  for (const selection of validSelections) {
    const route = routeMap.get(selection.routeId);
    if (!route) continue;
    const nameInput = selection.toolName || route.name || `${route.method || 'GET'}_${route.path || '/'}`;
    const name = ensureUniqueToolName(nameInput, usedNames);
    const schema = buildInputSchema({
      pathParams: extractPathParams(route.path),
      source: {
        type: 'mock-route',
        routeId: route.id,
      },
      summary: route.description || '',
    });

    creations.push({
      serverId: server.id,
      name,
      description: selection.description || route.description || '',
      inputSchema: schema,
      httpMethod: String(route.method || 'GET').toUpperCase(),
      baseUrl: normalizeBaseUrl(server.baseUrl),
      pathTemplate: route.path || '/',
      queryMapping: {},
      bodyMapping: {},
      headersMapping: {},
      enabled: true,
    });
  }

  if (creations.length === 0) {
    throw new Error('No matching routes were found for this server');
  }

  return prisma.$transaction(creations.map((data) => prisma.mcpTool.create({ data })));
}

async function createToolsFromOpenApi({ server, selections, baseUrl }) {
  const validSelections = selections
    .map(normalizeOperationSelection)
    .filter(Boolean);

  if (validSelections.length === 0) {
    throw new Error('Select at least one OpenAPI operation to continue');
  }

  const usedNames = await loadExistingNames(server.id);
  const creations = [];
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl, server.baseUrl);

  for (const selection of validSelections) {
    const name = ensureUniqueToolName(
      selection.toolName || selection.operationId || `${selection.method}_${selection.path}`,
      usedNames,
    );
    const schema = buildInputSchema({
      pathParams: selection.pathParams,
      queryParams: selection.queryParams,
      bodyProperties: selection.bodyProperties,
      source: {
        type: 'openapi',
        operationId: selection.operationId,
        path: selection.path,
        method: selection.method,
      },
      summary: selection.summary,
    });

    const queryMapping = {};
    for (const param of selection.queryParams || []) {
      queryMapping[param.name] = param.name;
    }

    const bodyMapping = {};
    for (const prop of selection.bodyProperties || []) {
      bodyMapping[prop.name] = prop.name;
    }

    creations.push({
      serverId: server.id,
      name,
      description: selection.description || selection.summary || '',
      inputSchema: schema,
      httpMethod: selection.method,
      baseUrl: normalizedBaseUrl,
      pathTemplate: selection.path,
      queryMapping,
      bodyMapping,
      headersMapping: {},
      enabled: true,
    });
  }

  return prisma.$transaction(creations.map((data) => prisma.mcpTool.create({ data })));
}

export async function POST(req, context) {
  const { userId, error } = await requireSession();
  if (!userId) return error;

  let server;
  try {
    server = await getServerForUser(userId, context?.params);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = cleanString(body?.mode).toLowerCase();

  try {
    if (mode === 'routes') {
      const created = await createToolsFromRoutes({ server, selections: body?.routes || [] });
      return NextResponse.json({ created });
    }
    if (mode === 'openapi') {
      const created = await createToolsFromOpenApi({
        server,
        selections: body?.operations || [],
        baseUrl: body?.baseUrl,
      });
      return NextResponse.json({ created });
    }
    return NextResponse.json({ error: 'Unsupported mode' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'Unable to create tools' }, { status: 400 });
  }
}

export async function DELETE(req, context) {
  const { userId, error } = await requireSession();
  if (!userId) return error;

  let server;
  try {
    server = await getServerForUser(userId, context?.params);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const toolId = Number(searchParams.get('toolId'));
  if (!toolId) {
    return NextResponse.json({ error: 'toolId is required' }, { status: 400 });
  }

  const tool = await prisma.mcpTool.findFirst({ where: { id: toolId, serverId: server.id } });
  if (!tool) {
    return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
  }

  await prisma.mcpTool.delete({ where: { id: tool.id } });
  return NextResponse.json({ ok: true });
}
