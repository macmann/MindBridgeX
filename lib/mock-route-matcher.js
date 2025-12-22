import pathToRegexp from 'path-to-regexp';
import { ensureLeadingSlash } from './url-utils.js';

export function normalizeMockPath(value) {
  const withSlash = ensureLeadingSlash(value || '/');
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.replace(/\/+$/, '');
  }
  return withSlash;
}

export function buildPathMatcher(pattern) {
  const normalizedPattern = normalizeMockPath(pattern);
  const keys = [];
  const matcher = pathToRegexp(normalizedPattern, keys);
  return (path) => {
    const normalizedPath = normalizeMockPath(path);
    const result = matcher.exec(normalizedPath);
    if (!result) return null;
    const params = {};
    keys.forEach((key, idx) => {
      params[key.name] = result[idx + 1] ? decodeURIComponent(result[idx + 1]) : result[idx + 1];
    });
    return { params };
  };
}

export function findMatchingRoute(routes, method, path) {
  const normalizedMethod = (method || '').toUpperCase();
  const normalizedPath = normalizeMockPath(path);
  for (const route of routes || []) {
    if (!route || (route.method || '').toUpperCase() !== normalizedMethod) continue;
    const matcher = buildPathMatcher(route.path || '/');
    const result = matcher(normalizedPath);
    if (result) {
      return { route, params: result.params || {} };
    }
  }
  return null;
}
