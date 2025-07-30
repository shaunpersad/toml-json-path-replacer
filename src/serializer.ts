import TOML, { AnyJson } from '@iarna/toml';

export function serializeKeyValuePair(key: string | number, value: unknown) {
  return `${key} = ${TOML.stringify.value(value as AnyJson)}`;
}
