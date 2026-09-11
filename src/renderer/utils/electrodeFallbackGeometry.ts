import * as THREE from 'three';
import { mergeBufferGeometries, PLYLoader } from 'three-stdlib';

export type ElectrodeCoordinate = [number, number, number];

export interface FallbackElectrodeSide {
  side: 'right' | 'left';
  contacts: ElectrodeCoordinate[];
  head?: ElectrodeCoordinate;
  tail?: ElectrodeCoordinate;
}

export interface FallbackElectrodeData {
  model?: string;
  sides: FallbackElectrodeSide[];
}

export interface FallbackElectrodeBounds {
  side: 'right' | 'left';
  center: ElectrodeCoordinate;
  size: ElectrodeCoordinate;
}

export interface ElectrodeGeometryMetadata {
  lead_diameter?: unknown;
  contact_diameter?: unknown;
  contact_length?: unknown;
  tip_length?: unknown;
  lead_color?: unknown;
  contact_color?: unknown;
  etageidx?: unknown;
}

const MAX_CONTACTS_PER_SIDE = 64;
const MIN_AXIS_LENGTH = 1e-6;

const exactArrayBuffer = (value: unknown): ArrayBuffer => {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return value.buffer.slice(
      value.byteOffset,
      value.byteOffset + value.byteLength,
    ) as ArrayBuffer;
  }
  throw new Error('The electrode PLY payload is missing or invalid.');
};

export const parseElectrodePlyGeometry = (
  value: unknown,
): THREE.BufferGeometry => {
  const geometry = new PLYLoader().parse(exactArrayBuffer(value));
  const positions = geometry.getAttribute('position');
  if (!positions || positions.count === 0) {
    geometry.dispose();
    throw new Error('The electrode PLY contains no vertices.');
  }
  for (let index = 0; index < positions.count; index += 1) {
    if (
      !Number.isFinite(positions.getX(index)) ||
      !Number.isFinite(positions.getY(index)) ||
      !Number.isFinite(positions.getZ(index))
    ) {
      geometry.dispose();
      throw new Error('The electrode PLY contains invalid coordinates.');
    }
  }

  const colors = geometry.getAttribute('color');
  if (colors && colors.itemSize >= 3) {
    const neutralized = new Float32Array(colors.count * 3);
    for (let index = 0; index < colors.count; index += 1) {
      const red = colors.getX(index);
      const green = colors.getY(index);
      const blue = colors.getZ(index);
      const replace =
        (red > 0.9 && green > 0.9 && blue < 0.6) ||
        (red > 0.4 && red < 0.6 && green > 0.9 && blue < 0.1) ||
        (red > 0.9 && green < 0.1 && blue > 0.4 && blue < 0.6) ||
        (red < 0.1 && green > 0.4 && green < 0.6 && blue > 0.9) ||
        (blue > 0.5 && blue > red && blue > green);
      neutralized[index * 3] = replace ? 0.8 : red;
      neutralized[index * 3 + 1] = replace ? 0.8 : green;
      neutralized[index * 3 + 2] = replace ? 0.8 : blue;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(neutralized, 3));
  }
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  return geometry;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const orderedValues = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (!isRecord(value)) return [];

  const numericEntries = Object.entries(value)
    .filter(([key]) => /^\d+$/.test(key))
    .sort(([left], [right]) => Number(left) - Number(right));
  return numericEntries.map(([, item]) => item);
};

const finiteNumber = (value: unknown): number | null => {
  let output = Number.NaN;
  if (typeof value === 'number') output = value;
  if (typeof value === 'string' && value.trim()) output = Number(value);
  return Number.isFinite(output) ? output : null;
};

const coordinate = (value: unknown): ElectrodeCoordinate | null => {
  if (isRecord(value)) {
    const x = finiteNumber(value.x);
    const y = finiteNumber(value.y);
    const z = finiteNumber(value.z);
    return x === null || y === null || z === null ? null : [x, y, z];
  }

  const values = orderedValues(value);
  if (values.length === 1) return coordinate(values[0]);
  if (values.length < 3) return null;
  const x = finiteNumber(values[0]);
  const y = finiteNumber(values[1]);
  const z = finiteNumber(values[2]);
  return x === null || y === null || z === null ? null : [x, y, z];
};

const coordinateList = (value: unknown): ElectrodeCoordinate[] => {
  const single = coordinate(value);
  if (single) return [single];

  return orderedValues(value)
    .slice(0, MAX_CONTACTS_PER_SIDE)
    .map(coordinate)
    .filter((item): item is ElectrodeCoordinate => item !== null);
};

