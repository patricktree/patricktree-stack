import type { ObjectLiteral } from "#src/types.ts";

export const objects = {
  shallowCopy,
  shallowIsEqual,
  groupBy,
};

function shallowCopy<T>(value: T): T {
  if (typeof value !== "object" || value === null) {
    // Return the value if it is not an object.
    return value;
  }

  // Shallow copy via object spread.
  return { ...value };
}

// https://stackoverflow.com/a/52323412/1700319
function shallowIsEqual(value: ObjectLiteral, valueToCompareWith: ObjectLiteral): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === Object.keys(valueToCompareWith).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(valueToCompareWith, key) &&
        value[key] === valueToCompareWith[key],
    )
  );
}

/** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy */
function groupBy<T, Key extends PropertyKey>(
  items: Iterable<T>,
  getKey: (element: T, index: number) => Key,
): { [Property in Key]?: T[] } {
  const result = {} as { [Property in Key]?: T[] };
  let index = 0;

  for (const item of items) {
    const key = getKey(item, index);
    result[key] = [...(result[key] ?? []), item];
    index += 1;
  }

  return result;
}
