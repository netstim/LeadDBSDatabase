import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import AddScoreTypeDialog, { splitPastedItems } from './AddScoreTypeDialog';

const renderDialog = (overrides = {}) => {
  const props = {
    show: true,
    existingScoreTypes: ['UPDRS', 'Y-BOCS'],
    scoreTemplates: {
      UPDRS: { '3.1: Speech': 0, '3.2: Facial expression': 0 },
      'Y-BOCS': { Obsessions: 0, Compulsions: 0 },
    },
    onClose: jest.fn(),
    onCreate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(
    <AddScoreTypeDialog
      show={props.show}
      existingScoreTypes={props.existingScoreTypes}
      scoreTemplates={props.scoreTemplates}
      onClose={props.onClose}
      onCreate={props.onCreate}
    />,
  );
  return props;
};

const createButton = () =>
  screen.getByRole('button', { name: /create score type/i });

describe('AddScoreTypeDialog', () => {
  it('disables Create until a unique name and at least one item exist', () => {
    renderDialog();
    expect(createButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/score type name/i), {
      target: { value: 'MoCA' },
    });
    expect(createButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Score item 1'), {
      target: { value: 'Visuospatial' },
    });
    expect(createButton()).toBeEnabled();
  });

  it('flags an existing name case-insensitively', () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText(/score type name/i), {
      target: { value: '  updrs ' },
    });
    fireEvent.change(screen.getByLabelText('Score item 1'), {
      target: { value: 'Item' },
    });
    expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    expect(createButton()).toBeDisabled();
  });

  it('adds rows with Enter and flags duplicate items', () => {
    renderDialog();
    const firstItem = screen.getByLabelText('Score item 1');
    fireEvent.change(firstItem, { target: { value: 'Tremor' } });
    fireEvent.keyDown(firstItem, { key: 'Enter' });

    const secondItem = screen.getByLabelText('Score item 2');
    fireEvent.change(secondItem, { target: { value: ' tremor ' } });

    expect(
      screen.getAllByText(/duplicate item name/i).length,
    ).toBeGreaterThanOrEqual(1);
    fireEvent.change(screen.getByLabelText(/score type name/i), {
      target: { value: 'TRS' },
    });
    expect(createButton()).toBeDisabled();

    fireEvent.change(secondItem, { target: { value: 'Rigidity' } });
    expect(createButton()).toBeEnabled();
  });

  it('expands a pasted separated list into rows', () => {
    renderDialog();
    const firstItem = screen.getByLabelText('Score item 1');
    fireEvent.paste(firstItem, {
      clipboardData: {
        getData: () => "'Obsessions', 'Compulsions'\nInsight",
      },
    });
    expect(screen.getByLabelText('Score item 1')).toHaveValue('Obsessions');
    expect(screen.getByLabelText('Score item 2')).toHaveValue('Compulsions');
    expect(screen.getByLabelText('Score item 3')).toHaveValue('Insight');
  });

  it('prefills items from a template score type', () => {
    renderDialog();
    fireEvent.change(
      screen.getByLabelText(/start from an existing type/i),
      { target: { value: 'Y-BOCS' } },
    );
    expect(screen.getByLabelText('Score item 1')).toHaveValue('Obsessions');
    expect(screen.getByLabelText('Score item 2')).toHaveValue('Compulsions');
  });

  it('calls onCreate with the trimmed name and filled items only', async () => {
    const props = renderDialog();
    fireEvent.change(screen.getByLabelText(/score type name/i), {
      target: { value: ' MoCA ' },
    });
    const firstItem = screen.getByLabelText('Score item 1');
    fireEvent.change(firstItem, { target: { value: ' Naming ' } });
    fireEvent.keyDown(firstItem, { key: 'Enter' });
    // The second row stays empty and must be dropped from the result.

    await act(async () => {
      fireEvent.click(createButton());
    });
    expect(props.onCreate).toHaveBeenCalledWith('MoCA', ['Naming']);
  });

  it('shows a rejection from onCreate inside the dialog', async () => {
    const props = renderDialog({
      onCreate: jest.fn().mockRejectedValue(new Error('Disk full')),
    });
    fireEvent.change(screen.getByLabelText(/score type name/i), {
      target: { value: 'MoCA' },
    });
    fireEvent.change(screen.getByLabelText('Score item 1'), {
      target: { value: 'Naming' },
    });
    await act(async () => {
      fireEvent.click(createButton());
    });
    expect(props.onCreate).toHaveBeenCalled();
    expect(screen.getByText('Disk full')).toBeInTheDocument();
  });

  it('splitPastedItems strips quotes and empty entries', () => {
    expect(splitPastedItems("'A', \"B\";C,\n , D\t")).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
  });
});
