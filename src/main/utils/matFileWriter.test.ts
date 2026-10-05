/* eslint-disable no-bitwise */
import {
  matCellMatrix,
  matEmpty,
  matMatrix,
  matNumeric,
  matStructArray,
  writeMatFile,
} from './matFileWriter';

const MI_INT8 = 1;
const MI_INT32 = 5;
const MI_UINT32 = 6;
const MI_DOUBLE = 9;
const MI_MATRIX = 14;
const MI_UTF16 = 17;

const MX_CELL = 1;
const MX_STRUCT = 2;
const MX_CHAR = 4;
const MX_DOUBLE = 6;

interface Element {
  type: number;
  byteLength: number;
  data: Buffer;
  nextOffset: number;
}

const readElement = (buffer: Buffer, offset: number): Element => {
  const type = buffer.readUInt32LE(offset);
  const byteLength = buffer.readUInt32LE(offset + 4);
  const dataStart = offset + 8;
  const padding = (8 - (byteLength % 8)) % 8;
  return {
    type,
    byteLength,
    data: buffer.subarray(dataStart, dataStart + byteLength),
    nextOffset: dataStart + byteLength + padding,
  };
};

const matrixParts = (matrixElement: Element) => {
  expect(matrixElement.type).toBe(MI_MATRIX);
  const flags = readElement(matrixElement.data, 0);
  const dimensions = readElement(matrixElement.data, flags.nextOffset);
  const name = readElement(matrixElement.data, dimensions.nextOffset);
  return { flags, dimensions, name, bodyOffset: name.nextOffset };
};

const readDimensions = (element: Element): number[] => {
  expect(element.type).toBe(MI_INT32);
  const dimensions: number[] = [];
  for (let offset = 0; offset < element.byteLength; offset += 4) {
    dimensions.push(element.data.readInt32LE(offset));
  }
  return dimensions;
};

const readDoubleScalar = (matrix: Element): number => {
  const parts = matrixParts(matrix);
  const real = readElement(matrix.data, parts.bodyOffset);
  expect(parts.flags.data.readUInt32LE(0) & 0xff).toBe(MX_DOUBLE);
  expect(real.type).toBe(MI_DOUBLE);
  return real.data.readDoubleLE(0);
};

