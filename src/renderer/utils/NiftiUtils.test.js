/** @jest-environment node */

import { gzipSync } from 'zlib';
import { NIFTI1 } from 'nifti-reader-js';
import { nii2Mesh } from './NiftiUtils';

const sampleVolume = () => {
  const header = new NIFTI1();
  header.littleEndian = true;
  header.dims = [3, 5, 5, 5, 1, 1, 1, 1];
  header.pixDims = [1, 1, 1, 1, 1, 1, 1, 1];
  header.datatypeCode = NIFTI1.TYPE_UINT8;
  header.numBitsPerVoxel = 8;
  header.vox_offset = 352;
  header.sform_code = NIFTI1.XFORM_MNI_152;
  header.affine = [
    [1, 0, 0, 10],
    [0, 1, 0, -20],
    [0, 0, 1, 30],
    [0, 0, 0, 1],
  ];
  header.magic = 'n+1';
  const bytes = new Uint8Array(352 + 125);
  bytes.set(new Uint8Array(header.toArrayBuffer()));
  for (let z = 1; z <= 3; z += 1) {
    for (let y = 1; y <= 3; y += 1) {
      for (let x = 1; x <= 3; x += 1) {
        bytes[352 + x + 5 * (y + 5 * z)] = 1;
      }
    }
  }
  return bytes.buffer;
};

test('imports compressed NIfTI structure with affine and smoothing', () => {
  const compressed = gzipSync(Buffer.from(sampleVolume()));
  const buffer = compressed.buffer.slice(
    compressed.byteOffset,
    compressed.byteOffset + compressed.byteLength,
  );
  const { geometry, material } = nii2Mesh(buffer, { smoothingIterations: 3 });
  const position = geometry.getAttribute('position');
  expect(position.count).toBeGreaterThan(0);
  expect(geometry.getIndex().count).toBeGreaterThan(0);
  expect(geometry.boundingBox.min.x).toBeGreaterThan(9);
  expect(geometry.boundingBox.min.y).toBeLessThan(-17);
  expect(geometry.boundingBox.min.z).toBeGreaterThan(29);
  geometry.dispose();
  material.dispose();
});
