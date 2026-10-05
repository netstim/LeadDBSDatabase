/* eslint-disable no-use-before-define, default-param-last, valid-typeof */
/**
 * Minimal MATLAB Level-5 MAT-file writer.
 *
 * The writer intentionally supports the subset needed by SPARK/Lead-DBS:
 * real numeric arrays, logical arrays, UTF-16 character rows, cell arrays,
 * and scalar/array structs. It does not implement compressed, sparse,
 * complex, object, or function-handle arrays.
 *
 * MATLAB stores array contents in column-major order. The explicit helpers
 * accept column-major values; `matMatrix` and `matCellMatrix` convert ordinary
 * JavaScript row arrays for callers that prefer row-major input.
 */

const MAT_VALUE_MARKER = '__sparkMatValue';
const MAX_UINT32 = 0xffffffff;
const MAX_DIMENSION = 0x7fffffff;
const MAX_NAME_LENGTH = 63;
const MAX_NESTING_DEPTH = 64;

enum MiType {
  Int8 = 1,
  UInt8 = 2,
  Int16 = 3,
  UInt16 = 4,
  Int32 = 5,
  UInt32 = 6,
  Single = 7,
  Double = 9,
  Int64 = 12,
  UInt64 = 13,
  Matrix = 14,
  Utf16 = 17,
}

enum MxClass {
  Cell = 1,
  Struct = 2,
  Char = 4,
  Double = 6,
  Single = 7,
  Int8 = 8,
  UInt8 = 9,
  Int16 = 10,
  UInt16 = 11,
  Int32 = 12,
  UInt32 = 13,
  Int64 = 14,
  UInt64 = 15,
}

const LOGICAL_ARRAY_FLAG = 0x0200;

export type MatNumericType =
  | 'double'
  | 'single'
  | 'int8'
  | 'uint8'
  | 'int16'
  | 'uint16'
  | 'int32'
  | 'uint32'
  | 'int64'
  | 'uint64';

export type MatTypedArray =
  | Float64Array
  | Float32Array
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | BigInt64Array
  | BigUint64Array;

export type MatNumericValue = number | bigint | boolean;
export type MatNumericValues = readonly MatNumericValue[] | MatTypedArray;

export interface MatStructValue {
  readonly [fieldName: string]: MatValue | undefined;
}

export interface MatNumericArray {
  readonly [MAT_VALUE_MARKER]: 'numeric';
  readonly dimensions: readonly number[];
  readonly values: readonly MatNumericValue[];
  readonly dataType: MatNumericType;
  readonly logical: boolean;
}

export interface MatCellArray {
  readonly [MAT_VALUE_MARKER]: 'cell';
  readonly dimensions: readonly number[];
  readonly values: readonly MatValue[];
}

export interface MatStructArray {
  readonly [MAT_VALUE_MARKER]: 'struct';
  readonly dimensions: readonly number[];
  readonly values: readonly MatStructValue[];
  readonly fieldNames?: readonly string[];
}

export type MatValue =
  | number
  | bigint
  | boolean
  | string
  | null
  | undefined
  | MatTypedArray
  | readonly MatValue[]
  | MatStructValue
  | MatNumericArray
  | MatCellArray
  | MatStructArray;

/** Public input alias used by callers that construct a top-level variable map. */
export type MatValueInput = MatValue;

export interface MatFileOptions {
  /** Optional deterministic header description, truncated to 116 ASCII bytes. */
  readonly description?: string;
  /** Used only by the default header description. */
  readonly createdAt?: Date;
}

interface EncodingContext {
  readonly activeContainers: Set<object>;
}

interface NumericEncoding {
  readonly miType: MiType;
  readonly mxClass: MxClass;
  readonly byteWidth: number;
}

