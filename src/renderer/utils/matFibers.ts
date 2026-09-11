import * as fflate from 'fflate';

/**
 * Minimal MATLAB v5 MAT-file reader for fiber tract files, plus helpers to
 * turn the common Lead-DBS fiber representations into renderable polylines.
 *
 * Supported variables:
 * - `fibcell`: cell array of Nx3 coordinate matrices (one per fiber), often
 *   wrapped in an extra 1x1 cell;
 * - `fibers` (Nx4: x, y, z, fiberId) with optional `idx` (points per fiber);
 * - `ftr`-style structs carrying `fibers`/`idx` fields.
 */

export type FiberPolyline = Array<[number, number, number]>;

export interface MatMatrix {
  kind: 'matrix';
  name: string;
  dims: number[];
  /** Column-major values, as stored by MATLAB. */
  values: Float64Array;
}

export interface MatCell {
  kind: 'cell';
  name: string;
  dims: number[];
  items: MatValue[];
}

export interface MatStruct {
  kind: 'struct';
  name: string;
  fields: Record<string, MatValue>;
}

export interface MatChar {
  kind: 'char';
  name: string;
  text: string;
}

export type MatValue = MatMatrix | MatCell | MatStruct | MatChar | null;

const MI_INT8 = 1;
const MI_UINT8 = 2;
const MI_INT16 = 3;
const MI_UINT16 = 4;
const MI_INT32 = 5;
const MI_UINT32 = 6;
const MI_SINGLE = 7;
const MI_DOUBLE = 9;
const MI_INT64 = 12;
const MI_UINT64 = 13;
const MI_MATRIX = 14;
const MI_COMPRESSED = 15;
const MI_UTF8 = 16;

const MX_CELL = 1;
const MX_STRUCT = 2;
const MX_OBJECT = 3;
const MX_CHAR = 4;

interface RawElement {
  type: number;
  data: DataView;
  /** Offset just past this element (tag + padded data). */
  next: number;
}

const paddedSize = (size: number): number => Math.ceil(size / 8) * 8;

const readElement = (view: DataView, offset: number): RawElement => {
  const rawType = view.getUint32(offset, true);
  // Small data element format packs type and size into one word.
  if ((rawType & 0xffff0000) !== 0) {
    const type = rawType & 0xffff;
    const size = rawType >>> 16;
    return {
      type,
      data: new DataView(view.buffer, view.byteOffset + offset + 4, size),
      next: offset + 8,
    };
  }
  const size = view.getUint32(offset + 4, true);
  const available = Math.max(0, view.byteLength - offset - 8);
  return {
    type: rawType,
    data: new DataView(
      view.buffer,
      view.byteOffset + offset + 8,
      Math.min(size, available),
    ),
    // Compressed elements are stored unpadded; everything else pads to 8.
    next:
      offset + 8 + (rawType === MI_COMPRESSED ? size : paddedSize(size)),
  };
};

const numericValues = (type: number, data: DataView): Float64Array => {
  const { buffer } = data;
  const start = data.byteOffset;
  const length = data.byteLength;
  const convert = (typed: ArrayLike<number | bigint>): Float64Array => {
    const output = new Float64Array(typed.length);
    for (let index = 0; index < typed.length; index += 1) {
      output[index] = Number(typed[index]);
    }
    return output;
  };
  // Typed-array views require aligned offsets; copy to be safe.
  const aligned = buffer.slice(start, start + length);
  switch (type) {
    case MI_INT8:
      return convert(new Int8Array(aligned));
    case MI_UINT8:
    case MI_UTF8:
      return convert(new Uint8Array(aligned));
    case MI_INT16:
      return convert(new Int16Array(aligned));
    case MI_UINT16:
      return convert(new Uint16Array(aligned));
    case MI_INT32:
      return convert(new Int32Array(aligned));
    case MI_UINT32:
      return convert(new Uint32Array(aligned));
    case MI_SINGLE:
      return convert(new Float32Array(aligned));
    case MI_DOUBLE:
      return convert(new Float64Array(aligned));
    case MI_INT64:
      return convert(new BigInt64Array(aligned));
    case MI_UINT64:
      return convert(new BigUint64Array(aligned));
    default:
      throw new Error(`Unsupported MAT numeric element type ${type}.`);
  }
};

