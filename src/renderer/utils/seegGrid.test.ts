import { createEmptyElectrodeSet } from './seegCsv';
import { getGridColumns, pasteGridCells, updateGridCell } from './seegGrid';

describe('sEEG grid editing', () => {
  const columns = getGridColumns(['Outcome'], ['A1', 'A2']);

  it('pastes rectangular spreadsheet data into existing and new sets', () => {
    const result = pasteGridCells(
      [createEmptyElectrodeSet()],
      columns,
      0,
      0,
      '2.5\tmA\t60\tBetter\t+\t-\n3\tV\t90\tSame\tOff\t+',
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      amplitude: '2.5',
      amplitudeUnit: 'mA',
      pulseWidth: '60',
      variableValues: { Outcome: 'Better' },
      contactStates: { A1: 'plus', A2: 'minus' },
      contacts: ['A1', 'A2'],
    });
    expect(result[1]).toMatchObject({
      amplitude: '3',
      amplitudeUnit: 'V',
      pulseWidth: '90',
      contactStates: { A1: 'none', A2: 'plus' },
      contacts: ['A2'],
    });
  });

  it('keeps active contacts synchronized when a polarity is cleared', () => {
    const withContact = updateGridCell(createEmptyElectrodeSet(), columns[4], '+');
    const cleared = updateGridCell(withContact, columns[4], 'off');
    expect(cleared.contactStates.A1).toBe('none');
    expect(cleared.contacts).toEqual([]);
  });

  it('ignores invalid polarity or unit text without changing other cells', () => {
    const original = createEmptyElectrodeSet();
    expect(updateGridCell(original, columns[1], 'invalid')).toBe(original);
    expect(updateGridCell(original, columns[4], 'invalid')).toBe(original);
  });
});
