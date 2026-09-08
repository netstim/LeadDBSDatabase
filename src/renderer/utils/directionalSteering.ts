import type { SteeringContext, SteeringState } from './currentSteering';

export type DirectionalAction =
  | 'up'
  | 'down'
  | 'clockwise'
  | 'counterclockwise'
  | 'level'
  | 'forward'
  | 'back'
  | 'left'
  | 'right';

export interface DirectionalSteeringResult extends SteeringState {
  changed: boolean;
  reason?: string;
}

type Polarity = 'center' | 'right';

/** Fraction of one level (or one face spacing) moved per click. */
const STEP = 0.1;
const POLARITIES: Polarity[] = ['center', 'right'];
const EPSILON = 1e-9;
const FACES = 3; // Directional segments sit 120° apart.

/**
 * A polarity's allocation summarized as a steering vector:
 * - height: continuous level position along the shaft (0 = most distal tier),
 *   the level-weighted center of mass of the allocation;
 * - facePosition: continuous radial position in face units on the 3-face
 *   circle (0 = front, 1 = left, 2 = right), so 0.5 points between faces;
 * - directedness: 0 = ring-like (even split around the lead), 1 = fully
 *   directed at facePosition.
 * The radial parametrization is exact and invertible: any per-face profile
 * decomposes uniquely into an even part (1 - r)/3 and a directed part r spread
 * between the two faces adjacent to facePosition.
 */
interface SteeringVector {
  height: number;
  facePosition: number;
  directedness: number;
  total: number;
}

const wrapFace = (position: number): number =>
  ((position % FACES) + FACES) % FACES;

/** Per-face radial weights for a direction: even floor plus a tent between
 * the two adjacent faces. Always non-negative and sums to exactly 1. */
const faceWeights = (facePosition: number, directedness: number): number[] => {
  const wrapped = wrapFace(facePosition);
  const lower = Math.floor(wrapped) % FACES;
  const fraction = wrapped - Math.floor(wrapped);
  const weights = Array.from({ length: FACES }, () => (1 - directedness) / FACES);
  weights[lower] += directedness * (1 - fraction);
  weights[(lower + 1) % FACES] += directedness * fraction;
  return weights;
};

const readVector = (
  leadTiers: number[][],
  quantityOf: (key: number) => number,
): SteeringVector => {
  let total = 0;
  let heightSum = 0;
  let segmentedTotal = 0;
  const faceTotals = Array.from({ length: FACES }, () => 0);

  leadTiers.forEach((tier, tierIndex) => {
    tier.forEach((key, faceIndex) => {
      const quantity = quantityOf(key);
      if (quantity <= 0) return;
      total += quantity;
      heightSum += quantity * tierIndex;
      if (tier.length > 1 && faceIndex < FACES) {
        segmentedTotal += quantity;
        faceTotals[faceIndex] += quantity;
      }
    });
  });

  let facePosition = 0;
  let directedness = 0;
  if (segmentedTotal > EPSILON) {
    const profile = faceTotals.map((value) => value / segmentedTotal);
    const minimum = Math.min(...profile);
    directedness = Math.max(0, 1 - FACES * minimum);
    if (directedness > EPSILON) {
      // After removing the even floor, at most two adjacent faces remain.
      const residual = profile.map((value) => value - minimum);
      const anchor = residual.findIndex(
        (value, index) => value > EPSILON && residual[(index + 2) % FACES] <= EPSILON,
      );
      const startFace = anchor >= 0 ? anchor : residual.indexOf(Math.max(...residual));
      facePosition = wrapFace(
        startFace + residual[(startFace + 1) % FACES] / directedness,
      );
    }
  }

  return {
    height: total > 0 ? heightSum / total : 0,
    facePosition,
    directedness,
    total,
  };
};

/**
 * Distribute a polarity's total from its steering vector. Height splits
 * linearly between the two adjacent tiers; segmented tiers split between
 * faces with the tent weights above. Ring tiers take their full axial share.
 */
