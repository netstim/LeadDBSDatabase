/**
 * OSS Settings Modal Component
 *
 * Provides a modal dialog for configuring OSS-DBS (Butenko 2020) settings.
 * This includes stimulation volume parameters and pathway activation parameters.
 */

import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, ButtonGroup, ToggleButton, Nav } from 'react-bootstrap';
import { OSSSettings, defaultOSSSettings, validateOSSSettings } from '../../utils/OSSSettings';

interface OSSSettingsModalProps {
  show: boolean;
  onHide: () => void;
  settings: OSSSettings;
  onSave: (settings: OSSSettings) => void;
}

type TabKey = 'stimulation' | 'pathway';

function OSSSettingsModal({ show, onHide, settings, onSave }: OSSSettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<OSSSettings>(settings);
  const [activeTab, setActiveTab] = useState<TabKey>('stimulation');

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    if (validateOSSSettings(localSettings)) {
      onSave(localSettings);
      onHide();
    } else {
      alert('Please check your settings. Some values are invalid.');
    }
  };

  const handleReset = () => {
    setLocalSettings(defaultOSSSettings);
  };

  const updateSetting = <K extends keyof OSSSettings>(
    key: K,
    value: OSSSettings[K]
  ) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered>
      <Modal.Header closeButton style={{ borderBottom: '2px solid #e0e0e0' }}>
        <Modal.Title style={{ fontWeight: 'bold', fontSize: '1.5rem', color: '#000000' }}>
          OSS-DBS Settings
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: '0', color: '#000000' }}>
        {/* Tab Navigation */}
        <Nav
          variant="tabs"
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k as TabKey)}
          style={{
            borderBottom: '2px solid #e0e0e0',
            padding: '0 20px',
            backgroundColor: '#f8f9fa',
          }}
        >
          <Nav.Item>
            <Nav.Link
              eventKey="stimulation"
              style={{
                fontWeight: activeTab === 'stimulation' ? 'bold' : 'normal',
                color: '#000000',
                borderBottom: activeTab === 'stimulation' ? '3px solid #000000' : 'none',
                padding: '15px 20px',
              }}
            >
              Estimate Stimulation Volume
            </Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link
              eventKey="pathway"
              style={{
                fontWeight: activeTab === 'pathway' ? 'bold' : 'normal',
                color: '#000000',
                borderBottom: activeTab === 'pathway' ? '3px solid #000000' : 'none',
                padding: '15px 20px',
              }}
            >
              Estimate Pathway Activation
            </Nav.Link>
          </Nav.Item>
        </Nav>

        {/* Tab Content */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto', padding: '25px', color: '#000000' }}>
          {activeTab === 'stimulation' && (
            <div>
              <div
                style={{
                  backgroundColor: '#f5f5f5',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '25px',
                  border: '1px solid #d0d0d0',
                }}
              >
                <h4 style={{ margin: '0', color: '#000000', fontWeight: 'bold' }}>
                  Stimulation Volume Settings
                </h4>
                <p style={{ margin: '5px 0 0 0', color: '#000000', fontSize: '0.9rem' }}>
                  Configure parameters for estimating the volume of tissue activated (VTA)
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#fafafa',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  marginBottom: '20px',
                }}
              >
                <h5 style={{ marginBottom: '20px', color: '#000000' }}>
                  Basic Parameters
                </h5>

                <Form.Group className="mb-4">
                  <Form.Check
                    type="checkbox"
                    label={
                      <span style={{ fontWeight: '500', fontSize: '1rem', color: '#000000' }}>
                        Remove Lead
                      </span>
                    }
                    checked={localSettings.removeLead}
                    onChange={(e) => updateSetting('removeLead', e.target.checked)}
                    style={{ padding: '8px 0' }}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
                    ||E||-threshold
                  </Form.Label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Form.Control
                      type="number"
                      value={localSettings.eThresholdValue}
                      onChange={(e) =>
                        updateSetting('eThresholdValue', parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: '150px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                      }}
                    />
                    <Form.Select
                      value={localSettings.eThresholdUnit}
                      onChange={(e) => updateSetting('eThresholdUnit', e.target.value)}
                      style={{
                        width: '120px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                      }}
                    >
                      <option value="V/m">V/m</option>
                      <option value="mV/m">mV/m</option>
                    </Form.Select>
                  </div>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Check
                    type="checkbox"
                    label={
                      <span style={{ fontWeight: '500', fontSize: '1rem', color: '#000000' }}>
                        PW-Adaptive VAT
                      </span>
                    }
                    checked={localSettings.pwAdaptiveVAT}
                    onChange={(e) => updateSetting('pwAdaptiveVAT', e.target.checked)}
                    style={{ padding: '8px 0' }}
                  />
                </Form.Group>
              </div>

              <div
                style={{
                  backgroundColor: '#fafafa',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                }}
              >
                <h5 style={{ marginBottom: '20px', color: '#000000' }}>
                  Advanced Settings
                </h5>

                <Form.Group className="mb-4">
                  <Form.Check
                    type="checkbox"
                    label={
                      <span style={{ fontWeight: '500', fontSize: '1rem', color: '#000000' }}>
                        Use Adaptive Mesh Refinement
                      </span>
                    }
                    checked={localSettings.useAdaptiveMeshRefinement}
                    onChange={(e) =>
                      updateSetting('useAdaptiveMeshRefinement', e.target.checked)
                    }
                    style={{ padding: '8px 0' }}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '10px', color: '#000000' }}>
                    Segmentation Model
                  </Form.Label>
                  <ButtonGroup style={{ width: '100%' }}>
                    {(['SPM', 'SynthSeg', 'Atlas Based'] as const).map((option) => (
                      <ToggleButton
                        key={option}
                        id={`seg-${option}`}
                        type="radio"
                        variant="outline-secondary"
                        name="segmentationModel"
                        value={option}
                        checked={localSettings.segmentationModel === option}
                        onChange={() => updateSetting('segmentationModel', option)}
                        style={{
                          flex: 1,
                          borderRadius: '6px',
                          border: '1px solid #6c757d',
                          color: '#000000',
                        }}
                      >
                        {option}
                      </ToggleButton>
                    ))}
                  </ButtonGroup>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '10px', color: '#000000' }}>
                    Encapsulation
                  </Form.Label>
                  <ButtonGroup style={{ width: '100%' }}>
                    {(['Chronic', 'Acute', 'None'] as const).map((option) => (
                      <ToggleButton
                        key={option}
                        id={`encap-${option}`}
                        type="radio"
                        variant="outline-secondary"
                        name="encapsulationType"
                        value={option}
                        checked={localSettings.encapsulationType === option}
                        onChange={() => updateSetting('encapsulationType', option)}
                        style={{
                          flex: 1,
                          borderRadius: '6px',
                          border: '1px solid #6c757d',
                          color: '#000000',
                        }}
                      >
                        {option}
                      </ToggleButton>
                    ))}
                  </ButtonGroup>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '10px', color: '#000000' }}>
                    Conductivity
                  </Form.Label>
                  <ButtonGroup style={{ width: '100%' }}>
                    {(['ColeCole4', 'ColeCole3', 'Homogeneous (0.2 S/m)'] as const).map(
                      (option) => (
                        <ToggleButton
                          key={option}
                          id={`cond-${option}`}
                          type="radio"
                        variant="outline-secondary"
                        name="conductivityModel"
                        value={option}
                        checked={localSettings.conductivityModel === option}
                        onChange={() => updateSetting('conductivityModel', option)}
                        style={{
                          flex: 1,
                          borderRadius: '6px',
                          border: '1px solid #6c757d',
                          fontSize: '0.9rem',
                          color: '#000000',
                        }}
                        >
                          {option}
                        </ToggleButton>
                      )
                    )}
                  </ButtonGroup>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '10px', color: '#000000' }}>
                    Anisotropy Model
                  </Form.Label>
                  <ButtonGroup style={{ width: '100%' }}>
                    {(['Isotropic', 'Normative', 'Patient-Specific'] as const).map(
                      (option) => (
                        <ToggleButton
                          key={option}
                          id={`aniso-${option}`}
                          type="radio"
                        variant="outline-secondary"
                        name="anisotropyModel"
                        value={option}
                        checked={localSettings.anisotropyModel === option}
                        onChange={() => updateSetting('anisotropyModel', option)}
                        disabled={option === 'Patient-Specific'}
                        style={{
                          flex: 1,
                          borderRadius: '6px',
                          border: '1px solid #6c757d',
                          opacity: option === 'Patient-Specific' ? 0.5 : 1,
                          color: '#000000',
                        }}
                        >
                          {option}
                        </ToggleButton>
                      )
                    )}
                  </ButtonGroup>
                </Form.Group>
              </div>
            </div>
          )}

          {activeTab === 'pathway' && (
            <div>
              <div
                style={{
                  backgroundColor: '#f5f5f5',
                  padding: '15px',
                  borderRadius: '8px',
                  marginBottom: '25px',
                  border: '1px solid #d0d0d0',
                }}
              >
                <h4 style={{ margin: '0', color: '#000000', fontWeight: 'bold' }}>
                  Pathway Activation Settings
                </h4>
                <p style={{ margin: '5px 0 0 0', color: '#000000', fontSize: '0.9rem' }}>
                  Configure biophysical parameters for estimating pathway activation
                </p>
              </div>

              <div
                style={{
                  backgroundColor: '#fafafa',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                }}
              >

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
                    Connectome
                  </Form.Label>
                  <Form.Select
                    value={localSettings.connectomeType}
                    onChange={(e) => updateSetting('connectomeType', e.target.value)}
                    style={{
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                    }}
                  >
                    <option value="Multi-Tract: Sahin_C...">
                      Multi-Tract: Sahin_C...
                    </option>
                    <option value="Single-Tract">Single-Tract</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
                    Cable Model
                  </Form.Label>
                  <Form.Select
                    value={localSettings.cableModel}
                    onChange={(e) => updateSetting('cableModel', e.target.value)}
                    style={{
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                    }}
                  >
                    <option value="McNeal1976">McNeal1976</option>
                    <option value="Rattay1999">Rattay1999</option>
                    <option value="McIntyre2002">McIntyre2002</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
                    Axon Diameter
                  </Form.Label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Form.Select
                      value={localSettings.axonDiameter}
                      onChange={(e) =>
                        updateSetting('axonDiameter', parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: '150px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                      }}
                    >
                      <option value="1.0">1.0</option>
                      <option value="2.0">2.0</option>
                      <option value="3.0">3.0</option>
                      <option value="4.0">4.0</option>
                      <option value="5.0">5.0</option>
                    </Form.Select>
                    <span style={{ fontWeight: '500', color: '#000000' }}>
                      {localSettings.axonDiameterUnit}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      style={{ borderRadius: '6px', color: '#000000' }}
                    >
                      Custom
                    </Button>
                  </div>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
                    Length
                  </Form.Label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Form.Control
                      type="number"
                      value={localSettings.axonLength}
                      onChange={(e) =>
                        updateSetting('axonLength', parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: '150px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                      }}
                      step="0.1"
                    />
                    <span style={{ fontWeight: '500', color: '#000000' }}>
                      {localSettings.axonLengthUnit}
                    </span>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      style={{ borderRadius: '6px', color: '#000000' }}
                    >
                      pPAM
                    </Button>
                  </div>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
                    Pulse Type
                  </Form.Label>
                  <Form.Select
                    value={localSettings.pulseType}
                    onChange={(e) => updateSetting('pulseType', e.target.value)}
                    style={{
                      borderRadius: '6px',
                      border: '1px solid #ccc',
                    }}
                  >
                    <option value="Train">Train</option>
                    <option value="Single">Single</option>
                    <option value="Biphasic">Biphasic</option>
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Check
                    type="checkbox"
                    label={
                      <span style={{ fontWeight: '500', fontSize: '1rem', color: '#000000' }}>
                        Symmetric Biphasic
                      </span>
                    }
                    checked={localSettings.symmetricBiphasic}
                    onChange={(e) => updateSetting('symmetricBiphasic', e.target.checked)}
                    style={{ padding: '8px 0' }}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '8px', color: '#000000' }}>
                    Width
                  </Form.Label>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <Form.Control
                      type="number"
                      value={localSettings.pulseWidth}
                      onChange={(e) =>
                        updateSetting('pulseWidth', parseFloat(e.target.value) || 0)
                      }
                      style={{
                        width: '150px',
                        borderRadius: '6px',
                        border: '1px solid #ccc',
                      }}
                      step="1"
                    />
                    <span style={{ fontWeight: '500', color: '#000000' }}>
                      {localSettings.pulseWidthUnit}
                    </span>
                  </div>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label style={{ fontWeight: '600', marginBottom: '10px', color: '#000000' }}>
                    Axons intersected by lead are
                  </Form.Label>
                  <ButtonGroup style={{ width: '100%', flexDirection: 'column', gap: '8px' }}>
                    {([
                      'damaged (non-active)',
                      'activated',
                      'activated near active contacts',
                    ] as const).map((option) => (
                      <ToggleButton
                        key={option}
                        id={`axon-${option}`}
                        type="radio"
                        variant="outline-secondary"
                        name="axonsIntersectionStatus"
                        value={option}
                        checked={localSettings.axonsIntersectionStatus === option}
                        onChange={() => updateSetting('axonsIntersectionStatus', option)}
                        style={{
                          width: '100%',
                          borderRadius: '6px',
                          border: '1px solid #6c757d',
                          textAlign: 'left',
                          padding: '10px 15px',
                          color: '#000000',
                        }}
                      >
                        {option}
                      </ToggleButton>
                    ))}
                  </ButtonGroup>
                </Form.Group>
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer
        style={{
          borderTop: '2px solid #e0e0e0',
          padding: '15px 25px',
          backgroundColor: '#f8f9fa',
        }}
      >
        <Button
          variant="outline-secondary"
          onClick={handleReset}
          style={{
            borderRadius: '6px',
            fontWeight: '500',
            marginRight: 'auto',
            color: '#000000',
          }}
        >
          Reset to Defaults
        </Button>
        <Button
          variant="secondary"
          onClick={onHide}
          style={{
            borderRadius: '6px',
            fontWeight: '500',
            marginRight: '10px',
            color: '#000000',
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleSave}
          style={{
            borderRadius: '6px',
            fontWeight: '600',
            padding: '8px 25px',
            color: '#ffffff',
          }}
        >
          Save Settings
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default OSSSettingsModal;
