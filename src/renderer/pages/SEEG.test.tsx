import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import SEEG from './SEEG';

describe('sEEG workbook sheets', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: {
        ipcRenderer: {
          invoke: jest.fn((channel: string) => {
            if (channel === 'load_patient_list') return Promise.resolve([{ id: 'sub-01' }]);
            if (channel === 'load_seeg_stimulations') return Promise.resolve([]);
            if (channel === 'load_seeg_reco') {
              return Promise.resolve({
                reco: {
                  props: [
                    { elname: 'Electrode A', elmodel: 'A', multiple_elmodel: 'A', labels: [['A1']] },
                    { elname: 'Electrode B', elmodel: 'B', multiple_elmodel: 'B', labels: [['B1']] },
                  ],
                },
              });
            }
            return Promise.resolve(null);
          }),
          sendMessage: jest.fn(),
        },
      },
    });
  });

  it('uses electrode tabs in grid mode and keeps each sheet separate', async () => {
    render(<MemoryRouter><SEEG directoryPath="/dataset" /></MemoryRouter>);

    fireEvent.click(await screen.findByRole('button', { name: 'Grid entry' }));
    expect(screen.queryByLabelText('Choose an Electrode')).not.toBeInTheDocument();

    const sheetA = screen.getByRole('tab', { name: /Electrode A, 1 stimulation sets/i });
    const sheetB = screen.getByRole('tab', { name: /Electrode B, 1 stimulation sets/i });
    await waitFor(() => expect(sheetA).toHaveAttribute('aria-selected', 'true'));

    fireEvent.change(screen.getByRole('textbox', { name: 'Set 1, Amplitude' }), {
      target: { value: '2.5' },
    });
    fireEvent.click(sheetB);
    expect(screen.getByRole('textbox', { name: 'Set 1, Amplitude' })).toHaveValue('');
    expect(screen.getByLabelText('Set 1, B1')).toBeInTheDocument();
    expect(screen.queryByLabelText('Set 1, A1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add 10 Sets' }));
    expect(screen.getByRole('tab', { name: /Electrode B, 11 stimulation sets/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Electrode A, 1 stimulation sets/i })).toBeInTheDocument();

    fireEvent.click(sheetA);
    expect(screen.getByRole('textbox', { name: 'Set 1, Amplitude' })).toHaveValue('2.5');

    fireEvent.click(screen.getByRole('button', { name: 'Save All Electrode Configurations' }));
    const sendMessage = (window as any).electron.ipcRenderer.sendMessage as jest.Mock;
    const saved = sendMessage.mock.calls[0][1].electrodeCSVs;
    expect(saved.find((file: any) => file.electrodeName === 'Electrode A').metadata[0].amplitude).toBe('2.5');
    expect(saved.find((file: any) => file.electrodeName === 'Electrode B').metadata).toHaveLength(11);

    fireEvent.click(screen.getByRole('button', { name: 'Card entry' }));
    expect(screen.getByLabelText('Choose an Electrode')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Electrode B/i })).not.toBeInTheDocument();
  });
});
