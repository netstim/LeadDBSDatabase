/* eslint-disable no-bitwise */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  discoverLeadGroupExportOptions,
  prepareLeadGroupExport,
  resolveLeadGroupDatasetRoot,
  validateLeadGroupExportOptionsRequest,
  validateLeadGroupExportRequest,
  writeNewLeadGroupAnalysis,
} from './leadGroupExport';
import {
  buildLeadGroupMatFile,
  createLeadGroupClinicalLabels,
  normalizeLeadGroupStimulation,
} from './leadGroupMat';

const datasetRoot = path.join(
  os.tmpdir(),
  `SparkDataset${process.pid}${Date.now()}`,
);
const patientIds = ['sub-A', 'sub-B'];

const stimulation = (amplitude: number) => {
  const source = (sourceAmplitude: number) => ({
    k1: { perc: 100, pol: 1, imp: 1 },
    k2: { perc: 0, pol: 0, imp: 1 },
    case: { perc: 100, pol: 2 },
    amp: sourceAmplitude,
    va: 2,
    pulseWidth: 60,
  });
  return {
    label: 'saved-program',
    Rs1: source(amplitude),
    Rs2: source(0),
    Rs3: source(0),
    Rs4: source(0),
    Ls1: source(amplitude),
    Ls2: source(0),
    Ls3: source(0),
    Ls4: source(0),
    active: [1, 1],
    model: 'SimBio/FieldTrip (see Horn 2017)',
    monopolarmodel: 0,
    amplitude: [
      [amplitude, 0, 0, 0],
      [amplitude, 0, 0, 0],
    ],
    numContacts: 2,
    activecontacts: [
      [1, 0],
      [1, 0],
    ],
    sources: [1, 2, 3, 4],
    volume: [],
    ver: '2.0',
  };
};

const writeJson = (filePath: string, data: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
};

const sessionFile = (
  patientId: string,
  timeline: string,
  suffix: 'clinical' | 'stimparameters',
) =>
  path.join(
    datasetRoot,
    'derivatives',
    'leaddbs',
    patientId,
    'clinical',
    `ses-${timeline}`,
    `${patientId}_ses-${timeline}_${suffix}.json`,
  );

beforeAll(() => {
  patientIds.forEach((patientId, index) => {
    writeJson(sessionFile(patientId, 'programA', 'stimparameters'), {
      S: stimulation(index + 1),
    });
    writeJson(sessionFile(patientId, 'baseline', 'clinical'), {
      UPDRS: {
        Timeline: 'baseline',
        Speech: index === 0 ? 1 : 0,
        Rigidity: index === 0 ? 2 : 4,
      },
      PARTIAL: {
        Timeline: 'baseline',
        ItemA: index + 1,
        ...(index === 0 ? { ItemB: 2 } : {}),
      },
    });
    const reconstructionPath = path.join(
      datasetRoot,
      'derivatives',
      'leaddbs',
      patientId,
      'reconstruction',
      `${patientId}_desc-reconstruction.mat`,
    );
    fs.mkdirSync(path.dirname(reconstructionPath), { recursive: true });
    fs.writeFileSync(reconstructionPath, 'MATLAB reconstruction fixture');
  });
  writeJson(sessionFile('sub-A', 'postop', 'clinical'), {
    UPDRS: { Timeline: 'postop', Speech: 5 },
  });
  const canonicalStim = sessionFile('sub-A', 'programA', 'stimparameters');
  fs.renameSync(
    canonicalStim,
    path.join(
      path.dirname(canonicalStim),
      'SUB-A_SES-PROGRAMA_STIMPARAMETERS.JSON',
    ),
  );
});

afterAll(() => {
  fs.rmSync(datasetRoot, { recursive: true, force: true });
});

test('discovers saved stimulation sessions and patient-aligned outcomes', async () => {
  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );

  expect(options.patients.map(({ id }) => id)).toEqual(patientIds);
  expect(
    options.patients.map(({ stimulations }) =>
      stimulations.map(({ timeline }) => timeline),
    ),
  ).toEqual([['programA'], ['programA']]);

  const total = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
  );
  expect(total).toMatchObject({ coverage: 2 });
  expect(total?.values).toEqual({ 'sub-A': 3, 'sub-B': 4 });

  const zeroScore = options.outcomes.find(
    ({ timeline, item }) => timeline === 'baseline' && item === 'Speech',
  );
  expect(zeroScore).toMatchObject({ coverage: 2 });
  expect(zeroScore?.values['sub-B']).toBe(0);

  const partialTotal = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'PARTIAL' && mode === 'total',
  );
  expect(partialTotal).toMatchObject({ coverage: 1 });
  expect(partialTotal?.values).toEqual({ 'sub-A': 3, 'sub-B': null });
});

