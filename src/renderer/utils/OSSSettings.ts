/**
 * OSS-DBS Settings Module
 *
 * This module defines the settings structure for OSS-DBS (Butenko 2020) visualization model.
 * These settings control stimulation volume estimation and pathway activation parameters.
 */

export interface OSSSettings {
  // Stimulation Volume Settings
  removeLead: boolean;
  eThresholdValue: number;
  eThresholdUnit: string;
  pwAdaptiveVAT: boolean;
  useAdaptiveMeshRefinement: boolean;
  segmentationModel: 'SPM' | 'SynthSeg' | 'Atlas Based';
  encapsulationType: 'Chronic' | 'Acute' | 'None';
  conductivityModel: 'ColeCole4' | 'ColeCole3' | 'Homogeneous (0.2 S/m)';
  anisotropyModel: 'Isotropic' | 'Normative' | 'Patient-Specific';

  // Pathway Activation Settings
  connectomeType: string;
  cableModel: string;
  axonDiameter: number;
  axonDiameterUnit: string;
  axonLength: number;
  axonLengthUnit: string;
  pulseType: string;
  symmetricBiphasic: boolean;
  pulseWidth: number;
  pulseWidthUnit: string;
  axonsIntersectionStatus: 'damaged (non-active)' | 'activated' | 'activated near active contacts';
}

export const defaultOSSSettings: OSSSettings = {
  // Stimulation Volume Defaults
  removeLead: true,
  eThresholdValue: 200,
  eThresholdUnit: 'V/m',
  pwAdaptiveVAT: false,
  useAdaptiveMeshRefinement: false,
  segmentationModel: 'SPM',
  encapsulationType: 'None',
  conductivityModel: 'ColeCole4',
  anisotropyModel: 'Isotropic',

  // Pathway Activation Defaults
  connectomeType: 'Multi-Tract: Sahin_C...',
  cableModel: 'McNeal1976',
  axonDiameter: 3.0,
  axonDiameterUnit: 'µm',
  axonLength: 11.1,
  axonLengthUnit: 'mm',
  pulseType: 'Train',
  symmetricBiphasic: false,
  pulseWidth: 60,
  pulseWidthUnit: 'µs',
  axonsIntersectionStatus: 'damaged (non-active)',
};

/**
 * Validates OSS settings to ensure all values are within acceptable ranges
 */
export const validateOSSSettings = (settings: OSSSettings): boolean => {
  if (settings.eThresholdValue < 0) return false;
  if (settings.axonDiameter <= 0) return false;
  if (settings.axonLength <= 0) return false;
  if (settings.pulseWidth <= 0) return false;
  return true;
};

/**
 * Creates a deep copy of OSS settings
 */
export const cloneOSSSettings = (settings: OSSSettings): OSSSettings => {
  return JSON.parse(JSON.stringify(settings));
};
