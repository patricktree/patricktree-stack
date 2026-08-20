import type { ObjectLiteral } from "#src/types.ts";

export const check = {
  assertIsUnreachable,
  isNullish,
  isNotNullish,
  isEmptyString,
  isNullishOrEmptyString,
  isNonEmptyString,
  isEmptyObject,
  isValueInEnum,
};

// https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
function assertIsUnreachable(value?: never): never {
  throw new Error(`Should be unreachable, but got here. value=${String(value)}`);
}

function isNullish(value: unknown): value is null | undefined {
  return value === undefined || value === null;
}

function isNotNullish<T>(value: T | null | undefined): value is NonNullable<T> {
  return !isNullish(value);
}

function isEmptyString(value: string): value is "" {
  return value.trim().length === 0;
}

function isNullishOrEmptyString(value: string | null | undefined): value is "" | null | undefined {
  return isNullish(value) || isEmptyString(value);
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return !isNullish(value) && !isEmptyString(value);
}

function isEmptyObject(value: ObjectLiteral): boolean {
  return Object.keys(value).length === 0;
}

function isValueInEnum<TEnumValue extends string>(
  value: string,
  enumVariable: Record<string, TEnumValue>,
): value is TEnumValue {
  return Object.values(enumVariable).some((enumValue) => enumValue === value);
}
