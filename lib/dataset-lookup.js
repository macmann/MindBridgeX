import prisma from './prisma.js';
import { normalizeJson } from './normalize-json.js';

const DEFAULT_NOT_FOUND_BODY = { error: 'Not found' };

function coerceNotFound(route) {
  try {
    return normalizeJson(route?.notFoundBody ?? DEFAULT_NOT_FOUND_BODY);
  } catch {
    return DEFAULT_NOT_FOUND_BODY;
  }
}

function hasLookupKey(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeDatasetValue(record) {
  try {
    return normalizeJson(record.valueJson);
  } catch (err) {
    const error = new Error(`Invalid JSON in dataset.valueJson for key=${record.key}`);
    error.status = 500;
    throw error;
  }
}

export async function resolveDatasetPayload(route, params, request, { prismaClient = prisma } = {}) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  let lookupKey;
  if (route.lookupParamName) {
    lookupKey = params?.[route.lookupParamName] ?? searchParams.get(route.lookupParamName);
  }

  if (!hasLookupKey(lookupKey)) {
    lookupKey = searchParams.get('key') ?? searchParams.get('bookingId');
  }

  if (!hasLookupKey(lookupKey)) {
    const allowListAll = route.returnAllWhenNoKey !== false;
    if (!allowListAll) {
      return { status: route.notFoundStatus || 404, payload: coerceNotFound(route) };
    }

    const records = await prismaClient.routeDataset.findMany({
      where: { routeId: route.id, enabled: true },
    });
    const items = records.map((record) => ({ key: record.key, value: normalizeDatasetValue(record) }));
    return { status: 200, payload: { count: items.length, items } };
  }

  const record = await prismaClient.routeDataset.findFirst({
    where: { routeId: route.id, key: String(lookupKey), enabled: true },
  });

  if (!record) {
    return { status: route.notFoundStatus || 404, payload: coerceNotFound(route) };
  }

  return { status: 200, payload: normalizeDatasetValue(record) };
}
