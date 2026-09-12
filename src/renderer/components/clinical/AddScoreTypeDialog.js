import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Form, InputGroup, Modal } from 'react-bootstrap';

/**
 * Dialog for creating a new clinical score type: a named scale plus the list
 * of items that are scored at each session. Items are edited as individual
 * rows (reorderable, removable); pasting a comma/newline-separated list
 * expands into rows, and an existing score type can be used as a template.
 */

const ITEM_SEPARATORS = /[\n;,\t]+/;

export const splitPastedItems = (text) =>
  String(text || '')
    .split(ITEM_SEPARATORS)
    .map((item) =>
      item
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
        .trim(),
    )
    .filter(Boolean);

const normalized = (value) => value.trim().toLocaleLowerCase('en-US');

// A global stylesheet (TripleToggle.css) paints every <label> white with a
// hover transform; restore normal styling inside this dialog.
const labelStyle = { color: '#212529', transform: 'none', cursor: 'default' };

function AddScoreTypeDialog({
  show,
  existingScoreTypes = [],
  scoreTemplates = {},
  onClose,
  onCreate,
}) {
  const [name, setName] = useState('');
  const [items, setItems] = useState(['']);
  const [template, setTemplate] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving] = useState(false);
  const itemRefs = useRef([]);
  const focusIndexRef = useRef(null);

  useEffect(() => {
    if (show) {
      setName('');
      setItems(['']);
      setTemplate('');
      setSubmitError('');
      setSaving(false);
    }
  }, [show]);

  useEffect(() => {
    const index = focusIndexRef.current;
    if (index !== null && itemRefs.current[index]) {
      itemRefs.current[index].focus();
      focusIndexRef.current = null;
    }
  }, [items]);

  const trimmedName = name.trim();
  const nameTaken = useMemo(
    () =>
      existingScoreTypes.some(
        (existing) => normalized(existing) === normalized(trimmedName),
      ),
    [existingScoreTypes, trimmedName],
  );

  const trimmedItems = items.map((item) => item.trim());
  const filledItems = trimmedItems.filter(Boolean);
  const duplicateValues = useMemo(() => {
    const seen = new Set();
    const duplicates = new Set();
    filledItems.forEach((item) => {
      const key = normalized(item);
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    });
    return duplicates;
  }, [items]);

  const canCreate =
    !saving &&
    trimmedName.length > 0 &&
    !nameTaken &&
    filledItems.length > 0 &&
    duplicateValues.size === 0;

  const setItemAt = (index, value) => {
    setItems((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
    setSubmitError('');
  };

  const insertItemsAt = (index, values, replaceCurrent) => {
    setItems((current) => {
      const next = [...current];
      next.splice(replaceCurrent ? index : index + 1, replaceCurrent ? 1 : 0, ...values);
      focusIndexRef.current = Math.min(
        next.length - 1,
        index + values.length - (replaceCurrent ? 1 : 0),
      );
      return next;
    });
    setSubmitError('');
  };

  const addItemAfter = (index) => {
    insertItemsAt(index, [''], false);
  };

  const removeItemAt = (index) => {
    setItems((current) => {
      const next = current.filter((_, itemIndex) => itemIndex !== index);
      return next.length > 0 ? next : [''];
    });
    setSubmitError('');
  };

  const moveItem = (index, direction) => {
    setItems((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleItemPaste = (index, event) => {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!ITEM_SEPARATORS.test(text)) return; // Plain text pastes normally.
    event.preventDefault();
    const parts = splitPastedItems(text);
    if (parts.length === 0) return;
    insertItemsAt(index, parts, items[index].trim() === '');
  };

  const handleItemKeyDown = (index, event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addItemAfter(index);
    }
  };

  const applyTemplate = (templateName) => {
    setTemplate(templateName);
    if (!templateName) return;
    const templateItems = Object.keys(scoreTemplates[templateName] || {}).filter(
      (item) => item.toLocaleLowerCase('en-US') !== 'timeline',
    );
    if (templateItems.length > 0) {
      setItems(templateItems);
      setSubmitError('');
    }
  };

  const handleCreate = async () => {
    if (!canCreate) return;
    setSaving(true);
    setSubmitError('');
    try {
      await onCreate(trimmedName, filledItems);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'The score type could not be added.',
      );
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <Modal
      show={show}
      onHide={saving ? undefined : onClose}
      size="lg"
      centered
      scrollable
    >
      <Modal.Header closeButton={!saving}>
        <Modal.Title>New clinical score type</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group className="mb-3" controlId="score-type-name">
          <Form.Label style={labelStyle}>Score type name</Form.Label>
          <Form.Control
            type="text"
            placeholder="e.g. UPDRS-III, Y-BOCS, Seizure Frequency"
            value={name}
            autoFocus
            isInvalid={nameTaken}
            onChange={(event) => {
              setName(event.target.value);
              setSubmitError('');
            }}
          />
          {nameTaken ? (
            <Form.Control.Feedback type="invalid">
              A score type named “{trimmedName}” already exists.
            </Form.Control.Feedback>
          ) : (
            <Form.Text muted>
              Shown in the score type dropdown and saved with every session.
            </Form.Text>
          )}
        </Form.Group>

        {existingScoreTypes.length > 0 && (
          <Form.Group className="mb-3" controlId="score-type-template">
            <Form.Label style={labelStyle}>Start from an existing type (optional)</Form.Label>
            <Form.Select
              value={template}
              onChange={(event) => applyTemplate(event.target.value)}
            >
              <option value="">Blank — start from scratch</option>
              {existingScoreTypes.map((existing) => (
                <option key={existing} value={existing}>
                  Copy items from {existing}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        )}

        <Form.Group controlId="score-type-items">
          <Form.Label style={labelStyle}>
            Score items{' '}
            <span style={{ fontWeight: 'normal', color: '#6c757d' }}>
              ({filledItems.length} item{filledItems.length === 1 ? '' : 's'})
            </span>
          </Form.Label>
          <Form.Text muted style={{ display: 'block', marginBottom: '8px' }}>
            Each item becomes a numeric field scored at every session. Press
            Enter for a new row, or paste a comma/newline-separated list.
          </Form.Text>
          {items.map((item, index) => {
            const isDuplicate =
              item.trim() !== '' && duplicateValues.has(normalized(item));
            return (
              // Rows have no stable identity beyond their position.
              // eslint-disable-next-line react/no-array-index-key
              <InputGroup className="mb-2" key={index} hasValidation>
                <InputGroup.Text
                  style={{ width: '44px', justifyContent: 'center' }}
                >
                  {index + 1}
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder={
                    index === 0 ? 'e.g. 3.1: Speech' : 'Item name'
                  }
                  value={item}
                  isInvalid={isDuplicate}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  onChange={(event) => setItemAt(index, event.target.value)}
                  onPaste={(event) => handleItemPaste(index, event)}
                  onKeyDown={(event) => handleItemKeyDown(index, event)}
                  aria-label={`Score item ${index + 1}`}
                />
                <Button
                  variant="outline-secondary"
                  onClick={() => moveItem(index, -1)}
                  disabled={index === 0}
                  title="Move up"
                  aria-label={`Move item ${index + 1} up`}
                >
                  ↑
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1}
                  title="Move down"
                  aria-label={`Move item ${index + 1} down`}
                >
                  ↓
                </Button>
                <Button
                  variant="outline-danger"
                  onClick={() => removeItemAt(index)}
                  title="Remove item"
                  aria-label={`Remove item ${index + 1}`}
                >
                  ✕
                </Button>
                {isDuplicate && (
                  <Form.Control.Feedback type="invalid">
                    Duplicate item name.
                  </Form.Control.Feedback>
                )}
              </InputGroup>
            );
          })}
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => addItemAfter(items.length - 1)}
          >
            + Add item
          </Button>
        </Form.Group>

        {submitError && (
          <Alert variant="danger" className="mt-3 mb-0">
            {submitError}
          </Alert>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" onClick={handleCreate} disabled={!canCreate}>
          {saving ? 'Creating…' : 'Create score type'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default AddScoreTypeDialog;