const firstRecord = (
  source: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | null => {
  const key = keys.find((candidate) => isRecord(source[candidate]));
  return key ? (source[key] as Record<string, unknown>) : null;
};

const markerFromIndexedValue = (
  value: unknown,
  index: number,
  key: 'head' | 'tail',
): ElectrodeCoordinate | null => {
  const markers = orderedValues(value);
  const marker = markers[index];
  return isRecord(marker) ? coordinate(marker[key]) : null;
};

const modelName = (root: Record<string, unknown>): string | undefined => {
  if (typeof root.elmodel === 'string' && root.elmodel.trim()) {
    return root.elmodel.trim();
  }
  const props = orderedValues(root.props);
  const first = props[0];
  return isRecord(first) && typeof first.elmodel === 'string'
    ? first.elmodel
    : undefined;
};

export const extractFallbackElectrodeData = (
  input: unknown,
): FallbackElectrodeData => {
  const inputRecord = isRecord(input) ? input : {};
  const root = isRecord(inputRecord.reco) ? inputRecord.reco : inputRecord;
  const coordinateSpace = firstRecord(root, ['mni', 'native', 'scrf']);

  let rightContacts = coordinateList(root.coords_right ?? root.coords1);
  let leftContacts = coordinateList(root.coords_left ?? root.coords2);

  if (
    rightContacts.length === 0 &&
    leftContacts.length === 0 &&
    coordinateSpace
  ) {
    const spaceCoordinates = orderedValues(coordinateSpace.coords_mm);
    rightContacts = coordinateList(spaceCoordinates[0]);
    leftContacts = coordinateList(spaceCoordinates[1]);
  }

  const directMarkers = isRecord(root.markers) ? root.markers : null;
  const spaceMarkers = coordinateSpace?.markers;
  const sides: FallbackElectrodeSide[] = [
    {
      side: 'right',
      contacts: rightContacts,
      head:
        coordinate(directMarkers?.head1) ??
        markerFromIndexedValue(spaceMarkers, 0, 'head') ??
        undefined,
      tail:
        coordinate(directMarkers?.tail1) ??
        markerFromIndexedValue(spaceMarkers, 0, 'tail') ??
        undefined,
    },
    {
      side: 'left',
      contacts: leftContacts,
      head:
        coordinate(directMarkers?.head2) ??
        markerFromIndexedValue(spaceMarkers, 1, 'head') ??
        undefined,
      tail:
        coordinate(directMarkers?.tail2) ??
        markerFromIndexedValue(spaceMarkers, 1, 'tail') ??
        undefined,
    },
  ].filter((side) => {
    if (side.contacts.length > 0) return true;
    if (!side.head || !side.tail) return false;
    return (
      new THREE.Vector3(...side.head).distanceTo(
        new THREE.Vector3(...side.tail),
      ) > MIN_AXIS_LENGTH
    );
  }) as FallbackElectrodeSide[];

  return { model: modelName(root), sides };
};

export const getFallbackElectrodeBounds = (
  input: unknown,
  preferredSide?: 'right' | 'left',
): FallbackElectrodeBounds | null => {
  const extracted = extractFallbackElectrodeData(input);
  const selectedSide =
    extracted.sides.find((candidate) => candidate.side === preferredSide) ??
    extracted.sides[0];
  if (!selectedSide) return null;

  const points = selectedSide.contacts.map(
    (contact) => new THREE.Vector3(...contact),
  );
  if (selectedSide.head) points.push(new THREE.Vector3(...selectedSide.head));
  if (selectedSide.tail) points.push(new THREE.Vector3(...selectedSide.tail));
  if (points.length === 0) return null;

  const bounds = new THREE.Box3().setFromPoints(points);
  return {
    side: selectedSide.side,
    center: bounds
      .getCenter(new THREE.Vector3())
      .toArray() as ElectrodeCoordinate,
    size: bounds.getSize(new THREE.Vector3()).toArray() as ElectrodeCoordinate,
  };
};

const boundedMetadataNumber = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number => {
  const parsed = finiteNumber(value);
  return parsed !== null && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
};

const grayscale = (value: unknown, fallback: number): THREE.Color => {
  const channel = boundedMetadataNumber(value, fallback, 0, 1);
  return new THREE.Color(channel, channel, channel);
};

const addVertexColor = (
  geometry: THREE.BufferGeometry,
  colorValue: THREE.Color,
): THREE.BufferGeometry => {
  const { count } = geometry.getAttribute('position');
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = colorValue.r;
    colors[index * 3 + 1] = colorValue.g;
    colors[index * 3 + 2] = colorValue.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
};

const contactTierIndices = (value: unknown): number[][] =>
  orderedValues(value)
    .map((tier) => {
      if (typeof tier === 'number' && Number.isInteger(tier)) return [tier - 1];
      if (typeof tier !== 'string') return [];
      const match = /^(\d+)(?::(\d+))?$/.exec(tier.trim());
      if (!match) return [];
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      if (start < 1 || end < start || end - start > MAX_CONTACTS_PER_SIDE) {
        return [];
      }
      return Array.from(
        { length: end - start + 1 },
        (_item, index) => start - 1 + index,
      );
    })
    .filter((tier) => tier.length > 0);

const meanCoordinate = (
  contacts: ElectrodeCoordinate[],
  indices: number[],
): THREE.Vector3 | null => {
  const points = indices
    .map((index) => contacts[index])
    .filter((item): item is ElectrodeCoordinate => item !== undefined);
  if (points.length === 0) return null;
  return points
    .reduce(
      (sum, point) => sum.add(new THREE.Vector3(...point)),
      new THREE.Vector3(),
    )
    .multiplyScalar(1 / points.length);
};

const tierAxis = (
  contacts: ElectrodeCoordinate[],
  etageidx: unknown,
): [THREE.Vector3, THREE.Vector3] | null => {
  const centers = contactTierIndices(etageidx)
    .map((indices) => meanCoordinate(contacts, indices))
    .filter((item): item is THREE.Vector3 => item !== null);
  if (centers.length < 2) return null;
  const start = centers[0];
  const end = centers[centers.length - 1];
  return start.distanceTo(end) > MIN_AXIS_LENGTH ? [start, end] : null;
};

const principalAxis = (
  contacts: ElectrodeCoordinate[],
): [THREE.Vector3, THREE.Vector3] | null => {
  if (contacts.length < 2) return null;
  const points = contacts.map((item) => new THREE.Vector3(...item));
  const center = points
    .reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / points.length);
  const covariance = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  points.forEach((point) => {
    const offset = point.clone().sub(center);
    const values = [offset.x, offset.y, offset.z];
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        covariance[row][column] += values[row] * values[column];
      }
    }
  });

  let axis = points[points.length - 1].clone().sub(points[0]);
  if (axis.lengthSq() <= MIN_AXIS_LENGTH ** 2) axis.set(1, 1, 1);
  axis.normalize();
  for (let iteration = 0; iteration < 16; iteration += 1) {
    const next = new THREE.Vector3(
      covariance[0][0] * axis.x +
        covariance[0][1] * axis.y +
        covariance[0][2] * axis.z,
      covariance[1][0] * axis.x +
        covariance[1][1] * axis.y +
        covariance[1][2] * axis.z,
      covariance[2][0] * axis.x +
        covariance[2][1] * axis.y +
        covariance[2][2] * axis.z,
    );
    if (next.lengthSq() <= MIN_AXIS_LENGTH ** 2) return null;
    axis = next.normalize();
  }

  const projections = points.map((point) =>
    point.clone().sub(center).dot(axis),
  );
  const minimum = Math.min(...projections);
  const maximum = Math.max(...projections);
  if (maximum - minimum <= MIN_AXIS_LENGTH) return null;
  return [
    center.clone().addScaledVector(axis, minimum),
    center.clone().addScaledVector(axis, maximum),
  ];
};

