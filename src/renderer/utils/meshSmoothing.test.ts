import {
  buildMeshTopology,
  taubinSmoothPositions,
  type MeshFace,
  type MeshPoint,
} from './meshSmoothing';

const closedOctahedronFaces: MeshFace[] = [
  [0, 2, 4],
  [2, 1, 4],
  [1, 3, 4],
  [3, 0, 4],
  [2, 0, 5],
  [1, 2, 5],
  [3, 1, 5],
  [0, 3, 5],
];

const centroid = (points: ReadonlyArray<MeshPoint>): MeshPoint =>
  [0, 1, 2].map(
    (axis) =>
      points.reduce((sum, point) => sum + point[axis], 0) / points.length,
  ) as [number, number, number];

describe('mesh smoothing', () => {
  it('builds one-ring adjacency and identifies open boundaries', () => {
    const topology = buildMeshTopology(4, [
      [0, 1, 2],
      [2, 1, 3],
    ]);

    expect(topology.adjacency[1].sort()).toEqual([0, 2, 3]);
    expect(Array.from(topology.boundaryVertices).sort()).toEqual([0, 1, 2, 3]);
  });

  it('smooths a blocky closed surface while keeping its center fixed', () => {
    const positions: MeshPoint[] = [
      [-1.8, 0, 0],
      [1, 0, 0],
      [0, -1, 0],
      [0, 1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ];

    const result = taubinSmoothPositions(positions, closedOctahedronFaces, {
      iterations: 4,
    });

    expect(result[0][0]).toBeGreaterThan(positions[0][0]);
    expect(result[0][0]).toBeLessThan(-0.5);
    expect(centroid(result)).toEqual(
      expect.arrayContaining(
        centroid(positions).map((value) => expect.closeTo(value, 10)),
      ),
    );
  });

  it('is translation-equivariant and therefore preserves world units', () => {
    const positions: MeshPoint[] = [
      [-2, 0, 0],
      [1, 0, 0],
      [0, -3, 0],
      [0, 1, 0],
      [0, 0, 4],
      [0, 0, -1],
    ];
    const translation: MeshPoint = [83.25, -41.5, 12.75];
    const translated: MeshPoint[] = positions.map((point) => [
      point[0] + translation[0],
      point[1] + translation[1],
      point[2] + translation[2],
    ]);

    const baseResult = taubinSmoothPositions(positions, closedOctahedronFaces);
    const translatedResult = taubinSmoothPositions(
      translated,
      closedOctahedronFaces,
    );

    translatedResult.forEach((point, pointIndex) => {
      point.forEach((value, axis) => {
        expect(value - translation[axis]).toBeCloseTo(
          baseResult[pointIndex][axis],
          10,
        );
      });
    });
  });

  it('keeps open borders and isolated vertices unchanged by default', () => {
    const positions: MeshPoint[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
      [7, 8, 9],
    ];

    expect(taubinSmoothPositions(positions, [[0, 1, 2]])).toEqual(positions);
  });

  it('ignores malformed faces and rejects non-finite coordinates', () => {
    const positions: MeshPoint[] = [
      [0, 0, 0],
      [1, 0, 0],
      [0, 1, 0],
    ];
    const malformedFaces = [
      [0, 0, 1],
      [0, 1, 99],
    ] as MeshFace[];

    expect(taubinSmoothPositions(positions, malformedFaces)).toEqual(positions);
    expect(() => taubinSmoothPositions([[Number.NaN, 0, 0]], [])).toThrow(
      'finite XYZ',
    );
  });
});
