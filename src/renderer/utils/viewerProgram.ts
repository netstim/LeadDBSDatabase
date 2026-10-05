import {
  balanceSteering,
  SteeringContext,
  SteeringState,
  SteeringUnit,
} from './currentSteering';

export interface ViewerProgram extends SteeringState {
  amplitude: number;
}

const nonnegative = (value: unknown): number => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
};

/** Apply a viewer/optimizer proposal through the same rules as manual edits. */
export function normalizeViewerProgram(
  proposal: ViewerProgram,
  context: SteeringContext,
): ViewerProgram {
  const amplitude = nonnegative(proposal.amplitude);
  const state = balanceSteering(
    {
      quantities: proposal.quantities,
      selectedValues: proposal.selectedValues,
    },
    { ...context, totalAmplitude: amplitude },
    context.ipg === 'Abbott' ? 'equal' : 'proportional',
  );
  return { ...state, amplitude };
}

/** Convert NIfTI optimizer amplitudes to a complete contact program.
 * Missing, short, invalid, and sub-threshold optimizer entries remain OFF.
 */
export function niftiValuesToViewerProgram(
  values: unknown,
  state: SteeringState,
  unit: SteeringUnit,
): ViewerProgram {
  const optimizedValues: Record<string, number> = {};
  if (values && typeof values === 'object') {
    Object.entries(values as Record<string, unknown>).forEach(
      ([key, value]) => {
        const numericValue = Number(value);
        optimizedValues[key] =
          Number.isFinite(numericValue) && numericValue >= 0.2
            ? Math.round(numericValue * 10) / 10
            : 0;
      },
    );
  }

  const amplitude = Object.values(optimizedValues).reduce(
    (sum, value) => sum + value,
    0,
  );
  const quantities = { ...state.quantities };
  const selectedValues = { ...state.selectedValues };
  Object.keys(quantities).forEach((contact) => {
    if (contact === '0') {
      quantities[contact] = amplitude;
      selectedValues[contact] = 'right';
      return;
    }

    const optimizedQuantity = optimizedValues[String(Number(contact) - 1)];
    if (Number.isFinite(optimizedQuantity) && optimizedQuantity > 0) {
      selectedValues[contact] = 'center';
      quantities[contact] =
        unit === '%'
          ? (100 * optimizedQuantity) / amplitude
          : optimizedQuantity;
    } else {
      quantities[contact] = 0;
      selectedValues[contact] = 'left';
    }
  });

  return { quantities, selectedValues, amplitude };
}