// Directional segment plates cover an arc of the shaft circumference;
// three 120° segments with insulation gaps between them.
const SEGMENT_ARC = THREE.MathUtils.degToRad(100);
const RING_RADIAL_THRESHOLD = 0.2;

/**
 * A contact rendered as a plate: a shallow cylindrical band around the shaft
 * axis. Ring contacts wrap the full circumference; directional segments
 * cover an arc facing their radial offset direction.
 */
const contactPlate = (
  levelCenter: THREE.Vector3,
  axisDirection: THREE.Vector3,
  radialDirection: THREE.Vector3 | null,
  radius: number,
  length: number,
): THREE.BufferGeometry => {
  const isSegment = radialDirection !== null;
  const geometry = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    isSegment ? 12 : 24,
    1,
    false,
    isSegment ? -SEGMENT_ARC / 2 : 0,
    isSegment ? SEGMENT_ARC : Math.PI * 2,
  );

  // Local +Y is the cylinder axis; theta = 0 faces local +Z, so build a
  // basis that maps +Y onto the shaft and +Z onto the radial direction.
  const yAxis = axisDirection.clone().normalize();
  let zAxis = radialDirection
    ? radialDirection.clone().normalize()
    : new THREE.Vector3(1, 0, 0);
  // Re-orthogonalize against the shaft axis.
  zAxis = zAxis
    .sub(yAxis.clone().multiplyScalar(zAxis.dot(yAxis)))
    .normalize();
  if (!Number.isFinite(zAxis.x) || zAxis.lengthSq() < 0.5) {
    zAxis = Math.abs(yAxis.z) < 0.9
      ? new THREE.Vector3(0, 0, 1).cross(yAxis).normalize()
      : new THREE.Vector3(1, 0, 0).cross(yAxis).normalize();
  }
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize();

  const basis = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
  basis.setPosition(levelCenter);
  geometry.applyMatrix4(basis);
  return geometry;
};

