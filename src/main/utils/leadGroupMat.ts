import path from 'path';
import {
  encodeMatFile,
  mat,
  type MatStructValue,
  type MatValue,
} from './matFileWriter';
import type { PreparedLeadGroupExport } from './leadGroupExport';

const SOURCE_FIELDS = [
  'Rs1',
  'Rs2',
  'Rs3',
  'Rs4',
  'Ls1',
  'Ls2',
  'Ls3',
  'Ls4',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const scalarNumber = (value: unknown, label: string): number | null => {
  let candidate = value;
  while (Array.isArray(candidate)) {
    if (candidate.length === 0) return null;
    if (candidate.length !== 1) {
      throw new Error(`${label} must be a scalar.`);
    }
    [candidate] = candidate;
  }
  if (candidate === null || candidate === undefined || candidate === '') {
    return null;
  }
  let numeric = Number.NaN;
  if (typeof candidate === 'number') {
    numeric = candidate;
  } else if (typeof candidate === 'string' && candidate.trim()) {
    numeric = Number(candidate);
  }
  if (!Number.isFinite(numeric)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return numeric;
};

const parseAmplitudeRow = (value: unknown, label: string): number[] => {
  if (Array.isArray(value) && value.length === 4) {
    return value.map((entry, index) => {
      const numeric = scalarNumber(entry, `${label} source ${index + 1}`);
      if (numeric === null || numeric < 0) {
        throw new Error(`${label} must contain non-negative amplitudes.`);
      }
      return numeric;
    });
  }
  const scalar = scalarNumber(value, label);
  if (scalar === null || scalar < 0) {
    throw new Error(`${label} must contain non-negative amplitudes.`);
  }
  return [scalar, 0, 0, 0];
};

const parseRedundantAmplitude = (value: unknown): number[][] | null => {
  if (value === null || value === undefined) return null;
  let rows: unknown[];
  if (Array.isArray(value) && value.length === 2) {
    rows = value;
  } else if (isRecord(value)) {
    rows = [value.rightAmplitude, value.leftAmplitude];
  } else {
    throw new Error('The selected stimulation has an invalid amplitude array.');
  }
  return [
    parseAmplitudeRow(rows[0], 'Right amplitude'),
    parseAmplitudeRow(rows[1], 'Left amplitude'),
  ];
};

const contactIndices = (source: Record<string, unknown>): number[] =>
  Object.keys(source)
    .map((key) => /^k(\d+)$/.exec(key)?.[1])
    .filter((index): index is string => index !== undefined)
    .map(Number)
    .sort((left, right) => left - right);

const isConsecutive = (indices: number[], start: number): boolean =>
  indices.length > 0 &&
  indices.every((value, index) => value === start + index);

const remapLegacySourceContacts = (
  source: Record<string, unknown>,
  oldStart: number,
  contactCount: number,
): Record<string, MatValue> => ({
  ...Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => !/^k\d+$/.test(key))
      .map(([key, value]) => [key, value as MatValue]),
  ),
  ...Object.fromEntries(
    Array.from({ length: contactCount }, (_unused, index) => [
      `k${index + 1}`,
      source[`k${oldStart + index}`] as MatValue,
    ]),
  ),
});

const normalizedContact = (
  value: unknown,
  label: string,
  sourceAmplitude: number,
): Record<string, MatValue> => {
  if (!isRecord(value)) throw new Error(`${label} is missing or invalid.`);
  const percentage = scalarNumber(value.perc, `${label} percentage`) ?? 0;
  if (percentage < 0 || percentage > 100) {
    throw new Error(`${label} percentage must be between 0 and 100.`);
  }
  const rawPolarity = scalarNumber(value.pol, `${label} polarity`);
  const polarity = rawPolarity ?? (percentage === 0 ? 0 : Number.NaN);
  if (!Number.isInteger(polarity) || ![0, 1, 2].includes(polarity)) {
    throw new Error(`${label} has an invalid polarity.`);
  }
  if (percentage > 0 && ![1, 2].includes(polarity)) {
    throw new Error(`${label} needs a polarity when it is active.`);
  }
  const impedance = scalarNumber(value.imp, `${label} impedance`) ?? 1;
  if (sourceAmplitude > 0 && percentage > 0 && impedance <= 0) {
    throw new Error(`${label} impedance must be positive when active.`);
  }
  return {
    ...(value as Record<string, MatValue>),
    perc: percentage,
    pol: polarity,
    imp: impedance,
  };
};

