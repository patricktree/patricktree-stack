export const arrays = {
  uniqueValues,
  shallowCopy,
  reverse,
  pickElementAndRemove,
  partitionArray,
  includesValue,
};

function uniqueValues<T>(
  array: T[],
  getPropertyToCompare: (item: T) => unknown = (item) => item,
): T[] {
  const result: T[] = [];

  for (const item of array) {
    const isDuplicate = result.some(
      (existingItem) => getPropertyToCompare(existingItem) === getPropertyToCompare(item),
    );

    if (!isDuplicate) {
      result.push(item);
    }
  }

  return result;
}

function shallowCopy<T>(array: T[]): T[] {
  return [...array];
}

function reverse<T>(array: T[]): T[] {
  const reversedArray = shallowCopy(array);
  /* The input is already copied, so reversing in place does not mutate the caller's array.
     `Array#toReversed()` would need a lib newer than this package's ES2020 target. */
  reversedArray.reverse();
  return reversedArray;
}

function pickElementAndRemove<T>(array: T[], elementIndex: number): T | undefined {
  return array.splice(elementIndex, 1)[0];
}

function partitionArray<T>(
  array: T[],
  options: { countOfPartitions: number } | { itemsPerPartition: number },
): T[][] {
  if ("countOfPartitions" in options) {
    return partitionByCount(array, options.countOfPartitions);
  }

  return partitionByItemCount(array, options.itemsPerPartition);
}

function includesValue<T>(array: T[], element: unknown): element is T {
  return array.some((arrayElement) => arrayElement === element);
}

function partitionByCount<T>(array: T[], countOfPartitions: number): T[][] {
  const partitions = Array.from({ length: countOfPartitions }, () => [] as T[]);

  for (const [index, item] of array.entries()) {
    const partition = partitions[index % countOfPartitions];
    if (partition === undefined) {
      throw new Error("Expected at least one partition.");
    }
    partition.push(item);
  }

  return partitions;
}

function partitionByItemCount<T>(array: T[], itemsPerPartition: number): T[][] {
  const partitions: T[][] = [];
  let currentPartition: T[] = [];

  for (const item of array) {
    if (currentPartition.length === itemsPerPartition) {
      partitions.push(currentPartition);
      currentPartition = [];
    }
    currentPartition.push(item);
  }

  partitions.push(currentPartition);
  return partitions;
}
