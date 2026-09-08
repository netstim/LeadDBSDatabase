import { steerDirectional, DirectionalAction } from './directionalSteering';
import type { SteeringContext, SteeringState } from './currentSteering';

const tiers = [[1], [2, 3, 4], [5, 6, 7], [8]];
const context: SteeringContext = {
  ipg: 'Boston',
  unit: '%',
  totalAmplitude: 3,
};

const state = (
  negative: Record<string, number>,
  positive: Record<string, number> = { 0: 100 },
): SteeringState => {
  const quantities: Record<string, number> = {};
  const selectedValues: Record<string, string> = {};
  for (let key = 0; key <= 8; key += 1) {
    quantities[key] = negative[key] ?? positive[key] ?? 0;
    selectedValues[key] = 'left';
    if (negative[key] !== undefined) selectedValues[key] = 'center';
    else if (positive[key] !== undefined) selectedValues[key] = 'right';
  }
  return { quantities, selectedValues };
};

const total = (value: SteeringState, polarity: string) =>
  Object.keys(value.quantities).reduce(
    (sum, key) =>
      sum +
      (value.selectedValues[key] === polarity ? value.quantities[key] : 0),
    0,
  );

describe('vector-based directional steering', () => {
  it('up shifts the height by 10% of a level, splitting into the next tier', () => {
    const initial = state({ 1: 100 });
    const result = steerDirectional(initial, context, tiers, 'up');
    expect(result.changed).toBe(true);
    expect(result.quantities[1]).toBeCloseTo(90, 10);
    const nextTier = [2, 3, 4].map((key) => result.quantities[key]);
    expect(nextTier.reduce((sum, value) => sum + value, 0)).toBeCloseTo(10, 10);
    // Ring current has no direction, so the segmented tier splits evenly.
    nextTier.forEach((value) => expect(value).toBeGreaterThanOrEqual(3.3));
    [2, 3, 4].forEach((key) =>
      expect(result.selectedValues[key]).toBe('center'),
    );
    expect(result.quantities[0]).toBe(100);
    expect(result.selectedValues[0]).toBe('right');
    expect(total(result, 'center')).toBeCloseTo(100, 10);
    expect(initial).toEqual(state({ 1: 100 }));
  });

  it('up keeps the radial direction while moving between segmented tiers', () => {
    const result = steerDirectional(
      state({ 2: 20, 3: 80 }),
      context,
      tiers,
      'up',
    );
    // Height 1 -> 1.1: 90% stays on tier 1, 10% moves to tier 2, and both
    // tiers keep the same 20/80 front/left direction.
    expect(result.quantities).toMatchObject({ 2: 18, 3: 72, 5: 2, 6: 8, 7: 0 });
    expect(total(result, 'center')).toBeCloseTo(100, 10);
  });

  it('down moves a directed tier toward a ring without losing the direction', () => {
    const result = steerDirectional(
      state({ 2: 20, 3: 30, 4: 50 }),
      context,
      tiers,
      'down',
    );
    // Height 1 -> 0.9: the ring absorbs 10%, the remaining 90% keeps its
    // 20/30/50 radial distribution.
    expect(result.quantities).toMatchObject({ 1: 10, 2: 18, 3: 27, 4: 45 });
    expect(total(result, 'center')).toBeCloseTo(100, 10);
  });

  it.each([
    ['up', 8],
    ['down', 1],
  ] as const)('clamps %s at the end of the lead with a reason', (action, key) => {
    const initial = state({ [key]: 100 });
    const result = steerDirectional(initial, context, tiers, action);
    expect(result.changed).toBe(false);
    expect(result.reason).toMatch(/most (proximal|distal) level/);
  });

  it('rotates the direction by 10% of a face spacing in either direction', () => {
    const initial = state({ 2: 100 });
    const clockwise = steerDirectional(initial, context, tiers, 'clockwise');
    const counterclockwise = steerDirectional(
      initial,
      context,
      tiers,
      'counterclockwise',
    );
    // 10% of a face spacing off the front face: 90/10 with the neighbor.
    expect(clockwise.quantities).toMatchObject({ 2: 90, 3: 10, 4: 0 });
    expect(counterclockwise.quantities).toMatchObject({ 2: 90, 3: 0, 4: 10 });
    expect(total(clockwise, 'center')).toBeCloseTo(100, 10);
  });

  it('repeated rotations carry the current fully around the lead', () => {
    let current = state({ 2: 100 });
    for (let move = 0; move < 10; move += 1) {
      current = steerDirectional(current, context, tiers, 'clockwise');
      expect(total(current, 'center')).toBeCloseTo(100, 10);
    }
    // Ten 10% turns = one full face spacing: the current lands on face 1.
    expect(current.quantities[3]).toBe(100);
    expect(current.quantities[2]).toBe(0);
  });

  it.each([
    ['level', { 2: 20, 3: 20, 4: 20 }],
    ['forward', { 2: 60, 3: 0, 4: 0 }],
    ['back', { 2: 0, 3: 30, 4: 30 }],
    ['left', { 2: 0, 3: 60, 4: 0 }],
    ['right', { 2: 0, 3: 0, 4: 60 }],
  ] as [DirectionalAction, Record<string, number>][])(
    'applies the %s face preset at constant height',
    (action, expected) => {
      const result = steerDirectional(
        state({ 2: 10, 3: 20, 4: 30 }),
        context,
        tiers,
        action,
      );
      expect(result.quantities).toMatchObject(expected);
      expect(total(result, 'center')).toBeCloseTo(60, 10);
    },
  );

  it('level snaps a spread allocation to its center-of-mass height', () => {
    const result = steerDirectional(
      state({ 2: 25, 3: 25, 8: 50 }),
      context,
      tiers,
      'level',
    );
    // Height (50·1 + 50·3)/100 = 2: everything gathers evenly on tier 2.
    expect(total(result, 'center')).toBeCloseTo(100, 10);
    const tierTwo = [5, 6, 7].map((key) => result.quantities[key]);
    expect(tierTwo.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 10);
    tierTwo.forEach((value) => expect(value).toBeGreaterThanOrEqual(33.3));
    expect(result.quantities[2]).toBe(0);
    expect(result.quantities[8]).toBe(0);
  });

  it('steers opposite polarities independently when destinations are separate', () => {
    const initial = state({ 1: 100 }, { 0: 60, 5: 40 });
    const result = steerDirectional(initial, context, tiers, 'up');
    expect(result.changed).toBe(true);
    expect(result.quantities).toMatchObject({ 0: 60, 1: 90, 5: 36, 8: 4 });
    expect(result.selectedValues[8]).toBe('right');
    expect(total(result, 'center')).toBeCloseTo(100, 10);
    expect(total(result, 'right')).toBeCloseTo(100, 10);
  });

  it('carries a boundary polarity verbatim instead of blocking the move', () => {
    const initial = state({ 2: 100 }, { 0: 60, 8: 40 });
    const result = steerDirectional(initial, context, tiers, 'up');
    expect(result.changed).toBe(true);
    // Anode at the top ring cannot move further; the cathode still steps up.
    expect(result.quantities[8]).toBe(40);
    expect(result.selectedValues[8]).toBe('right');
    expect(total(result, 'center')).toBeCloseTo(100, 10);
  });

  it('rotation leaves ring-only polarities untouched instead of blocking', () => {
    const initial = state({ 2: 100 }, { 0: 60, 8: 40 });
    const result = steerDirectional(initial, context, tiers, 'clockwise');
    expect(result.changed).toBe(true);
    expect(result.quantities[8]).toBe(40);
    expect(result.quantities[2]).toBeCloseTo(90, 10);
  });

  it('blocks the entire action when transport would overwrite the opposite sign', () => {
    const initial = state({ 2: 100 }, { 0: 60, 3: 40 });
    const result = steerDirectional(initial, context, tiers, 'clockwise');
    expect(result.changed).toBe(false);
    expect(result.reason).toMatch(/overlap positive and negative/);
  });

  it('also protects explicitly enabled opposite contacts with zero allocation', () => {
    const initial = state({ 2: 100 }, { 0: 100, 3: 0 });
    const result = steerDirectional(initial, context, tiers, 'clockwise');
    expect(result.changed).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('supports selecting a single polarity without modifying the other', () => {
    const initial = state({ 2: 100 }, { 0: 60, 5: 40 });
    const result = steerDirectional(
      initial,
      context,
      tiers,
      'clockwise',
      'center',
    );
    expect(result.quantities[2]).toBeCloseTo(90, 10);
    expect(result.quantities[3]).toBeCloseTo(10, 10);
    expect(result.quantities[5]).toBe(40);
    expect(result.selectedValues[5]).toBe('right');
  });

  it('preserves displayed mA allocations, including the case and unknown contacts', () => {
    const initial = state({ 2: 0.7 }, { 0: 0.3, 8: 0.4 });
    initial.quantities[99] = 0.25;
    initial.selectedValues[99] = 'center';
    const result = steerDirectional(
      initial,
      { ...context, unit: 'mA' },
      [[0], ...tiers],
      'clockwise',
    );
    expect(result.quantities[2]).toBeCloseTo(0.6, 10);
    expect(result.quantities[3]).toBeCloseTo(0.1, 10);
    expect(result.quantities[0]).toBe(0.3);
    expect(result.quantities[99]).toBe(0.25);
    expect(total(result, 'center')).toBeCloseTo(0.95, 10);
    expect(total(result, 'right')).toBeCloseTo(0.7, 10);
  });

  it('turns emptied contacts off while preserving enabled zero-allocation contacts', () => {
    const initial = state({ 2: 100, 5: 0 });
    const result = steerDirectional(initial, context, tiers, 'left');
    expect(result.selectedValues[2]).toBe('left');
    expect(result.selectedValues[3]).toBe('center');
    expect(result.selectedValues[5]).toBe('center');
  });

  it('returns an explanation for voltage, invalid geometry, invalid values, or no lead allocation', () => {
    const initial = state({ 1: 100 });
    const invalid = state({ 1: Number.NaN });
    [
      steerDirectional(initial, { ...context, unit: 'V' }, tiers, 'up'),
      steerDirectional(initial, context, [[1], [1, 2, 3]], 'up'),
      steerDirectional(invalid, context, tiers, 'up'),
      steerDirectional(state({}), context, tiers, 'up'),
    ].forEach((result) => {
      expect(result.changed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  it('keeps both polarity totals and nonnegative values through repeated moves', () => {
    let current = state({ 2: 0.8, 3: 1.3, 4: 0.9 }, { 0: 2.1, 8: 0.9 });
    const actions: DirectionalAction[] = [
      'up',
      'clockwise',
      'down',
      'counterclockwise',
      'level',
      'left',
      'back',
      'right',
      'forward',
    ];
    for (let move = 0; move < 200; move += 1) {
      current = steerDirectional(
        current,
        { ...context, unit: 'mA' },
        tiers,
        actions[move % actions.length],
      );
      expect(total(current, 'center')).toBeCloseTo(3, 6);
      expect(total(current, 'right')).toBeCloseTo(3, 6);
      expect(current.quantities[0]).toBe(2.1);
      expect(
        Object.values(current.quantities).every(
          (value) => Number.isFinite(value) && value >= 0,
        ),
      ).toBe(true);
    }
  });
});