const normalizedCase = (
  value: unknown,
  sourceAmplitude: number,
  label: string,
): Record<string, MatValue> => {
  if (!isRecord(value) && sourceAmplitude > 0) {
    throw new Error(`${label} is missing its case electrode.`);
  }
  const input = isRecord(value) ? value : {};
  const percentage =
    scalarNumber(input.perc, `${label} case percentage`) ??
    (sourceAmplitude === 0 ? 100 : Number.NaN);
  const polarity =
    scalarNumber(input.pol, `${label} case polarity`) ??
    (sourceAmplitude === 0 ? 2 : Number.NaN);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error(`${label} case percentage must be between 0 and 100.`);
  }
  if (!Number.isInteger(polarity) || ![0, 1, 2].includes(polarity)) {
    throw new Error(`${label} case has an invalid polarity.`);
  }
  if (percentage > 0 && ![1, 2].includes(polarity)) {
    throw new Error(`${label} case needs a polarity when it is active.`);
  }
  return {
    ...(input as Record<string, MatValue>),
    perc: percentage,
    pol: polarity,
  };
};

const rawAllocationsAreZero = (source: Record<string, unknown>): boolean =>
  Object.entries(source)
    .filter(([key]) => /^k\d+$/.test(key))
    .every(([, contact]) => {
      if (!isRecord(contact)) return false;
      try {
        return (scalarNumber(contact.perc, 'Contact percentage') ?? 0) === 0;
      } catch {
        return false;
      }
    });

type SourceField = (typeof SOURCE_FIELDS)[number];

interface NormalizedSources {
  fields: Record<SourceField, MatStructValue>;
  count: number;
  amplitudes: number[][];
  activeContacts: number[][];
  active: number[];
}