const NUMERIC_ENCODINGS: Readonly<Record<MatNumericType, NumericEncoding>> = {
  double: { miType: MiType.Double, mxClass: MxClass.Double, byteWidth: 8 },
  single: { miType: MiType.Single, mxClass: MxClass.Single, byteWidth: 4 },
  int8: { miType: MiType.Int8, mxClass: MxClass.Int8, byteWidth: 1 },
  uint8: { miType: MiType.UInt8, mxClass: MxClass.UInt8, byteWidth: 1 },
  int16: { miType: MiType.Int16, mxClass: MxClass.Int16, byteWidth: 2 },
  uint16: { miType: MiType.UInt16, mxClass: MxClass.UInt16, byteWidth: 2 },
  int32: { miType: MiType.Int32, mxClass: MxClass.Int32, byteWidth: 4 },
  uint32: { miType: MiType.UInt32, mxClass: MxClass.UInt32, byteWidth: 4 },
  int64: { miType: MiType.Int64, mxClass: MxClass.Int64, byteWidth: 8 },
  uint64: { miType: MiType.UInt64, mxClass: MxClass.UInt64, byteWidth: 8 },
};

/**
 * Wrap an explicitly shaped numeric array. Values must already be in MATLAB
 * column-major order. A one-dimensional shape is normalized to `[1, length]`.
 */
export function matNumeric(
  values: MatNumericValues,
  dimensions: readonly number[] = [1, values.length],
  dataType: MatNumericType = 'double',
): MatNumericArray {
  return {
    [MAT_VALUE_MARKER]: 'numeric',
    dimensions: [...dimensions],
    values: Array.from(values),
    dataType,
    logical: false,
  };
}

/** Wrap an explicitly shaped logical array in column-major order. */
export function matLogical(
  values: readonly (boolean | number)[],
  dimensions: readonly number[] = [1, values.length],
): MatNumericArray {
  return {
    [MAT_VALUE_MARKER]: 'numeric',
    dimensions: [...dimensions],
    values: [...values],
    dataType: 'uint8',
    logical: true,
  };
}

/** Convert a conventional rectangular row-major matrix to MATLAB order. */
export function matMatrix(
  rows: readonly (readonly MatNumericValue[])[],
  dataType: MatNumericType = 'double',
): MatNumericArray {
  const { rowCount, columnCount } = validateRectangularRows(
    rows,
    'numeric matrix',
  );
  const values: MatNumericValue[] = [];

  for (let column = 0; column < columnCount; column += 1) {
    for (let row = 0; row < rowCount; row += 1) {
      values.push(rows[row][column]);
    }
  }

  return matNumeric(values, [rowCount, columnCount], dataType);
}

/** Construct an explicitly shaped cell array in MATLAB column-major order. */
export function matCell(
  values: readonly MatValue[],
  dimensions: readonly number[] = [1, values.length],
): MatCellArray {
  return {
    [MAT_VALUE_MARKER]: 'cell',
    dimensions: [...dimensions],
    values: [...values],
  };
}

/** Convert a conventional rectangular row-major cell matrix to MATLAB order. */
export function matCellMatrix(
  rows: readonly (readonly MatValue[])[],
): MatCellArray {
  const { rowCount, columnCount } = validateRectangularRows(
    rows,
    'cell matrix',
  );
  const values: MatValue[] = [];

  for (let column = 0; column < columnCount; column += 1) {
    for (let row = 0; row < rowCount; row += 1) {
      values.push(rows[row][column]);
    }
  }

  return matCell(values, [rowCount, columnCount]);
}

/** Construct a struct array whose elements are supplied in column-major order. */
export function matStructArray(
  values: readonly MatStructValue[],
  dimensions: readonly number[] = [1, values.length],
  fieldNames?: readonly string[],
): MatStructArray {
  return {
    [MAT_VALUE_MARKER]: 'struct',
    dimensions: [...dimensions],
    values: [...values],
    ...(fieldNames ? { fieldNames: [...fieldNames] } : {}),
  };
}

/** Construct an empty numeric array with an explicit MATLAB shape. */
export function matEmpty(
  dimensions: readonly number[] = [0, 0],
  dataType: MatNumericType = 'double',
): MatNumericArray {
  return matNumeric([], dimensions, dataType);
}

/**
 * Serialize top-level named variables into an uncompressed MATLAB Level-5
 * MAT-file. Object key insertion order determines variable order.
 */
export function writeMatFile(
  variables: Readonly<Record<string, MatValue>>,
  options: MatFileOptions = {},
): Buffer {
  if (!isPlainObject(variables)) {
    throw new TypeError(
      'MAT-file variables must be supplied as a plain object.',
    );
  }

  const context: EncodingContext = { activeContainers: new Set<object>() };
  const matrices = Object.entries(variables).map(([name, value]) => {
    validateVariableName(name);
    return encodeMatrixElement(name, value, context, 0);
  });

  return Buffer.concat([createHeader(options), ...matrices]);
}

