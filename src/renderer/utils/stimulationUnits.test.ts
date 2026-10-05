/** @jest-environment node */

import {
  changeStimulationIPG,
  exportSteeringQuantities,
  importedIPG,
  importSteeringSource,
  writeSteeringMetadata,
} from './stimulationUnits';

const currentSource = {
  amp: 4,
  va: 2,
  case: { pol: 2, perc: 100 },
  k1: { pol: 1, perc: 25 },
  k2: { pol: 1, perc: 75 },
  k3: { pol: 0, perc: 99 },
};

test.each(['Medtronic_Percept', 'Medtronic_Activa', 'Abbott'])(
  '%s imports contact and case percentages into its canonical mA distribution',
  (ipg) => {
    const source = importSteeringSource({ Ls1: currentSource }, 1, ipg);
    expect(source.unit).toBe('mA');
    const expectedQuantities =
      ipg === 'Abbott'
        ? { 0: 4, 1: 2, 2: 2, 3: 0 }
        : { 0: 4, 1: 1, 2: 3, 3: 0 };
    const expectedPercentages =
      ipg === 'Abbott'
        ? { 1: { 0: 100, 1: 50, 2: 50, 3: 0 } }
        : { 1: { 0: 100, 1: 25, 2: 75, 3: 0 } };
    expect(source.quantities).toEqual(expectedQuantities);
    expect(
      exportSteeringQuantities(
        { 1: source.quantities },
        { 1: 4 },
        { 1: source.unit },
        { 1: source.selectedValues },
        ipg,
      ),
    ).toEqual(expectedPercentages);
  },
);

test('Boston defaults to percentages and preserves a saved mA display preference', () => {
  const stimulation = { Rs3: currentSource, programmerUnits: { Rs3: 'mA' } };
  expect(
    importSteeringSource({ Rs3: currentSource }, 7, 'Boston').quantities[1],
  ).toBe(25);
  const imported = importSteeringSource(stimulation, 7, 'Boston');
  expect(imported.unit).toBe('mA');
  expect(imported.quantities[1]).toBe(1);
});

test('imports normalize each active polarity to its complete canonical budget', () => {
  const malformed = {
    amp: 4,
    va: 2,
    case: { pol: 2, perc: 90 },
    k1: { pol: 1, perc: 20 },
    k2: { pol: 1, perc: 70 },
  };
  const percent = importSteeringSource({ Ls1: malformed }, 1, 'Boston');
  expect(percent.quantities[0]).toBe(100);
  expect(percent.quantities[1]).toBeCloseTo(100 * (20 / 90));
  expect(percent.quantities[2]).toBeCloseTo(100 * (70 / 90));
  expect(percent.quantities[1] + percent.quantities[2]).toBeCloseTo(100);

  const current = importSteeringSource(
    { Ls1: malformed },
    1,
    'Medtronic_Percept',
  );
  expect(current.quantities[0]).toBe(4);
  expect(current.quantities[1] + current.quantities[2]).toBeCloseTo(4);
});

test('Abbott imports reapply equal sharing per polarity', () => {
  const imported = importSteeringSource(
    {
      Ls1: {
        ...currentSource,
        k1: { pol: 1, perc: 20 },
        k2: { pol: 1, perc: 70 },
      },
    },
    1,
    'Abbott',
  );

  expect(imported.quantities).toEqual({ 0: 4, 1: 2, 2: 2, 3: 0 });
});

test('unvisited sources are exported when the legacy unit map is empty', () => {
  expect(
    exportSteeringQuantities(
      { 2: { 0: 4, 1: 4 }, 8: { 0: 2, 1: 2 } },
      { 2: 4, 8: 2 },
      {},
      { 2: { 0: 'right', 1: 'center' }, 8: { 0: 'right', 1: 'center' } },
      'Medtronic_Percept',
    ),
  ).toEqual({
    2: { 0: 100, 1: 100 },
    8: { 0: 100, 1: 100 },
  });
});

