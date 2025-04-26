import { parseForESLint, traverseNodes } from 'toml-eslint-parser';
import { TOMLNode } from 'toml-eslint-parser/lib/ast';

export type JSONPath = Array<string | number>;

function getPath(node: TOMLNode, parent: TOMLNode | null, keys: JSONPath = []): JSONPath {
  if (!parent) {
    return keys;
  }
  switch (parent.type) {
    case 'TOMLTable':
      return getPath(parent, parent.parent, [
        ...parent.resolvedKey,
        ...keys,
      ]);
    case 'TOMLArray':
      return getPath(parent, parent.parent, [
        parent.elements.findIndex((item) => item === node),
        ...keys,
      ]);
    case 'TOMLKeyValue':
      return getPath(parent, parent.parent, [
        ...parent.key.keys.map((key) => {
          return key.type === 'TOMLBare' ? key.name : key.value;
        }),
        ...keys,
      ]);
    default:
      return getPath(parent, parent.parent, keys);
  }
}

/**
 * Replaces the value in the TOML found at the given path.
 */
function tomlJSONPathReplacer(
  toml: string,
  jsonPath: JSONPath,
  value: unknown,
): string {
  if (!['string', 'number', 'boolean'].includes(typeof value)) {
    throw new Error('Non-scalar values are not allowed.');
  }
  const { ast } = parseForESLint(toml);
  let replaced = toml;
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
      const path = getPath(node, parent, node.type === 'TOMLTable' ? node.resolvedKey : []);
      if (jsonPath.length === path.length && jsonPath.every((p, index) => p === path[index])) {
        const [start, end] = node.range;
        replaced = toml.substring(0, start) + JSON.stringify(value) + toml.substring(end);
      }
    },
    leaveNode() {},
  });
  return replaced;
}

export { tomlJSONPathReplacer };