/** Preferred concise name for the top-level encoder API. */
export function encodeMatFile(
  variables: Readonly<Record<string, MatValueInput>>,
  options: MatFileOptions = {},
): Buffer {
  return writeMatFile(variables, options);
}

/**
 * MATLAB-oriented wrapper namespace for call sites that need explicit shapes.
 *
 * @example
 * encodeMatFile({
 *   M: {
 *     patient: { list: mat.cell(['sub-1', 'sub-2'], [2, 1]) },
 *     clinical: {
 *       vars: mat.cell([
 *         mat.double([1, 2], [2, 1]),
 *         mat.double([3, 4], [2, 1]),
 *       ], [1, 2]),
 *     },
 *     S: mat.struct([{ label: 'A' }, { label: 'B' }], [1, 2]),
 *   },
 * });
 */
export const mat = Object.freeze({
  cell: matCell,
  struct: matStructArray,
  char: (value: string): string => value,
  double: (
    values: MatNumericValues,
    dimensions: readonly number[] = [1, values.length],
  ): MatNumericArray => matNumeric(values, dimensions, 'double'),
  single: (
    values: MatNumericValues,
    dimensions: readonly number[] = [1, values.length],
  ): MatNumericArray => matNumeric(values, dimensions, 'single'),
  logical: matLogical,
  numeric: matNumeric,
  matrix: matMatrix,
  cellMatrix: matCellMatrix,
  empty: matEmpty,
});

function createHeader(options: MatFileOptions): Buffer {
  const header = Buffer.alloc(128, 0);
  header.fill(0x20, 0, 116);

  const createdAt = options.createdAt ?? new Date();
  if (Number.isNaN(createdAt.getTime())) {
    throw new TypeError('MAT-file creation date is invalid.');
  }

  const description =
    options.description ??
    `MATLAB 5.0 MAT-file, Platform: Node.js, Created on: ${createdAt.toUTCString()}, Created by: SPARK`;
  const safeDescription = description
    .replace(/[^\x20-\x7e]/g, '?')
    .slice(0, 116);
  header.write(safeDescription, 0, safeDescription.length, 'ascii');

  // Bytes 116-123 are the optional subsystem-data offset and remain zero.
  header.writeUInt16LE(0x0100, 124);
  header.write('IM', 126, 2, 'ascii');
  return header;
}

function encodeMatrixElement(
  name: string,
  value: MatValue,
  context: EncodingContext,
  depth: number,
): Buffer {
  if (depth > MAX_NESTING_DEPTH) {
    throw new RangeError(
      `MAT value exceeds ${MAX_NESTING_DEPTH} nested levels.`,
    );
  }

  return encodeDataElement(
    MiType.Matrix,
    encodeMatrixPayload(name, value, context, depth),
  );
}

function encodeMatrixPayload(
  name: string,
  value: MatValue,
  context: EncodingContext,
  depth: number,
): Buffer {
  if (value === null || value === undefined) {
    return encodeNumericPayload(name, matEmpty(), false);
  }
  if (typeof value === 'number') {
    return encodeNumericPayload(name, matNumeric([value], [1, 1]), false);
  }
  if (typeof value === 'bigint') {
    return encodeNumericPayload(
      name,
      matNumeric([value], [1, 1], 'int64'),
      false,
    );
  }
  if (typeof value === 'boolean') {
    return encodeNumericPayload(name, matLogical([value], [1, 1]), false);
  }
  if (typeof value === 'string') {
    return encodeStringPayload(name, value);
  }
  if (isTypedArray(value)) {
    const dataType = typedArrayDataType(value);
    return encodeNumericPayload(
      name,
      matNumeric(value, [1, value.length], dataType),
      false,
    );
  }
  if (isMatNumericArray(value)) {
    return withCycleGuard(value, context, () =>
      encodeNumericPayload(name, value, value.logical),
    );
  }
  if (isMatCellArray(value)) {
    return withCycleGuard(value, context, () =>
      encodeCellPayload(name, value, context, depth),
    );
  }
  if (isMatStructArray(value)) {
    return withCycleGuard(value, context, () =>
      encodeStructPayload(name, value, context, depth),
    );
  }
  if (Array.isArray(value)) {
    return withCycleGuard(value, context, () =>
      encodeInferredArrayPayload(name, value, context, depth),
    );
  }
  if (isPlainObject(value)) {
    return withCycleGuard(value, context, () =>
      encodeStructPayload(
        name,
        matStructArray([value], [1, 1]),
        context,
        depth,
      ),
    );
  }

  throw new TypeError(`Unsupported MAT value of type ${typeof value}.`);
}

