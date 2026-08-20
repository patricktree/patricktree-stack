import type { Increment, Range } from "#src/types.ts";

export const numbers = {
  parsePositiveInteger,
  convert,
  sequence,
};

function parsePositiveInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer but received: ${value}`);
  }

  return parsed;
}

function convert(value: unknown): number | undefined {
  // https://stackoverflow.com/a/1421988/1700319
  const valueAsString = String(value);
  if (Number.isNaN(Number.parseFloat(valueAsString)) || Number.isNaN(Number(value))) {
    return undefined;
  }

  return Number(value);
}

function sequence<const FromInclusive extends number, const ToInclusive extends number>(options: {
  fromInclusive: FromInclusive;
  toInclusive: ToInclusive;
}): Array<Range<FromInclusive, Increment<ToInclusive>>> {
  /* The arithmetic below produces exactly the numbers described by `Range<...>`, but TypeScript
     cannot narrow `number` to that literal union on its own. */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Array.from(
    { length: options.toInclusive - options.fromInclusive + 1 },
    (_, index) => index + options.fromInclusive,
  ) as Array<Range<FromInclusive, Increment<ToInclusive>>>;
}
