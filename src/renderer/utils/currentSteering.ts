export type SteeringUnit = '%' | 'mA' | 'V';

export interface SteeringState {
  quantities: Record<string, number>;
  selectedValues: Record<string, string>;
}

export interface SteeringContext {
  ipg: string;
  unit: SteeringUnit;
  totalAmplitude: number;
}

type Polarity = 'left' | 'center' | 'right';
type Distribution = 'proportional' | 'equal';

const polarities: Polarity[] = ['center', 'right'];

const deviceName = (ipg: string) => String(ipg || '').toLowerCase();
const isActiva = (ipg: string) => deviceName(ipg).includes('activa');
const isAbbott = (ipg: string) => deviceName(ipg).includes('abbott');
const isBoston = (ipg: string) => deviceName(ipg).includes('boston');
const isMaster = (ipg: string) =>
  ['research', 'master'].some((name) => deviceName(ipg).includes(name));

const finiteAmount = (value: number) =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

const polarityOf = (value: string): Polarity =>
  value === 'center' || value === 'right' ? value : 'left';

function supportsUnit(ipg: string, unit: string): unit is SteeringUnit {
  if (unit === 'mA') return true;
  if (unit === '%') return isBoston(ipg) || isMaster(ipg);
  return unit === 'V' && (isActiva(ipg) || isMaster(ipg));
}

/** The saved unit is authoritative when the selected device supports it. */
export function getSteeringUnit(
  ipg: string,
  percAmpToggle?: string,
  volAmpToggle?: string,
  togglePosition?: string,
): SteeringUnit {
  if (togglePosition && supportsUnit(ipg, togglePosition)) {
    return togglePosition;
  }
  if (isBoston(ipg)) return (percAmpToggle ?? 'left') === 'left' ? '%' : 'mA';
  if (isActiva(ipg)) return volAmpToggle === 'right' ? 'V' : 'mA';
  if (isMaster(ipg)) {
    if (percAmpToggle === 'right') return 'V';
    return percAmpToggle === 'center' ? 'mA' : '%';
  }
  return 'mA';
}

const supportedUnit = (context: SteeringContext): SteeringUnit =>
  supportsUnit(context.ipg, context.unit) ? context.unit : 'mA';

function cleanState(state: SteeringState): SteeringState {
  const quantities: Record<string, number> = {};
  const selectedValues: Record<string, string> = {};
  const keys = new Set([
    ...Object.keys(state.quantities),
    ...Object.keys(state.selectedValues),
  ]);
  [...keys].sort().forEach((key) => {
    selectedValues[key] = polarityOf(state.selectedValues[key]);
    quantities[key] =
      selectedValues[key] === 'left' ? 0 : finiteAmount(state.quantities[key]);
  });
  return { quantities, selectedValues };
}

function contactsFor(state: SteeringState, polarity: string): string[] {
  return Object.keys(state.selectedValues).filter(
    (key) => state.selectedValues[key] === polarity,
  );
}

function currentBudget(context: SteeringContext): number {
  return supportedUnit(context) === '%'
    ? 100
    : finiteAmount(context.totalAmplitude);
}

/** Assign the final residual to a contributing contact so rounding cannot leak
 * current onto an intentionally zero-valued contact. Scaling first also avoids
 * overflow when recovering malformed or unusually large imported quantities.
 */
function distribute(
  state: SteeringState,
  keys: string[],
  budget: number,
  strategy: Distribution = 'proportional',
): void {
  if (!keys.length) return;
  const existingTotal = keys.reduce(
    (sum, key) => sum + state.quantities[key],
    0,
  );
  // Avoid perturbing already-valid imported or edited distributions merely
  // because their device remains in a compatible mode.
  if (strategy === 'proportional' && existingTotal === budget) return;
  const maximum = Math.max(...keys.map((key) => state.quantities[key]));
  const useEqual = strategy === 'equal' || maximum === 0;
  const weights = keys.map((key) =>
    useEqual ? 1 : state.quantities[key] / maximum,
  );
  const contributors = keys.filter((_, index) => weights[index] > 0);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const lastContributor = contributors[contributors.length - 1];
  let assigned = 0;
  keys.forEach((key, index) => {
    let quantity = 0;
    if (weights[index] > 0) {
      quantity =
        key === lastContributor
          ? Math.max(0, budget - assigned)
          : Math.min(
              budget - assigned,
              (budget * weights[index]) / totalWeight,
            );
    }
    state.quantities[key] = quantity;
    assigned += quantity;
  });
}

/** Normalize each polarity independently. The case (key 0) participates in
 * exactly the same way as an electrode contact. Voltage is not a current pool.
 */
export function balanceSteering(
  state: SteeringState,
  context: SteeringContext,
  strategy: Distribution = 'proportional',
): SteeringState {
  const next = cleanState(state);
  const unit = supportedUnit(context);
  const amplitude = finiteAmount(context.totalAmplitude);
  if (unit === 'V') {
    Object.keys(next.quantities).forEach((key) => {
      if (next.selectedValues[key] !== 'left') {
        next.quantities[key] = isActiva(context.ipg)
          ? amplitude
          : Math.min(amplitude, next.quantities[key]);
      }
    });
    return next;
  }
  polarities.forEach((polarity) => {
    distribute(
      next,
      contactsFor(next, polarity),
      currentBudget(context),
      strategy,
    );
  });
  return next;
}

