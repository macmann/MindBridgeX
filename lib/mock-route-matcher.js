import { match } from 'path-to-regexp';
import { ensureLeadingSlash } from './url-utils.js';

function convertOptionalSegments(pattern) {
  const optionalParams = [];
  const converted = pattern.replace(/\/:([A-Za-z0-9_\-]+)\?/g, (_match, name) => {
    optionalParams.push(name);
    return `{/:${name}}`;
  });
  return { converted, optionalParams };
}

export function normalizeMockPath(value) {
  const withSlash = ensureLeadingSlash(value || '/');
  if (withSlash.length > 1 && withSlash.endsWith('/')) {
    return withSlash.replace(/\/+$/, '');
  }
  return withSlash;
}

export function buildPathMatcher(pattern) {
  const normalizedPattern = normalizeMockPath(pattern);
  const { converted, optionalParams } = convertOptionalSegments(normalizedPattern);
  const matcher = match(converted, {
    decode: decodeURIComponent,
  });
  return (path) => {
    const normalizedPath = normalizeMockPath(path);
    const result = matcher(normalizedPath);
    if (!result) return null;
    const params = { ...(result.params || {}) };
    for (const name of optionalParams) {
      if (!(name in params)) {
        params[name] = undefined;
      }
    }
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