const normalizeSourceFields = (
  raw: Record<string, unknown>,
): NormalizedSources => {
  const redundantAmplitude = parseRedundantAmplitude(raw.amplitude);
  const sources = Object.fromEntries(
    SOURCE_FIELDS.map((field) => [field, raw[field] as MatStructValue]),
  ) as unknown as Record<SourceField, MatStructValue>;
  const indices = Object.fromEntries(
    SOURCE_FIELDS.map((field) => [field, contactIndices(sources[field])]),
  ) as Record<SourceField, number[]>;
  const slotCount = indices.Rs1.length;
  if (slotCount < 1 || slotCount > 16) {
    throw new Error(
      'The selected stimulation must specify between 1 and 16 contacts.',
    );
  }
  const explicitCount = scalarNumber(raw.numContacts, 'Contact count');

  const modern = SOURCE_FIELDS.every(
    (field) =>
      indices[field].length === slotCount && isConsecutive(indices[field], 1),
  );
  const legacyRight =
    slotCount === 8 &&
    SOURCE_FIELDS.slice(0, 4).every(
      (field) =>
        indices[field].length === slotCount && isConsecutive(indices[field], 0),
    );
  const legacyLeft =
    slotCount === 8 &&
    SOURCE_FIELDS.slice(4).every(
      (field) =>
        indices[field].length === slotCount && isConsecutive(indices[field], 8),
    );
  const versionIsAbsent =
    raw.ver === null ||
    raw.ver === undefined ||
    raw.ver === '' ||
    (Array.isArray(raw.ver) && raw.ver.length === 0);
  const legacy = legacyRight && legacyLeft && versionIsAbsent;
  if (!modern && !legacy) {
    throw new Error(
      'The selected stimulation uses an ambiguous or mixed contact-key scheme.',
    );
  }

  let count: number;
  if (legacy) {
    if (explicitCount === null) {
      throw new Error(
        'The legacy stimulation lacks an electrode contact count; reopen and save it in Lead-DBS before exporting.',
      );
    }
    if (
      !Number.isInteger(explicitCount) ||
      explicitCount < 1 ||
      explicitCount > 8
    ) {
      throw new Error(
        'The legacy stimulation has an invalid electrode contact count.',
      );
    }
    count = explicitCount;
  } else {
    count = slotCount;
    if (
      explicitCount !== null &&
      (!Number.isInteger(explicitCount) || explicitCount !== count)
    ) {
      throw new Error(
        'The selected stimulation has an inconsistent contact count.',
      );
    }
  }

  const contactMapped = Object.fromEntries(
    SOURCE_FIELDS.map((field, index) => [
      field,
      legacy
        ? remapLegacySourceContacts(sources[field], index < 4 ? 0 : 8, count)
        : sources[field],
    ]),
  ) as Record<SourceField, Record<string, unknown>>;
  const amplitudes = [new Array<number>(4), new Array<number>(4)];
  const fields = Object.fromEntries(
    SOURCE_FIELDS.map((field, sourceIndex) => {
      const source = contactMapped[field];
      const sideIndex = sourceIndex < 4 ? 0 : 1;
      const sideSourceIndex = sourceIndex % 4;
      let amplitude = scalarNumber(source.amp, `${field} amplitude`);
      if (amplitude === null) {
        const corroborated = redundantAmplitude?.[sideIndex][sideSourceIndex];
        if (corroborated !== undefined) amplitude = corroborated;
        else if (rawAllocationsAreZero(source)) amplitude = 0;
        else throw new Error(`${field} is missing its source amplitude.`);
      }
      if (amplitude < 0) {
        throw new Error(`${field} amplitude must be non-negative.`);
      }
      const voltageMode = scalarNumber(source.va, `${field} stimulation mode`);
      const va = voltageMode ?? (amplitude === 0 ? 2 : Number.NaN);
      if (!Number.isInteger(va) || ![1, 2].includes(va)) {
        throw new Error(`${field} has an invalid stimulation mode.`);
      }
      const pulseWidthValue = scalarNumber(
        source.pulseWidth,
        `${field} pulse width`,
      );
      let pulseWidth = pulseWidthValue;
      if (
        pulseWidth === null &&
        amplitude > 0 &&
        typeof raw.model === 'string' &&
        /OSS-DBS/i.test(raw.model)
      ) {
        pulseWidth = isRecord(raw.ossSettings)
          ? scalarNumber(
              raw.ossSettings.pulseWidth,
              'OSS-DBS pulse width setting',
            )
          : null;
        if (pulseWidth === null) {
          throw new Error(
            `${field} is missing the pulse width required for OSS-DBS.`,
          );
        }
      }
      pulseWidth ??= 60;
      if (pulseWidth <= 0) {
        throw new Error(`${field} pulse width must be positive.`);
      }
      const contacts = Object.fromEntries(
        Array.from({ length: count }, (_unused, contactIndex) => {
          const key = `k${contactIndex + 1}`;
          return [
            key,
            normalizedContact(source[key], `${field} ${key}`, amplitude),
          ];
        }),
      );
      const caseElectrode = normalizedCase(source.case, amplitude, field);
      if (amplitude > 0) {
        const activePolarities = [...Object.values(contacts), caseElectrode]
          .filter((contact) => Number(contact.perc) > 0)
          .map((contact) => Number(contact.pol));
        const hasActiveContact = Object.values(contacts).some(
          (contact) => Number(contact.perc) > 0,
        );
        if (
          !hasActiveContact ||
          !activePolarities.includes(1) ||
          !activePolarities.includes(2)
        ) {
          throw new Error(
            `${field} needs an active contact and both stimulation polarities.`,
          );
        }
      }
      amplitudes[sideIndex][sideSourceIndex] = amplitude;
      return [
        field,
        {
          ...(source as Record<string, MatValue>),
          ...contacts,
          amp: amplitude,
          va,
          pulseWidth,
          case: caseElectrode,
        },
      ];
    }),
  ) as unknown as Record<SourceField, MatStructValue>;

  const stimulatedSideModes: Array<number | null> = [null, null];
  amplitudes.forEach((sideAmplitudes, sideIndex) => {
    const activeSources = sideAmplitudes
      .map((amplitude, sourceIndex) => ({ amplitude, sourceIndex }))
      .filter(({ amplitude }) => amplitude > 0);
    const modes = new Set(
      activeSources.map(({ sourceIndex }) =>
        Number(fields[SOURCE_FIELDS[sideIndex * 4 + sourceIndex]].va),
      ),
    );
    if (modes.size > 1 || (modes.has(2) && activeSources.length > 1)) {
      throw new Error(
        'A hemisphere cannot mix stimulation modes or multiple current-controlled sources.',
      );
    }
    stimulatedSideModes[sideIndex] =
      activeSources.length > 0 ? [...modes][0] : null;
  });
  if (
    stimulatedSideModes[0] !== null &&
    stimulatedSideModes[1] !== null &&
    stimulatedSideModes[0] !== stimulatedSideModes[1]
  ) {
    throw new Error(
      'Both stimulated hemispheres must use the same stimulation mode.',
    );
  }

  if (redundantAmplitude) {
    redundantAmplitude.forEach((side, sideIndex) =>
      side.forEach((amplitude, sourceIndex) => {
        const normalizedAmplitude = amplitudes[sideIndex][sourceIndex];
        const tolerance =
          1e-9 *
          Math.max(1, Math.abs(amplitude), Math.abs(normalizedAmplitude));
        if (Math.abs(amplitude - normalizedAmplitude) > tolerance) {
          throw new Error(
            'The redundant amplitude array disagrees with the source amplitudes.',
          );
        }
      }),
    );
  }

  const activeContacts = [0, 1].map((sideIndex) =>
    Array.from({ length: count }, (_unused, contactIndex) =>
      SOURCE_FIELDS.slice(sideIndex * 4, sideIndex * 4 + 4).some((field) => {
        const source = fields[field];
        const contact = source[`k${contactIndex + 1}`] as MatStructValue;
        return Number(source.amp) > 0 && Number(contact.perc) > 0;
      })
        ? 1
        : 0,
    ),
  );
  let active: number[] | null = null;
  if (Array.isArray(raw.active) && raw.active.length === 2) {
    try {
      const parsed = raw.active.map((value, index) =>
        scalarNumber(value, `Selected source ${index + 1}`),
      );
      if (
        parsed.every(
          (value): value is number =>
            value !== null &&
            Number.isInteger(value) &&
            value >= 1 &&
            value <= 4,
        )
      ) {
        active = parsed;
      }
    } catch {
      active = null;
    }
  }
  if (!active) {
    active = amplitudes.map((side) => {
      const firstActive = side.findIndex((amplitude) => amplitude > 0);
      return firstActive >= 0 ? firstActive + 1 : 1;
    });
  }

  return { fields, count, amplitudes, activeContacts, active };
};