function encodeInferredArrayPayload(
  name: string,
  values: readonly MatValue[],
  context: EncodingContext,
  depth: number,
): Buffer {
  if (values.length === 0) {
    return encodeNumericPayload(name, matEmpty(), false);
  }

  if (values.every((value) => typeof value === 'number')) {
    return encodeNumericPayload(
      name,
      matNumeric(values as readonly number[], [1, values.length]),
      false,
    );
  }
  if (values.every((value) => typeof value === 'bigint')) {
    return encodeNumericPayload(
      name,
      matNumeric(values as readonly bigint[], [1, values.length], 'int64'),
      false,
    );
  }
  if (values.every((value) => typeof value === 'boolean')) {
    return encodeNumericPayload(
      name,
      matLogical(values as readonly boolean[], [1, values.length]),
      true,
    );
  }

  const numericRows = inferRectangularRows(values, 'number');
  if (numericRows) {
    return encodeNumericPayload(
      name,
      matMatrix(numericRows as readonly (readonly number[])[]),
      false,
    );
  }
  const bigintRows = inferRectangularRows(values, 'bigint');
  if (bigintRows) {
    return encodeNumericPayload(
      name,
      matMatrix(bigintRows as readonly (readonly bigint[])[], 'int64'),
      false,
    );
  }
  const logicalRows = inferRectangularRows(values, 'boolean');
  if (logicalRows) {
    const matrix = matMatrix(
      logicalRows as readonly (readonly boolean[])[],
      'uint8',
    );
    return encodeNumericPayload(name, { ...matrix, logical: true }, true);
  }

  if (values.every(isPlainObject)) {
    return encodeStructPayload(
      name,
      matStructArray(values as readonly MatStructValue[]),
      context,
      depth,
    );
  }

  return encodeCellPayload(name, matCell(values), context, depth);
}

function encodeNumericPayload(
  name: string,
  numeric: MatNumericArray,
  logical: boolean,
): Buffer {
  const dimensions = normalizeDimensions(numeric.dimensions);
  const expectedLength = dimensionProduct(dimensions);
  if (numeric.values.length !== expectedLength) {
    throw new RangeError(
      `Numeric array shape [${dimensions.join(
        ', ',
      )}] requires ${expectedLength} values, received ${
        numeric.values.length
      }.`,
    );
  }
  if (logical && numeric.dataType !== 'uint8') {
    throw new TypeError('Logical arrays must use uint8 storage.');
  }

  const encoding = NUMERIC_ENCODINGS[numeric.dataType];
  const realData = encodeNumericValues(
    numeric.values,
    numeric.dataType,
    logical,
  );
  return assembleMatrixPayload(
    name,
    encoding.mxClass,
    dimensions,
    [encodeDataElement(encoding.miType, realData)],
    logical,
  );
}

function encodeStringPayload(name: string, value: string): Buffer {
  const utf16 = Buffer.from(value, 'utf16le');
  const codeUnitLength = utf16.length / 2;
  const dimensions = codeUnitLength === 0 ? [0, 0] : [1, codeUnitLength];
  return assembleMatrixPayload(name, MxClass.Char, dimensions, [
    encodeDataElement(MiType.Utf16, utf16),
  ]);
}

function encodeCellPayload(
  name: string,
  cell: MatCellArray,
  context: EncodingContext,
  depth: number,
): Buffer {
  const dimensions = normalizeDimensions(cell.dimensions);
  const expectedLength = dimensionProduct(dimensions);
  if (cell.values.length !== expectedLength) {
    throw new RangeError(
      `Cell array shape [${dimensions.join(
        ', ',
      )}] requires ${expectedLength} values, received ${cell.values.length}.`,
    );
  }

  const children = cell.values.map((value) =>
    encodeMatrixElement('', value, context, depth + 1),
  );
  return assembleMatrixPayload(name, MxClass.Cell, dimensions, children);
}