test('prepares a canonical ordered M and encodes it as a MATLAB v5 file', async () => {
  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );
  const total = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
  );
  expect(total).toBeDefined();

  const prepared = await prepareLeadGroupExport({
    directoryPath: datasetRoot,
    leadDBS: true,
    analysisId: 'TestGroup1',
    subjects: [...patientIds].reverse().map((id) => ({
      id,
      stimulationTimeline: 'programA',
    })),
    outcomeKeys: [total!.key],
    allowMissing: false,
  });
  expect(prepared.patients.map(({ id }) => id)).toEqual(['sub-B', 'sub-A']);
  expect(prepared.filePath).toBe(
    path.join(
      fs.realpathSync(datasetRoot),
      'derivatives',
      'leadgroup',
      'TestGroup1',
      `dataset-${path.basename(datasetRoot)}_analysis-TestGroup1.mat`,
    ),
  );

  const buffer = buildLeadGroupMatFile(
    prepared,
    new Date('2026-08-21T12:00:00.000Z'),
  );
  expect(buffer.subarray(0, 19).toString('ascii')).toBe('MATLAB 5.0 MAT-file');
  expect(buffer.readUInt16LE(124)).toBe(0x0100);
  expect(buffer.subarray(126, 128).toString('ascii')).toBe('IM');
});

test('requires complete clinical data unless NaN export is explicit', async () => {
  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );
  const incomplete = options.outcomes.find(
    ({ timeline, mode }) => timeline === 'postop' && mode === 'total',
  );
  expect(incomplete).toMatchObject({ coverage: 1 });

  await expect(
    prepareLeadGroupExport({
      directoryPath: datasetRoot,
      leadDBS: true,
      analysisId: 'IncompleteGroup',
      subjects: patientIds.map((id) => ({
        id,
        stimulationTimeline: 'programA',
      })),
      outcomeKeys: [incomplete!.key],
      allowMissing: false,
    }),
  ).rejects.toThrow(/missing for: sub-B/);
});

test('rejects mixed VTA models in one Lead-Group analysis', async () => {
  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );
  const total = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
  );
  const prepared = await prepareLeadGroupExport({
    directoryPath: datasetRoot,
    leadDBS: true,
    analysisId: 'MixedModels',
    subjects: patientIds.map((id) => ({
      id,
      stimulationTimeline: 'programA',
    })),
    outcomeKeys: [total!.key],
    allowMissing: false,
  });
  prepared.patients[1].stimulation.model = 'OSS-DBS (Butenko 2020)';

  expect(() => buildLeadGroupMatFile(prepared)).toThrow(/same VTA model/);
});

test('requires a contact count and truncates the exact legacy key scheme before emitting v2', () => {
  const legacy = stimulation(0) as Record<string, any>;
  ['Rs1', 'Rs2', 'Rs3', 'Rs4'].forEach((field) => {
    const source = legacy[field];
    const contact = source.k1;
    delete source.k1;
    delete source.k2;
    Array.from({ length: 8 }, (_unused, index) => index).forEach((index) => {
      source[`k${index}`] = { ...contact };
    });
  });
  ['Ls1', 'Ls2', 'Ls3', 'Ls4'].forEach((field) => {
    const source = legacy[field];
    const contact = source.k1;
    delete source.k1;
    delete source.k2;
    Array.from({ length: 8 }, (_unused, index) => index + 8).forEach(
      (index) => {
        source[`k${index}`] = { ...contact };
      },
    );
  });
  legacy.numContacts = null;
  legacy.ver = null;
  legacy.sources = null;
  legacy.volume = null;

  expect(() => normalizeLeadGroupStimulation(legacy, 'LegacyGroup')).toThrow(
    /legacy stimulation lacks an electrode contact count/,
  );

  legacy.numContacts = 4;
  const normalized = normalizeLeadGroupStimulation(
    legacy,
    'LegacyGroup',
  ) as any;
  expect(normalized.numContacts).toBe(4);
  expect(normalized.ver).toBe('2.0');
  expect(normalized.Rs1).toHaveProperty('k1');
  expect(normalized.Rs1).toHaveProperty('k4');
  expect(normalized.Rs1).not.toHaveProperty('k5');
  expect(normalized.Rs1).not.toHaveProperty('k0');
  expect(normalized.Ls1).toHaveProperty('k1');
  expect(normalized.Ls1).toHaveProperty('k4');
  expect(normalized.Ls1).not.toHaveProperty('k5');
  expect(normalized.Ls1).not.toHaveProperty('k8');
});