const cylinderBetween = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
): THREE.BufferGeometry | null => {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  if (!Number.isFinite(length) || length <= MIN_AXIS_LENGTH) return null;

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 16, 1);
  const midpoint = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5);
  const rotation = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(midpoint, rotation, new THREE.Vector3(1, 1, 1)),
  );
  return geometry;
};

export const createFallbackElectrodeGeometry = (
  reconstruction: unknown,
  metadata: ElectrodeGeometryMetadata = {},
): THREE.BufferGeometry | null => {
  const extracted = extractFallbackElectrodeData(reconstruction);
  if (extracted.sides.length === 0) return null;

  const physicalLeadRadius =
    boundedMetadataNumber(metadata.lead_diameter, 1.3, 0.1, 10) / 2;
  const physicalContactRadius =
    boundedMetadataNumber(
      metadata.contact_diameter,
      physicalLeadRadius * 2,
      0.1,
      10,
    ) / 2;
  // Render at true physical scale so the fallback reads as an actual lead in
  // millimetre space; contacts bulge slightly past the shaft to stay visible.
  const leadRadius = Math.min(1.5, Math.max(0.2, physicalLeadRadius));
  const contactRadius = Math.min(
    1.8,
    Math.max(leadRadius * 1.15, physicalContactRadius * 0.6),
  );
  const leadColor = grayscale(metadata.lead_color, 0.35);
  const contactColor = grayscale(metadata.contact_color, 0.75);
  const pieces: THREE.BufferGeometry[] = [];

  extracted.sides.forEach((side) => {
    const markerAxis =
      side.head && side.tail
        ? ([
            new THREE.Vector3(...side.head),
            new THREE.Vector3(...side.tail),
          ] as [THREE.Vector3, THREE.Vector3])
        : null;
    const axis =
      markerAxis ??
      tierAxis(side.contacts, metadata.etageidx) ??
      principalAxis(side.contacts);
    let axisDirection: THREE.Vector3 | null = null;
    if (axis) {
      // Extend the shaft well past the proximal marker (like a real lead
      // running toward the burr hole) and slightly past the distal tip.
      const direction = axis[1].clone().sub(axis[0]);
      const contactSpan = direction.length();
      direction.normalize();
      axisDirection = direction;
      const start = axis[0].clone().addScaledVector(direction, -leadRadius);
      const end = axis[1]
        .clone()
        .addScaledVector(direction, Math.max(10, contactSpan * 4));
      const shaft = cylinderBetween(start, end, leadRadius);
      if (shaft) pieces.push(addVertexColor(shaft, leadColor));
    }

    const contactLength = boundedMetadataNumber(
      metadata.contact_length,
      1.5,
      0.3,
      6,
    );
    const axisStart = axis ? axis[0] : null;
    side.contacts.forEach((contactPosition) => {
      const position = new THREE.Vector3(...contactPosition);
      if (axisDirection && axisStart) {
        // Project the contact onto the shaft axis; the radial remainder
        // decides between a full ring and a directional segment plate.
        const along = position.clone().sub(axisStart).dot(axisDirection);
        const levelCenter = axisStart
          .clone()
          .addScaledVector(axisDirection, along);
        const radial = position.clone().sub(levelCenter);
        const plate = contactPlate(
          levelCenter,
          axisDirection,
          radial.length() > RING_RADIAL_THRESHOLD ? radial : null,
          contactRadius,
          contactLength,
        );
        pieces.push(addVertexColor(plate, contactColor));
        return;
      }
      // Without any usable axis, fall back to a small marker sphere.
      const contact = new THREE.SphereGeometry(contactRadius, 16, 12);
      contact.translate(...contactPosition);
      pieces.push(addVertexColor(contact, contactColor));
    });
  });

  if (pieces.length === 0) return null;
  const merged = mergeBufferGeometries(pieces, false);
  pieces.forEach((piece) => piece.dispose());
  if (!merged) return null;
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  merged.userData = {
    ...merged.userData,
    source: 'reconstruction-fallback',
    model: extracted.model,
    contactCount: extracted.sides.reduce(
      (total, side) => total + side.contacts.length,
      0,
    ),
  };
  return merged;
};