const parseMatrixElement = (view: DataView): MatValue => {
  let offset = 0;
  const flagsElement = readElement(view, offset);
  const classId = flagsElement.data.getUint8(0);
  offset = flagsElement.next;

  const dimsElement = readElement(view, offset);
  const dims = Array.from(numericValues(MI_INT32, dimsElement.data)).map(
    Number,
  );
  offset = dimsElement.next;

  const nameElement = readElement(view, offset);
  const name = new TextDecoder()
    .decode(
      new Uint8Array(
        nameElement.data.buffer,
        nameElement.data.byteOffset,
        nameElement.data.byteLength,
      ),
    )
    .replace(/\0+$/, '');
  offset = nameElement.next;

  const elementCount = dims.reduce(
    (product, dimension) => product * Math.max(1, dimension),
    1,
  );

  if (classId === MX_CELL) {
    const items: MatValue[] = [];
    while (items.length < elementCount && offset < view.byteLength) {
      const child = readElement(view, offset);
      if (child.type !== MI_MATRIX) break;
      items.push(child.data.byteLength > 0 ? parseMatrixElement(child.data) : null);
      offset = child.next;
    }
    return { kind: 'cell', name, dims, items };
  }

  if (classId === MX_STRUCT || classId === MX_OBJECT) {
    if (classId === MX_OBJECT) {
      // Skip the class name element.
      offset = readElement(view, offset).next;
    }
    const lengthElement = readElement(view, offset);
    const fieldNameLength = lengthElement.data.getInt32(0, true);
    offset = lengthElement.next;
    const namesElement = readElement(view, offset);
    const fieldCount = Math.floor(
      namesElement.data.byteLength / Math.max(1, fieldNameLength),
    );
    const decoder = new TextDecoder();
    const fieldNames: string[] = [];
    for (let index = 0; index < fieldCount; index += 1) {
      const bytes = new Uint8Array(
        namesElement.data.buffer,
        namesElement.data.byteOffset + index * fieldNameLength,
        fieldNameLength,
      );
      fieldNames.push(decoder.decode(bytes).replace(/\0.*$/, ''));
    }
    offset = namesElement.next;
    const fields: Record<string, MatValue> = {};
    fieldNames.forEach((fieldName) => {
      if (offset >= view.byteLength) return;
      const child = readElement(view, offset);
      fields[fieldName] =
        child.type === MI_MATRIX && child.data.byteLength > 0
          ? parseMatrixElement(child.data)
          : null;
      offset = child.next;
    });
    return { kind: 'struct', name, fields };
  }

  if (classId === MX_CHAR) {
    const dataElement = readElement(view, offset);
    const values = numericValues(dataElement.type, dataElement.data);
    const text = Array.from(values)
      .map((code) => String.fromCharCode(code))
      .join('');
    return { kind: 'char', name, text };
  }

  // Numeric classes: read the real part; the imaginary part is ignored.
  const dataElement = readElement(view, offset);
  const values = numericValues(dataElement.type, dataElement.data);
  return { kind: 'matrix', name, dims, values };
};

/** Parse the top-level variables of a MATLAB v5 (non-HDF5) MAT file. */
export function parseMatFile(input: ArrayBuffer): Record<string, MatValue> {
  const bytes = new Uint8Array(input);
  if (bytes.length < 132) {
    throw new Error('The .mat file is too short to be valid.');
  }
  const header = new TextDecoder().decode(bytes.slice(0, 10));
  if (!header.startsWith('MATLAB 5.0')) {
    throw new Error(
      'Only MATLAB v5/v7 (non-v7.3) .mat files are supported. Re-save the file without the -v7.3 flag.',
    );
  }
  const endian = new TextDecoder().decode(bytes.slice(126, 128));
  if (endian !== 'IM') {
    throw new Error('Big-endian .mat files are not supported.');
  }

  const view = new DataView(input);
  const variables: Record<string, MatValue> = {};
  let offset = 128;
  while (offset + 8 <= view.byteLength) {
    const element = readElement(view, offset);
    let payload = element;
    if (element.type === MI_COMPRESSED) {
      const compressed = new Uint8Array(
        element.data.buffer,
        element.data.byteOffset,
        element.data.byteLength,
      );
      const inflated = fflate.unzlibSync(compressed);
      const innerView = new DataView(
        inflated.buffer,
        inflated.byteOffset,
        inflated.byteLength,
      );
      payload = readElement(innerView, 0);
    }
    if (payload.type === MI_MATRIX && payload.data.byteLength > 0) {
      const value = parseMatrixElement(payload.data);
      if (value && 'name' in value && value.name) {
        variables[value.name] = value;
      }
    }
    offset = element.next;
  }
  return variables;
}