test('Activa voltage imports full source voltage on every active contact', () => {
  const source = importSteeringSource(
    { Ls1: { ...currentSource, va: 1 } },
    1,
    'Medtronic_Activa',
  );
  expect(source.unit).toBe('V');
  expect(source.quantities).toEqual({ 0: 4, 1: 4, 2: 4, 3: 0 });
});

test('IPG inference respects the serialized Research/Master identifier and does not label unknown voltage electrodes Activa', () => {
  expect(importedIPG({ ipg: 'Research', Ls1: { va: 1 } }, 'Boston')).toBe(
    'Research',
  );
  expect(importedIPG({ Ls1: { va: 1 } }, 'Research')).toBe('Research');
  expect(importedIPG({ Ls1: { va: 1 } }, 'Medtronic_Percept')).toBe(
    'Medtronic_Activa',
  );
  expect(importedIPG({ ipg: 'invalid' }, 'Abbott')).toBe('Abbott');
});

test('Master voltage metadata preserves contact values and rejects an externally changed source amplitude', () => {
  const stimulation: any = { Ls1: { ...currentSource, va: 1 } };
  writeSteeringMetadata(
    stimulation,
    'Research',
    { 1: { 0: 4, 1: 1, 2: 2, 3: 0 } },
    { 1: 4 },
    { 1: 'V' },
  );
  expect(stimulation.programmerVoltageQuantities.Ls1.quantities).toEqual({
    case: 4,
    k1: 1,
    k2: 2,
    k3: 0,
  });
  expect(importSteeringSource(stimulation, 1, 'Research').quantities).toEqual({
    0: 4,
    1: 1,
    2: 2,
    3: 0,
  });
  stimulation.Ls1.amp = 5;
  expect(importSteeringSource(stimulation, 1, 'Research').quantities[1]).toBe(
    5,
  );
});

test('Master voltage import remains compatible with legacy numeric snapshot keys', () => {
  const stimulation = {
    ipg: 'Research',
    programmerUnits: { Ls1: 'V' },
    programmerVoltageQuantities: {
      Ls1: {
        amplitude: 4,
        quantities: { 0: 4, 1: 1, 2: 2, 3: 0 },
        polarities: { case: 2, k1: 1, k2: 1, k3: 0 },
      },
    },
    Ls1: { ...currentSource, va: 1 },
  };

  expect(importSteeringSource(stimulation, 1, 'Research').quantities).toEqual({
    0: 4,
    1: 1,
    2: 2,
    3: 0,
  });
});

test('Master voltage import rejects an incomplete or over-amplitude snapshot', () => {
  const stimulation: any = {
    ipg: 'Research',
    programmerUnits: { Ls1: 'V' },
    programmerVoltageQuantities: {
      Ls1: {
        amplitude: 4,
        quantities: { case: 4, k1: 1, k2: 5 },
        polarities: { case: 2, k1: 1, k2: 1, k3: 0 },
      },
    },
    Ls1: { ...currentSource, va: 1 },
  };

  expect(importSteeringSource(stimulation, 1, 'Research').quantities).toEqual({
    0: 4,
    1: 4,
    2: 4,
    3: 0,
  });
});

test('Master voltage import rejects a snapshot with a missing off-contact polarity', () => {
  const stimulation: any = {
    ipg: 'Research',
    programmerUnits: { Ls1: 'V' },
    programmerVoltageQuantities: {
      Ls1: {
        amplitude: 4,
        quantities: { case: 4, k1: 1, k2: 2, k3: 0 },
        polarities: { case: 2, k1: 1, k2: 1 },
      },
    },
    Ls1: { ...currentSource, va: 1 },
  };

  expect(importSteeringSource(stimulation, 1, 'Research').quantities).toEqual({
    0: 4,
    1: 4,
    2: 4,
    3: 0,
  });
});

