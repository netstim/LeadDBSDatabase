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
  eThresholdUnit: 'V/m';
  pwAdaptiveVAT: boolean;
  useAdaptiveMeshRefinement: boolean;
  segmentationModel: 'SPM' | 'SynthSeg' | 'Atlas Based';
  encapsulationType: 'Chronic' | 'Acute' | 'None';
  conductivityModel: 'ColeCole4' | 'ColeCole3' | 'Homogeneous (0.2 S/m)';
  anisotropyModel: 'Isotropic' | 'Normative' | 'Patient-Specific';

  // Pathway Activation Settings
  connectomeType: string;
  connectomeOptions?: string[];
  connectomeAtLaunch?: string;
  cableModel: 'McNeal1976' | 'MRG2002' | 'MRG2002_DS';
  axonDiameter: number;
  axonDiameterValues?: number[];
  axonDiameterUnit: string;
  axonLength: number;
  axonLengthValues?: number[];
  axonLengthUnit: string;
  pulseType: 'Train' | 'Triangle' | 'Ramp-Up' | 'Ramp-Down';
  symmetricBiphasic: boolean;
  pulseWidth: number;
  pulseWidthUnit: string;
  axonsIntersectionStatus:
    | 'damaged (non-active)'
    | 'activated'
    | 'activated near active contacts';
  calculateVAT?: boolean;
  calculatePAM?: boolean;
}

export const OSS_CABLE_MODELS: OSSSettings['cableModel'][] = [
  'McNeal1976',
  'MRG2002',
  'MRG2002_DS',
];

export const OSS_AXON_DIAMETERS = [2.0, 3.0, 5.7, 7.3, 8.7, 10.0, 12.8];

export const OSS_PULSE_TYPES: OSSSettings['pulseType'][] = [
  'Train',
  'Triangle',
  'Ramp-Up',
  'Ramp-Down',
];

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
  connectomeType: 'DBS Tractography Atlas (Middlebrooks 2020)',
  connectomeOptions: ['DBS Tractography Atlas (Middlebrooks 2020)'],
  cableModel: 'McNeal1976',
  axonDiameter: 3.0,
  axonDiameterUnit: 'µm',
  axonLength: 10,
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
  if (
    !Number.isFinite(settings.eThresholdValue) ||
    settings.eThresholdValue < 0
  )
    return false;
  if (!OSS_CABLE_MODELS.includes(settings.cableModel)) return false;
  if (!OSS_AXON_DIAMETERS.includes(settings.axonDiameter)) return false;
  if (!Number.isFinite(settings.axonLength) || settings.axonLength <= 0)
    return false;
  if (!OSS_PULSE_TYPES.includes(settings.pulseType)) return false;
  if (!Number.isFinite(settings.pulseWidth) || settings.pulseWidth <= 0)
    return false;
  return true;
};

/**
 * Merges persisted settings with current defaults. This keeps sessions created
 * by older Programmer versions usable when new OSS-DBS fields are introduced.
 */
export const normalizeOSSSettings = (
  settings?: Partial<OSSSettings> | null,
): OSSSettings => {
  type PersistedOSSSettings = Omit<
    Partial<OSSSettings>,
    'cableModel' | 'pulseType' | 'eThresholdUnit'
  > & {
    cableModel?: string;
    pulseType?: string;
    eThresholdUnit?: string;
  };
  const persistedSettings = (settings || {}) as PersistedOSSSettings;
  const normalized = {
    ...defaultOSSSettings,
    ...persistedSettings,
  };
  const legacyCableModels: Record<string, OSSSettings['cableModel']> = {
    Rattay1999: 'McNeal1976',
    McIntyre2002: 'MRG2002',
  };
  const cableModel = OSS_CABLE_MODELS.includes(
    normalized.cableModel as OSSSettings['cableModel'],
  )
    ? (normalized.cableModel as OSSSettings['cableModel'])
    : legacyCableModels[normalized.cableModel] || defaultOSSSettings.cableModel;
  const pulseType = OSS_PULSE_TYPES.includes(
    normalized.pulseType as OSSSettings['pulseType'],
  )
    ? (normalized.pulseType as OSSSettings['pulseType'])
    : defaultOSSSettings.pulseType;
  const axonDiameter = OSS_AXON_DIAMETERS.includes(
    Number(normalized.axonDiameter),
  )
    ? Number(normalized.axonDiameter)
    : defaultOSSSettings.axonDiameter;
  const thresholdValue =
    persistedSettings.eThresholdUnit === 'mV/m'
      ? Number(normalized.eThresholdValue) / 1000
      : Number(normalized.eThresholdValue);
  const connectomeOptions = Array.from(
    new Set(
      [
        ...(Array.isArray(persistedSettings.connectomeOptions)
          ? persistedSettings.connectomeOptions
          : []),
        normalized.connectomeType,
        defaultOSSSettings.connectomeType,
      ].filter(
        (connectome): connectome is string =>
          typeof connectome === 'string' && connectome.length > 0,
      ),
    ),
  );

  return {
    ...normalized,
    eThresholdValue: Number.isFinite(thresholdValue)
      ? thresholdValue
      : defaultOSSSettings.eThresholdValue,
    eThresholdUnit: 'V/m',
    connectomeOptions,
    cableModel,
    axonDiameter,
    pulseType,
    symmetricBiphasic:
      normalized.symmetricBiphasic ||
      persistedSettings.pulseType === 'Biphasic',
  };
};

/**
 * Creates a deep copy of OSS settings
 */
export const cloneOSSSettings = (settings: OSSSettings): OSSSettings => {
  return JSON.parse(JSON.stringify(settings));
};
