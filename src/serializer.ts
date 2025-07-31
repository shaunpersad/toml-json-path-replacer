import TOML, { AnyJson } from '@iarna/toml';
import { JSONPath } from './paths';
import { TOMLTable } from 'toml-eslint-parser/lib/ast';

export function serializeKey(value: string | number) {
  return value.toString().includes('.') ? JSON.stringify(value) : value;
}

export function serializePathToKey(path: JSONPath) {
  return path
    .map(
      (str) => serializeKey(str),
    )
    .join('.');
}

export function serializeKeyValue(key: JSONPath, value: unknown) {
  return `${serializePathToKey(key)} = ${TOML.stringify.value(value as AnyJson)}`;
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