function encodeStructPayload(
  name: string,
  struct: MatStructArray,
  context: EncodingContext,
  depth: number,
): Buffer {
  const dimensions = normalizeDimensions(struct.dimensions);
  const expectedLength = dimensionProduct(dimensions);
  if (struct.values.length !== expectedLength) {
    throw new RangeError(
      `Struct array shape [${dimensions.join(
        ', ',
      )}] requires ${expectedLength} values, received ${struct.values.length}.`,
    );
  }
  struct.values.forEach((value) => {
    if (!isPlainObject(value)) {
      throw new TypeError('Every struct-array element must be a plain object.');
    }
  });

  const fieldNames = collectFieldNames(struct.values, struct.fieldNames);
  const fieldWidth = fieldNames.reduce(
    (maximum, fieldName) =>
      Math.max(maximum, Buffer.byteLength(fieldName, 'ascii') + 1),
    1,
  );
  const fieldNameData = Buffer.alloc(fieldWidth * fieldNames.length, 0);
  fieldNames.forEach((fieldName, index) => {
    fieldNameData.write(fieldName, index * fieldWidth, fieldWidth - 1, 'ascii');
  });

  const fieldWidthData = Buffer.alloc(4);
  fieldWidthData.writeInt32LE(fieldWidth, 0);
  const body: Buffer[] = [
    encodeDataElement(MiType.Int32, fieldWidthData),
    encodeDataElement(MiType.Int8, fieldNameData),
  ];

  struct.values.forEach((element) => {
    fieldNames.forEach((fieldName) => {
      body.push(
        encodeMatrixElement('', element[fieldName], context, depth + 1),
      );
    });
  });

  return assembleMatrixPayload(name, MxClass.Struct, dimensions, body);
}

function assembleMatrixPayload(
  name: string,
  mxClass: MxClass,
  dimensions: readonly number[],
  body: readonly Buffer[],
  logical = false,
): Buffer {
  const flags = Buffer.alloc(8, 0);
  flags.writeUInt32LE(mxClass + (logical ? LOGICAL_ARRAY_FLAG : 0), 0);

  const dimensionData = Buffer.alloc(dimensions.length * 4);
  dimensions.forEach((dimension, index) => {
    dimensionData.writeInt32LE(dimension, index * 4);
  });

  const nameData = Buffer.from(name, 'ascii');
  return Buffer.concat([
    encodeDataElement(MiType.UInt32, flags),
    encodeDataElement(MiType.Int32, dimensionData),
    encodeDataElement(MiType.Int8, nameData),
    ...body,
  ]);
}

function encodeNumericValues(
  values: readonly MatNumericValue[],
  dataType: MatNumericType,
  logical: boolean,
): Buffer {
  const encoding = NUMERIC_ENCODINGS[dataType];
  const buffer = Buffer.alloc(values.length * encoding.byteWidth);

  values.forEach((value, index) => {
    const offset = index * encoding.byteWidth;
    if (logical) {
      buffer.writeUInt8(normalizeLogical(value), offset);
      return;
    }

    switch (dataType) {
      case 'double':
        buffer.writeDoubleLE(normalizeFloatingPoint(value, dataType), offset);
        break;
      case 'single':
        buffer.writeFloatLE(normalizeFloatingPoint(value, dataType), offset);
        break;
      case 'int8':
        buffer.writeInt8(normalizeInteger(value, -128, 127, dataType), offset);
        break;
      case 'uint8':
        buffer.writeUInt8(normalizeInteger(value, 0, 255, dataType), offset);
        break;
      case 'int16':
        buffer.writeInt16LE(
          normalizeInteger(value, -32768, 32767, dataType),
          offset,
        );
        break;
      case 'uint16':
        buffer.writeUInt16LE(
          normalizeInteger(value, 0, 65535, dataType),
          offset,
        );
        break;
      case 'int32':
        buffer.writeInt32LE(
          normalizeInteger(value, -2147483648, 2147483647, dataType),
          offset,
        );
        break;
      case 'uint32':
        buffer.writeUInt32LE(
          normalizeInteger(value, 0, 4294967295, dataType),
          offset,
        );
        break;
      case 'int64':
        buffer.writeBigInt64LE(
          normalizeBigInteger(value, -(2n ** 63n), 2n ** 63n - 1n, dataType),
          offset,
        );
        break;
      case 'uint64':
        buffer.writeBigUInt64LE(
          normalizeBigInteger(value, 0n, 2n ** 64n - 1n, dataType),
          offset,
        );
        break;
      default: {
        const exhaustiveCheck: never = dataType;
        throw new TypeError(`Unsupported numeric type ${exhaustiveCheck}.`);
      }
    }
  });

  return buffer;
}

