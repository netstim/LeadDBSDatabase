/** @jest-environment node */
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import {
  extractFiberPolylines,
  parseMatFile,
  polylinesToSegmentPositions,
} from './matFibers';

const FIBER_FILE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'FakeDBSDataset',
  'test_overlays',
  'typical_seizure.mat',
);

const toArrayBuffer = (buffer: Buffer): ArrayBuffer =>
  buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;

/** Build a minimal v5 MAT file holding one double matrix named `fibers`. */
const syntheticFibersMat = (
  rows: number[][],
  name = 'fibers',
  compress = false,
): ArrayBuffer => {
  const rowCount = rows.length;
  const columnCount = rows[0]?.length ?? 0;
  const element = (type: number, payload: Buffer): Buffer => {
    const tag = Buffer.alloc(8);
    tag.writeUInt32LE(type, 0);
    tag.writeUInt32LE(payload.length, 4);
    const padding = Buffer.alloc(
      (8 - (payload.length % 8)) % 8,
    );
    return Buffer.concat([tag, payload, padding]);
  };

  const flags = Buffer.alloc(8);
  flags.writeUInt8(6, 0); // mxDOUBLE_CLASS
  const dims = Buffer.alloc(8);
  dims.writeInt32LE(rowCount, 0);
  dims.writeInt32LE(columnCount, 4);
  const nameBuffer = Buffer.from(name, 'utf8');
  const values = Buffer.alloc(rowCount * columnCount * 8);
  for (let column = 0; column < columnCount; column += 1) {
    for (let row = 0; row < rowCount; row += 1) {
      values.writeDoubleLE(rows[row][column], (column * rowCount + row) * 8);
    }
  }

  const matrixBody = Buffer.concat([
    element(6, flags), // miUINT32 array flags
    element(5, dims), // miINT32 dims
    element(1, nameBuffer), // miINT8 name
    element(9, values), // miDOUBLE data
  ]);
  let topElement = element(14, matrixBody);
  if (compress) {
    topElement = element(15, zlib.deflateSync(topElement));
  }

  const header = Buffer.alloc(128, 0x20);
  header.write('MATLAB 5.0 MAT-file, synthetic test', 0, 'utf8');
  header.writeUInt16LE(0x0100, 124);
  header.write('IM', 126, 'utf8');
  return toArrayBuffer(Buffer.concat([header, topElement]));
};

describe('matFibers', () => {
  it('parses the real Lead-DBS fibcell file into many polylines', () => {
    const buffer = toArrayBuffer(fs.readFileSync(FIBER_FILE));
    const variables = parseMatFile(buffer);
    expect(Object.keys(variables)).toContain('fibcell');

    const polylines = extractFiberPolylines(buffer);
    expect(polylines.length).toBeGreaterThan(10);
    polylines.forEach((polyline) => {
      expect(polyline.length).toBeGreaterThanOrEqual(2);
      polyline.forEach((point) => {
        expect(point).toHaveLength(3);
        point.forEach((coordinate) => expect(Number.isFinite(coordinate)).toBe(true));
      });
    });

    // Fiber coordinates should be in a plausible MNI-space range.
    const flat = polylines.flat();
    const magnitudes = flat.map((point) => Math.hypot(...point));
    expect(Math.max(...magnitudes)).toBeLessThan(300);

    const positions = polylinesToSegmentPositions(polylines);
    const expectedSegments = polylines.reduce(
      (sum, polyline) => sum + polyline.length - 1,
      0,
    );
    expect(positions.length).toBe(expectedSegments * 6);
  });

  it('splits an Nx4 fibers matrix by its fiber id column', () => {
    const buffer = syntheticFibersMat([
      [0, 0, 0, 1],
      [1, 0, 0, 1],
      [2, 0, 0, 1],
      [5, 5, 5, 2],
      [6, 5, 5, 2],
    ]);
    const polylines = extractFiberPolylines(buffer);
    expect(polylines).toEqual([
      [
        [0, 0, 0],
        [1, 0, 0],
        [2, 0, 0],
      ],
      [
        [5, 5, 5],
        [6, 5, 5],
      ],
    ]);
  });

  it('reads compressed elements and rejects non-v5 files', () => {
    const compressed = syntheticFibersMat(
      [
        [0, 0, 0, 7],
        [1, 1, 1, 7],
      ],
      'fibers',
      true,
    );
    expect(extractFiberPolylines(compressed)).toHaveLength(1);

    const bogus = new ArrayBuffer(200);
    expect(() => parseMatFile(bogus)).toThrow(/MATLAB v5/);
  });
});
