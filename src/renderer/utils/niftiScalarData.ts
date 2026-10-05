import { NIFTI1 } from 'nifti-reader-js';

type ScalarHeader = {
  datatypeCode: number;
  littleEndian: boolean;
  scl_slope?: number;
  scl_inter?: number;
};

/** Decode one 3D frame using the byte order and scaling stored in its header. */
export default function decodeNiftiScalarData(
  image: ArrayBuffer,
  header: ScalarHeader,
  voxelCount: number,
): Float32Array {
  const types: Record<
    number,
    {
      bytes: number;
      read: (view: DataView, offset: number, littleEndian: boolean) => number;
    }
  > = {
    [NIFTI1.TYPE_UINT8]: {
      bytes: 1,
      read: (view, offset) => view.getUint8(offset),
    },
    [NIFTI1.TYPE_INT8]: {
      bytes: 1,
      read: (view, offset) => view.getInt8(offset),
    },
    [NIFTI1.TYPE_INT16]: {
      bytes: 2,
      read: (view, offset, littleEndian) => view.getInt16(offset, littleEndian),
    },
    [NIFTI1.TYPE_UINT16]: {
      bytes: 2,
      read: (view, offset, littleEndian) =>
        view.getUint16(offset, littleEndian),
    },
    [NIFTI1.TYPE_INT32]: {
      bytes: 4,
      read: (view, offset, littleEndian) => view.getInt32(offset, littleEndian),
    },
    [NIFTI1.TYPE_UINT32]: {
      bytes: 4,
      read: (view, offset, littleEndian) =>
        view.getUint32(offset, littleEndian),
    },
    [NIFTI1.TYPE_FLOAT32]: {
      bytes: 4,
      read: (view, offset, littleEndian) =>
        view.getFloat32(offset, littleEndian),
    },
    [NIFTI1.TYPE_FLOAT64]: {
      bytes: 8,
      read: (view, offset, littleEndian) =>
        view.getFloat64(offset, littleEndian),
    },
  };
  const type = types[header.datatypeCode];
  if (!type) {
    throw new Error(`Unsupported NIfTI datatype code: ${header.datatypeCode}`);
  }
  if (
    !Number.isSafeInteger(voxelCount) ||
    voxelCount <= 0 ||
    image.byteLength < voxelCount * type.bytes
  ) {
    throw new Error('NIfTI image is truncated or has invalid dimensions.');
  }

  const result = new Float32Array(voxelCount);
  const view = new DataView(image);
  const slope =
    Number.isFinite(header.scl_slope) && header.scl_slope !== 0
      ? header.scl_slope!
      : 1;
  const intercept = Number.isFinite(header.scl_inter) ? header.scl_inter! : 0;
  for (let index = 0; index < voxelCount; index += 1) {
    result[index] =
      type.read(view, index * type.bytes, header.littleEndian) * slope +
      intercept;
  }
  return result;
}
