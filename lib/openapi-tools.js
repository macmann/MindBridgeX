import YAML from 'yaml';
import { slugifyToolName, ensureUniqueToolName } from './tool-utils.js';

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

export const OPENAPI_SNIPPET = `{
  "openapi": "3.0.0",
  "info": { "title": "Sample", "version": "1.0.0" },
  "paths": {
    "/users": {
      "get": {
        "summary": "List users",
        "operationId": "listUsers"
      }
    }
  }
}`;

export function parseOpenApiSpec(raw = '') {
  const text = String(raw || '').trim();
  if (!text) {
    throw new Error('Paste an OpenAPI document first.');
  }
  try {
    return { document: JSON.parse(text), format: 'json' };
  } catch {
    try {
      return { document: YAML.parse(text), format: 'yaml' };
    } catch (error) {
      throw new Error(`Unable to parse OpenAPI spec: ${error.message}`);
    }
  }
}

function normalizeSchema(schema) {
  if (!schema || typeof schema !== 'object') {
    return { type: 'string' };
  }
  if (schema.type === 'array' && schema.items) {
    const child = normalizeSchema(schema.items);
    return { type: `array<${child.type}>`, description: schema.description };
  }
  if (schema.$ref) {
    return { type: 'object', description: 'Referenced schema' };
  }
  return {
    type: schema.type || 'string',
    description: schema.description || '',
  };
}

function collectParameters(pathItem, operation) {
  const output = [];
  const seen = new Set();
  const source = [];
  if (Array.isArray(pathItem?.parameters)) source.push(...pathItem.parameters);
  if (Array.isArray(operation?.parameters)) source.push(...operation.parameters);
  for (const param of source) {
    if (!param || typeof param !== 'object') continue;
    const name = param.name || '';
    if (!name || seen.has(`${param.in || 'query'}:${name}`)) continue;
    seen.add(`${param.in || 'query'}:${name}`);
    if (param.$ref) continue;
    output.push({
      name,
      in: param.in || 'query',
      required: Boolean(param.required),
      description: param.description || '',
      schema: normalizeSchema(param.schema),
    });
  }
  return output;
}

function collectBodyProperties(operation) {
  const requestBody = operation?.requestBody;
  if (!requestBody || typeof requestBody !== 'object') return [];
  const content = requestBody.content || {};
  const jsonContent = content['application/json'] || content['application/*+json'];
  if (!jsonContent || typeof jsonContent.schema !== 'object') return [];
  const schema = jsonContent.schema;
  if (!schema || typeof schema !== 'object' || typeof schema.properties !== 'object') {
    return [];
  }
  const required = Array.isArray(schema.required) ? schema.required : [];
  const props = [];
  for (const [name, propSchema] of Object.entries(schema.properties)) {
    const normalized = normalizeSchema(propSchema);
    props.push({
      name,
      type: normalized.type,
      description: normalized.description || '',
      required: required.includes(name),
    });
  }
  return props;
}

export function extractOpenApiOperations(spec) {
  const paths = spec?.paths || {};
  const operations = [];
  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const methodKey of HTTP_METHODS) {
      const op = pathItem[methodKey];
      if (!op || typeof op !== 'object') continue;
      const method = methodKey.toUpperCase();
      const parameters = collectParameters(pathItem, op);
      const bodyProps = collectBodyProperties(op);
      const summary = op.summary || '';
      const description = op.description || '';
      const operationId = op.operationId || `${method}_${pathKey}`;
      const suggestedName = slugifyToolName(op.operationId || op.summary || `${method}_${pathKey}`);
      operations.push({
        id: `${method}_${pathKey}_${operationId}`,
        operationId,
        method,
        path: pathKey,
        summary,
        description,
        suggestedName,
        parameters,
        queryParams: parameters.filter((param) => param.in === 'query'),
        pathParams: parameters.filter((param) => param.in === 'path'),
        bodyProperties: bodyProps,
      });
    }
  }
  return operations;
}

export function inferBaseUrlFromSpec(spec) {
  const firstServer = Array.isArray(spec?.servers) ? spec.servers[0] : null;
  if (firstServer && typeof firstServer.url === 'string') {
    return firstServer.url.trim();
  }
  const basePath = spec?.basePath;
  return basePath || '';
}

export function inferOpenApiAuth(spec) {
  const components = spec?.components || {};
  const securitySchemes = components.securitySchemes || {};
  let primarySchemeKey = null;
  if (Array.isArray(spec?.security) && spec.security.length > 0) {
    const first = spec.security[0];
    primarySchemeKey = Object.keys(first || {})[0] || null;
  }
  if (!primarySchemeKey) {
    const keys = Object.keys(securitySchemes);
    primarySchemeKey = keys.length > 0 ? keys[0] : null;
  }
  const primaryScheme = primarySchemeKey ? securitySchemes[primarySchemeKey] : null;
  const inferred = {
    auth_type: 'none',
    api_key_header_name: null,
    api_key_query_name: null,
  };
  if (primaryScheme) {
    if (primaryScheme.type === 'apiKey') {
      if (primaryScheme.in === 'header') {
        inferred.auth_type = 'api_key_header';
        inferred.api_key_header_name = primaryScheme.name || 'X-API-Key';
      } else if (primaryScheme.in === 'query') {
        inferred.auth_type = 'api_key_query';
        inferred.api_key_query_name = primaryScheme.name || 'api_key';
      }
    } else if (primaryScheme.type === 'http') {
      const scheme = (primaryScheme.scheme || '').toLowerCase();
      if (scheme === 'bearer') {
        inferred.auth_type = 'bearer_token';
      } else if (scheme === 'basic') {
        inferred.auth_type = 'basic';
      }
    }
  }
  return inferred;
}

export function ensureOperationNames(operations, existingNames = []) {
  const used = new Set(existingNames);
  return operations.map((op) => ({
    ...op,
    toolName: ensureUniqueToolName(op.suggestedName, used),
  }));
}

export default {
  parseOpenApiSpec,
  extractOpenApiOperations,
  inferBaseUrlFromSpec,
  inferOpenApiAuth,
  ensureOperationNames,
  OPENAPI_SNIPPET,
};
