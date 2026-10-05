import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import { ElectrodeSet } from '../utils/seegCsv';
import { getGridColumns, GridColumn } from '../utils/seegGrid';

interface SEEGGridProps {
  sets: ElectrodeSet[];
  variableNames: string[];
  contactNames: string[];
  onCellChange: (row: number, column: GridColumn, value: string) => void;
  onPasteCells: (row: number, column: number, text: string) => void;
  onRemoveSet: (row: number) => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 74,
  height: 34,
  boxSizing: 'border-box',
  border: '1px solid transparent',
  borderRadius: 4,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  padding: '4px 7px',
};

function SEEGGrid({
  sets,
  variableNames,
  contactNames,
  onCellChange,
  onPasteCells,
  onRemoveSet,
}: SEEGGridProps) {
  const columns = getGridColumns(variableNames, contactNames);

  const handlePaste = (
    event: React.ClipboardEvent<HTMLElement>,
    row: number,
    column: number,
  ) => {
    const text = event.clipboardData.getData('text/plain');
    if (!text.includes('\t') && !text.includes('\n')) return;
    event.preventDefault();
    onPasteCells(row, column, text);
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        One row per stimulation. Use Tab to move between cells, or paste a
        rectangular selection from a spreadsheet. Contact cells accept +, −,
        or Off.
      </Typography>
      <Box
        role="region"
        aria-label="Stimulation parameter grid"
        tabIndex={0}
        sx={{
          maxHeight: 'min(65vh, 700px)',
          overflow: 'auto',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          '& td, & th': {
            borderRight: '1px solid',
            borderBottom: '1px solid',
            borderColor: 'divider',
            padding: '4px 6px',
            whiteSpace: 'nowrap',
          },
          '& input:focus, & select:focus': {
            outline: '2px solid #1976d2',
            outlineOffset: -2,
            backgroundColor: 'background.paper',
          },
        }}
      >
        <table style={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
          <thead>
            <tr>
              <th
                scope="col"
                style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: '#edf2f7', minWidth: 94 }}
              >
                Set
              </th>
              {columns.map((column, index) => (
                <th
                  key={`${column.kind}-${'name' in column ? column.name : index}`}
                  scope="col"
                  style={{ position: 'sticky', top: 0, zIndex: 2, background: '#edf2f7', minWidth: column.kind === 'variable' ? 130 : 90 }}
                >
                  {column.label}
                </th>
              ))}
              <th scope="col" style={{ position: 'sticky', top: 0, zIndex: 2, background: '#edf2f7' }}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set, row) => (
              <tr key={row} style={{ background: row % 2 === 0 ? '#fff' : '#f8fafc' }}>
                <th
                  scope="row"
                  style={{ position: 'sticky', left: 0, zIndex: 1, background: row % 2 === 0 ? '#fff' : '#f8fafc', textAlign: 'left' }}
                >
                  {row + 1}
                </th>
                {columns.map((column, columnIndex) => {
                  const key = `${column.kind}-${'name' in column ? column.name : columnIndex}`;
                  const label = `Set ${row + 1}, ${column.label}`;
                  let value = '';
                  if (column.kind === 'amplitude') value = set.amplitude;
                  if (column.kind === 'unit') value = set.amplitudeUnit;
                  if (column.kind === 'pulseWidth') value = set.pulseWidth;
                  if (column.kind === 'variable') value = set.variableValues[column.name] || '';
                  if (column.kind === 'contact') value = set.contactStates[column.name] || 'none';

                  return (
                    <td key={key} onPaste={(event) => handlePaste(event, row, columnIndex)}>
                      {column.kind === 'unit' || column.kind === 'contact' ? (
                        <select
                          aria-label={label}
                          value={value}
                          onChange={(event) => onCellChange(row, column, event.target.value)}
                          style={{
                            ...inputStyle,
                            cursor: 'pointer',
                            backgroundColor: column.kind === 'contact'
                              ? value === 'plus' ? '#e3f3e7' : value === 'minus' ? '#fbe6e5' : 'transparent'
                              : 'transparent',
                          }}
                        >
                          {column.kind === 'unit' ? (
                            <>
                              <option value="mA">mA</option>
                              <option value="V">V</option>
                            </>
                          ) : (
                            <>
                              <option value="none">Off</option>
                              <option value="plus">+</option>
                              <option value="minus">−</option>
                            </>
                          )}
                        </select>
                      ) : (
                        <input
                          aria-label={label}
                          type="text"
                          inputMode={column.kind === 'variable' ? 'text' : 'decimal'}
                          value={value}
                          onChange={(event) => onCellChange(row, column, event.target.value)}
                          style={inputStyle}
                        />
                      )}
                    </td>
                  );
                })}
                <td>
                  <Button
                    size="small"
                    color="error"
                    aria-label={`Remove set ${row + 1}`}
                    disabled={sets.length === 1}
                    onClick={() => onRemoveSet(row)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  );
}

export default SEEGGrid;
