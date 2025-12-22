import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { findMatchingRoute, normalizeMockPath } from '../lib/mock-route-matcher.js';

describe('normalizeMockPath', () => {
  it('ensures a leading slash and trims trailing slashes', () => {
    assert.equal(normalizeMockPath('api/test/'), '/api/test');
    assert.equal(normalizeMockPath('/api/test///'), '/api/test');
    assert.equal(normalizeMockPath(''), '/');
  });
});

describe('findMatchingRoute', () => {
  const routes = [
    { id: 1, method: 'GET', path: '/api/flightbooking2/:bookingId' },
    { id: 2, method: 'POST', path: '/api/flightbooking2/:bookingId' },
    { id: 3, method: 'GET', path: '/mynew/getuserlist/:userId' },
    { id: 4, method: 'GET', path: '/fixed/path' },
  ];

  it('matches parameterized paths and extracts params', () => {
    const match = findMatchingRoute(routes, 'GET', '/api/flightbooking2/A2BCS');
    assert.ok(match);
    assert.equal(match.route.id, 1);
    assert.deepEqual(match.params, { bookingId: 'A2BCS' });
  });

  it('respects HTTP method when matching', () => {
    const match = findMatchingRoute(routes, 'POST', '/api/flightbooking2/A2BCS');
    assert.ok(match);
    assert.equal(match.route.id, 2);
  });

  it('matches paths without an explicit leading slash', () => {
    const match = findMatchingRoute(routes, 'GET', 'mynew/getuserlist/42');
    assert.ok(match);
    assert.equal(match.route.id, 3);
    assert.deepEqual(match.params, { userId: '42' });
  });

  it('returns null when no route matches', () => {
    const match = findMatchingRoute(routes, 'DELETE', '/api/flightbooking2/A2BCS');
    assert.equal(match, null);
  });
});
