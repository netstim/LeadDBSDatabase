import { NIFTI1 } from 'nifti-reader-js';
import decodeNiftiScalarData from './niftiScalarData';

test('decodes big endian uint16 voxels with NIfTI scale and intercept', () => {
  const image = new ArrayBuffer(8);
  const view = new DataView(image);
  [0, 100, 500, 1000].forEach((value, index) =>
    view.setUint16(index * 2, value, false),
  );
  const voxels = decodeNiftiScalarData(
    image,
    {
      datatypeCode: NIFTI1.TYPE_UINT16,
      littleEndian: false,
      scl_slope: 0.5,
      scl_inter: -10,
    },
    4,
  );
  expect(Array.from(voxels)).toEqual([-10, 40, 240, 490]);
});

test('reads only the first frame and rejects truncated volumes', () => {
  const image = new Uint8Array([1, 2, 3, 4, 9, 9, 9, 9]).buffer;
  const header = { datatypeCode: NIFTI1.TYPE_UINT8, littleEndian: true };
  expect(Array.from(decodeNiftiScalarData(image, header, 4))).toEqual([
    1, 2, 3, 4,
  ]);
  expect(() => decodeNiftiScalarData(image, header, 9)).toThrow('truncated');
});
