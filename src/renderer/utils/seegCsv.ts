export type ContactState = 'none' | 'plus' | 'minus';

export interface ElectrodeSet {
  contacts: string[];
  contactStates: Record<string, ContactState>;
  amplitude: string;
  amplitudeUnit: string;
  pulseWidth: string;
  variableValues: Record<string, string>;
}

export const createEmptyElectrodeSet = (): ElectrodeSet => ({
  contacts: [],
  contactStates: {},
  amplitude: '',
  amplitudeUnit: 'mA',
  pulseWidth: '',
  variableValues: {},
});

export const parseElectrodeCSV = (
  csv: string,
  expectedLabels: string[],
): ElectrodeSet[] => {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [createEmptyElectrodeSet()];

  const savedLabels = lines[0].split(',').map((label) => label.trim());
  const sets = lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim());
    const contactStates: Record<string, ContactState> = {};
    const contacts: string[] = [];
    let amplitude = '';

    expectedLabels.forEach((label) => {
      const savedIndex = savedLabels.indexOf(label);
      const savedValue = savedIndex >= 0 ? values[savedIndex] : undefined;
      if (!savedValue || savedValue === 'None') return;

      let polarity: ContactState = 'none';
      if (savedValue.startsWith('+')) polarity = 'plus';
      if (savedValue.startsWith('-')) polarity = 'minus';

      if (polarity !== 'none') {
        contactStates[label] = polarity;
        contacts.push(label);
        if (!amplitude) amplitude = savedValue.slice(1);
      }
    });

    return {
      ...createEmptyElectrodeSet(),
      contacts,
      contactStates,
      amplitude,
    };
  });

  return sets.length > 0 ? sets : [createEmptyElectrodeSet()];
};
