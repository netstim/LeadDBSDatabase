import {
  balanceSteering,
  changeSteeringUnit,
  getSteeringUnit,
  SteeringUnit,
} from './currentSteering';

export const sourceName = (position: string | number): string => {
  const index = Number(position);
  return index > 4 ? `Rs${index - 4}` : `Ls${index}`;
};

const nonnegative = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isPolarity = (value: unknown): value is number =>
  isFiniteNumber(value) && [0, 1, 2].includes(value);

export const importedIPG = (stimulation: any, fallback: string): string => {
  const supported = [
    'Boston',
    'Abbott',
    'Medtronic_Percept',
    'Medtronic_Activa',
    'Research',
    'Master',
  ];
  if (supported.includes(stimulation?.ipg)) {
    return stimulation.ipg === 'Master' ? 'Research' : stimulation.ipg;
  }
  // Voltage identifies an Activa only when the electrode itself is Medtronic.
  // Research electrodes and imported Master programs must not become Activas.
  return fallback.startsWith('Medtronic') &&
    Array.from({ length: 8 }, (_, i) => stimulation?.[sourceName(i + 1)]).some(
      (source) => Number(source?.va) === 1,
    )
    ? 'Medtronic_Activa'
    : fallback;
};

export const unitTogglePositions = (unit: SteeringUnit) => ({
  percAmpToggle: { '%': 'left', V: 'right', mA: 'center' }[unit],
  volAmpToggle: unit === 'V' ? 'right' : 'center',
});

export const changeStimulationIPG = (
  oldIPG: string,
  newIPG: string,
  allQuantities: Record<string, any>,
  allSelectedValues: Record<string, any>,
  allTotalAmplitudes: Record<string, any>,
  allTogglePositions: Record<string, any>,
  allPercAmpToggles: Record<string, any>,
  allVolAmpToggles: Record<string, any>,
) => {
  const quantities: Record<string, any> = {};
  const units: Record<string, SteeringUnit> = {};
  const percentages: Record<string, string> = {};
  const voltages: Record<string, string> = {};
  Object.entries(allQuantities).forEach(([position, contacts]) => {
    const oldUnit = getSteeringUnit(
      oldIPG,
      allPercAmpToggles[position],
      allVolAmpToggles[position],
      allTogglePositions[position],
    );
    const nextUnit = getSteeringUnit(
      newIPG,
      allPercAmpToggles[position],
      allVolAmpToggles[position],
      oldUnit,
    );
    const toggles = unitTogglePositions(nextUnit);
    const needsConversion =
      oldUnit !== nextUnit ||
      newIPG === 'Abbott' ||
      (newIPG === 'Medtronic_Activa' && nextUnit === 'V');
    const state = {
      quantities: contacts,
      selectedValues: allSelectedValues[position] || {},
    };
    const totalAmplitude = nonnegative(allTotalAmplitudes[position]);
    quantities[position] = needsConversion
      ? changeSteeringUnit(
          state,
          {
            ipg: newIPG,
            unit: oldUnit,
            totalAmplitude,
          },
          nextUnit,
        ).quantities
      : balanceSteering(state, {
          ipg: newIPG,
          unit: nextUnit,
          totalAmplitude,
        }).quantities;
    units[position] = nextUnit;
    percentages[position] = toggles.percAmpToggle;
    voltages[position] = toggles.volAmpToggle;
  });
  return { quantities, units, percentages, voltages };
};