const vectorToAmounts = (
  leadTiers: number[][],
  vector: SteeringVector,
): Map<number, number> => {
  const amounts = new Map<number, number>();
  const maxTier = leadTiers.length - 1;
  const height = Math.min(maxTier, Math.max(0, vector.height));
  const lowerTier = Math.min(maxTier, Math.floor(height + EPSILON));
  const fraction = Math.min(1, Math.max(0, height - lowerTier));

  const axialShares: Array<[number, number]> = [[lowerTier, 1 - fraction]];
  if (fraction > EPSILON && lowerTier < maxTier) {
    axialShares.push([lowerTier + 1, fraction]);
  }

  axialShares.forEach(([tierIndex, axialShare]) => {
    if (axialShare <= EPSILON) return;
    const tier = leadTiers[tierIndex];
    const tierTotal = vector.total * axialShare;

    if (tier.length === 1) {
      amounts.set(tier[0], (amounts.get(tier[0]) ?? 0) + tierTotal);
      return;
    }

    const weights = faceWeights(vector.facePosition, vector.directedness);
    tier.forEach((key, faceIndex) => {
      const share = faceIndex < FACES ? weights[faceIndex] : 0;
      if (share <= EPSILON) return;
      amounts.set(key, (amounts.get(key) ?? 0) + tierTotal * share);
    });
  });

  return amounts;
};

/** Round to 0.1 with the largest-remainder method, preserving the total. */
const roundAmounts = (
  amounts: Map<number, number>,
  total: number,
): Map<number, number> => {
  const entries = [...amounts.entries()].filter(([, value]) => value > EPSILON);
  const floors = entries.map(
    ([key, value]) => [key, Math.floor(value * 10 + EPSILON) / 10] as [number, number],
  );
  const floorTotal = floors.reduce((sum, [, value]) => sum + value, 0);
  let tenthsLeft = Math.round((total - floorTotal) * 10);

  const byRemainder = entries
    .map(([key, value], index) => ({ key, remainder: value - floors[index][1] }))
    .sort((left, right) => right.remainder - left.remainder);

  const rounded = new Map<number, number>(floors);
  for (const { key } of byRemainder) {
    if (tenthsLeft <= 0) break;
    rounded.set(key, Math.round(((rounded.get(key) ?? 0) + 0.1) * 10) / 10);
    tenthsLeft -= 1;
  }
  // Any residual beyond one pass (rare) lands on the largest allocation.
  if (tenthsLeft > 0 && rounded.size > 0) {
    const [largestKey] = [...rounded.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0];
    rounded.set(
      largestKey,
      Math.round(((rounded.get(largestKey) ?? 0) + tenthsLeft / 10) * 10) / 10,
    );
  }
  return rounded;
};

/**
 * Vector-based directional steering. Each polarity's active allocation is a
 * single steering vector: a continuous height in levels along the shaft and a
 * continuous radial face position across the 120°-spaced segments, plus a
 * directedness. Actions move that vector — up/down shift the height by 10% of
 * a level while keeping the radial direction, rotations turn the face
 * position by 10% of a face spacing at constant height, "level" flattens the
 * radial direction, and face presets aim it fully at one direction. Contact
 * currents are re-derived from the vector, so each polarity's total is
 * preserved exactly. The case (contact 0) is never touched.
 */
