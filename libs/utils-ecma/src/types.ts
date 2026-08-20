export type ObjectLiteral = Record<string, unknown>;

export type EmptyObject = Record<string, never>;

export type ArrayElement<ArrayType> =
  ArrayType extends ReadonlyArray<infer Element> ? Element : never;

// https://github.com/Microsoft/TypeScript/issues/15480#issuecomment-601714262
type PrependNextNumber<ArrayType extends unknown[]> = ArrayType["length"] extends infer Length
  ? ((value: Length, ...array: ArrayType) => void) extends (...values: infer Result) => void
    ? Result
    : never
  : never;

type EnumerateInternal<ArrayType extends unknown[], NumberToEnumerate extends number> = {
  0: ArrayType;
  1: EnumerateInternal<PrependNextNumber<ArrayType>, NumberToEnumerate>;
}[NumberToEnumerate extends ArrayType["length"] ? 0 : 1];

export type Enumerate<NumberToEnumerate extends number> =
  EnumerateInternal<[], NumberToEnumerate> extends Array<infer NumberInRange>
    ? NumberInRange
    : never;

export type Range<From extends number, To extends number> = Exclude<Enumerate<To>, Enumerate<From>>;

// https://stackoverflow.com/a/73555039/1700319
type ArrayOfLength<
  Length extends number,
  Values extends unknown[] = [],
> = Values["length"] extends Length ? Values : ArrayOfLength<Length, [...Values, unknown]>;

export type Increment<Value extends number> = [...ArrayOfLength<Value>, unknown]["length"] & number;

/*
 * Discriminate unions.
 * https://stackoverflow.com/a/50499316/1700319
 */
export type NarrowUnion<
  Union,
  DiscriminatorProperty extends keyof Union,
  DiscriminatorValue,
> = Union extends { [Property in DiscriminatorProperty]: DiscriminatorValue } ? Union : never;

/*
 * Merge and flatten unions.
 * https://www.roryba.in/programming/2019/10/12/flattening-typescript-union-types.html#flattenunion
 */
/** Converts a union of two types into an intersection, i.e. `A | B` to `A & B`. */
export type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

export type KnownKeys<Value> = {
  [Key in keyof Value]: string extends Key ? never : number extends Key ? never : Key;
} extends { [_ in keyof Value]: infer KnownKey }
  ? KnownKey
  : never;

export type RemoveIndexSignature<Value> = {
  [Key in KnownKeys<Value>]: Value[Key];
};

/*
 * Identity function to show computed types.
 * https://github.com/microsoft/vscode/issues/94679#issuecomment-611320155
 */
export type Id<Value> = {} & { [Property in keyof Value]: Value[Property] };

// https://stackoverflow.com/a/58993872/1700319
type ImmutablePrimitive =
  | null
  | undefined
  | boolean
  | string
  | number
  | ((...args: never[]) => unknown);
type ImmutableArray<Value> = ReadonlyArray<Immutable<Value>>;
type ImmutableMap<Key, Value> = ReadonlyMap<Immutable<Key>, Immutable<Value>>;
type ImmutableSet<Value> = ReadonlySet<Immutable<Value>>;
type ImmutableObject<Value> = { readonly [Key in keyof Value]: Immutable<Value[Key]> };

export type Immutable<Value> = Value extends ImmutablePrimitive
  ? Value
  : Value extends Array<infer Element>
    ? ImmutableArray<Element>
    : Value extends Map<infer Key, infer MapValue>
      ? ImmutableMap<Key, MapValue>
      : Value extends Set<infer SetValue>
        ? ImmutableSet<SetValue>
        : ImmutableObject<Value>;

export type FunctionType<Arguments extends unknown[], ReturnValue> = (
  ...arguments_: Arguments
) => ReturnValue;

/** https://stackoverflow.com/a/43001581/1700319 */
export type Writeable<Value> = { -readonly [Property in keyof Value]: Value[Property] };

/** Expands object types one level deep. https://stackoverflow.com/a/57683652/1700319 */
export type ExpandProps<Value> = Value extends object
  ? Value extends infer ObjectValue
    ? { [Key in keyof ObjectValue]: ObjectValue[Key] }
    : never
  : Value;
