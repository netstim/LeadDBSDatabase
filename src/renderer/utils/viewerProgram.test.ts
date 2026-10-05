/** @jest-environment node */

import {
  niftiValuesToViewerProgram,
  normalizeViewerProgram,
  ViewerProgram,
} from './viewerProgram';

const proposal: ViewerProgram = {
  quantities: { 0: 3, 1: 2, 2: 1, 3: 0 },
  selectedValues: { 0: 'right', 1: 'center', 2: 'center', 3: 'left' },
  amplitude: 3,
};

test.each([
  ['Boston', '%', { 0: 100, 1: 200 / 3, 2: 100 / 3, 3: 0 }],
  ['Boston', 'mA', { 0: 3, 1: 2, 2: 1, 3: 0 }],
  ['Medtronic_Percept', 'mA', { 0: 3, 1: 2, 2: 1, 3: 0 }],
] as const)(
  '%s %s viewer proposals balance the case and cathodes',
  (ipg, unit, expected) => {
    const result = normalizeViewerProgram(proposal, {
      ipg,
      unit,
      totalAmplitude: 99,
    });
    Object.entries(expected).forEach(([key, value]) =>
      expect(result.quantities[key]).toBeCloseTo(value),
    );
    expect(result.amplitude).toBe(3);
  },
);

test('Abbott viewer proposals restore equal current sharing', () => {
  const result = normalizeViewerProgram(proposal, {
    ipg: 'Abbott',
    unit: 'mA',
    totalAmplitude: 8,
  });
  expect(result.quantities).toEqual({ 0: 3, 1: 1.5, 2: 1.5, 3: 0 });
});

test('Activa viewer proposals apply the full proposed voltage to every active node', () => {
  const result = normalizeViewerProgram(proposal, {
    ipg: 'Medtronic_Activa',
    unit: 'V',
    totalAmplitude: 8,
  });
  expect(result.quantities).toEqual({ 0: 3, 1: 3, 2: 3, 3: 0 });
});

test('Master viewer proposals retain independent voltages and include the case', () => {
  const result = normalizeViewerProgram(proposal, {
    ipg: 'Research',
    unit: 'V',
    totalAmplitude: 8,
  });
  expect(result.quantities).toEqual({ 0: 3, 1: 2, 2: 1, 3: 0 });
});

test('short NIfTI optimizer output cannot activate missing electrode contacts', () => {
  const state = {
    quantities: { 0: 4, 1: 4, 2: 4, 3: 4 },
    selectedValues: {
      0: 'right',
      1: 'center',
      2: 'center',
      3: 'center',
    },
  };
  const values = [1];
  const result = niftiValuesToViewerProgram(values, state, 'mA');
  expect(result).toEqual({
    amplitude: 1,
    quantities: { 0: 1, 1: 1, 2: 0, 3: 0 },
    selectedValues: { 0: 'right', 1: 'center', 2: 'left', 3: 'left' },
  });
  expect(values).toEqual([1]);
});

test('NIfTI percentage conversion rejects invalid and sub-threshold entries', () => {
  const result = niftiValuesToViewerProgram(
    { 0: 0.1, 1: 1, 2: Number.NaN, 3: 3 },
    {
      quantities: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 },
      selectedValues: {
        0: 'left',
        1: 'left',
        2: 'left',
        3: 'left',
        4: 'left',
      },
    },
    '%',
  );
  expect(result.amplitude).toBe(4);
  expect(result.quantities).toEqual({ 0: 4, 1: 0, 2: 25, 3: 0, 4: 75 });
});
