import { ContactState, createEmptyElectrodeSet, ElectrodeSet } from './seegCsv';

export type GridColumn =
  | { kind: 'amplitude' | 'unit' | 'pulseWidth'; label: string }
  | { kind: 'variable' | 'contact'; label: string; name: string };

export const getGridColumns = (
  variableNames: string[],
  contactNames: string[],
): GridColumn[] => [
  { kind: 'amplitude', label: 'Amplitude' },
  { kind: 'unit', label: 'Unit' },
  { kind: 'pulseWidth', label: 'Pulse width (µs)' },
  ...variableNames.map((name) => ({ kind: 'variable' as const, label: name, name })),
  ...contactNames.map((name) => ({ kind: 'contact' as const, label: name, name })),
];

export const parseContactState = (value: string): ContactState | null => {
  switch (value.trim().toLowerCase()) {
    case '':
    case 'none':
    case 'off':
    case '0':
      return 'none';
    case '+':
    case 'plus':
    case 'positive':
    case 'anode':
      return 'plus';
    case '-':
    case 'minus':
    case 'negative':
    case 'cathode':
      return 'minus';
    default:
      return null;
  }
};

export const updateGridCell = (
  set: ElectrodeSet,
  column: GridColumn,
  value: string,
): ElectrodeSet => {
  if (column.kind === 'amplitude') return { ...set, amplitude: value };
  if (column.kind === 'pulseWidth') return { ...set, pulseWidth: value };
  if (column.kind === 'unit') {
    const unit = value.trim().toLowerCase();
    if (unit !== 'ma' && unit !== 'v') return set;
    return { ...set, amplitudeUnit: unit === 'ma' ? 'mA' : 'V' };
  }
  if (column.kind === 'variable') {
    return {
      ...set,
      variableValues: { ...set.variableValues, [column.name]: value },
    };
  }
  if (!('name' in column)) return set;
  const state = parseContactState(value);
  if (state === null) return set;
  const contactStates = { ...set.contactStates, [column.name]: state };
  return {
    ...set,
    contactStates,
    contacts: Object.entries(contactStates)
      .filter(([, polarity]) => polarity === 'plus' || polarity === 'minus')
      .map(([name]) => name),
  };
};

export const pasteGridCells = (
  sets: ElectrodeSet[],
  columns: GridColumn[],
  startRow: number,
  startColumn: number,
  clipboardText: string,
): ElectrodeSet[] => {
  const rows = clipboardText.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  if (rows.length === 0 || startRow < 0 || startColumn < 0) return sets;

  const updated = [...sets];
  rows.forEach((row, rowOffset) => {
    const cells = row.split('\t');
    if (startColumn >= columns.length) return;
    const index = startRow + rowOffset;
    while (updated.length <= index) updated.push(createEmptyElectrodeSet());
    let next = updated[index];
    cells.forEach((cell, columnOffset) => {
      const column = columns[startColumn + columnOffset];
      if (column) next = updateGridCell(next, column, cell);
    });
    updated[index] = next;
  });
  return updated;
};
