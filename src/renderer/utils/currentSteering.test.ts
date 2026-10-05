/** @jest-environment node */

import {
  balanceSteering,
  changeContactPolarity,
  changeContactQuantity,
  changeSteeringAmplitude,
  changeSteeringUnit,
  getSteeringUnit,
  SteeringContext,
  SteeringState,
} from './currentSteering';

const percent: SteeringContext = {
  ipg: 'Boston',
  unit: '%',
  totalAmplitude: 4,
};
const milliamps: SteeringContext = {
  ipg: 'Medtronic_Percept',
  unit: 'mA',
  totalAmplitude: 4,
};

function makeState(contacts: Record<string, [string, number]>): SteeringState {
  return {
    quantities: Object.fromEntries(
      Object.entries(contacts).map(([key, [, quantity]]) => [key, quantity]),
    ),
    selectedValues: Object.fromEntries(
      Object.entries(contacts).map(([key, [polarity]]) => [key, polarity]),
    ),
  };
}

function expectBudget(state: SteeringState, budget: number): void {
  ['center', 'right'].forEach((polarity) => {
    const keys = Object.keys(state.selectedValues).filter(
      (key) => state.selectedValues[key] === polarity,
    );
    if (keys.length) {
      expect(
        keys.reduce((sum, key) => sum + state.quantities[key], 0),
      ).toBeCloseTo(budget, 10);
    }
  });
  Object.entries(state.quantities).forEach(([key, quantity]) => {
    expect(Number.isFinite(quantity)).toBe(true);
    expect(quantity).toBeGreaterThanOrEqual(0);
    if (state.selectedValues[key] === 'left') expect(quantity).toBe(0);
  });
}

describe('device unit selection', () => {
  test.each([
    ['Boston', '%'],
    ['Medtronic_Percept', 'mA'],
    ['Medtronic_Activa', 'mA'],
    ['Abbott', 'mA'],
    ['Research', '%'],
    ['Master', '%'],
    ['unknown', 'mA'],
  ])('%s has a supported default', (ipg, unit) => {
    expect(getSteeringUnit(ipg)).toBe(unit);
  });

  test('supported saved units take priority over stale secondary toggles', () => {
    expect(getSteeringUnit('Boston', 'left', 'left', 'mA')).toBe('mA');
    expect(getSteeringUnit('Medtronic_Activa', 'left', 'left', 'V')).toBe('V');
    expect(getSteeringUnit('Research', 'left', 'left', 'V')).toBe('V');
    expect(getSteeringUnit('Master', 'left', 'left', 'mA')).toBe('mA');
  });

  test('unsupported saved units fall back to device-specific controls', () => {
    expect(getSteeringUnit('Boston', 'left', 'right', 'V')).toBe('%');
    expect(getSteeringUnit('Medtronic_Activa', 'left', 'right', '%')).toBe('V');
    expect(getSteeringUnit('Medtronic_Percept', 'left', 'right', '%')).toBe(
      'mA',
    );
    expect(getSteeringUnit('Abbott', 'left', 'right', 'V')).toBe('mA');
    expect(getSteeringUnit('Research', 'right')).toBe('V');
  });
});

describe('polarity changes treat the case and contacts uniformly', () => {
  test.each(['0', '1'])(
    'first contact %s receives the full budget on either side',
    (key) => {
      ['center', 'right'].forEach((polarity) => {
        const off = makeState({ [key]: ['left', 0] });
        const next = changeContactPolarity(off, percent, key, polarity);
        expect(next.quantities[key]).toBe(100);
        expect(next.selectedValues[key]).toBe(polarity);
        expect(off.quantities[key]).toBe(0);
        expect(
          changeContactPolarity(off, milliamps, key, polarity).quantities[key],
        ).toBe(4);
      });
    },
  );

  test('both polarities have their own budget, including a negative case', () => {
    let next = changeContactPolarity(makeState({}), percent, '0', 'center');
    next = changeContactPolarity(next, percent, '1', 'right');
    expect(next.quantities).toEqual({ 0: 100, 1: 100 });
    expectBudget(next, 100);
  });

  test('adding a peer preserves existing shares and starts the new contact at zero', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 70],
      2: ['center', 30],
      3: ['left', 0],
    });
    const next = changeContactPolarity(state, percent, '3', 'center');
    expect(next.quantities).toEqual({ 0: 100, 1: 70, 2: 30, 3: 0 });
    expectBudget(next, 100);
  });

  test('selecting the existing polarity preserves manually chosen shares', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 70],
      2: ['center', 30],
    });
    expect(changeContactPolarity(state, percent, 1, 'center')).toEqual(state);
  });

  test('deactivation gives a surviving lone case or contact the full budget', () => {
    const state = makeState({
      0: ['center', 70],
      1: ['center', 30],
      2: ['right', 100],
    });
    expect(changeContactPolarity(state, percent, 1, 'left').quantities).toEqual(
      {
        0: 100,
        1: 0,
        2: 100,
      },
    );
    expect(changeContactPolarity(state, percent, 0, 'left').quantities).toEqual(
      {
        0: 0,
        1: 100,
        2: 100,
      },
    );
  });

  test('moving polarity carries the share and balances both affected sides', () => {
    const state = makeState({
      0: ['right', 60],
      1: ['center', 30],
      2: ['center', 70],
      3: ['right', 40],
    });
    const next = changeContactPolarity(state, percent, 1, 'right');
    expect(next.quantities[0]).toBeCloseTo(42, 10);
    expect(next.quantities[1]).toBe(30);
    expect(next.quantities[2]).toBe(100);
    expect(next.quantities[3]).toBeCloseTo(28, 10);
    expectBudget(next, 100);
  });

  test('switching a sole contact to an empty polarity assigns its full budget', () => {
    const next = changeContactPolarity(
      makeState({ 0: ['right', 100] }),
      percent,
      0,
      'center',
    );
    expect(next).toEqual(makeState({ 0: ['center', 100] }));
  });
});

