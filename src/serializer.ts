import TOML, { AnyJson } from '@iarna/toml';
import { JSONPath, JSONPathKey } from './paths';
import { TOMLTable } from 'toml-eslint-parser/lib/ast';

export function serializeKey(value: JSONPathKey) {
  return value.toString().includes('.') ? JSON.stringify(value) : value;
}

export function serializePathToKey(path: JSONPath) {
  return path
    .map(
      (str) => serializeKey(str),
    )
    .join('.');
}

export function serializeKeyValue(path: JSONPath, value: unknown) {
  return `${serializePathToKey(path)} = ${TOML.stringify.value(value as AnyJson)}`;
}

export function serializeTable(path: JSONPath, value: object, type: TOMLTable['kind'] = 'standard') {
  const header = `[${serializePathToKey(path)}]`;
  return [
    type === 'array' ? `[${header}]` : header,
    ...Object.entries(value).map(
      ([k, v]) => serializeKeyValue([k], v),
    ),
  ].join('\n');
}