export function steerDirectional(
  state: SteeringState,
  context: SteeringContext,
  tiers: number[][],
  action: DirectionalAction,
  polarity: Polarity | 'both' = 'both',
): DirectionalSteeringResult {
  const unchanged = (reason?: string): DirectionalSteeringResult => ({
    ...state,
    changed: false,
    ...(reason ? { reason } : {}),
  });

  if (context.unit === 'V') {
    return unchanged('Directional steering is available in % and mA modes.');
  }

  // Ignore the case even if a caller accidentally includes it in the geometry.
  const leadTiers = tiers
    .map((tier) => tier.filter((key) => key !== 0))
    .filter((tier) => tier.length > 0);
  const contacts = leadTiers.flat();
  if (
    contacts.some((key) => !Number.isInteger(key) || key < 1) ||
    new Set(contacts).size !== contacts.length
  ) {
    return unchanged('The electrode contact layout is incomplete.');
  }

  if (
    contacts.some((key) => {
      const quantity = state.quantities[key] ?? 0;
      return (
        !Number.isFinite(quantity) ||
        quantity < 0 ||
        (quantity > 0 &&
          !POLARITIES.includes(state.selectedValues[key] as Polarity))
      );
    })
  ) {
    return unchanged(
      'Check the contact values before using directional steering.',
    );
  }

  const selectedPolarities = polarity === 'both' ? POLARITIES : [polarity];
  const hasAllocation = contacts.some(
    (key) =>
      selectedPolarities.includes(state.selectedValues[key] as Polarity) &&
      state.quantities[key] > 0,
  );
  if (!hasAllocation) {
    return unchanged(
      'Enable an electrode contact with a nonzero allocation first.',
    );
  }

  const hasSegments = leadTiers.some((tier) => tier.length > 1);
  const maxTier = leadTiers.length - 1;
  const isRotation = action === 'clockwise' || action === 'counterclockwise';
  const isPreset =
    action === 'forward' ||
    action === 'back' ||
    action === 'left' ||
    action === 'right';

  if ((isRotation || isPreset || action === 'level') && !hasSegments) {
    return unchanged('This electrode has no directional segments.');
  }

  const amounts: Record<Polarity, Map<number, number>> = {
    center: new Map(),
    right: new Map(),
  };
  let movedAny = false;
  let skipReason: string | undefined;

  for (const sign of POLARITIES) {
    const quantityOf = (key: number) =>
      state.selectedValues[key] === sign ? state.quantities[key] ?? 0 : 0;
    const vector = readVector(leadTiers, quantityOf);
    if (vector.total <= 0) continue;

    const carryVerbatim = () => {
      contacts.forEach((key) => {
        const quantity = quantityOf(key);
        if (quantity > 0) amounts[sign].set(key, quantity);
      });
    };

    if (!selectedPolarities.includes(sign)) {
      carryVerbatim();
      continue;
    }

    // Rotations, presets and leveling only apply to current that sits on
    // segmented tiers; a ring-only polarity is carried through untouched.
    const onSegments = leadTiers.some(
      (tier) => tier.length > 1 && tier.some((key) => quantityOf(key) > 0),
    );

    let applies = true;
    switch (action) {
      case 'up': {
        if (vector.height >= maxTier - EPSILON) {
          applies = false;
          skipReason = 'The current is already at the most proximal level.';
          break;
        }
        vector.height = Math.min(maxTier, vector.height + STEP);
        break;
      }
      case 'down': {
        if (vector.height <= EPSILON) {
          applies = false;
          skipReason = 'The current is already at the most distal level.';
          break;
        }
        vector.height = Math.max(0, vector.height - STEP);
        break;
      }
      case 'clockwise':
      case 'counterclockwise': {
        if (!onSegments || vector.directedness <= EPSILON) {
          applies = false;
          skipReason =
            'Aim the current at a face first — it is split evenly around the lead.';
          break;
        }
        vector.facePosition = wrapFace(
          vector.facePosition + (action === 'clockwise' ? STEP : -STEP),
        );
        break;
      }
      case 'level': {
        if (!onSegments) {
          applies = false;
          break;
        }
        vector.directedness = 0;
        break;
      }
      case 'forward':
      case 'left':
      case 'right':
      case 'back': {
        if (!onSegments) {
          applies = false;
          break;
        }
        const presetPositions: Record<string, number> = {
          forward: 0,
          left: 1,
          right: 2,
          back: 1.5,
        };
        vector.facePosition = presetPositions[action];
        vector.directedness = 1;
        break;
      }
      default:
        return unchanged();
    }

    if (!applies) {
      carryVerbatim();
      continue;
    }

    movedAny = true;
    amounts[sign] = roundAmounts(
      vectorToAmounts(leadTiers, vector),
      vector.total,
    );
  }

  if (!movedAny) {
    return unchanged(
      skipReason ?? 'Nothing on the lead can move in that direction.',
    );
  }

  // A contact cannot carry both signs. Also protect explicitly enabled zero-
  // allocation contacts so a move never silently changes an opposing polarity.
  const collision = contacts.some((key) =>
    POLARITIES.some((sign) => {
      const opposite = sign === 'center' ? 'right' : 'center';
      return (
        (amounts[sign].get(key) ?? 0) > 0 &&
        ((amounts[opposite].get(key) ?? 0) > 0 ||
          (POLARITIES.includes(state.selectedValues[key] as Polarity) &&
            state.selectedValues[key] !== sign))
      );
    }),
  );
  if (collision) {
    return unchanged(
      'This move would overlap positive and negative contacts. Adjust the contacts or choose a different direction.',
    );
  }

  const quantities = { ...state.quantities };
  const selectedValues = { ...state.selectedValues };
  contacts.forEach((key) => {
    const center = amounts.center.get(key) ?? 0;
    const right = amounts.right.get(key) ?? 0;
    quantities[key] = Math.round((center + right) * 10) / 10;
    if (center > 0) selectedValues[key] = 'center';
    else if (right > 0) selectedValues[key] = 'right';
    else if (state.quantities[key] > 0) selectedValues[key] = 'left';
  });

  const changed = contacts.some(
    (key) =>
      Math.abs((state.quantities[key] ?? 0) - quantities[key]) > 1e-6 ||
      (state.selectedValues[key] ?? 'left') !== (selectedValues[key] ?? 'left'),
  );
  return changed ? { quantities, selectedValues, changed } : unchanged();
}