describe('manual current distributions', () => {
  test('editing 50/50 to 70 adjusts the peer to 30 and leaves the opposite sign alone', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 50],
      2: ['center', 50],
    });
    const next = changeContactQuantity(state, percent, 1, 70);
    expect(next.quantities).toEqual({ 0: 100, 1: 70, 2: 30 });
    expect(state.quantities[1]).toBe(50);
  });

  test('editing the case redistributes positive peers by their prior proportions', () => {
    const state = makeState({
      0: ['right', 50],
      1: ['right', 30],
      2: ['right', 20],
      3: ['center', 100],
    });
    const next = changeContactQuantity(state, percent, 0, 75);
    expect(next.quantities[0]).toBe(75);
    expect(next.quantities[1]).toBeCloseTo(15, 10);
    expect(next.quantities[2]).toBeCloseTo(10, 10);
    expect(next.quantities[3]).toBe(100);
  });

  test('all-zero peers share the remaining current equally', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 4],
      2: ['center', 0],
      3: ['center', 0],
    });
    const next = changeContactQuantity(state, milliamps, 1, 1);
    expect(next.quantities).toEqual({ 0: 4, 1: 1, 2: 1.5, 3: 1.5 });
    expectBudget(next, 4);
  });

  test.each([0, 2, 20, -1, Number.NaN])(
    'a lone active contact keeps the budget when edited to %s',
    (value) => {
      const next = changeContactQuantity(
        makeState({ 0: ['right', 4], 1: ['center', 4] }),
        milliamps,
        1,
        value,
      );
      expect(next.quantities).toEqual({ 0: 4, 1: 4 });
    },
  );

  test('out-of-range and invalid quantities stay finite and inside the budget', () => {
    const state = makeState({ 1: ['center', 50], 2: ['center', 50] });
    expect(changeContactQuantity(state, percent, 1, 400).quantities).toEqual({
      1: 100,
      2: 0,
    });
    [-1, Number.NaN, Number.POSITIVE_INFINITY].forEach((value) => {
      expect(
        changeContactQuantity(state, percent, 1, value).quantities,
      ).toEqual({ 1: 0, 2: 100 });
    });
    expect(
      changeContactQuantity(makeState({ 1: ['left', 0] }), percent, 1, 20)
        .quantities[1],
    ).toBe(0);
  });

  test('an edit can atomically activate a contact and set its share', () => {
    const next = changeContactQuantity(
      makeState({ 1: ['center', 100], 2: ['left', 0] }),
      percent,
      2,
      40,
      'center',
    );
    expect(next).toEqual(makeState({ 1: ['center', 60], 2: ['center', 40] }));
  });
});

