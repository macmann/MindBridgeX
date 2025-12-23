import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import prisma from '../lib/prisma.js';
import { resolveDatasetPayload } from '../lib/dataset-lookup.js';

const noop = () => {};

describe('resolveDatasetPayload', () => {
  let originalFindMany;
  let originalFindFirst;

  beforeEach(() => {
    originalFindMany = prisma.routeDataset.findMany;
    originalFindFirst = prisma.routeDataset.findFirst;
  });

  afterEach(() => {
    prisma.routeDataset.findMany = originalFindMany;
    prisma.routeDataset.findFirst = originalFindFirst;
  });

  it('returns all enabled items when no key is provided', async () => {
    const route = { id: 1, returnAllWhenNoKey: true, notFoundStatus: 404 };
    const request = new Request('http://example.com/mock');
    let findFirstCalled = false;

    prisma.routeDataset.findMany = async ({ where }) => {
      assert.equal(where.routeId, route.id);
      return [
        { key: 'a', valueJson: { foo: 'bar' } },
        { key: 'b', valueJson: { fizz: 'buzz' } },
      ];
    };
    prisma.routeDataset.findFirst = () => {
      findFirstCalled = true;
      return null;
    };

    const result = await resolveDatasetPayload(route, {}, request, { prismaClient: prisma });
    assert.equal(result.status, 200);
    assert.deepEqual(result.payload, {
      count: 2,
      items: [
        { key: 'a', value: { foo: 'bar' } },
        { key: 'b', value: { fizz: 'buzz' } },
      ],
    });
    assert.equal(findFirstCalled, false);
  });

  it('returns a single record when a lookup key is provided', async () => {
    const route = { id: 2, lookupParamName: 'bookingId', returnAllWhenNoKey: false, notFoundStatus: 404 };
    const request = new Request('http://example.com/mock?bookingId=ABC123');

    prisma.routeDataset.findMany = noop;
    prisma.routeDataset.findFirst = async ({ where }) => {
      assert.equal(where.routeId, route.id);
      assert.equal(where.key, 'ABC123');
      return { valueJson: { id: 'ABC123', ok: true } };
    };

    const result = await resolveDatasetPayload(route, {}, request, { prismaClient: prisma });
    assert.equal(result.status, 200);
    assert.deepEqual(result.payload, { id: 'ABC123', ok: true });
  });
});
