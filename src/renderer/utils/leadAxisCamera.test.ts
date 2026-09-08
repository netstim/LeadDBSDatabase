/** @jest-environment node */

import { createLeadAxisCameraPose } from './leadAxisCamera';

const subtract = (left: number[], right: number[]) =>
  left.map((value, index) => value - right[index]);

const dot = (left: number[], right: number[]) =>
  left.reduce((sum, value, index) => sum + value * right[index], 0);

const length = (value: number[]) => Math.sqrt(dot(value, value));

const normalized = (value: number[]) =>
  value.map((component) => component / length(value));

test('looks exactly from tail toward head for an arbitrarily oriented lead', () => {
  const pose = createLeadAxisCameraPose({
    head: [4, -3, 2],
    tail: [10, 5, 14],
    contacts: [
      [4, -3, 2],
      [7, 1, 8],
      [10, 5, 14],
    ],
  });

  expect(pose).not.toBeNull();
  const shaftDirection = normalized([6, 8, 12]);
  const viewDirection = normalized(
    subtract(pose!.target, pose!.position),
  );
  viewDirection.forEach((component, index) =>
    expect(component).toBeCloseTo(-shaftDirection[index], 12),
  );
  expect(dot(pose!.up, shaftDirection)).toBeCloseTo(0, 12);
  expect(length(pose!.up)).toBeCloseTo(1, 12);
});

test('uses a stable finite up vector for a vertical lead', () => {
  const pose = createLeadAxisCameraPose({
    head: [0, 0, 0],
    tail: [0, 0, 20],
  });

  expect(pose).toMatchObject({
    axis: [0, 0, 1],
    target: [0, 0, 0],
    up: [0, 1, 0],
  });
  expect(pose!.position).toEqual([0, 0, 50]);
  expect(pose!.position.every(Number.isFinite)).toBe(true);
});

test('infers the shaft from directional contact tiers when markers degenerate', () => {
  const pose = createLeadAxisCameraPose({
    head: [0, 0, 0],
    tail: [0, 0, 0],
    contacts: [
      [1, 0, 0],
      [-0.5, 0.866, 0],
      [-0.5, -0.866, 0],
      [1, 0, 10],
      [-0.5, 0.866, 10],
      [-0.5, -0.866, 10],
    ],
  });

  expect(pose).not.toBeNull();
  expect(Math.abs(pose!.axis[0])).toBeLessThan(0.001);
  expect(Math.abs(pose!.axis[1])).toBeLessThan(0.001);
  expect(pose!.axis[2]).toBeCloseTo(1, 4);
});

test('falls back deterministically for coincident coordinates', () => {
  const pose = createLeadAxisCameraPose({
    head: [1, 2, 3],
    tail: [1, 2, 3],
    contacts: [[1, 2, 3]],
  });

  expect(pose).toMatchObject({
    axis: [0, 0, 1],
    target: [1, 2, 3],
    up: [0, 1, 0],
  });
  expect(pose!.position).toEqual([1, 2, 28]);
});

test('computes predictable orthographic framing and ignores malformed contacts', () => {
  const pose = createLeadAxisCameraPose({
    head: [0, 0, 0],
    tail: [0, 0, 10],
    contacts: [
      [3, 0, 2],
      [-3, 0, 4],
      ['bad', 0, 6],
    ],
    aspect: 2,
    padding: 2,
    minimumVisibleHeight: 2,
    baseFrustumHeight: 40,
  });

  expect(pose).not.toBeNull();
  expect(pose!.visibleHeight).toBeCloseTo(6);
  expect(pose!.visibleWidth).toBeCloseTo(12);
  expect(pose!.zoom).toBeCloseTo(40 / 6);
});

test('returns null when no finite coordinate can anchor the view', () => {
  expect(
    createLeadAxisCameraPose({
      head: [Number.NaN, 0, 0],
      contacts: [['not', 'coordinates']],
    }),
  ).toBeNull();
});
