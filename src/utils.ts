import { TOMLNode } from 'toml-eslint-parser/lib/ast/index.js';

export function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return value.constructor === Object;
}

export function isArrayOfObjects(value: unknown): value is object[] {
  return Array.isArray(value) && !!value.length && value.every((v) => isPlainObject(v));
}

export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') {
    return true;
  }
  if (typeof value === 'string') {
    return !isNaN(Number(value));
  }
  return false;
}

export function isAncestor(node: TOMLNode, potentialAncestor: TOMLNode): boolean {
  let n = node;
  while (n) {
    if (!n.parent) {
      break;
    }
    if (n.parent === potentialAncestor) {
      return true;
    }
    n = n.parent;
  }
  return false;
}