describe('amplitude, balancing, and mode conversion', () => {
  test('amplitude changes retain independent distributions on both signs', () => {
    const state = makeState({
      0: ['right', 3],
      1: ['right', 1],
      2: ['center', 1],
      3: ['center', 3],
    });
    const next = changeSteeringAmplitude(state, milliamps, 6);
    expect(next.quantities).toEqual({ 0: 4.5, 1: 1.5, 2: 1.5, 3: 4.5 });
    expectBudget(next, 6);
  });

  test('percentage shares survive source amplitude changes', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 70],
      2: ['center', 30],
    });
    expect(changeSteeringAmplitude(state, percent, 9)).toEqual(state);
  });

  test('zero amplitude produces zero current and recovers an equal distribution', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 3],
      2: ['center', 1],
    });
    const zero = changeSteeringAmplitude(state, milliamps, 0);
    expect(zero.quantities).toEqual({ 0: 0, 1: 0, 2: 0 });
    expect(
      changeSteeringAmplitude(zero, { ...milliamps, totalAmplitude: 0 }, 4)
        .quantities,
    ).toEqual({ 0: 4, 1: 2, 2: 2 });
    expectBudget(zero, 0);
  });

  test('Split Even balances each sign, includes the case, and clears off contacts', () => {
    const state = makeState({
      0: ['right', 90],
      1: ['right', 10],
      2: ['center', 100],
      3: ['center', 0],
      4: ['left', 99],
    });
    expect(balanceSteering(state, percent, 'equal').quantities).toEqual({
      0: 50,
      1: 50,
      2: 50,
      3: 50,
      4: 0,
    });
  });

  test('rounding residuals never activate zero-share contacts', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 1],
      2: ['center', 1],
      3: ['center', 1],
      4: ['center', 0],
    });
    let next = balanceSteering(state, percent);
    for (let index = 0; index < 50; index += 1) {
      next = changeContactQuantity(next, percent, 2, 33.3 + (index % 2) / 10);
      expectBudget(next, 100);
      expect(next.quantities[4]).toBe(0);
    }
  });

  test('malformed imports and extremely small currents stay finite', () => {
    const malformed = makeState({
      0: ['right', Number.NaN],
      1: ['center', Number.MAX_VALUE],
      2: ['center', Number.MAX_VALUE],
      3: ['invalid', 100],
    });
    const next = balanceSteering(malformed, milliamps);
    expect(next.quantities).toEqual({ 0: 4, 1: 2, 2: 2, 3: 0 });
    const tiny = changeSteeringAmplitude(next, milliamps, 1e-12);
    expect(tiny.quantities[1]).toBe(5e-13);
    expectBudget(tiny, 1e-12);
  });

  test('percent and mA round trips preserve both signs and the case distribution', () => {
    const state = makeState({
      0: ['right', 75],
      1: ['right', 25],
      2: ['center', 70],
      3: ['center', 30],
    });
    const current = changeSteeringUnit(state, percent, 'mA');
    expect(current.quantities[0]).toBe(3);
    expect(current.quantities[2]).toBeCloseTo(2.8);
    const restored = changeSteeringUnit(
      current,
      { ...percent, unit: 'mA' },
      '%',
    );
    Object.keys(state.quantities).forEach((key) =>
      expect(restored.quantities[key]).toBeCloseTo(state.quantities[key], 10),
    );
    expectBudget(restored, 100);
  });

  test('zero-current to percentage conversion falls back to equal shares per sign', () => {
    const state = makeState({
      0: ['right', 0],
      1: ['center', 0],
      2: ['center', 0],
    });
    expect(
      changeSteeringUnit(
        state,
        { ...percent, unit: 'mA', totalAmplitude: 0 },
        '%',
      ).quantities,
    ).toEqual({ 0: 100, 1: 50, 2: 50 });
  });

  test('device switching accepts the previous unsupported unit and converts to the new supported one', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 70],
      2: ['center', 30],
    });
    const next = changeSteeringUnit(state, { ...milliamps, unit: '%' }, '%');
    expect(next.quantities[0]).toBe(4);
    expect(next.quantities[1]).toBeCloseTo(2.8);
    expectBudget(next, 4);
  });
});