describe('writeMatFile', () => {
  test('writes the Level-5 header and column-major numeric matrices', () => {
    const buffer = writeMatFile(
      {
        matrix: matMatrix([
          [1, 2],
          [3, Number.NaN],
        ]),
      },
      { description: 'MATLAB 5.0 MAT-file, deterministic unit test' },
    );

    expect(buffer.subarray(0, 19).toString('ascii')).toBe(
      'MATLAB 5.0 MAT-file',
    );
    expect(buffer.readUInt16LE(124)).toBe(0x0100);
    expect(buffer.subarray(126, 128).toString('ascii')).toBe('IM');

    const matrix = readElement(buffer, 128);
    const parts = matrixParts(matrix);
    expect(parts.flags.type).toBe(MI_UINT32);
    expect(parts.flags.data.readUInt32LE(0) & 0xff).toBe(MX_DOUBLE);
    expect(readDimensions(parts.dimensions)).toEqual([2, 2]);
    expect(parts.name.type).toBe(MI_INT8);
    expect(parts.name.data.toString('ascii')).toBe('matrix');

    const real = readElement(matrix.data, parts.bodyOffset);
    expect(real.type).toBe(MI_DOUBLE);
    expect([
      real.data.readDoubleLE(0),
      real.data.readDoubleLE(8),
      real.data.readDoubleLE(16),
    ]).toEqual([1, 3, 2]);
    expect(Number.isNaN(real.data.readDoubleLE(24))).toBe(true);
  });

  test('writes strings as UTF-16 character rows, including surrogate pairs', () => {
    const buffer = writeMatFile({ label: 'left α 🧠' });
    const matrix = readElement(buffer, 128);
    const parts = matrixParts(matrix);
    const characters = readElement(matrix.data, parts.bodyOffset);

    expect(parts.flags.data.readUInt32LE(0) & 0xff).toBe(MX_CHAR);
    expect(readDimensions(parts.dimensions)).toEqual([1, 'left α 🧠'.length]);
    expect(characters.type).toBe(MI_UTF16);
    expect(characters.data.toString('utf16le')).toBe('left α 🧠');
  });

  test('converts row-major cell matrices to column-major child order', () => {
    const buffer = writeMatFile({
      cells: matCellMatrix([
        [1, 2],
        [3, 4],
      ]),
    });
    const matrix = readElement(buffer, 128);
    const parts = matrixParts(matrix);
    expect(parts.flags.data.readUInt32LE(0) & 0xff).toBe(MX_CELL);
    expect(readDimensions(parts.dimensions)).toEqual([2, 2]);

    const values: number[] = [];
    let offset = parts.bodyOffset;
    for (let index = 0; index < 4; index += 1) {
      const child = readElement(matrix.data, offset);
      values.push(readDoubleScalar(child));
      offset = child.nextOffset;
    }
    expect(values).toEqual([1, 3, 2, 4]);
  });

  test('writes struct arrays with a stable field union and empty missing values', () => {
    const buffer = writeMatFile({
      records: matStructArray(
        [
          { label: 'baseline', value: 1 },
          { label: 'follow-up', note: 'missing score' },
        ],
        [1, 2],
        ['label', 'value'],
      ),
    });
    const matrix = readElement(buffer, 128);
    const parts = matrixParts(matrix);
    expect(parts.flags.data.readUInt32LE(0) & 0xff).toBe(MX_STRUCT);
    expect(readDimensions(parts.dimensions)).toEqual([1, 2]);

    const fieldLength = readElement(matrix.data, parts.bodyOffset);
    const fieldNames = readElement(matrix.data, fieldLength.nextOffset);
    expect(fieldLength.type).toBe(MI_INT32);
    const width = fieldLength.data.readInt32LE(0);
    expect(width).toBe(6);
    expect(fieldNames.type).toBe(MI_INT8);
    const decodedNames: string[] = [];
    for (let offset = 0; offset < fieldNames.byteLength; offset += width) {
      decodedNames.push(
        fieldNames.data
          .subarray(offset, offset + width)
          .toString('ascii')
          .replace(/\0.*$/, ''),
      );
    }
    expect(decodedNames).toEqual(['label', 'value', 'note']);

    // Values are field-major within each struct element.
    let childOffset = fieldNames.nextOffset;
    const firstLabel = readElement(matrix.data, childOffset);
    childOffset = firstLabel.nextOffset;
    const firstValue = readElement(matrix.data, childOffset);
    childOffset = firstValue.nextOffset;
    const firstNote = readElement(matrix.data, childOffset);
    childOffset = firstNote.nextOffset;
    const secondLabel = readElement(matrix.data, childOffset);
    childOffset = secondLabel.nextOffset;
    const secondValue = readElement(matrix.data, childOffset);

    const firstLabelParts = matrixParts(firstLabel);
    const firstLabelData = readElement(
      firstLabel.data,
      firstLabelParts.bodyOffset,
    );
    expect(firstLabelData.data.toString('utf16le')).toBe('baseline');
    expect(readDoubleScalar(firstValue)).toBe(1);

    const firstNoteParts = matrixParts(firstNote);
    expect(readDimensions(firstNoteParts.dimensions)).toEqual([0, 0]);
    const secondLabelParts = matrixParts(secondLabel);
    const secondLabelData = readElement(
      secondLabel.data,
      secondLabelParts.bodyOffset,
    );
    expect(secondLabelData.data.toString('utf16le')).toBe('follow-up');
    const secondValueParts = matrixParts(secondValue);
    expect(readDimensions(secondValueParts.dimensions)).toEqual([0, 0]);
  });

  test('preserves explicit empty dimensions and typed numeric storage', () => {
    const buffer = writeMatFile({
      empty: matEmpty([0, 3]),
      integers: matNumeric([1, 2, 3], [3, 1], 'uint16'),
    });
    const empty = readElement(buffer, 128);
    const emptyParts = matrixParts(empty);
    expect(readDimensions(emptyParts.dimensions)).toEqual([0, 3]);
    const emptyReal = readElement(empty.data, emptyParts.bodyOffset);
    expect(emptyReal.byteLength).toBe(0);

    const integers = readElement(buffer, empty.nextOffset);
    const integerParts = matrixParts(integers);
    expect(readDimensions(integerParts.dimensions)).toEqual([3, 1]);
  });

  test('rejects malformed shapes, unsafe names, invalid integers, and cycles', () => {
    expect(() => writeMatFile({ bad: matNumeric([1], [2, 2]) })).toThrow(
      /requires 4 values/,
    );
    expect(() => writeMatFile({ 'not-valid': 1 })).toThrow(/variable name/);
    expect(() =>
      writeMatFile({ bad: matNumeric([256], [1, 1], 'uint8') }),
    ).toThrow(/valid range/);

    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(() => writeMatFile({ circular: circular as never })).toThrow(
      /circular references/,
    );
  });
});