const normalizeStimulation = (
  raw: Record<string, unknown>,
  analysisId: string,
): MatStructValue => {
  SOURCE_FIELDS.forEach((field) => {
    if (
      !raw[field] ||
      typeof raw[field] !== 'object' ||
      Array.isArray(raw[field])
    ) {
      throw new Error(`The selected stimulation is missing ${field}.`);
    }
  });
  if (typeof raw.model !== 'string' || !raw.model.trim()) {
    throw new Error('The selected stimulation does not specify a VTA model.');
  }
  const normalizedSources = normalizeSourceFields(raw);

  const normalized: Record<string, MatValue> = {
    ...(raw as Record<string, MatValue>),
    ...normalizedSources.fields,
    label: `gs_${analysisId}`,
    monopolarmodel: 0,
    amplitude: mat.cell(
      normalizedSources.amplitudes.map((row) => mat.double(row, [1, 4])),
      [1, 2],
    ),
    numContacts: normalizedSources.count,
    activecontacts: mat.cell(
      normalizedSources.activeContacts.map((row) =>
        mat.double(row, [1, normalizedSources.count]),
      ),
      [1, 2],
    ),
    active: mat.double(normalizedSources.active, [1, 2]),
    sources: mat.double([1, 2, 3, 4], [1, 4]),
    volume: mat.double([0, 0], [1, 2]),
    ver: '2.0',
    template:
      typeof raw.template === 'number' || typeof raw.template === 'boolean'
        ? raw.template
        : 0,
  };

  return normalized;
};

const trailingSeparator = (folder: string): string =>
  folder.endsWith(path.sep) ? folder : `${folder}${path.sep}`;

const MAX_CLINICAL_FILE_LABEL_LENGTH = 96;

const clinicalFileLabelBase = (outcome: {
  timeline: string;
  scoreType: string;
  mode: 'total' | 'item';
  item?: string;
}): string => {
  const detail = outcome.mode === 'total' ? 'total' : outcome.item || 'item';
  const normalized = [outcome.timeline, outcome.scoreType, detail]
    .join('_')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `SPARK_${normalized || 'clinical'}`.slice(
    0,
    MAX_CLINICAL_FILE_LABEL_LENGTH,
  );
};

export const createLeadGroupClinicalLabels = (
  outcomes: Array<{
    timeline: string;
    scoreType: string;
    mode: 'total' | 'item';
    item?: string;
  }>,
): string[] => {
  const used = new Set<string>();
  return outcomes.map((outcome) => {
    const base = clinicalFileLabelBase(outcome);
    let candidate = base;
    let suffixNumber = 2;
    while (used.has(candidate.toLocaleLowerCase('en-US'))) {
      const suffix = `_${suffixNumber}`;
      candidate = `${base.slice(
        0,
        MAX_CLINICAL_FILE_LABEL_LENGTH - suffix.length,
      )}${suffix}`;
      suffixNumber += 1;
    }
    used.add(candidate.toLocaleLowerCase('en-US'));
    return candidate;
  });
};

