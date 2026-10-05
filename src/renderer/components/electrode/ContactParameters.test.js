import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

import ContactParameters from './ContactParameters';

const renderContact = (overrides = {}) => {
  const props = {
    switchPosition: 'center',
    quantity: 50,
    maxQuantity: 100,
    unit: '%',
    contactName: 'Contact 2',
    onChange: jest.fn(),
    onQuantityChange: jest.fn(),
    ...overrides,
  };

  render(
    <ContactParameters
      switchPosition={props.switchPosition}
      quantity={props.quantity}
      maxQuantity={props.maxQuantity}
      unit={props.unit}
      contactName={props.contactName}
      quantityReadOnly={props.quantityReadOnly}
      onChange={props.onChange}
      onQuantityChange={props.onQuantityChange}
    />,
  );
  return props;
};

const quantityInput = (name = /Contact 2 quantity/) =>
  screen.getByRole('spinbutton', { name });

describe('ContactParameters', () => {
  test('a polarity click dispatches one polarity transition without a stale quantity transition', () => {
    const { onChange, onQuantityChange } = renderContact();

    fireEvent.click(screen.getByRole('button', { name: 'Positive' }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('right');
    expect(onQuantityChange).not.toHaveBeenCalled();
  });

  test('an active peer quantity can be replaced and commits only on blur', () => {
    const { onChange, onQuantityChange } = renderContact();
    const input = quantityInput();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '70' } });

    expect(input.value).toBe('70');
    expect(onChange).not.toHaveBeenCalled();
    expect(onQuantityChange).not.toHaveBeenCalled();

    fireEvent.blur(input);

    expect(onQuantityChange).toHaveBeenCalledTimes(1);
    expect(onQuantityChange).toHaveBeenCalledWith('center', 70);
  });

  test('Enter commits an edited active peer quantity', () => {
    const { onQuantityChange } = renderContact();
    const input = quantityInput();
    const blurSpy = jest
      .spyOn(input, 'blur')
      .mockImplementation(() => fireEvent.blur(input));

    act(() => input.focus());
    fireEvent.change(input, { target: { value: '65' } });
    expect(onQuantityChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(blurSpy).toHaveBeenCalledTimes(1);
    expect(onQuantityChange).toHaveBeenCalledTimes(1);
    expect(onQuantityChange).toHaveBeenCalledWith('center', 65);
  });

  test('a positive quantity entered while off atomically activates negative polarity', () => {
    const { onChange, onQuantityChange } = renderContact({
      switchPosition: 'left',
      quantity: 0,
    });
    const input = quantityInput();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(onQuantityChange).toHaveBeenCalledTimes(1);
    expect(onQuantityChange).toHaveBeenCalledWith('center', 25);
  });

  test('committed quantities clamp to the configured maximum', () => {
    const { onQuantityChange } = renderContact({ maxQuantity: 60 });
    const input = quantityInput();

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '95' } });
    fireEvent.blur(input);

    expect(onQuantityChange).toHaveBeenCalledTimes(1);
    expect(onQuantityChange).toHaveBeenCalledWith('center', 60);
  });

  test('Activa voltage quantities are read-only when requested', () => {
    const { onQuantityChange } = renderContact({
      quantity: 3.5,
      maxQuantity: 5,
      unit: 'V',
      contactName: 'Activa contact 1',
      quantityReadOnly: true,
    });

    const input = quantityInput(/Activa contact 1 quantity in V/);
    expect(input.disabled).toBe(true);
    expect(onQuantityChange).not.toHaveBeenCalled();
  });
});
