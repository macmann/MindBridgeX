// @ts-nocheck
import { NextResponse } from 'next/server';

import prisma from '../../lib/prisma.js';
import { getRuntimeContext, readApiKeyHeader } from '../../lib/runtime-context';
import { findMatchingRoute } from '../../lib/mock-route-matcher.js';
import { renderTemplate } from '../../gui-mock-api/templates.js';
import { resolveDatasetPayload } from '../../lib/dataset-lookup.js';
import { normalizeJson } from '../../lib/normalize-json.js';

export const dynamic = 'force-dynamic';

const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function buildPathFromParams(params) {
  const segments = Array.isArray(params?.mock) ? params.mock : [];
  if (!segments.length) {
    return '/';
  }
  const cleaned = segments
    .map((segment) => decodeURIComponent(segment || ''))
    .map((segment) => segment.replace(/^\/+|\/+$/g, ''));
  const joined = cleaned.filter(Boolean).join('/');
  return `/${joined}`;
}

function safeJsonParse(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeHeaders(map) {
  if (!map || typeof map !== 'object') {
    return {};
  }
  const headers = {};
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined || value === null) continue;
    headers[key] = String(value);
  }
  return headers;
}

function buildTemplateContext({ request, path, route, rawBody, jsonBody, params }) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const headers = Object.fromEntries(request.headers.entries());
  const vars = {};
  for (const variable of route.vars || []) {
    vars[variable.key] = variable.value;
  }
  return {
    request: {
      method: request.method,
      path,
      url: url.pathname + url.search,
      params: params || {},
      query,
      headers,
      body: jsonBody ?? rawBody,
      rawBody,
      json: jsonBody,
    },
    params: params || {},
    vars,
    now: new Date().toISOString(),
  };
}

async function selectMockRoute({ userId, projectId, method, path }) {
  if (!userId || !projectId) {
    return null;
  }
  const routes = await prisma.mockRoute.findMany({
    where: { userId, projectId, method, enabled: true },
    include: { vars: true },
    orderBy: { id: 'asc' },
  });
  return findMatchingRoute(routes, method, path);
}

async function selectMockRouteByApiKey({ apiKey }) {
  if (!apiKey) return null;
  const route = await prisma.mockRoute.findFirst({
    where: { apiKey, enabled: true },
    include: { vars: true },
  });
  return route;
}

async function selectPublicMockRoute({ method, path }) {
  const routes = await prisma.mockRoute.findMany({
    where: { method, enabled: true, requireApiKey: false },
    include: { vars: true },
    orderBy: { id: 'asc' },
  });
  return findMatchingRoute(routes, method, path);
}

function buildResponsePayload(route, renderedBody) {
  if (route.responseIsJson) {
    try {
      return normalizeJson(renderedBody ?? '');
    } catch (err) {
      const error = new Error('Invalid JSON in route.responseBody');
      error.status = 500;
      error.cause = err;
      throw error;
    }
  }
  return { body: renderedBody ?? '' };
}

async function handleMockRequest(request, context) {
  const method = request.method.toUpperCase();
  if (!SUPPORTED_METHODS.has(method)) {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const path = buildPathFromParams(context.params || {});

  const runtime = await getRuntimeContext(request, { requireAuth: false });
  const providedApiKey = readApiKeyHeader(request);

  let match = await selectMockRoute({
    userId: runtime?.userId,
    projectId: runtime?.project?.id,
    method,
    path,
  });

  if (!match && runtime && !providedApiKey) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  if (!match) {
    if (providedApiKey) {
      const apiKeyRoute = await selectMockRouteByApiKey({ apiKey: providedApiKey });
      if (!apiKeyRoute) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }
      const matchedWithApiKey = findMatchingRoute([apiKeyRoute], method, path);
      if (!matchedWithApiKey) {
        return NextResponse.json({ error: 'API key does not match this route' }, { status: 404 });
      }
      match = matchedWithApiKey;
    } else {
      match = await selectPublicMockRoute({ method, path });
      if (!match) {
        return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
      }
    }
  }

  if (!match) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  const { route, params } = match;

  const rawBody = await request.text().catch(() => '');
  const jsonBody = rawBody ? safeJsonParse(rawBody) : null;

  const headers = new Headers({ 'content-type': 'application/json', 'cache-control': 'no-store' });
  const configuredHeaders = normalizeHeaders(route.responseHeaders);
  for (const [key, value] of Object.entries(configuredHeaders)) {
    headers.set(key, value);
  }

  const delay = Number(route.responseDelayMs || 0);
  if (delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  if (route.responseMode === 'DATASET_LOOKUP') {
    try {
      const { payload, status } = await resolveDatasetPayload(route, params, request);
      return NextResponse.json(payload, { status, headers });
    } catch (err) {
      const status = err?.status || 500;
      return NextResponse.json({ error: err?.message || 'Failed to resolve dataset response' }, { status });
    }
  }

  const templateContext = buildTemplateContext({ request, path, route, rawBody, jsonBody, params });
  const useTemplate = route.responseMode === 'TEMPLATE' || route.templateEnabled;
  const renderedBody = useTemplate
    ? renderTemplate(route.responseBody || '', templateContext)
    : route.responseBody || '';

  let payload;
  try {
    payload = buildResponsePayload(route, renderedBody);
  } catch (err) {
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || 'Failed to render response' }, { status });
  }

  // Stored mock response is loaded above and returned verbatim (JSON parsing optional)
  return new NextResponse(JSON.stringify(payload), {
    status: route.responseStatus || 200,
    headers,
  });
}

export async function GET(request, context) {
  return handleMockRequest(request, context);
}

export async function POST(request, context) {
  return handleMockRequest(request, context);
}

export async function PUT(request, context) {
  return handleMockRequest(request, context);
}

export async function PATCH(request, context) {
  return handleMockRequest(request, context);
}

export async function DELETE(request, context) {
  return handleMockRequest(request, context);
}