function normalizeFloatingPoint(
  value: MatNumericValue,
  dataType: MatNumericType,
): number {
  if (typeof value === 'bigint') {
    throw new TypeError(`${dataType} values cannot be bigint.`);
  }
  return typeof value === 'boolean' ? Number(value) : value;
}

function normalizeInteger(
  value: MatNumericValue,
  minimum: number,
  maximum: number,
  dataType: MatNumericType,
): number {
  if (typeof value === 'bigint') {
    throw new TypeError(`${dataType} values must be JavaScript numbers.`);
  }
  const numericValue = typeof value === 'boolean' ? Number(value) : value;
  if (
    !Number.isInteger(numericValue) ||
    numericValue < minimum ||
    numericValue > maximum
  ) {
    throw new RangeError(
      `${String(value)} is outside the valid range for ${dataType}.`,
    );
  }
  return numericValue;
}

function normalizeBigInteger(
  value: MatNumericValue,
  minimum: bigint,
  maximum: bigint,
  dataType: MatNumericType,
): bigint {
  let bigintValue: bigint;
  if (typeof value === 'boolean') {
    bigintValue = value ? 1n : 0n;
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError(
        `${String(value)} is not a safe ${dataType} integer.`,
      );
    }
    bigintValue = BigInt(value);
  } else {
    bigintValue = value;
  }

  if (bigintValue < minimum || bigintValue > maximum) {
    throw new RangeError(
      `${String(value)} is outside the valid range for ${dataType}.`,
    );
  }
  return bigintValue;
}

function normalizeLogical(value: MatNumericValue): number {
  if (typeof value === 'boolean') return Number(value);
  if (value === 0 || value === 0n) return 0;
  if (value === 1 || value === 1n) return 1;
  throw new RangeError(
    `Logical value must be true, false, 0, or 1; received ${String(value)}.`,
  );
}

function encodeDataElement(type: MiType, data: Buffer): Buffer {
  if (data.length > MAX_UINT32) {
    throw new RangeError(
      'MAT data element exceeds the Level-5 32-bit size limit.',
    );
  }
  const padding = (8 - (data.length % 8)) % 8;
  const element = Buffer.alloc(8 + data.length + padding, 0);
  element.writeUInt32LE(type, 0);
  element.writeUInt32LE(data.length, 4);
  data.copy(element, 8);
  return element;
}

function normalizeDimensions(dimensions: readonly number[]): number[] {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new RangeError('MAT arrays require at least one dimension.');
  }
  const normalized =
    dimensions.length === 1 ? [1, dimensions[0]] : [...dimensions];

  normalized.forEach((dimension) => {
    if (
      !Number.isInteger(dimension) ||
      dimension < 0 ||
      dimension > MAX_DIMENSION
    ) {
      throw new RangeError(`Invalid MAT array dimension ${String(dimension)}.`);
    }
  });
  return normalized;
}

function dimensionProduct(dimensions: readonly number[]): number {
  return dimensions.reduce((product, dimension) => {
    const nextProduct = product * dimension;
    if (!Number.isSafeInteger(nextProduct)) {
      throw new RangeError('MAT array contains too many elements.');
    }
    return nextProduct;
  }, 1);
}

function validateRectangularRows<T>(
  rows: readonly (readonly T[])[],
  label: string,
): { rowCount: number; columnCount: number } {
  if (!Array.isArray(rows)) {
    throw new TypeError(`${label} rows must be an array.`);
  }
  const rowCount = rows.length;
  const columnCount = rowCount === 0 ? 0 : rows[0].length;
  rows.forEach((row) => {
    if (!Array.isArray(row) || row.length !== columnCount) {
      throw new RangeError(`${label} rows must have equal lengths.`);
    }
  });
  return { rowCount, columnCount };
}