export const importSteeringSource = (
  stimulation: any,
  position: string | number,
  ipg: string,
  fallbackAmplitude?: unknown,
) => {
  const name = sourceName(position);
  const source = stimulation?.[name] || {};
  const totalAmplitude = nonnegative(source.amp ?? fallbackAmplitude);
  const savedUnit = stimulation?.programmerUnits?.[name];
  let requestedUnit = savedUnit === 'V' ? undefined : savedUnit;
  if (Number(source.va) === 1) requestedUnit = 'V';
  const unit = getSteeringUnit(
    ipg,
    'left',
    Number(source.va) === 1 ? 'right' : 'center',
    requestedUnit,
  );
  const quantities: Record<string, number> = {};
  const selectedValues: Record<string, string> = {};
  const contacts = [
    'case',
    ...Object.keys(source).filter((key) => /^k\d+$/.test(key)),
  ];
  const voltageSnapshot = stimulation?.programmerVoltageQuantities?.[name];
  const savedVoltageQuantity = (key: string): unknown => {
    const id = key === 'case' ? '0' : key.slice(1);
    return (
      voltageSnapshot?.quantities?.[key] ??
      voltageSnapshot?.quantities?.[id] ??
      voltageSnapshot?.quantities?.[`x${id}`]
    );
  };
  const restoreVoltage =
    unit === 'V' &&
    (ipg === 'Research' || ipg === 'Master') &&
    source.va === 1 &&
    isFiniteNumber(source.amp) &&
    source.amp >= 0 &&
    isFiniteNumber(voltageSnapshot?.amplitude) &&
    voltageSnapshot.amplitude >= 0 &&
    voltageSnapshot.amplitude === totalAmplitude &&
    voltageSnapshot?.polarities &&
    contacts.every((key) => {
      const savedQuantity = savedVoltageQuantity(key);
      const sourcePolarity = source[key]?.pol;
      const savedPolarity = voltageSnapshot.polarities[key];
      return (
        Object.prototype.hasOwnProperty.call(voltageSnapshot.polarities, key) &&
        isPolarity(sourcePolarity) &&
        isPolarity(savedPolarity) &&
        sourcePolarity === savedPolarity &&
        isFiniteNumber(savedQuantity) &&
        savedQuantity >= 0 &&
        savedQuantity <= totalAmplitude
      );
    });
  contacts.forEach((key) => {
    const id = key === 'case' ? '0' : key.slice(1);
    const contact = source[key] || {};
    const polarity = Number(contact.pol);
    selectedValues[id] = 'left';
    if (polarity === 1) selectedValues[id] = 'center';
    if (polarity === 2) selectedValues[id] = 'right';
    if (selectedValues[id] === 'left') {
      quantities[id] = 0;
    } else if (restoreVoltage) {
      quantities[id] = nonnegative(savedVoltageQuantity(key));
    } else if (unit === 'V') {
      quantities[id] = totalAmplitude;
    } else {
      quantities[id] =
        nonnegative(contact.perc) * (unit === 'mA' ? totalAmplitude / 100 : 1);
    }
  });
  const normalized = balanceSteering(
    { quantities, selectedValues },
    { ipg, unit, totalAmplitude },
    ipg === 'Abbott' ? 'equal' : 'proportional',
  );
  return {
    quantities: normalized.quantities,
    selectedValues: normalized.selectedValues,
    totalAmplitude,
    unit,
    ...unitTogglePositions(unit),
  };
};

export const exportSteeringQuantities = (
  allQuantities: Record<string, any>,
  allTotalAmplitudes: Record<string, any>,
  allTogglePositions: Record<string, any>,
  allSelectedValues: Record<string, any>,
  ipg: string,
  allPercAmpToggles: Record<string, any> = {},
  allVolAmpToggles: Record<string, any> = {},
): Record<string, Record<string, number>> =>
  Object.fromEntries(
    Object.entries(allQuantities).map(([position, contacts]) => {
      const unit = getSteeringUnit(
        ipg,
        allPercAmpToggles[position],
        allVolAmpToggles[position],
        allTogglePositions[position],
      );
      const amplitude = nonnegative(allTotalAmplitudes[position]);
      return [
        position,
        Object.fromEntries(
          Object.entries(contacts || {}).map(([id, value]) => {
            const active = ['center', 'right'].includes(
              allSelectedValues[position]?.[id],
            );
            const quantity = active ? nonnegative(value) : 0;
            if (unit === 'V') return [id, quantity > 0 ? 100 : 0];
            if (unit === 'mA') {
              return [id, amplitude > 0 ? (quantity / amplitude) * 100 : 0];
            }
            return [id, quantity];
          }),
        ),
      ];
    }),
  );

export const writeSteeringMetadata = (
  stimulation: any,
  ipg: string,
  allQuantities: Record<string, any>,
  allTotalAmplitudes: Record<string, any>,
  allTogglePositions: Record<string, any>,
  allPercAmpToggles: Record<string, any> = {},
  allVolAmpToggles: Record<string, any> = {},
) => {
  stimulation.ipg = ipg === 'Master' ? 'Research' : ipg;
  stimulation.programmerUnits = {};
  stimulation.programmerVoltageQuantities = {};
  Object.keys(allQuantities).forEach((position) => {
    const name = sourceName(position);
    const unit = getSteeringUnit(
      ipg,
      allPercAmpToggles[position],
      allVolAmpToggles[position],
      allTogglePositions[position],
    );
    stimulation.programmerUnits[name] = unit;
    if (unit === 'V' && (ipg === 'Research' || ipg === 'Master')) {
      const source = stimulation[name] || {};
      const contactFields = [
        'case',
        ...Object.keys(source).filter((key) => /^k\d+$/.test(key)),
      ];
      stimulation.programmerVoltageQuantities[name] = {
        amplitude: nonnegative(allTotalAmplitudes[position]),
        quantities: Object.fromEntries(
          contactFields.map((key) => [
            key,
            nonnegative(
              allQuantities[position]?.[key === 'case' ? '0' : key.slice(1)],
            ),
          ]),
        ),
        polarities: Object.fromEntries(
          contactFields.map((key) => [key, Number(source[key]?.pol || 0)]),
        ),
      };
    }
  });
};
