import React, { useState, useEffect } from 'react';
import { ToggleButton, ToggleButtonGroup, TextField } from '@mui/material';
import { styled } from '@mui/system';

const CONTACT_CONTROL_WIDTH = 'clamp(104px, 9vw, 112px)';

const ContactParametersRoot = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  width: CONTACT_CONTROL_WIDTH,
  maxWidth: '100%',
  minWidth: 0,
});

const StyledToggleButton = styled(ToggleButton)(() => ({
  borderColor: 'transparent',
  minWidth: 0,
  minHeight: 0,
  height: '24px',
  padding: '1px 2px',
  fontSize: 'clamp(11px, 1vw, 13px)',
  fontWeight: 600,
  lineHeight: 1,
  letterSpacing: 0,
  whiteSpace: 'nowrap',
  backgroundColor: 'transparent',
  '&.Mui-selected': {
    backgroundColor: 'transparent',
    color: '#fff',
    borderColor: 'transparent',
  },
  '&:hover': {
    backgroundColor: 'transparent',
    color: '#fff',
  },
  '&.Mui-focusVisible': {
    outline: '2px solid rgba(255, 255, 255, 0.9)',
    outlineOffset: '-2px',
  },
}));

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(() => ({
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1fr',
  width: '100%',
  height: '24px',
  '& .MuiToggleButton-root': {
    margin: 0,
  },
}));

const StyledTextField = styled(TextField)(() => ({
  minWidth: 0,
  '& .MuiOutlinedInput-root': {
    width: '100%',
    height: '30px',
    minWidth: 0,
    padding: 0,
    color: 'white',
    fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
    '& fieldset': {
      borderColor: 'transparent',
    },
    '&:hover fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.45)',
    },
    '&.Mui-focused fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.9)',
    },
  },
  '& .MuiOutlinedInput-input': {
    boxSizing: 'border-box',
    height: '30px',
    minWidth: 0,
    padding: '0 2px',
    textAlign: 'center',
    lineHeight: 1,
    MozAppearance: 'textfield',
    '&::-webkit-inner-spin-button, &::-webkit-outer-spin-button': {
      margin: 0,
      WebkitAppearance: 'none',
    },
  },
}));

const QuantityRow = styled('div')({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  width: '100%',
  minWidth: 0,
  marginTop: '1px',
  columnGap: '2px',
});

const QuantityUnit = styled('span')({
  color: 'white',
  fontSize: 'clamp(10px, 0.85vw, 12px)',
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: 'nowrap',
});

const formatQuantityForDisplay = (quantity) => {
  const numericQuantity = Number(quantity);
  if (!Number.isFinite(numericQuantity)) return '0';
  if (Number.isInteger(numericQuantity)) return String(numericQuantity);

  const decimalPlaces = Math.abs(numericQuantity) < 0.01 ? 4 : 2;
  return String(Number(numericQuantity.toFixed(decimalPlaces)));
};

const quantityFontSize = (displayQuantity) => {
  if (displayQuantity.length <= 3) return '24px';
  if (displayQuantity.length <= 5) return '21px';
  if (displayQuantity.length <= 7) return '18px';
  return '15px';
};

function ContactParameters({
  switchPosition,
  quantity,
  maxQuantity = Number.POSITIVE_INFINITY,
  unit = '',
  contactName = 'Contact',
  quantityReadOnly = false,
  onChange = () => {},
  onQuantityChange = () => {},
}) {
  const [currentPosition, setCurrentPosition] = useState(switchPosition);
  const [currentQuantity, setCurrentQuantity] = useState(quantity ?? 0);
  const [quantityDraft, setQuantityDraft] = useState(
    formatQuantityForDisplay(quantity ?? 0),
  );
  const [isEditingQuantity, setIsEditingQuantity] = useState(false);

  useEffect(() => {
    setCurrentPosition(switchPosition);
    setCurrentQuantity(quantity ?? 0);
    if (!isEditingQuantity) {
      setQuantityDraft(formatQuantityForDisplay(quantity ?? 0));
    }
  }, [switchPosition, quantity, isEditingQuantity]);

  const handleSwitchChange = (event, newPosition) => {
    if (newPosition !== null) {
      setCurrentPosition(newPosition);
      if (newPosition === 'left') {
        setCurrentQuantity(0);
        setQuantityDraft('0');
      }
      // Polarity and its implied quantity are one state transition. Dispatching
      // a second quantity callback here lets stale parent state overwrite it.
      onChange(newPosition);
    }
  };

  const commitQuantity = (rawQuantity) => {
    const parsedQuantity = Number.parseFloat(rawQuantity);
    if (!Number.isFinite(parsedQuantity)) {
      setQuantityDraft(formatQuantityForDisplay(currentQuantity));
      return;
    }
    const finiteMaximum = Number.isFinite(maxQuantity)
      ? Math.max(0, maxQuantity)
      : Number.POSITIVE_INFINITY;
    const quantityValue = Math.min(Math.max(parsedQuantity, 0), finiteMaximum);
    let nextPosition = currentPosition;
    if (quantityValue !== 0 && currentPosition === 'left') {
      nextPosition = 'center';
      setCurrentPosition(nextPosition);
    }

    setCurrentQuantity(quantityValue);
    setQuantityDraft(formatQuantityForDisplay(quantityValue));
    onQuantityChange(nextPosition, quantityValue);
  };

  const handleQuantityChange = (event) => {
    setQuantityDraft(event.target.value);
  };

  const handleQuantityBlur = (event) => {
    setIsEditingQuantity(false);
    commitQuantity(event.target.value);
  };

  const displayQuantity = isEditingQuantity
    ? quantityDraft
    : formatQuantityForDisplay(currentQuantity);
  const exactQuantityLabel = `${currentQuantity}${unit ? ` ${unit}` : ''}`;

  return (
    <ContactParametersRoot>
      <StyledToggleButtonGroup
        value={currentPosition}
        exclusive
        onChange={handleSwitchChange}
        aria-label="Contact polarity"
      >
        <StyledToggleButton value="left" aria-label="Off">
          OFF
        </StyledToggleButton>
        <StyledToggleButton value="center" aria-label="Negative">
          -
        </StyledToggleButton>
        <StyledToggleButton value="right" aria-label="Positive">
          +
        </StyledToggleButton>
      </StyledToggleButtonGroup>

      <QuantityRow>
        <StyledTextField
          type="number"
          disabled={quantityReadOnly}
          inputProps={{
            min: 0,
            max: Number.isFinite(maxQuantity)
              ? Math.max(0, maxQuantity)
              : undefined,
            step: 'any',
            'aria-label': `${contactName} quantity${unit ? ` in ${unit}` : ''}`,
            'aria-valuetext': exactQuantityLabel,
            title: `Exact contact quantity: ${exactQuantityLabel}`,
          }}
          value={displayQuantity}
          onChange={handleQuantityChange}
          onFocus={(event) => {
            setIsEditingQuantity(true);
            event.currentTarget.select();
          }}
          onBlur={handleQuantityBlur}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.target.blur();
          }}
          size="small"
          sx={{
            '& .MuiOutlinedInput-input': {
              fontSize: quantityFontSize(displayQuantity),
            },
          }}
        />
        {unit && <QuantityUnit aria-hidden="true">{unit}</QuantityUnit>}
      </QuantityRow>
    </ContactParametersRoot>
  );
}

export default ContactParameters;
