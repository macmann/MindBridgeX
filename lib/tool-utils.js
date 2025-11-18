const PATH_PARAM_REGEX = /\{([^}]+)\}|:([A-Za-z0-9_]+)/g;

export function slugifyToolName(value = '') {
  const normalized = String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  return normalized || 'tool';
}

export function ensureUniqueToolName(baseName, usedNames = new Set()) {
  const base = slugifyToolName(baseName);
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  usedNames.add(candidate);
  return candidate;
}

export function extractPathParams(path = '') {
  if (!path) return [];
  const matches = path.match(PATH_PARAM_REGEX) || [];
  return matches
    .map((token) => token.replace(/\{|\}|:/g, ''))
    .filter((value, index, array) => value && array.indexOf(value) === index);
}

export function buildInputSchema({
  pathParams = [],
  queryParams = [],
  bodyProperties = [],
  source = null,
  summary = '',
} = {}) {
  const schema = {
    type: 'object',
    additionalProperties: true,
    properties: {},
    required: [],
  };

  if (summary) {
    schema.description = summary;
  }

  if (source) {
    schema['x-mbx-source'] = source;
  }

  for (const param of pathParams) {
    const key = typeof param === 'string' ? param : param?.name;
    if (!key || schema.properties[key]) continue;
    schema.properties[key] = {
      type: 'string',
      description: 'Path parameter',
    };
    schema.required.push(key);
  }

  for (const param of queryParams) {
    const key = typeof param === 'string' ? param : param?.name;
    if (!key || schema.properties[key]) continue;
    schema.properties[key] = {
      type: param?.type || 'string',
      description: param?.description || 'Query parameter',
    };
    if (param?.required) {
      schema.required.push(key);
    }
  }

  for (const prop of bodyProperties) {
    const key = typeof prop === 'string' ? prop : prop?.name;
    if (!key || schema.properties[key]) continue;
    schema.properties[key] = {
      type: prop?.type || 'string',
      description: prop?.description || 'Body property',
    };
    if (prop?.required) {
      schema.required.push(key);
    }
  }

  schema.required = Array.from(new Set(schema.required));
  return schema;
}

export function describeSource(schema = {}) {
  if (!schema || typeof schema !== 'object') return null;
  const meta = schema['x-mbx-source'];
  if (!meta || typeof meta !== 'object') return null;
  return meta;
}

export default {
  slugifyToolName,
  ensureUniqueToolName,
  extractPathParams,
  buildInputSchema,
  describeSource,
};
