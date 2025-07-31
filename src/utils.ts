export function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return value.constructor === Object;
}

export function isNumeric(str: string) {
  return !isNaN(Number(str));
}
