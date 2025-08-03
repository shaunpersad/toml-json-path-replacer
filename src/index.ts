import { parseForESLint, traverseNodes } from 'toml-eslint-parser';
import { TOMLNode, TOMLTable } from 'toml-eslint-parser/lib/ast';
import TOML, { AnyJson } from '@iarna/toml';
import { getPath, JSONPath, matchPaths, pathsAreEqual, PathTracker } from './paths';
import _set from 'lodash.set';
import { isArrayOfObjects, isNumeric, isPlainObject } from './utils';
import { serializeKeyValue, serializePathToKey, serializeTable } from './serializer';

const RANGE_START = 0;
const RANGE_END = 1;

function insert(
  toml: string,
  jsonPath: JSONPath,
  value: unknown,
  pathTracker: PathTracker,
  mostMatchedPath: JSONPath,
): string {
  console.log({ jsonPath, mostMatchedPath });
  let node = pathTracker.get(mostMatchedPath);
  if (!node) {
    const tableArrayNode = pathTracker.get([...mostMatchedPath, 0]); // only table arrays will match this pattern
    if (tableArrayNode && tableArrayNode.type === 'TOMLTable' && tableArrayNode.kind === 'array') {
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
  if (!node) { // we didn't find any existing nodes so we can make a brand new entry in the top-level table
    // only objects can be turned into tables, which are desirable because they can go to the bottom of the file
    // non-objects get turned into kv pairs, which cannot safely go to the bottom,
    // because they may get unintentionally added to some other table
    console.log('insert - adding new entry');

    if (isPlainObject(value)) { // we can create regular tables
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
      console.log('insert - updating table', node.kind, 'with key', node.resolvedKey);
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
          console.log('insert - removing table arrays');
          let tomlWithoutArray = '';
          let index = 0;
          let lastEnd = 0;
          let element: TOMLNode | undefined;
          while (element = pathTracker.get([...jsonPath, index++])) {
            const [start, end] = element.range;
            tomlWithoutArray += toml.slice(lastEnd, start).trimEnd();
            lastEnd = end;
          }
          return tomlJSONPathReplacer(tomlWithoutArray.trimEnd(), jsonPath, value) + toml.slice(lastEnd);
        }
        // we're adding a new kv pair into an existing element
        console.log('insert - into table array');
        const valuePath = jsonPath.slice(node.resolvedKey.length);
        return [
          toml.slice(0, node.range[RANGE_END]).trimEnd(),
          '\n',
          serializeKeyValue(valuePath, value),
          toml.slice(node.range[RANGE_END]),
        ].join('');
      } else {
        console.log('insert - updating existing standard table');
        const valuePath = jsonPath.slice(node.resolvedKey.length);
        return [
          toml.slice(0, node.range[RANGE_END]).trimEnd(),
          '\n',
          serializeKeyValue(valuePath, value),
          toml.slice(node.range[RANGE_END]),
        ].join('');
      }
    case 'TOMLArray': {
      console.log('insert - updating array');
      const indexToInsert = Number(jsonPath[mostMatchedPath.length]);
      if (!Number.isFinite(indexToInsert)) {
        throw new Error('Cannot convert an array item to another type.');
      }
      if (indexToInsert !== node.elements.length) {
        throw new Error('Cannot skip array elements when inserting.');
      }
      const isMultiLine = node.loc.start.line !== node.loc.end.line;
      const lastElement = node.elements.length ? node.elements[node.elements.length - 1] : null;
      if (!lastElement) {
        if (!isMultiLine) {
          return [
            toml.slice(0, node.range[RANGE_START]),
            `[${TOML.stringify.value(value as AnyJson)}]`, // we cant have comments inside the array so this is ok
            toml.slice(node.range[RANGE_END]),
          ].join('');
        }
        return [
          toml.slice(0, node.range[RANGE_END] - 1), // preserve whatever was inside the array
          TOML.stringify.value(value as AnyJson),
          toml.slice(node.range[RANGE_END] - 1),
        ].join('\n');
      }
      return [
        toml.slice(0, lastElement.range[RANGE_END]),
        isMultiLine ? ',\n' : ', ',
        TOML.stringify.value(value as AnyJson),
        toml.slice(node.range[RANGE_END] - 1),
      ].join('');
    }
    case 'TOMLInlineTable': { // inline tables cannot have comments or any trailing commas, so it's safe to remake
      console.log('insert - updating inline table');
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
      console.log('insert - default update');
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
  value: unknown,
  node: TOMLNode,
): string {
  const [start, end] = node.range;
  if (node.type === 'TOMLTable') {  // tables require special care
    console.log('update - updating table');
    if (isPlainObject(value)) {
      console.log('plain object');
      return [
        toml.slice(0, node.range[RANGE_START]),
        serializeTable(node.resolvedKey.slice(0, node.kind === 'array' ? -1 : undefined), value, node.kind),
        toml.slice(end),
      ].join('');
    } else { // remove the table and go through the insertion logic instead
      console.log('update - removing table');
      const tomlWithoutTable = toml.slice(0, start) + toml.slice(end);
      return tomlJSONPathReplacer(tomlWithoutTable, jsonPath, value);
    }
  }
  console.log('update - default replacement');
  return toml.slice(0, start) + TOML.stringify.value(value as AnyJson) + toml.slice(end);
}

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
        replaced = update(toml, jsonPath, value, node);
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

export { JSONPath, tomlJSONPathReplacer };

