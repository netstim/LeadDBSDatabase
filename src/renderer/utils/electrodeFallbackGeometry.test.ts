/** @jest-environment node */

import {
  createFallbackElectrodeGeometry,
  extractFallbackElectrodeData,
  getFallbackElectrodeBounds,
  parseElectrodePlyGeometry,
} from './electrodeFallbackGeometry';

test('extracts legacy coords1/coords2 and ignores malformed coordinates', () => {
  const extracted = extractFallbackElectrodeData({
    elmodel: 'Medtronic 3387',
    coords1: [
      [1, 2, 3],
      ['4', '5', '6'],
      [7, Number.NaN, 9],
    ],
    coords2: [[-1, 2, 3]],
    markers: {
      head1: [1, 2, 3],
      tail1: [1, 2, 20],
      head2: [-1, 2, 3],
      tail2: [-1, 2, 20],
    },
  });

  expect(extracted.model).toBe('Medtronic 3387');
  expect(extracted.sides.map(({ side }) => side)).toEqual(['right', 'left']);
  expect(extracted.sides[0].contacts).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ]);
  expect(extracted.sides[1].contacts).toEqual([[-1, 2, 3]]);
});

test('extracts a wrapped Lead-DBS reconstruction coordinate space', () => {
  const extracted = extractFallbackElectrodeData({
    reco: {
      props: [{ elmodel: 'Boston Vercise' }],
      mni: {
        coords_mm: [[[10, 11, 12]], [[-10, 11, 12]]],
        markers: [
          { head: [10, 11, 12], tail: [10, 11, 30] },
          { head: [-10, 11, 12], tail: [-10, 11, 30] },
        ],
      },
    },
  });

  expect(extracted.model).toBe('Boston Vercise');
  expect(extracted.sides).toHaveLength(2);
  expect(extracted.sides[0].head).toEqual([10, 11, 12]);
  expect(extracted.sides[1].tail).toEqual([-10, 11, 30]);
});

test('builds finite renderer-native geometry from contacts and metadata', () => {
  const geometry = createFallbackElectrodeGeometry(
    {
      coords_right: [
        [1, 2, 3],
        [1, 2, 6],
      ],
      coords_left: [[-1, 2, 3]],
    },
    {
      lead_diameter: 1.27,
      contact_diameter: 1.27,
      contact_length: 1.5,
    },
  );

  expect(geometry).not.toBeNull();
  expect(geometry!.getAttribute('position').count).toBeGreaterThan(0);
  expect(geometry!.getAttribute('color').count).toBe(
    geometry!.getAttribute('position').count,
  );
  expect(geometry!.userData).toMatchObject({
    source: 'reconstruction-fallback',
    contactCount: 3,
  });
  const positions = geometry!.getAttribute('position').array;
  expect(Array.from(positions).every(Number.isFinite)).toBe(true);
  geometry!.dispose();
});

test('uses directional tier means for the shaft when radial spread is larger', () => {
  const geometry = createFallbackElectrodeGeometry(
    {
      coords_right: [
        [3, 0, 0],
        [-1.5, 2.598, 0],
        [-1.5, -2.598, 0],
        [3, 0, 1],
        [-1.5, 2.598, 1],
        [-1.5, -2.598, 1],
      ],
    },
    { etageidx: ['1:3', '4:6'] },
  );

  expect(geometry).not.toBeNull();
  const positions = geometry!.getAttribute('position');
  const centralShaftZ: number[] = [];
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    expect(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)).toBe(
      true,
    );
    if (Math.hypot(x, y) < 0.35) centralShaftZ.push(z);
  }
  expect(Math.min(...centralShaftZ)).toBeLessThanOrEqual(0.01);
  expect(Math.max(...centralShaftZ)).toBeGreaterThanOrEqual(0.99);
  geometry!.dispose();
});

test('uses the remaining unilateral side for camera bounds', () => {
  const bounds = getFallbackElectrodeBounds(
    {
      coords_left: [
        [-10, 2, 3],
        [-10, 2, 7],
      ],
      markers: { head2: [-10, 2, 2], tail2: [-10, 2, 10] },
    },
    'right',
  );

  expect(bounds).toEqual({
    side: 'left',
    center: [-10, 2, 6],
    size: [0, 0, 8],
  });
});

test('uses valid marker axes and returns null when no geometry data exists', () => {
  expect(
    createFallbackElectrodeGeometry({
      markers: { head1: [0, 0, 0], tail1: [0, 0, 10] },
    }),
  ).not.toBeNull();
  expect(
    createFallbackElectrodeGeometry({
      coords1: [[0, 'invalid', 0]],
      markers: { head1: [0, 0, 0], tail1: [0, 0, 0] },
    }),
  ).toBeNull();
});

test('accepts a valid PLY without vertex colors', () => {
  const ply = new TextEncoder().encode(`ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_indices
end_header
0 0 0
1 0 0
0 1 0
3 0 1 2
`);
  const geometry = parseElectrodePlyGeometry(ply);
  expect(geometry.getAttribute('position').count).toBe(3);
  expect(geometry.hasAttribute('color')).toBe(false);
  geometry.dispose();
});