test('Master voltage import rejects coercible nonnumeric snapshot fields', () => {
  const makeStimulation = (): any => ({
    ipg: 'Research',
    programmerUnits: { Ls1: 'V' },
    programmerVoltageQuantities: {
      Ls1: {
        amplitude: 4,
        quantities: { case: 4, k1: 1, k2: 2, k3: 0 },
        polarities: { case: 2, k1: 1, k2: 1, k3: 0 },
      },
    },
    Ls1: {
      amp: 4,
      va: 1,
      case: { pol: 2, perc: 100 },
      k1: { pol: 1, perc: 25 },
      k2: { pol: 1, perc: 75 },
      k3: { pol: 0, perc: 0 },
    },
  });
  const malformed = [
    (stimulation: any) => {
      stimulation.programmerVoltageQuantities.Ls1.amplitude = '4';
    },
    (stimulation: any) => {
      stimulation.programmerVoltageQuantities.Ls1.quantities.k1 = '1';
    },
    (stimulation: any) => {
      stimulation.programmerVoltageQuantities.Ls1.polarities.k3 = '0';
    },
    (stimulation: any) => {
      stimulation.Ls1.k3.pol = '0';
    },
    (stimulation: any) => {
      stimulation.Ls1.amp = '4';
    },
    (stimulation: any) => {
      stimulation.Ls1.va = '1';
    },
  ];

  malformed.forEach((mutate) => {
    const stimulation = makeStimulation();
    mutate(stimulation);
    expect(importSteeringSource(stimulation, 1, 'Research').quantities).toEqual(
      { 0: 4, 1: 4, 2: 4, 3: 0 },
    );
  });
});

test('changing IPG converts hidden sources and both hemispheres, including the case', () => {
  const contacts = { 0: 100, 1: 25, 2: 75 };
  const selected = { 0: 'right', 1: 'center', 2: 'center' };
  const result = changeStimulationIPG(
    'Boston',
    'Medtronic_Percept',
    { 1: contacts, 4: contacts, 5: contacts, 8: contacts },
    { 1: selected, 4: selected, 5: selected, 8: selected },
    { 1: 2, 4: 4, 5: 6, 8: 8 },
    {},
    {},
    {},
  );
  expect(result.units).toEqual({ 1: 'mA', 4: 'mA', 5: 'mA', 8: 'mA' });
  expect(result.quantities[4]).toEqual({ 0: 4, 1: 1, 2: 3 });
  expect(result.quantities[8]).toEqual({ 0: 8, 1: 2, 2: 6 });
  expect(contacts).toEqual({ 0: 100, 1: 25, 2: 75 });
});

test('switching compatible hardware normalizes malformed pools while preserving their proportions', () => {
  const result = changeStimulationIPG(
    'Boston',
    'Research',
    { 1: { 0: 100, 1: 20, 2: 70 } },
    { 1: { 0: 'right', 1: 'center', 2: 'center' } },
    { 1: 4 },
    { 1: '%' },
    {},
    {},
  );
  expect(result.quantities[1][0]).toBe(100);
  expect(result.quantities[1][1]).toBeCloseTo(100 * (20 / 90));
  expect(result.quantities[1][2]).toBeCloseTo(100 * (70 / 90));
});

test('invalid imported and zero-amplitude values do not become NaN or infinity', () => {
  const imported = importSteeringSource(
    { Ls1: { ...currentSource, amp: 'invalid' } },
    1,
    'Abbott',
  );
  expect(imported.totalAmplitude).toBe(0);
  expect(imported.quantities[1]).toBe(0);
  expect(
    exportSteeringQuantities(
      { 1: { 0: 0, 1: 'invalid' } },
      { 1: 0 },
      { 1: 'mA' },
      { 1: { 0: 'right', 1: 'center' } },
      'Abbott',
    ),
  ).toEqual({ 1: { 0: 0, 1: 0 } });
});
