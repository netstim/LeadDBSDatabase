export type CameraVector3 = [number, number, number];

export interface LeadAxisCameraInput {
  /** Distal lead marker (the point the camera looks toward). */
  head?: unknown;
  /** Proximal lead marker (the side from which the camera looks). */
  tail?: unknown;
  /** Contact centers, used for framing and as an axis fallback. */
  contacts?: unknown;
  /** Unzoomed height of the OrthographicCamera frustum. */
  baseFrustumHeight?: number;
  /** Render-surface width divided by height. */
  aspect?: number;
  /** Smallest world-space height shown in the fixed view. */
  minimumVisibleHeight?: number;
  /** Extra space around contact centers in the fixed view. */
  padding?: number;
  /** Smallest camera-to-target distance. */
  minimumDistance?: number;
}

export interface LeadAxisCameraPose {
  /** Unit vector from the distal head marker toward the proximal tail. */
  axis: CameraVector3;
  position: CameraVector3;
  target: CameraVector3;
  up: CameraVector3;
  distance: number;
  visibleHeight: number;
  visibleWidth: number;
  zoom: number;
}

const AXIS_EPSILON = 1e-8;

const finitePositive = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const vector = (value: unknown): CameraVector3 | null => {
  if (!Array.isArray(value) || value.length < 3) return null;
  const parsed = value.slice(0, 3).map(Number);
  return parsed.every(Number.isFinite)
    ? (parsed as CameraVector3)
    : null;
};

const vectorList = (value: unknown): CameraVector3[] =>
  Array.isArray(value)
    ? value
        .map(vector)
        .filter((item): item is CameraVector3 => item !== null)
    : [];

const add = (left: CameraVector3, right: CameraVector3): CameraVector3 => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2],
];

const subtract = (left: CameraVector3, right: CameraVector3): CameraVector3 => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
];

const scale = (value: CameraVector3, amount: number): CameraVector3 => [
  value[0] * amount,
  value[1] * amount,
  value[2] * amount,
];

const dot = (left: CameraVector3, right: CameraVector3): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const cross = (left: CameraVector3, right: CameraVector3): CameraVector3 => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
];

const magnitude = (value: CameraVector3): number => Math.sqrt(dot(value, value));

const normalize = (value: CameraVector3): CameraVector3 | null => {
  const length = magnitude(value);
  return length > AXIS_EPSILON ? scale(value, 1 / length) : null;
};

const centroid = (points: CameraVector3[]): CameraVector3 =>
  scale(
    points.reduce<CameraVector3>((sum, point) => add(sum, point), [0, 0, 0]),
    1 / points.length,
  );

/**
 * Find the best-fit line through the contacts. Directional contact centers can
 * be radially separated, so using the first and last contact directly can
 * create the same oblique error this utility is intended to avoid.
 */
const principalContactAxis = (points: CameraVector3[]): CameraVector3 | null => {
  if (points.length < 2) return null;
  const center = centroid(points);
  const covariance = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  points.forEach((point) => {
    const offset = subtract(point, center);
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        covariance[row][column] += offset[row] * offset[column];
      }
    }
  });

  let estimate = normalize(subtract(points[points.length - 1], points[0])) ?? [
    0,
    0,
    1,
  ];
  for (let iteration = 0; iteration < 24; iteration += 1) {
    const next: CameraVector3 = [
      dot(covariance[0] as CameraVector3, estimate),
      dot(covariance[1] as CameraVector3, estimate),
      dot(covariance[2] as CameraVector3, estimate),
    ];
    const normalized = normalize(next);
    if (!normalized) return null;
    estimate = normalized;
  }

  const orderHint = normalize(subtract(points[points.length - 1], points[0]));
  if (orderHint && dot(estimate, orderHint) < 0) return scale(estimate, -1);
  return estimate;
};

const projectedUpVector = (axis: CameraVector3): CameraVector3 => {
  // Retain anatomical superior as screen-up whenever possible. When the lead
  // is nearly superior/inferior, anterior becomes the deterministic fallback.
  const preferred: CameraVector3 =
    Math.abs(dot(axis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
  const projected = subtract(preferred, scale(axis, dot(preferred, axis)));
  return normalize(projected) ?? [1, 0, 0];
};

/**
 * Calculate a deterministic orthographic pose that looks exactly from the
 * proximal side of a lead toward its distal head. No Euler-angle
 * approximation is used, so arbitrary lead orientations remain axial.
 */
export const createLeadAxisCameraPose = (
  input: LeadAxisCameraInput,
): LeadAxisCameraPose | null => {
  const head = vector(input.head);
  const tail = vector(input.tail);
  const contacts = vectorList(input.contacts);
  const availablePoints = [head, tail, ...contacts].filter(
    (item): item is CameraVector3 => item !== null,
  );
  if (availablePoints.length === 0) return null;

  const markerAxis = head && tail ? normalize(subtract(tail, head)) : null;
  let axis = markerAxis ?? principalContactAxis(contacts) ?? ([0, 0, 1] as CameraVector3);

  // If only one marker is usable, keep the fallback axis pointing from the
  // known distal/head side toward the contact cloud where possible.
  if (!markerAxis && head && contacts.length > 0) {
    const towardContacts = subtract(centroid(contacts), head);
    if (dot(axis, towardContacts) < 0) axis = scale(axis, -1);
  }

  const target = head ?? contacts[0] ?? tail!;
  const projections = availablePoints.map((point) =>
    dot(subtract(point, target), axis),
  );
  const axialSpan = Math.max(...projections) - Math.min(...projections);
  const minimumDistance = finitePositive(input.minimumDistance, 25);
  const distance = Math.max(minimumDistance, axialSpan * 2.5);
  const position = add(target, scale(axis, distance));
  const up = projectedUpVector(axis);
  const right = normalize(cross(axis, up)) ?? [1, 0, 0];

  const aspect = finitePositive(input.aspect, 2);
  const padding = Math.max(1, finitePositive(input.padding, 1.5));
  const minimumVisibleHeight = finitePositive(input.minimumVisibleHeight, 8);
  const radialHalfHeight = availablePoints.reduce((maximum, point) => {
    const relative = subtract(point, target);
    const horizontal = Math.abs(dot(relative, right)) / aspect;
    const vertical = Math.abs(dot(relative, up));
    return Math.max(maximum, horizontal, vertical);
  }, 0);
  const visibleHeight = Math.max(
    minimumVisibleHeight,
    radialHalfHeight * 2 * padding,
  );
  const baseFrustumHeight = finitePositive(input.baseFrustumHeight, 45);

  return {
    axis,
    position,
    target,
    up,
    distance,
    visibleHeight,
    visibleWidth: visibleHeight * aspect,
    zoom: baseFrustumHeight / visibleHeight,
  };
};