export const buildLeadGroupMatFile = (
  prepared: PreparedLeadGroupExport,
  createdAt = new Date(),
): Buffer => {
  const patientCount = prepared.patients.length;
  const outcomeCount = prepared.outcomes.length;
  if (patientCount === 0)
    throw new Error('A Lead-Group needs at least one patient.');
  if (outcomeCount === 0)
    throw new Error('Select at least one clinical outcome.');

  const stimulations = prepared.patients.map(({ stimulation }) =>
    normalizeStimulation(stimulation, prepared.analysisId),
  );
  const stimulationModels = stimulations.map(({ model }) => model);
  if (
    stimulationModels.some(
      (model) => typeof model !== 'string' || model !== stimulationModels[0],
    )
  ) {
    throw new Error(
      'All selected stimulations must use the same VTA model for one Lead-Group analysis.',
    );
  }
  const clinicalLabels = createLeadGroupClinicalLabels(prepared.outcomes);
  const clinicalVariables = prepared.outcomes.map(({ values }) =>
    mat.double(
      prepared.patients.map(({ id }) => {
        const value = values[id];
        return typeof value === 'number' && Number.isFinite(value)
          ? value
          : Number.NaN;
      }),
      [patientCount, 1],
    ),
  );
  const vatModel = stimulations[0].model;
  const ui = {
    listselect: mat.double(
      Array.from({ length: patientCount }, (_unused, index) => index + 1),
      [1, patientCount],
    ),
    clinicallist: 1,
    hlactivecontcheck: 0,
    showpassivecontcheck: 1,
    showactivecontcheck: 1,
    showisovolumecheck: 0,
    isovscloudpopup: 1,
    volumeintersections: 1,
    fibercounts: 1,
    elrendering: 1,
    statvat: 0,
    elmodelselect: 1,
    normregpopup: 1,
    colorpointcloudcheck: 0,
    mirrorsides: 0,
    showdiscfibers: 0,
    lc: { graphmetric: 1, normalization: 1, smooth: 1 },
  };

  const M: MatStructValue = {
    patient: {
      list: mat.cell(
        prepared.patients.map(({ patientFolder }) => patientFolder),
        [patientCount, 1],
      ),
      group: mat.double(
        Array.from({ length: patientCount }, () => 1),
        [patientCount, 1],
      ),
    },
    groups: {
      group: mat.double([1], [1, 1]),
      label: mat.cell(['Group 1'], [1, 1]),
      color: mat.double([0.7, 0.7, 0.7], [1, 3]),
      colorschosen: 1,
    },
    guid: prepared.analysisId,
    clinical: {
      vars: mat.cell(clinicalVariables, [1, outcomeCount]),
      labels: mat.cell(clinicalLabels, [1, outcomeCount]),
    },
    vilist: mat.cell([], [0, 0]),
    fclist: mat.cell([], [0, 0]),
    ui,
    S: mat.struct(stimulations, [1, patientCount]),
    vatmodel: typeof vatModel === 'string' ? vatModel : mat.empty(),
    root: trailingSeparator(prepared.analysisDirectory),
    notes: `Created by SPARK-DBS on ${createdAt.toISOString()}. elstruct was intentionally omitted and can be populated by Lead-DBS from the patient reconstructions.`,
    spark: {
      schemaVersion: 1,
      createdBy: 'SPARK-DBS',
      createdAt: createdAt.toISOString(),
      missingClinicalValues: 'NaN',
      subjects: mat.struct(
        prepared.patients.map((patient) => ({
          id: patient.id,
          folder: patient.patientFolder,
          stimulationTimeline: patient.stimulationTimeline,
        })),
        [1, patientCount],
      ),
      clinical: mat.struct(
        prepared.outcomes.map((outcome, index) => ({
          label: outcome.label,
          fileLabel: clinicalLabels[index],
          timeline: outcome.timeline,
          scoreType: outcome.scoreType,
          mode: outcome.mode,
          item: outcome.item || '',
        })),
        [1, outcomeCount],
      ),
    },
  };

  return encodeMatFile(
    { M },
    {
      createdAt,
      description: `MATLAB 5.0 MAT-file, Lead-Group ${prepared.analysisId}, created by SPARK-DBS`,
    },
  );
};

export const normalizeLeadGroupStimulation = normalizeStimulation;
