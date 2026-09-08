export type MeshPoint = readonly [number, number, number];
export type MeshFace = readonly [number, number, number];

export interface MeshSmoothingOptions {
  /** Number of Taubin lambda/mu passes. Zero returns an unchanged copy. */
  iterations?: number;
  /** Positive low-pass step. Values around 0.4-0.6 are usually stable. */
  lambda?: number;
  /** Negative inflation step used to counter Laplacian shrinkage. */
  mu?: number;
  /** Keep vertices on open mesh borders fixed. */
  preserveBoundary?: boolean;
  /** Remove numerical translation introduced by irregular vertex valence. */
  preserveCentroid?: boolean;
}

export const DEFAULT_MESH_SMOOTHING_OPTIONS: Required<MeshSmoothingOptions> = {
  iterations: 5,
  lambda: 0.5,
  mu: -0.53,
  preserveBoundary: true,
  preserveCentroid: true,
};

const finiteOr = (value: number | undefined, fallback: number): number =>
  Number.isFinite(value) ? (value as number) : fallback;

const pointIsFinite = (point: MeshPoint): boolean =>
  point.length === 3 && point.every(Number.isFinite);

const edgeKey = (a: number, b: number): string =>
  a < b ? `${a}:${b}` : `${b}:${a}`;

interface MeshTopology {
  adjacency: number[][];
  boundaryVertices: Set<number>;
}

/**
 * Builds undirected one-ring neighborhoods and detects open mesh borders.
 * Invalid/degenerate faces are ignored so malformed optional overlays cannot
 * corrupt an otherwise valid viewer scene.
 */
export function buildMeshTopology(
  vertexCount: number,
  faces: ReadonlyArray<MeshFace>,
): MeshTopology {
  const safeVertexCount = Math.max(0, Math.floor(vertexCount));
  const neighbors = Array.from(
    { length: safeVertexCount },
    () => new Set<number>(),
  );
  const edgeCounts = new Map<string, number>();

  const addEdge = (a: number, b: number) => {
    if (a === b) return;
    neighbors[a].add(b);
    neighbors[b].add(a);
    const key = edgeKey(a, b);
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1);
  };

  faces.forEach((face) => {
    if (
      face.length !== 3 ||
      !face.every(
        (index) =>
          Number.isInteger(index) && index >= 0 && index < safeVertexCount,
      ) ||
      new Set(face).size !== 3
    ) {
      return;
    }

    addEdge(face[0], face[1]);
    addEdge(face[1], face[2]);
    addEdge(face[2], face[0]);
  });

  const boundaryVertices = new Set<number>();
  edgeCounts.forEach((count, key) => {
    if (count !== 1) return;
    const [a, b] = key.split(':').map(Number);
    boundaryVertices.add(a);
    boundaryVertices.add(b);
  });

  return {
    adjacency: neighbors.map((entries) => Array.from(entries)),
    boundaryVertices,
  };
}

const centroid = (positions: ReadonlyArray<MeshPoint>): MeshPoint => {
  if (positions.length === 0) return [0, 0, 0];
  let x = 0;
  let y = 0;
  let z = 0;
  positions.forEach((point) => {
    x += point[0];
    y += point[1];
    z += point[2];
  });
  return [x / positions.length, y / positions.length, z / positions.length];
};

const laplacianPass = (
  positions: ReadonlyArray<MeshPoint>,
  adjacency: number[][],
  fixedVertices: ReadonlySet<number>,
  factor: number,
): MeshPoint[] =>
  positions.map((point, index) => {
    const neighbors = adjacency[index];
    if (fixedVertices.has(index) || neighbors.length === 0) {
      return [point[0], point[1], point[2]];
    }

    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    neighbors.forEach((neighborIndex) => {
      const neighbor = positions[neighborIndex];
      sumX += neighbor[0];
      sumY += neighbor[1];
      sumZ += neighbor[2];
    });

    const count = neighbors.length;
    return [
      point[0] + factor * (sumX / count - point[0]),
      point[1] + factor * (sumY / count - point[1]),
      point[2] + factor * (sumZ / count - point[2]),
    ];
  });

/**
 * Smooths indexed surface vertices using Taubin's two-pass method.
 *
 * Positions remain in their original coordinate system (normally millimetres
 * after applying the NIfTI affine). The negative mu pass counters the shrinkage
 * of ordinary Laplacian smoothing, and optional centroid preservation prevents
 * small translations on meshes with uneven vertex density.
 */
export function taubinSmoothPositions(
  positions: ReadonlyArray<MeshPoint>,
  faces: ReadonlyArray<MeshFace>,
  options: MeshSmoothingOptions = {},
): MeshPoint[] {
  if (!positions.every(pointIsFinite)) {
    throw new Error('Mesh positions must contain only finite XYZ coordinates.');
  }

  const settings = {
    ...DEFAULT_MESH_SMOOTHING_OPTIONS,
    ...options,
  };
  const iterations = Math.min(
    100,
    Math.max(
      0,
      Math.floor(
        finiteOr(
          settings.iterations,
          DEFAULT_MESH_SMOOTHING_OPTIONS.iterations,
        ),
      ),
    ),
  );
  const lambda = finiteOr(
    settings.lambda,
    DEFAULT_MESH_SMOOTHING_OPTIONS.lambda,
  );
  const mu = finiteOr(settings.mu, DEFAULT_MESH_SMOOTHING_OPTIONS.mu);
  const originalCentroid = centroid(positions);
  const topology = buildMeshTopology(positions.length, faces);
  const fixedVertices = settings.preserveBoundary
    ? topology.boundaryVertices
    : new Set<number>();

  let result: MeshPoint[] = positions.map((point) => [...point]);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    result = laplacianPass(result, topology.adjacency, fixedVertices, lambda);
    result = laplacianPass(result, topology.adjacency, fixedVertices, mu);
  }

  if (settings.preserveCentroid && result.length > 0) {
    const smoothedCentroid = centroid(result);
    const offset = originalCentroid.map(
      (value, axis) => value - smoothedCentroid[axis],
    );
    result = result.map((point) => [
      point[0] + offset[0],
      point[1] + offset[1],
      point[2] + offset[2],
    ]);
  }

  return result;
}