export function changeContactPolarity(
  state: SteeringState,
  context: SteeringContext,
  contactKey: string | number,
  position: string,
): SteeringState {
  const next = cleanState(state);
  const key = String(contactKey);
  const previousPolarity = polarityOf(next.selectedValues[key]);
  const nextPolarity = polarityOf(position);
  if (previousPolarity === nextPolarity) return next;

  const carriedAmount = finiteAmount(next.quantities[key]);
  next.selectedValues[key] = nextPolarity;
  next.quantities[key] = nextPolarity === 'left' ? 0 : carriedAmount;

  if (supportedUnit(context) === 'V') {
    if (nextPolarity !== 'left' && previousPolarity === 'left') {
      next.quantities[key] = finiteAmount(context.totalAmplitude);
    }
    return balanceSteering(next, context);
  }
  if (isAbbott(context.ipg)) return balanceSteering(next, context, 'equal');

  const budget = currentBudget(context);
  if (previousPolarity !== 'left') {
    distribute(next, contactsFor(next, previousPolarity), budget);
  }
  if (nextPolarity !== 'left') {
    const peers = contactsFor(next, nextPolarity).filter(
      (peer) => peer !== key,
    );
    next.quantities[key] = peers.length
      ? Math.min(budget, carriedAmount)
      : budget;
    distribute(next, peers, Math.max(0, budget - next.quantities[key]));
  }
  return next;
}

/** Honor the edited share and redistribute only its same-polarity peers. A sole
 * active contact necessarily carries its entire polarity's current budget.
 */
export function changeContactQuantity(
  state: SteeringState,
  context: SteeringContext,
  contactKey: string | number,
  value: number,
  position?: string,
): SteeringState {
  const key = String(contactKey);
  const previousPolarity = polarityOf(state.selectedValues[key]);
  const next =
    position === undefined
      ? cleanState(state)
      : changeContactPolarity(state, context, key, position);
  const polarity = polarityOf(next.selectedValues[key]);
  if (polarity === 'left') {
    next.selectedValues[key] = 'left';
    next.quantities[key] = 0;
    return next;
  }
  // Abbott reapplies equal current sharing whenever an electrode is added to
  // a polarity. Typing into an OFF contact is both an activation and an edit;
  // preserve the topology rule for that first transition. A subsequent edit
  // (once the contact is active) may customize the distribution normally.
  if (
    isAbbott(context.ipg) &&
    position !== undefined &&
    previousPolarity === 'left'
  ) {
    return next;
  }
  const budget = currentBudget(context);
  const quantity = Math.min(budget, finiteAmount(value));
  if (supportedUnit(context) === 'V') {
    next.quantities[key] = isActiva(context.ipg) ? budget : quantity;
    return next;
  }
  const peers = contactsFor(next, polarity).filter((peer) => peer !== key);
  next.quantities[key] = peers.length ? quantity : budget;
  distribute(next, peers, Math.max(0, budget - next.quantities[key]));
  return next;
}

export function changeSteeringAmplitude(
  state: SteeringState,
  context: SteeringContext,
  newTotal: number,
): SteeringState {
  const nextContext = { ...context, totalAmplitude: finiteAmount(newTotal) };
  if (supportedUnit(context) === 'V' && !isActiva(context.ipg)) {
    const next = cleanState(state);
    const previousAmplitude = finiteAmount(context.totalAmplitude);
    Object.keys(next.quantities).forEach((key) => {
      if (next.selectedValues[key] !== 'left') {
        const fraction = previousAmplitude
          ? Math.min(1, next.quantities[key] / previousAmplitude)
          : 1;
        next.quantities[key] = fraction * nextContext.totalAmplitude;
      }
    });
    return next;
  }
  return balanceSteering(
    state,
    nextContext,
    isAbbott(context.ipg) ? 'equal' : 'proportional',
  );
}

/** Context.unit describes the old values. Context.ipg may already be the newly
 * selected device, allowing the caller to convert modes while switching IPGs.
 */
export function changeSteeringUnit(
  state: SteeringState,
  context: SteeringContext,
  newUnit: SteeringUnit,
): SteeringState {
  const unit = supportsUnit(context.ipg, newUnit) ? newUnit : 'mA';
  const nextContext = { ...context, unit };
  const next = cleanState(state);
  if (unit === 'V' && !isActiva(context.ipg) && context.unit === '%') {
    Object.keys(next.quantities).forEach((key) => {
      next.quantities[key] =
        (Math.min(100, next.quantities[key]) / 100) *
        finiteAmount(context.totalAmplitude);
    });
  }
  return balanceSteering(
    next,
    nextContext,
    isAbbott(context.ipg) ? 'equal' : 'proportional',
  );
}
