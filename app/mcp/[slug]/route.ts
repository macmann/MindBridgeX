// @ts-nocheck
import { NextResponse } from 'next/server';

import prisma from '../../../lib/prisma.js';
import { getRuntimeContext, readApiKeyHeader } from '../../../lib/runtime-context';
import { dispatchMcpRpc, DEFAULT_PROTOCOL_VERSION } from '../../../lib/mcp-dispatcher';

export const dynamic = 'force-dynamic';

function jsonRpcResponse(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function jsonRpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) {
    error.data = data;
  }
  return { jsonrpc: '2.0', id: id ?? null, error };
}

function normalizeSlug(value) {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function loadServer({ userId, projectId, slug }) {
  if (!userId || !projectId) {
    return null;
  }
  return prisma.mcpServer.findFirst({
    where: { userId, projectId, slug, isEnabled: true },
    include: { authConfig: true },
  });
}

async function loadServerByApiKey(apiKey) {
  if (!apiKey) return null;
  return prisma.mcpServer.findFirst({
    where: { apiKey, isEnabled: true },
    include: { authConfig: true },
  });
}

async function loadPublicServer(slug) {
  return prisma.mcpServer.findFirst({
    where: { slug, isEnabled: true, requireApiKey: false },
    include: { authConfig: true },
  });
}

function ensureJsonRequest(request) {
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw Object.assign(new Error('Content-Type must be application/json'), {
      status: 415,
      code: -32700,
    });
  }
}

export async function POST(request, context) {
  const runtime = await getRuntimeContext(request, { requireAuth: false });
  const providedApiKey = readApiKeyHeader(request);

  const slug = normalizeSlug(context.params?.slug);
  if (!slug) {
    return jsonRpcResponse(jsonRpcError(null, -32602, 'Invalid MCP server slug'), 400);
  }

  let server = await loadServer({ userId: runtime?.userId, projectId: runtime?.project?.id, slug });
  if (!server && runtime && !providedApiKey) {
    return jsonRpcResponse(jsonRpcError(null, -32004, `MCP server not found for slug: ${slug}`), 404);
  }

  if (!server) {
    if (providedApiKey) {
      server = await loadServerByApiKey(providedApiKey);
      if (!server) {
        return jsonRpcResponse(jsonRpcError(null, -32000, 'Invalid API key'), 401);
      }
      if (server.slug !== slug) {
        return jsonRpcResponse(jsonRpcError(null, -32004, `MCP server not found for slug: ${slug}`), 404);
      }
    } else {
      server = await loadPublicServer(slug);
      if (!server) {
        return jsonRpcResponse(jsonRpcError(null, -32000, 'Missing API key'), 401);
      }
    }
  }

  if (!server) {
    return jsonRpcResponse(jsonRpcError(null, -32004, `MCP server not found for slug: ${slug}`), 404);
  }

  try {
    ensureJsonRequest(request);
  } catch (err) {
    return jsonRpcResponse(jsonRpcError(null, err?.code ?? -32700, err?.message), err?.status || 415);
  }

  let rpcPayload;
  try {
    rpcPayload = await request.json();
  } catch {
    return jsonRpcResponse(jsonRpcError(null, -32700, 'Parse error: Invalid JSON body'), 400);
  }

  const rpc = rpcPayload && typeof rpcPayload === 'object' ? rpcPayload : {};
  const hasId = Object.prototype.hasOwnProperty.call(rpc, 'id');
  const responseId = hasId ? rpc.id ?? null : null;
  const rpcMethod = rpc.method;

  if (rpc.jsonrpc !== '2.0' || typeof rpcMethod !== 'string') {
    return jsonRpcResponse(jsonRpcError(responseId, -32600, 'Invalid JSON-RPC 2.0 request'), 400);
  }

  if (!hasId) {
    return jsonRpcResponse({ jsonrpc: '2.0', id: null, result: null }, 200);
  }

  const rpcParams = rpc.params || {};
  const protocolVersion =
    typeof rpcParams.protocolVersion === 'string' ? rpcParams.protocolVersion : DEFAULT_PROTOCOL_VERSION;

  try {
    const dispatchResult = await dispatchMcpRpc({
      method: rpcMethod,
      params: rpcParams,
      server,
      protocolVersion,
    });

    if (dispatchResult.kind === 'error') {
      return jsonRpcResponse(
        jsonRpcError(responseId, dispatchResult.error.code, dispatchResult.error.message, dispatchResult.error.data),
        dispatchResult.status || 200,
      );
    }

    return jsonRpcResponse(
      { jsonrpc: '2.0', id: responseId, result: dispatchResult.result },
      dispatchResult.status || 200,
    );
  } catch (err) {
    return jsonRpcResponse(
      jsonRpcError(responseId, err?.code || -32603, err?.message || 'Internal MCP server error', err?.data),
      err?.status || 500,
    );
  }
}

export async function GET(request, context) {
  const slug = normalizeSlug(context.params?.slug);
  return jsonRpcResponse({ ok: true, slug, message: 'MCP endpoint is running' }, 200);
}
