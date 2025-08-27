import { parseForESLint, traverseNodes } from 'toml-eslint-parser';
import type { TOMLContentNode, TOMLNode } from 'toml-eslint-parser/lib/ast/index.js';
import TOML, { type AnyJson } from '@iarna/toml';
import { getPath, type JSONPath, matchPaths, pathsAreEqual, PathTracker } from './paths.js';
import _set from 'lodash.set';
import { isArrayOfObjects, isNumeric, isPlainObject } from './utils.js';
import { serializeKeyValue, serializeTable } from './serializer.js';

const RANGE_START = 0;
const RANGE_END = 1;

function insert(
  toml: string,
  jsonPath: JSONPath,
  value: unknown,
  pathTracker: PathTracker,
  mostMatchedPath: JSONPath,
): string {
  let node = pathTracker.get(mostMatchedPath);
  if (!node) {
    const tableArrayNode = pathTracker.get([...mostMatchedPath, 0]); // only table arrays will match this pattern
    if (tableArrayNode && tableArrayNode.type === 'TOMLTable' && tableArrayNode.kind === 'array') {
      if (value === undefined) {
        if (pathsAreEqual(jsonPath, mostMatchedPath)) {  // this is actually a delete of all the table array elements
          let index = 0;
          let tomlWithElementsRemoved = toml;
          while (node = pathTracker.get([...mostMatchedPath, index++])) {
            tomlWithElementsRemoved = tomlJSONPathReplacer(tomlWithElementsRemoved, [...mostMatchedPath, 0], undefined);
          }
          return tomlWithElementsRemoved;
        }
        // it's trying to unset a path that doesn't exist
        return toml;
      }
      // otherwise set to the first table array element
      node = tableArrayNode;
    } else {
      // walk up the chain to find some node that already exists in the toml
      for (let i = 0; i < mostMatchedPath.length; i++) {
        if (node = pathTracker.get(mostMatchedPath.slice(0, -i))) {
          break;
        }
      }
    }
  }
  if (value === undefined) { // we didn't match the specified path, but it was a delete anyway
    return toml;
  }
  if (!node) { // we didn't find any existing nodes so we can make a brand new entry in the top-level table
    // only objects can be turned into tables, which are desirable because they can go to the bottom of the file
    // non-objects get turned into kv pairs, which cannot safely go to the bottom,
    // because they may get unintentionally added to some other table
    if (isPlainObject(value) && Object.keys(value).length) { // we can create regular tables
      return [
        toml.trimEnd(),
        '\n\n',
        serializeTable(jsonPath, value),
      ].join('').trim();
    }
    if (isArrayOfObjects(value)) { // we can create table arrays
      return [
        toml.trimEnd(),
        '\n\n',
        value.map((item) => serializeTable(jsonPath, item, 'array')).join('\n\n'),
      ].join('').trim();
    }
    if (jsonPath.length >= 2) { // we have enough keys in the path to create a table name and a table body
      const objectKey = jsonPath.pop()!;
      return [
        toml.trimEnd(),
        '\n\n',
        serializeTable(jsonPath, { [objectKey]: value }),
      ].join('').trim();
    }
    // we couldn't meet the criteria for a table so we have to use a kv pair, which will go at the top of the file
    return [
      serializeKeyValue(jsonPath, value),
      '\n\n',
      toml.trimStart(),
    ].join('').trim();
  }

  switch (node.type) {
    case 'TOMLTable':
      if (node.kind === 'array') {
        const entireTableArrayPath = node.resolvedKey.slice(0, -1); // remove index
        // are we targeting an array element?
        if (jsonPath.length === node.resolvedKey.length && isNumeric(jsonPath[jsonPath.length - 1])) {
          if (!isPlainObject(value)) {
            throw new Error('Table array bodies can only consist of key-value pairs.');
          }
          const targetedIndex = Number(jsonPath[jsonPath.length - 1]);
          const existingElement = pathTracker.get([...entireTableArrayPath, targetedIndex]);
          if (!existingElement) {
            const lastElement = pathTracker.get([...entireTableArrayPath, targetedIndex - 1]);
            if (!lastElement) {
              throw new Error('Cannot skip array elements.');
            }
            return [
              toml.slice(0, lastElement.range[RANGE_END]).trimEnd(),
              '\n\n',
              serializeTable(entireTableArrayPath, value, node.kind),
              toml.slice(lastElement.range[RANGE_END]),
            ].join('');
          }
          if (existingElement.type !== 'TOMLTable' || existingElement.kind !== 'array') {
            throw new Error('Expecting a table array.'); // this shouldn't happen
          }
          return [
            toml.slice(0, existingElement.range[RANGE_START]).trimEnd(),
            '\n\n',
            serializeTable(jsonPath, value, 'array'),
            toml.slice(existingElement.range[RANGE_END]),
          ].join('');
        }
        if (
          // we're targeting the whole array
          pathsAreEqual(jsonPath, entireTableArrayPath) ||
          // we're trying to update an array index with an invalid index, which is a type change
          !isNumeric(jsonPath[node.resolvedKey.length - 1])
        ) { // remove the table arrays and try again
          return [
            // insert the new value right where the first table array is
            tomlJSONPathReplacer(
              toml.slice(0, node.range[RANGE_START]).trimEnd(),
              jsonPath,
              value,
            ),
            // remove the table arrays from the rest of the toml
            tomlJSONPathReplacer(toml.slice(node.range[RANGE_START]), jsonPath, undefined),
          ].join('');
        }
        // we're adding a new kv pair into an existing element
        const valuePath = jsonPath.slice(node.resolvedKey.length);
        const indexOfNewLine = toml.slice(node.range[RANGE_END]).indexOf('\n');
        return [
          toml.slice(0, node.range[RANGE_END] + (indexOfNewLine === -1 ? 0 : indexOfNewLine)).trimEnd(),
          '\n',
          serializeKeyValue(valuePath, value),
          toml.slice(node.range[RANGE_END] + (indexOfNewLine === -1 ? 0 : indexOfNewLine)),
        ].join('');
      } else { // regular table
        const valuePath = jsonPath.slice(node.resolvedKey.length);
        const indexOfNewLine = toml.slice(node.range[RANGE_END]).indexOf('\n');
        return [
          toml.slice(0, node.range[RANGE_END] + (indexOfNewLine === -1 ? 0 : indexOfNewLine)).trimEnd(),
          '\n',
          serializeKeyValue(valuePath, value),
          toml.slice(node.range[RANGE_END] + (indexOfNewLine === -1 ? 0 : indexOfNewLine)),
        ].join('');
      }
    case 'TOMLArray': {
      let arrayPath: JSONPath = [];
      let valuePath: JSONPath = [];
      for (let index = 0; index < jsonPath.length; index++) {
        arrayPath = jsonPath.slice(0, -index);
        if (node === pathTracker.get(arrayPath)) {
          valuePath = jsonPath.slice(jsonPath.length - index);
          break;
        }
      }
      if (!isNumeric(valuePath[0])) { // the element index is not a number, so we're converting the array to an object
        const body = _set({}, valuePath, value);
        return [
          toml.slice(0, node.range[RANGE_START]),
          TOML.stringify.value(body as AnyJson),
          toml.slice(node.range[RANGE_END]),
        ].join('');
      }
      const indexToInsert = Number(valuePath.shift());
      if (indexToInsert > node.elements.length) {
        throw new Error('Cannot skip array elements when inserting.');
      }
      const body = valuePath.length ? _set({}, valuePath, value) : value;
      const existingElement = pathTracker.get([...arrayPath, indexToInsert]);
      if (existingElement) { // replace an existing array item
        return [
          toml.slice(0, existingElement.range[RANGE_START]),
          TOML.stringify.value(body as AnyJson),
          toml.slice(existingElement.range[RANGE_END]),
        ].join('');
      }
      if (!node.elements.length) { // it's an empty array so we can just reconstruct it
        return [
          toml.slice(0, node.range[RANGE_START]),
          TOML.stringify.value([body] as AnyJson),
          toml.slice(node.range[RANGE_END]),
        ].join('');
      }
      // insert right after the last element, preserving the indent
      const lastElement = node.elements[node.elements.length - 1];
      const elementBefore = node.elements[node.elements.length - 2];
      const start = elementBefore ? elementBefore.range[RANGE_END] : node.range[RANGE_START] + 1;
      const betweenElements = toml.slice(start, lastElement?.range[RANGE_START]);
      const spaceBetweenElements = (betweenElements.split('\n').pop() ?? '').replace(',', '');
      const toArrayEnd = toml.slice(lastElement?.range[RANGE_END], node.range[RANGE_END] - 1);
      const [lastElementRestOfLine] = toArrayEnd.replace(',', '').split('\n');
      const toArrayEndExcludingLastElementRestOfLine = toArrayEnd.replace(',', '').split('\n').pop();
      return [
        toml.slice(0, lastElement?.range[RANGE_END]),
        ',',
        toArrayEnd.includes('\n') ? `${lastElementRestOfLine}\n` : '',
        spaceBetweenElements,
        TOML.stringify.value(body as AnyJson),
        toArrayEnd.includes('\n') ? '\n' : '',
        toArrayEndExcludingLastElementRestOfLine,
        toml.slice(node.range[RANGE_END] - 1),
      ].join('');
    }
    case 'TOMLInlineTable': { // inline tables cannot have comments or any trailing commas, so it's safe to remake
      const { data } = TOML.parse(`data = ${toml.slice(...node.range)}`) as { data: object };
      const valuePath = jsonPath.slice(mostMatchedPath.length);
      const body = _set(data, valuePath, value);
      return [
        toml.slice(0, node.range[RANGE_START]),
        TOML.stringify.value(body as AnyJson),
        toml.slice(node.range[RANGE_END]),
      ].join('');
    }
    default: {
      const valuePath = jsonPath.slice(mostMatchedPath.length);
      const body = _set({}, valuePath, value);
      return [
        toml.slice(0, node.range[RANGE_START]),
        TOML.stringify.value(body),
        toml.slice(node.range[RANGE_END]),
      ].join('');
    }
  }
}

