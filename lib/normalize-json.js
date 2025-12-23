export function normalizeJson(input) {
  if (input === undefined || input === null) return input;
  if (typeof input === 'object') return input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    return JSON.parse(trimmed);
  }
  return input;
}