function inferRectangularRows(
  values: readonly MatValue[],
  primitiveType: 'number' | 'bigint' | 'boolean',
): readonly (readonly MatValue[])[] | null {
  if (!values.every(Array.isArray)) return null;
  const rows = values as readonly (readonly MatValue[])[];
  const columnCount = rows[0]?.length ?? 0;
  if (
    !rows.every(
      (row) =>
        row.length === columnCount &&
        row.every((value) => typeof value === primitiveType),
    )
  ) {
    return null;
  }
  return rows;
}

function collectFieldNames(
  values: readonly MatStructValue[],
  explicitFieldNames?: readonly string[],
): string[] {
  const fieldNames: string[] = [];
  const seen = new Set<string>();
  const addField = (fieldName: string) => {
    validateFieldName(fieldName);
    if (!seen.has(fieldName)) {
      seen.add(fieldName);
      fieldNames.push(fieldName);
    }
  };

  explicitFieldNames?.forEach(addField);
  values.forEach((value) => Object.keys(value).forEach(addField));
  return fieldNames;
}

function validateVariableName(name: string): void {
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) {
    throw new TypeError(`Invalid MATLAB variable name "${name}".`);
  }
  if (Buffer.byteLength(name, 'ascii') > MAX_NAME_LENGTH) {
    throw new RangeError(
      `MATLAB variable name "${name}" exceeds ${MAX_NAME_LENGTH} bytes.`,
    );
  }
}

function validateFieldName(name: string): void {
  if (!name || /[^\x20-\x7e]/.test(name) || name.includes('\0')) {
    throw new TypeError(
      `MATLAB struct field name "${name}" must be printable ASCII.`,
    );
  }
  if (Buffer.byteLength(name, 'ascii') > MAX_NAME_LENGTH) {
    throw new RangeError(
      `MATLAB struct field name "${name}" exceeds ${MAX_NAME_LENGTH} bytes.`,
    );
  }
}

function isPlainObject(value: unknown): value is MatStructValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isTypedArray(value: unknown): value is MatTypedArray {
  return (
    ArrayBuffer.isView(value) &&
    !(value instanceof DataView) &&
    !isMatWrapper(value)
  );
}

function typedArrayDataType(value: MatTypedArray): MatNumericType {
  if (value instanceof Float64Array) return 'double';
  if (value instanceof Float32Array) return 'single';
  if (value instanceof Int8Array) return 'int8';
  if (value instanceof Uint8Array || value instanceof Uint8ClampedArray)
    return 'uint8';
  if (value instanceof Int16Array) return 'int16';
  if (value instanceof Uint16Array) return 'uint16';
  if (value instanceof Int32Array) return 'int32';
  if (value instanceof Uint32Array) return 'uint32';
  if (value instanceof BigInt64Array) return 'int64';
  if (value instanceof BigUint64Array) return 'uint64';
  throw new TypeError('Unsupported typed array.');
}

function isMatWrapper(
  value: unknown,
): value is MatNumericArray | MatCellArray | MatStructArray {
  return (
    typeof value === 'object' && value !== null && MAT_VALUE_MARKER in value
  );
}

function isMatNumericArray(value: unknown): value is MatNumericArray {
  return isMatWrapper(value) && value[MAT_VALUE_MARKER] === 'numeric';
}

function isMatCellArray(value: unknown): value is MatCellArray {
  return isMatWrapper(value) && value[MAT_VALUE_MARKER] === 'cell';
}

function isMatStructArray(value: unknown): value is MatStructArray {
  return isMatWrapper(value) && value[MAT_VALUE_MARKER] === 'struct';
}

function withCycleGuard<T>(
  container: object,
  context: EncodingContext,
  encode: () => T,
): T {
  if (context.activeContainers.has(container)) {
    throw new TypeError('MAT values cannot contain circular references.');
  }
  context.activeContainers.add(container);
  try {
    return encode();
  } finally {
    context.activeContainers.delete(container);
  }
}