function update(
  toml: string,
  jsonPath: JSONPath,
  value: unknown | undefined,
  node: TOMLNode,
): string {
  const [start, end] = node.range;
  if (node.type === 'TOMLTable') {  // tables require special care
    if (isPlainObject(value) && Object.keys(value).length) {
      return [
        toml.slice(0, node.range[RANGE_START]),
        serializeTable(node.resolvedKey.slice(0, node.kind === 'array' ? -1 : undefined), value, node.kind),
        toml.slice(end),
      ].join('');
    } else { // remove the table and go through the insertion logic instead, to change its type
      const tomlWithoutTable = tomlJSONPathReplacer(toml, jsonPath, undefined);
      return tomlJSONPathReplacer(tomlWithoutTable, jsonPath, value);
    }
  }
  return toml.slice(0, start) + TOML.stringify.value(value as AnyJson) + toml.slice(end);
}

function remove(toml: string, jsonPath: JSONPath, node: TOMLNode): string {
  switch (node.parent?.type) {
    case 'TOMLArray':
      for (let index = 0; index < node.parent.elements.length; index++) {
        const element: TOMLContentNode = node.parent.elements[index]!;
        if (node !== element) {
          continue;
        }
        if (node.parent.elements.length === 1) { // removing the only element in the array
          return [
            toml.slice(0, node.parent.range[RANGE_START]),
            '[]',
            toml.slice(node.parent.range[RANGE_END]),
          ].join('');
        }
        const [start, end] = node.range;
        const nextElement = node.parent.elements[index + 1];
        if (nextElement) { // chop off till start of next element
          return [
            toml.slice(0, start),
            toml.slice(nextElement.range[RANGE_START]),
          ].join('');
        }
        if (node.loc.end.line === node.parent.loc.end.line) { // same line
          const indexOfComma = toml.slice(end, node.parent.range[RANGE_END]).indexOf(',');
          return [
            toml.slice(0, start),
            toml.slice(end + (indexOfComma === -1 ? 0 : (indexOfComma + 1))),
          ].join('');
        }
        const indexOfNewLine = toml.slice(end, node.parent.range[RANGE_END]).indexOf('\n');
        return [
          toml.slice(0, start).trimEnd(),
          toml.slice(end + indexOfNewLine),
        ].join('');
      }
      break;
    case 'TOMLKeyValue': {
      const grandparent = node.parent.parent;
      switch (grandparent.type) {
        case 'TOMLTopLevelTable':
        case 'TOMLTable':
          if (grandparent.body.length === 1) { // tables _can_ exist with no elements, but it may swallow up unwanted keys under it
            if (grandparent.type === 'TOMLTopLevelTable') {
              return '';
            }
            return remove(toml, jsonPath.slice(0, -1), grandparent);
          }
          for (const element of grandparent.body) {
            if (element === node.parent) {
              const [start, end] = element.range;
              const indexOfNewLine = toml.slice(end).indexOf('\n');
              return [
                toml.slice(0, start).trimEnd(),
                toml.slice(end + (indexOfNewLine === -1 ? 0 : indexOfNewLine)),
              ].join('');
            }
          }
          break;
        case 'TOMLInlineTable': {
          const [start, end] = grandparent.range;
          const { data } = TOML.parse(`data = ${toml.slice(start, end)}`) as { data: object };
          const key = jsonPath[jsonPath.length - 1];
          delete data[key as keyof typeof data];
          return [
            toml.slice(0, start),
            TOML.stringify.value(data as AnyJson),
            toml.slice(end),
          ].join('');
        }
      }
    }
      break;
  }
  // the only possible case left is if we're targeting a table
  const [start, end] = node.range;
  const indexOfNewLine = toml.slice(end).indexOf('\n');
  return [
    toml.slice(0, start).trimEnd(),
    toml.slice(end + (indexOfNewLine === -1 ? 0 : indexOfNewLine)),
  ].join('');
}

/**
 * Replaces the value in the TOML found at the given path.
 */
function tomlJSONPathReplacer(
  toml: string,
  jsonPath: JSONPath,
  value: unknown | undefined,
): string {
  if (!jsonPath.length) {
    throw new Error('JSON paths cannot be empty.');
  }
  const { ast } = parseForESLint(toml);
  const pathTracker = new PathTracker();
  let found = false;
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
      const currentPath = getPath(node, node.type === 'TOMLTable' ? node.resolvedKey : []);
      const matchedPath = matchPaths(jsonPath, currentPath);
      if (matchedPath.length > mostMatchedPath.length) {
        mostMatchedPath = matchedPath;
      }
      if (pathsAreEqual(currentPath, jsonPath)) {
        found = true;
        replaced = value === undefined
          ? remove(toml, jsonPath, node)
          : update(toml, jsonPath, value, node);
      }
      pathTracker.set(currentPath, node);
    },
    leaveNode() {},
  });
  if (!found) {
    return insert(
      toml,
      jsonPath,
      value,
      pathTracker,
      mostMatchedPath,
    );
  }
  return replaced;
}

export { tomlJSONPathReplacer };
export type { JSONPath };