describe('retained device-specific rules', () => {
  const abbott: SteeringContext = { ...milliamps, ipg: 'Abbott' };
  const activaVoltage: SteeringContext = {
    ...milliamps,
    ipg: 'Medtronic_Activa',
    unit: 'V',
  };
  const masterVoltage: SteeringContext = {
    ...milliamps,
    ipg: 'Research',
    unit: 'V',
  };

  test('Abbott shares equally on topology changes, including case polarity changes', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 4],
      2: ['left', 0],
    });
    const added = changeContactPolarity(state, abbott, 2, 'center');
    expect(added.quantities).toEqual({ 0: 4, 1: 2, 2: 2 });
    expect(
      changeContactPolarity(added, abbott, 0, 'center').quantities[0],
    ).toBeCloseTo(4 / 3);
    expectBudget(added, 4);
  });

  test('Abbott permits manual shares but amplitude changes reapply equal sharing', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 2],
      2: ['center', 2],
    });
    const edited = changeContactQuantity(state, abbott, 1, 3);
    expect(edited.quantities).toEqual({ 0: 4, 1: 3, 2: 1 });
    expect(changeContactPolarity(edited, abbott, 1, 'center')).toEqual(edited);
    expect(changeSteeringAmplitude(edited, abbott, 6).quantities).toEqual({
      0: 6,
      1: 3,
      2: 3,
    });
  });

  test('Abbott OFF-to-typed activation applies equal sharing before later manual edits', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 4],
      2: ['left', 0],
    });
    const activated = changeContactQuantity(state, abbott, 2, 3, 'center');
    expect(activated.quantities).toEqual({ 0: 4, 1: 2, 2: 2 });
    expect(changeContactQuantity(activated, abbott, 2, 3).quantities).toEqual({
      0: 4,
      1: 1,
      2: 3,
    });
  });

  test('switching to Abbott reapplies its equal-sharing device rule', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 70],
      2: ['center', 30],
    });
    expect(
      changeSteeringUnit(state, { ...abbott, unit: '%' }, 'mA').quantities,
    ).toEqual({ 0: 4, 1: 2, 2: 2 });
  });

  test('Activa voltage applies full source voltage to every active contact and case', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 1],
      2: ['center', 3],
      3: ['left', 1],
    });
    const next = balanceSteering(state, activaVoltage);
    expect(next.quantities).toEqual({ 0: 4, 1: 4, 2: 4, 3: 0 });
    expect(changeContactQuantity(next, activaVoltage, 1, 1).quantities[1]).toBe(
      4,
    );
    expect(changeSteeringAmplitude(next, activaVoltage, 2).quantities).toEqual({
      0: 2,
      1: 2,
      2: 2,
      3: 0,
    });
    expect(
      changeContactPolarity(next, activaVoltage, 2, 'left').quantities,
    ).toEqual({ 0: 4, 1: 4, 2: 0, 3: 0 });
  });

  test('switching Activa voltage to current splits each polarity while returning restores full voltage', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 4],
      2: ['center', 4],
    });
    const current = changeSteeringUnit(state, activaVoltage, 'mA');
    expect(current.quantities).toEqual({ 0: 4, 1: 2, 2: 2 });
    expect(
      changeSteeringUnit(current, { ...activaVoltage, unit: 'mA' }, 'V'),
    ).toEqual(state);
  });

  test('Research/Master voltage edits are independent and amplitude changes scale them', () => {
    const state = makeState({
      0: ['right', 4],
      1: ['center', 3],
      2: ['center', 2],
    });
    const edited = changeContactQuantity(state, masterVoltage, 1, 1);
    expect(edited.quantities).toEqual({ 0: 4, 1: 1, 2: 2 });
    expect(
      changeSteeringAmplitude(edited, masterVoltage, 8).quantities,
    ).toEqual({ 0: 8, 1: 2, 2: 4 });
    expect(
      changeContactQuantity(edited, masterVoltage, 1, 100).quantities,
    ).toEqual({ 0: 4, 1: 4, 2: 2 });
    expect(
      changeContactPolarity(edited, masterVoltage, 1, 'left').quantities,
    ).toEqual({ 0: 4, 1: 0, 2: 2 });
  });

  test('Master voltage activation and recovery from zero initialize each active contact', () => {
    const context = { ...masterVoltage, ipg: 'Master' };
    const initial = makeState({ 0: ['right', 4], 1: ['left', 0] });
    const active = changeContactPolarity(initial, context, 1, 'center');
    expect(active.quantities).toEqual({ 0: 4, 1: 4 });
    const zero = changeSteeringAmplitude(active, context, 0);
    expect(
      changeSteeringAmplitude(zero, { ...context, totalAmplitude: 0 }, 2)
        .quantities,
    ).toEqual({ 0: 2, 1: 2 });
  });

  test('Research percent-to-voltage scales shares, and independent voltages normalize when returning to current', () => {
    const state = makeState({
      0: ['right', 100],
      1: ['center', 75],
      2: ['center', 25],
    });
    const voltage = changeSteeringUnit(
      state,
      { ...percent, ipg: 'Research' },
      'V',
    );
    expect(voltage.quantities).toEqual({ 0: 4, 1: 3, 2: 1 });
    const edited = changeContactQuantity(voltage, masterVoltage, 2, 3);
    const current = changeSteeringUnit(edited, masterVoltage, 'mA');
    expect(current.quantities).toEqual({ 0: 4, 1: 2, 2: 2 });
  });
});