const matrixToPolyline = (matrix: MatMatrix): FiberPolyline | null => {
  const [rows, columns] = [matrix.dims[0] ?? 0, matrix.dims[1] ?? 0];
  if (rows < 2 || columns < 3) return null;
  const polyline: FiberPolyline = [];
  for (let row = 0; row < rows; row += 1) {
    const x = matrix.values[row];
    const y = matrix.values[rows + row];
    const z = matrix.values[rows * 2 + row];
    if (![x, y, z].every(Number.isFinite)) return null;
    polyline.push([x, y, z]);
  }
  return polyline;
};

const cellToPolylines = (cell: MatCell): FiberPolyline[] => {
  const polylines: FiberPolyline[] = [];
  cell.items.forEach((item) => {
    if (!item) return;
    if (item.kind === 'cell') {
      polylines.push(...cellToPolylines(item));
    } else if (item.kind === 'matrix') {
      const polyline = matrixToPolyline(item);
      if (polyline) polylines.push(polyline);
    }
  });
  return polylines;
};

const fibersMatrixToPolylines = (
  fibers: MatMatrix,
  idx: MatMatrix | null,
): FiberPolyline[] => {
  const rows = fibers.dims[0] ?? 0;
  const columns = fibers.dims[1] ?? 0;
  if (rows < 2 || columns < 3) return [];
  const coordinate = (row: number, column: number): number =>
    fibers.values[column * rows + row];

  const polylines: FiberPolyline[] = [];
  const pushRange = (start: number, end: number) => {
    if (end - start < 2) return;
    const polyline: FiberPolyline = [];
    for (let row = start; row < end; row += 1) {
      polyline.push([
        coordinate(row, 0),
        coordinate(row, 1),
        coordinate(row, 2),
      ]);
    }
    polylines.push(polyline);
  };

  if (idx && idx.values.length > 0) {
    let start = 0;
    for (const rawCount of idx.values) {
      const count = Math.floor(rawCount);
      if (count <= 0) continue;
      pushRange(start, Math.min(rows, start + count));
      start += count;
      if (start >= rows) break;
    }
    return polylines;
  }

  if (columns >= 4) {
    let start = 0;
    for (let row = 1; row <= rows; row += 1) {
      if (row === rows || coordinate(row, 3) !== coordinate(start, 3)) {
        pushRange(start, row);
        start = row;
      }
    }
    return polylines;
  }

  pushRange(0, rows);
  return polylines;
};

const searchForPolylines = (value: MatValue): FiberPolyline[] => {
  if (!value) return [];
  if (value.kind === 'cell') return cellToPolylines(value);
  if (value.kind === 'struct') {
    const fibers = value.fields.fibers;
    const idx = value.fields.idx;
    if (fibers?.kind === 'matrix') {
      return fibersMatrixToPolylines(
        fibers,
        idx?.kind === 'matrix' ? idx : null,
      );
    }
    for (const field of Object.values(value.fields)) {
      const found = searchForPolylines(field);
      if (found.length > 0) return found;
    }
    return [];
  }
  return [];
};

/** Extract fiber polylines from a parsed (or raw) Lead-DBS fiber MAT file. */
export function extractFiberPolylines(input: ArrayBuffer): FiberPolyline[] {
  const variables = parseMatFile(input);

  const fibcell = variables.fibcell;
  if (fibcell?.kind === 'cell') {
    const polylines = cellToPolylines(fibcell);
    if (polylines.length > 0) return polylines;
  }

  const fibers = variables.fibers;
  if (fibers?.kind === 'matrix') {
    const idx = variables.idx;
    const polylines = fibersMatrixToPolylines(
      fibers,
      idx?.kind === 'matrix' ? idx : null,
    );
    if (polylines.length > 0) return polylines;
  }

  for (const value of Object.values(variables)) {
    const polylines = searchForPolylines(value);
    if (polylines.length > 0) return polylines;
  }
  return [];
}

/** Flatten polylines into paired segment endpoints for THREE.LineSegments. */
export function polylinesToSegmentPositions(
  polylines: FiberPolyline[],
): Float32Array {
  let segmentCount = 0;
  polylines.forEach((polyline) => {
    segmentCount += Math.max(0, polyline.length - 1);
  });
  const positions = new Float32Array(segmentCount * 6);
  let cursor = 0;
  polylines.forEach((polyline) => {
    for (let index = 0; index + 1 < polyline.length; index += 1) {
      positions.set(polyline[index], cursor);
      positions.set(polyline[index + 1], cursor + 3);
      cursor += 6;
    }
  });
  return positions;
}