test('rejects ambiguous mixed contact-key schemes', () => {
  const mixed = stimulation(0) as Record<string, any>;
  const right = mixed.Rs1;
  right.k0 = right.k1;
  delete right.k2;
  mixed.ver = null;
  expect(() => normalizeLeadGroupStimulation(mixed, 'MixedKeys')).toThrow(
    /ambiguous or mixed contact-key scheme/,
  );
});

test('validates active source safety fields and bilateral stimulation mode', () => {
  const missingCasePercentage = stimulation(1) as Record<string, any>;
  delete missingCasePercentage.Rs1.case.perc;
  expect(() =>
    normalizeLeadGroupStimulation(missingCasePercentage, 'MissingCase'),
  ).toThrow(/case percentage/);

  const invalidImpedance = stimulation(1) as Record<string, any>;
  invalidImpedance.Rs1.k1.imp = 0;
  expect(() =>
    normalizeLeadGroupStimulation(invalidImpedance, 'BadImpedance'),
  ).toThrow(/impedance must be positive/);

  const mixedSides = stimulation(1) as Record<string, any>;
  mixedSides.Rs1.va = 1;
  expect(() => normalizeLeadGroupStimulation(mixedSides, 'MixedSides')).toThrow(
    /same stimulation mode/,
  );
});

test('requires trusted pulse width for active OSS and derives malformed active selection', () => {
  const oss = stimulation(1) as Record<string, any>;
  oss.model = 'OSS-DBS (Butenko 2020)';
  delete oss.Rs1.pulseWidth;
  expect(() => normalizeLeadGroupStimulation(oss, 'MissingPulse')).toThrow(
    /pulse width required for OSS-DBS/,
  );
  oss.ossSettings = { pulseWidth: 90 };
  oss.active = [[1, 2], null];
  const normalized = normalizeLeadGroupStimulation(oss, 'TrustedPulse') as any;
  expect(normalized.Rs1.pulseWidth).toBe(90);
  expect(normalized.active.values).toEqual([1, 1]);
});

test('strictly validates booleans, IDs, duplicates, and patient bounds', () => {
  expect(() =>
    validateLeadGroupExportOptionsRequest({
      directoryPath: datasetRoot,
      leadDBS: 1,
      patientIds,
    }),
  ).toThrow(/boolean/);
  expect(() =>
    validateLeadGroupExportOptionsRequest({
      directoryPath: datasetRoot,
      leadDBS: true,
      patientIds: ['sub-A', 'SUB-A'],
    }),
  ).toThrow(/only be included once/);
  expect(() =>
    validateLeadGroupExportOptionsRequest({
      directoryPath: datasetRoot,
      leadDBS: true,
      patientIds: Array.from(
        { length: 251 },
        (_unused, index) => `sub-${index}`,
      ),
    }),
  ).toThrow(/limited to 250/);
  expect(() =>
    validateLeadGroupExportRequest({
      directoryPath: datasetRoot,
      leadDBS: true,
      analysisId: 'StrictGroup',
      subjects: [{ id: 'sub-A', stimulationTimeline: 'programA' }],
      outcomeKeys: ['outcome'],
      allowMissing: 'false',
    }),
  ).toThrow(/must be a boolean/);
});

test('does not fall back to launch data when the requested dataset is invalid', async () => {
  await expect(
    resolveLeadGroupDatasetRoot(
      path.join(datasetRoot, 'derivatives', 'leaddbs', 'does-not-exist'),
      { datasetRoot },
    ),
  ).rejects.toThrow(/does not exist/);
});

test('rejects an explicit launch subject folder outside the requested dataset', async () => {
  const outsideRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'spark-outside-subject-'),
  );
  const outsidePatient = path.join(outsideRoot, 'sub-A');
  fs.mkdirSync(outsidePatient);
  try {
    await expect(
      discoverLeadGroupExportOptions(datasetRoot, true, ['sub-A'], {
        subjects: [{ id: 'sub-A', folder: outsidePatient }],
      }),
    ).rejects.toThrow(/outside the selected dataset/);
  } finally {
    fs.rmSync(outsideRoot, { recursive: true, force: true });
  }
});

