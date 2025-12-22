import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '../../../../../../lib/auth.js';
import prisma from '../../../../../../lib/prisma.js';

async function requireUser() {
  const session = await getServerSession(authOptions);
  const userId = Number(session?.user?.id);
  if (!userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  return { userId };
}

async function findRoute(routeId, userId) {
  const numericRouteId = Number(routeId);
  if (!numericRouteId) return null;
  return prisma.mockRoute.findFirst({ where: { id: numericRouteId, userId } });
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value === 'true' || value === '1' || value.toLowerCase() === 'on';
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  return false;
}

function normalizeKey(value) {
  const key = String(value ?? '').trim();
  if (!key) {
    throw new Error('key is required');
  }
  return key;
}

function parseJsonValue(value) {
  if (value === undefined) {
    throw new Error('valueJson is required');
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error('valueJson is required');
    }
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error('valueJson must be valid JSON');
    }
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    throw new Error('valueJson must be JSON-serializable');
  }
}

function serializeRecord(record) {
  return {
    id: record.id,
    routeId: record.routeId,
    key: record.key,
    valueJson: record.valueJson,
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

export async function PUT(req, { params }) {
  const { userId, error } = await requireUser();
  if (!userId) return error;

  const route = await findRoute(params?.routeId, userId);
  if (!route) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  const recordId = params?.recordId;
  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  const existing = await prisma.routeDataset.findFirst({
    where: { id: recordId, routeId: route.id }
  });

  if (!existing) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates = {};

  if (body?.key !== undefined) {
    try {
      updates.key = normalizeKey(body.key);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  if (Object.prototype.hasOwnProperty.call(body || {}, 'valueJson')) {
    try {
      updates.valueJson = parseJsonValue(body.valueJson);
    } catch (err) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  if (body?.enabled !== undefined) {
    updates.enabled = toBoolean(body.enabled);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const record = await prisma.routeDataset.update({
      where: { id: recordId },
      data: updates
    });

    return NextResponse.json({ record: serializeRecord(record) });
  } catch (err) {
    if (err?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A record with this key already exists for this route' },
        { status: 409 }
      );
    }
    console.error('Failed to update dataset record', err);
    return NextResponse.json({ error: 'Failed to update dataset record' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { userId, error } = await requireUser();
  if (!userId) return error;

  const route = await findRoute(params?.routeId, userId);
  if (!route) {
    return NextResponse.json({ error: 'Route not found' }, { status: 404 });
  }

  const recordId = params?.recordId;
  if (!recordId) {
    return NextResponse.json({ error: 'recordId is required' }, { status: 400 });
  }

  const existing = await prisma.routeDataset.findFirst({ where: { id: recordId, routeId: route.id } });
  if (!existing) {
    return NextResponse.json({ error: 'Record not found' }, { status: 404 });
  }

  await prisma.routeDataset.delete({ where: { id: recordId } });

  return NextResponse.json({ ok: true });
}
