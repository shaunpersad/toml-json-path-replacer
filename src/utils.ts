export function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return value.constructor === Object;
}

export function isArrayOfObjects(value: unknown): value is object[] {
  return Array.isArray(value) && value.every((v) => isPlainObject(v));
}
