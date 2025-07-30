import { TOMLNode } from 'toml-eslint-parser/lib/ast';

export type JSONPath = Array<string | number>;

export function getPath(node: TOMLNode, parent: TOMLNode | null, keys: JSONPath = []): JSONPath {
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

export function pathsAreEqual(pathA: JSONPath, pathB: JSONPath) {
  if (pathA.length !== pathB.length) {
    return false;
  }
  return pathA.every((key, index) => pathB[index].toString() === key.toString());
}

export function matchPaths(intendedPath: JSONPath, currentPath: JSONPath): JSONPath {
  for (let i = 0; i < currentPath.length; i++) {
    if (intendedPath[i]?.toString() !== currentPath[i].toString()) {
      return currentPath.slice(0, i);
    }
  }
  return currentPath;
}

export class PathTracker {
  protected readonly paths: Array<[JSONPath, TOMLNode]> = [];

  set(path: JSONPath, node: TOMLNode): void {
    const existingIndex = this.paths.findIndex(
      ([pathToInspect]) => pathsAreEqual(pathToInspect, path),
    );
    if (existingIndex === -1) {
      this.paths.push([path, node]);
    } else {
      this.paths[existingIndex] = [path, node];
    }
  }

  get(path: JSONPath): TOMLNode | undefined {
    const existing = this.paths.find(
      ([pathToInspect]) => pathsAreEqual(pathToInspect, path),
    );
    return existing?.[1];
  }

  toJSON() {
    return this.paths;
  }
}