test('rejects ambiguous session JSON suffix matches', async () => {
  const duplicate = path.join(
    path.dirname(sessionFile('sub-A', 'programA', 'stimparameters')),
    'alias_ses-programA_stimparameters.json',
  );
  writeJson(duplicate, { S: stimulation(1) });
  try {
    await expect(
      discoverLeadGroupExportOptions(datasetRoot, true, ['sub-A']),
    ).rejects.toThrow(/multiple stimulation JSON files/);
  } finally {
    fs.unlinkSync(duplicate);
  }
});

test('requires a canonical patient reconstruction before export', async () => {
  const reconstructionPath = path.join(
    datasetRoot,
    'derivatives',
    'leaddbs',
    'sub-B',
    'reconstruction',
    'sub-B_desc-reconstruction.mat',
  );
  const parkedPath = `${reconstructionPath}.parked`;
  fs.renameSync(reconstructionPath, parkedPath);
  try {
    const options = await discoverLeadGroupExportOptions(
      datasetRoot,
      true,
      patientIds,
    );
    const total = options.outcomes.find(
      ({ timeline, scoreType, mode }) =>
        timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
    );
    await expect(
      prepareLeadGroupExport({
        directoryPath: datasetRoot,
        leadDBS: true,
        analysisId: 'MissingRecon',
        subjects: patientIds.map((id) => ({
          id,
          stimulationTimeline: 'programA',
        })),
        outcomeKeys: [total!.key],
        allowMissing: false,
      }),
    ).rejects.toThrow(/no electrode reconstruction was found/);
  } finally {
    fs.renameSync(parkedPath, reconstructionPath);
  }
});

test('accepts a clinical JSON reconstruction when the .mat is absent', async () => {
  const reconstructionPath = path.join(
    datasetRoot,
    'derivatives',
    'leaddbs',
    'sub-B',
    'reconstruction',
    'sub-B_desc-reconstruction.mat',
  );
  const parkedPath = `${reconstructionPath}.parked`;
  const jsonReconstructionPath = path.join(
    datasetRoot,
    'derivatives',
    'leaddbs',
    'sub-B',
    'clinical',
    'sub-B_desc-reconstruction.json',
  );
  fs.renameSync(reconstructionPath, parkedPath);
  writeJson(jsonReconstructionPath, { markers: { head1: [1, 2, 3] } });
  try {
    const options = await discoverLeadGroupExportOptions(
      datasetRoot,
      true,
      patientIds,
    );
    const total = options.outcomes.find(
      ({ timeline, scoreType, mode }) =>
        timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
    );
    const prepared = await prepareLeadGroupExport({
      directoryPath: datasetRoot,
      leadDBS: true,
      analysisId: 'JsonRecon',
      subjects: patientIds.map((id) => ({
        id,
        stimulationTimeline: 'programA',
      })),
      outcomeKeys: [total!.key],
      allowMissing: false,
    });
    expect(prepared.patients).toHaveLength(patientIds.length);
  } finally {
    fs.rmSync(jsonReconstructionPath, { force: true });
    fs.renameSync(parkedPath, reconstructionPath);
  }
});

test('blocks a generic dataset without an equivalent canonical reconstruction', async () => {
  const genericRoot = path.join(
    os.tmpdir(),
    `SparkGeneric${process.pid}${Date.now()}`,
  );
  const genericSession = path.join(genericRoot, 'sub-G', 'ses-programA');
  writeJson(path.join(genericSession, 'sub-G_ses-programA_stim.json'), {
    S: stimulation(1),
  });
  const clinicalSession = path.join(genericRoot, 'sub-G', 'ses-baseline');
  writeJson(path.join(clinicalSession, 'sub-G_ses-baseline_clinical.json'), {
    Score: { Item: 1 },
  });
  try {
    const options = await discoverLeadGroupExportOptions(genericRoot, false, [
      'sub-G',
    ]);
    const total = options.outcomes.find(({ mode }) => mode === 'total');
    await expect(
      prepareLeadGroupExport({
        directoryPath: genericRoot,
        leadDBS: false,
        analysisId: 'GenericGroup',
        subjects: [{ id: 'sub-G', stimulationTimeline: 'programA' }],
        outcomeKeys: [total!.key],
        allowMissing: false,
      }),
    ).rejects.toThrow(/no electrode reconstruction was found/);
  } finally {
    fs.rmSync(genericRoot, { recursive: true, force: true });
  }
});

