import { parseForESLint, traverseNodes } from 'toml-eslint-parser';
import { TOMLNode } from 'toml-eslint-parser/lib/ast';
import TOML, { AnyJson, JsonMap } from '@iarna/toml';
import { getPath, JSONPath, matchPaths, pathsAreEqual, PathTracker } from './paths';
import _set from 'lodash.set';
import { isPlainObject } from './utils';
import { serializeKeyValuePair } from './serializer';

/**
 * Replaces the value in the TOML found at the given path.
 */
function tomlJSONPathReplacer(
  toml: string,
  jsonPath: JSONPath,
  value: unknown,
): string {
  if (!jsonPath.length) {
    throw new Error('JSON paths cannot be empty.');
  }
  const { ast } = parseForESLint(toml);
  const pathTracker = new PathTracker();
  let replaced = toml;
  let mostMatchedPath: JSONPath = [];
  traverseNodes(ast, {
    enterNode(node: TOMLNode, parent: TOMLNode | null) {
      // we don't care about values that belong to a key
      if (parent && ['TOMLKey'].includes(parent?.type)) {
        return;
      }
      // these either don't produce paths, or produce redundant paths
      if (['Program', 'TOMLTopLevelTable', 'TOMLKey', 'TOMLKeyValue'].includes(node.type)) {
        return;
      }
      const currentPath = getPath(node, parent, node.type === 'TOMLTable' ? node.resolvedKey : []);
      const matchedPath = matchPaths(jsonPath, currentPath);
      if (matchedPath.length > mostMatchedPath.length) {
        mostMatchedPath = matchedPath;
        pathTracker.set(matchedPath, node); // this captures table arrays
      }
      if (pathsAreEqual(currentPath, jsonPath)) {
        const [start, end] = node.range;
        replaced = toml.substring(0, start) + TOML.stringify.value(value as AnyJson) + toml.substring(end);
      }
      pathTracker.set(currentPath, node);
    },
    leaveNode() {},
  });
  if (replaced === toml) { // we didn't do any replacements
    if (!mostMatchedPath.length) { // no keys matched, so we can just append to the end
      const keyToInsert = jsonPath[0];
      const valuePath = jsonPath.slice(1);
      const body = valuePath.length ? _set({}, valuePath, value) : value;
      return [
        toml,
        serializeKeyValuePair(keyToInsert, body),
      ].join('\n\n');
    }
    const node = pathTracker.get(mostMatchedPath);
    if (!node) {
      throw new Error('Missing node.'); // this shouldn't happen
    }
    switch (node.type) {
      case 'TOMLTable':
        if (node.kind === 'array') {
          const indexToInsert = Number(jsonPath[mostMatchedPath.length]);
          if (!Number.isFinite(indexToInsert)) {
            throw new Error('Could not get insertion index.');
          }
          const lastNodeInArray = pathTracker.get([...mostMatchedPath, indexToInsert - 1]);
          if (!lastNodeInArray) {
            throw new Error(`Could not insert at ${[...mostMatchedPath, indexToInsert]}`);
          }
          const header = toml.slice(...node.key.range);
          const valuePath = jsonPath.slice(mostMatchedPath.length + 1);
          if (!valuePath.length && !isPlainObject(value)) {
            throw new Error('Only objects can be inserted into a table array.');
          }
          const body = valuePath.length ? _set({}, valuePath, value) : value as object;
          return [
            toml.slice(0, lastNodeInArray.range[1]),
            '\n',
            header,
            ...Object.entries(body).map(
              ([k, v]) => serializeKeyValuePair(k, v),
            ),
            '\n',
            toml.slice(lastNodeInArray.range[1]),
          ].join('\n');
        } else {
          const keyToInsert = jsonPath[mostMatchedPath.length];
          const valuePath = jsonPath.slice(mostMatchedPath.length + 1);
          const body = valuePath.length ? _set({}, valuePath, value) : value;
          return [
            toml.slice(0, node.range[1]),
            serializeKeyValuePair(keyToInsert, body),
            toml.slice(node.range[1]),
          ].join('\n');
        }
      case 'TOMLArray': {
        const indexToInsert = Number(jsonPath[mostMatchedPath.length]);
        if (indexToInsert !== node.elements.length) {
          throw new Error('Cannot skip array elements when inserting.');
        }
        const isMultiLine = node.loc.start.line !== node.loc.end.line;
        const lastElement = node.elements.length ? node.elements[node.elements.length - 1] : null;
        if (!lastElement) {
          if (!isMultiLine) {
            return [
              toml.slice(0, node.range[0]),
              `[${TOML.stringify.value(value as AnyJson)}]`, // we cant have comments inside the array so this is ok
              toml.slice(node.range[1]),
            ].join('');
          }
          return [
            toml.slice(0, node.range[1] - 1), // preserve whatever was inside the array
            '\n',
            TOML.stringify.value(value as AnyJson),
            toml.slice(node.range[1] - 1),
          ].join('');
        }
        return [
          toml.slice(0, lastElement.range[1]),
          isMultiLine ? ',\n' : ', ',
          TOML.stringify.value(value as AnyJson),
          toml.slice(node.range[1] - 1),
        ].join('');
      }
      case 'TOMLInlineTable': { // inline tables cannot have comments or any trailing commas, so its safe to remake
        const { data } = TOML.parse(`data = ${toml.slice(...node.range)}`) as { data: object };
        const valuePath = jsonPath.slice(mostMatchedPath.length);
        const body = _set(data, valuePath, value);
        return [
          toml.slice(0, node.range[0]),
          TOML.stringify.value(body as AnyJson),
          toml.slice(node.range[1]),
        ].join('');
      }
      default: {
        const valuePath = jsonPath.slice(mostMatchedPath.length);
        const body = _set({}, valuePath, value);
        return [
          toml.slice(0, node.range[0]),
          TOML.stringify.value(body),
          toml.slice(node.range[1]),
        ].join('');
      }
    }
  }
  return replaced;
}

export { JSONPath, tomlJSONPathReplacer };