test('creates an analysis exactly once without replacing existing data', async () => {
  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );
  const total = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
  );
  const prepared = await prepareLeadGroupExport({
    directoryPath: datasetRoot,
    leadDBS: true,
    analysisId: 'AtomicGroup',
    subjects: patientIds.map((id) => ({
      id,
      stimulationTimeline: 'programA',
    })),
    outcomeKeys: [total!.key],
    allowMissing: false,
  });
  const original = buildLeadGroupMatFile(prepared);
  await writeNewLeadGroupAnalysis(prepared, original);
  await expect(
    writeNewLeadGroupAnalysis(prepared, Buffer.from('replacement')),
  ).rejects.toThrow(/already exists/);
  expect(fs.readFileSync(prepared.filePath)).toEqual(original);
  expect(
    fs
      .readdirSync(prepared.analysisDirectory)
      .filter((name) => name.endsWith('.tmp')),
  ).toEqual([]);
});

test('publishes at most one of two concurrent exports with the same ID', async () => {
  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );
  const total = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
  );
  const prepared = await prepareLeadGroupExport({
    directoryPath: datasetRoot,
    leadDBS: true,
    analysisId: 'ConcurrentGroup',
    subjects: patientIds.map((id) => ({
      id,
      stimulationTimeline: 'programA',
    })),
    outcomeKeys: [total!.key],
    allowMissing: false,
  });
  const first = buildLeadGroupMatFile(prepared);
  const second = Buffer.from(first);
  second[0] ^= 1;
  const results = await Promise.allSettled([
    writeNewLeadGroupAnalysis(prepared, first),
    writeNewLeadGroupAnalysis(prepared, second),
  ]);
  expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(
    1,
  );
  expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
  const saved = fs.readFileSync(prepared.filePath);
  expect(saved.equals(first) || saved.equals(second)).toBe(true);
});

test('removes its claimed analysis directory when publishing fails', async () => {
  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );
  const total = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
  );
  const prepared = await prepareLeadGroupExport({
    directoryPath: datasetRoot,
    leadDBS: true,
    analysisId: 'CleanupGroup',
    subjects: patientIds.map((id) => ({
      id,
      stimulationTimeline: 'programA',
    })),
    outcomeKeys: [total!.key],
    allowMissing: false,
  });
  const originalOpen = fs.promises.open;
  const openSpy = jest.spyOn(fs.promises, 'open').mockImplementation(((
    filePath: fs.PathLike,
    ...args: unknown[]
  ) => {
    if (String(filePath).endsWith('.tmp')) {
      return Promise.reject(new Error('simulated publish failure'));
    }
    return originalOpen(
      filePath,
      args[0] as string | number,
      args[1] as string | number | undefined,
    );
  }) as typeof fs.promises.open);
  try {
    await expect(
      writeNewLeadGroupAnalysis(prepared, buildLeadGroupMatFile(prepared)),
    ).rejects.toThrow(/simulated publish failure/);
  } finally {
    openSpy.mockRestore();
  }
  expect(fs.existsSync(prepared.analysisDirectory)).toBe(false);
});

test('uses unique filesystem-safe clinical labels and preserves human labels in metadata', async () => {
  const labels = createLeadGroupClinicalLabels([
    {
      timeline: 'baseline',
      scoreType: 'UPDRS / motor',
      mode: 'item',
      item: 'Left: hand?',
    },
    {
      timeline: 'BASELINE',
      scoreType: 'UPDRS \\ motor',
      mode: 'item',
      item: 'LEFT: HAND?',
    },
  ]);
  expect(labels[0]).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(labels[1]).toMatch(/^[A-Za-z0-9_-]+$/);
  expect(labels[0].toLowerCase()).not.toBe(labels[1].toLowerCase());

  const options = await discoverLeadGroupExportOptions(
    datasetRoot,
    true,
    patientIds,
  );
  const selected = options.outcomes.find(
    ({ timeline, scoreType, mode }) =>
      timeline === 'baseline' && scoreType === 'UPDRS' && mode === 'total',
  );
  const prepared = await prepareLeadGroupExport({
    directoryPath: datasetRoot,
    leadDBS: true,
    analysisId: 'MetadataLabels',
    subjects: patientIds.map((id) => ({
      id,
      stimulationTimeline: 'programA',
    })),
    outcomeKeys: [selected!.key],
    allowMissing: false,
  });
  prepared.outcomes[0].label = 'Human / readable: label?';
  const encoded = buildLeadGroupMatFile(prepared);
  expect(
    encoded.includes(Buffer.from(prepared.outcomes[0].label, 'utf16le')),
  ).toBe(true);
});
