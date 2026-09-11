/* eslint-disable max-classes-per-file, no-bitwise, no-await-in-loop, no-restricted-syntax, no-nested-ternary, no-undef */
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

export type LeadGroupLaunchData = {
  datasetRoot?: string;
  filepath?: string;
  path?: string;
  mode?: string;
  scope?: string;
  type?: string;
  subjects?: Array<{
    id?: string;
    patientname?: string;
    folder?: string;
    patientFolder?: string;
  }>;
  patientname?: string | string[];
  patientfolders?: string[] | string[][];
};

export interface LeadGroupExportOptionsRequest {
  directoryPath: string;
  leadDBS: boolean;
  patientIds: string[];
}

export interface LeadGroupExportSubjectRequest {
  id: string;
  stimulationTimeline: string;
}

export interface LeadGroupExportRequest {
  directoryPath: string;
  leadDBS: boolean;
  analysisId: string;
  subjects: LeadGroupExportSubjectRequest[];
  outcomeKeys: string[];
  allowMissing: boolean;
}

export interface LeadGroupOutcomeOption {
  key: string;
  label: string;
  timeline: string;
  scoreType: string;
  mode: 'total' | 'item';
  item?: string;
  coverage: number;
  values: Record<string, number | null>;
}

export interface LeadGroupPatientOptions {
  id: string;
  patientFolder: string;
  stimulations: Array<{ timeline: string; label: string; model: string }>;
  clinicalSessions: Array<{
    timeline: string;
    outcomes: Array<{
      key: string;
      label: string;
      scoreType: string;
      mode: 'total' | 'item';
      item?: string;
      value: number;
    }>;
  }>;
}

export interface LeadGroupExportOptions {
  success: true;
  datasetRoot: string;
  patients: LeadGroupPatientOptions[];
  outcomes: LeadGroupOutcomeOption[];
  warnings: string[];
}

export interface PreparedLeadGroupExport {
  datasetRoot: string;
  analysisId: string;
  analysisDirectory: string;
  filePath: string;
  patients: Array<{
    id: string;
    patientFolder: string;
    stimulationTimeline: string;
    stimulation: Record<string, unknown>;
  }>;
  outcomes: LeadGroupOutcomeOption[];
}

const MAX_PATH_LENGTH = 4096;
const MAX_SEGMENT_LENGTH = 128;
const MAX_ANALYSIS_ID_LENGTH = 63;
const MAX_EXPORT_SUBJECTS = 250;
const MAX_SESSIONS_PER_PATIENT = 200;
const MAX_SESSION_DIRECTORY_ENTRIES = 2000;
const MAX_SELECTED_OUTCOMES = 256;
const MAX_DISCOVERED_OUTCOMES = 4096;
const MAX_OUTCOME_KEY_LENGTH = 4096;
const MAX_CLINICAL_NAME_LENGTH = 256;
const MAX_JSON_BYTES = 25 * 1024 * 1024;
const MAX_AGGREGATE_JSON_BYTES = 128 * 1024 * 1024;
const MAX_MAT_BYTES = 512 * 1024 * 1024;
const DISCOVERY_CONCURRENCY = 8;

class LeadGroupLimitError extends Error {}
class LeadGroupPathError extends Error {}

class JsonReadBudget {
  private bytesRead = 0;

  consume(byteLength: number) {
    if (
      !Number.isSafeInteger(byteLength) ||
      byteLength < 0 ||
      this.bytesRead + byteLength > MAX_AGGREGATE_JSON_BYTES
    ) {
      throw new LeadGroupLimitError(
        `Lead-Group discovery is limited to ${
          MAX_AGGREGATE_JSON_BYTES / (1024 * 1024)
        } MB of JSON data.`,
      );
    }
    this.bytesRead += byteLength;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safeSegment = (
  value: unknown,
  label: string,
  maximumLength = MAX_SEGMENT_LENGTH,
): string => {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximumLength ||
    value === '.' ||
    value === '..' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  ) {
    throw new Error(`Invalid ${label}.`);
  }
  return value;
};

const safeDirectoryPath = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > MAX_PATH_LENGTH ||
    value.includes('\0') ||
    !path.isAbsolute(value)
  ) {
    throw new Error('Choose a valid absolute dataset path before exporting.');
  }
  return value;
};

const safeOutcomeKey = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > MAX_OUTCOME_KEY_LENGTH ||
    value.includes('\0')
  ) {
    throw new Error('Invalid clinical outcome key.');
  }
  return value;
};

const uniqueStrings = (values: string[], label: string) => {
  const normalized = values.map((value) => value.toLocaleLowerCase('en-US'));
  if (new Set(normalized).size !== values.length) {
    throw new Error(`Each ${label} may only be included once.`);
  }
};

export const validateLeadGroupExportOptionsRequest = (
  value: unknown,
): LeadGroupExportOptionsRequest => {
  if (!isRecord(value)) {
    throw new Error('The Lead-Group export request is missing.');
  }
  if (typeof value.leadDBS !== 'boolean') {
    throw new Error('The Lead-DBS dataset flag must be a boolean.');
  }
  if (!Array.isArray(value.patientIds) || value.patientIds.length === 0) {
    throw new Error('Select at least one patient to export.');
  }
  if (value.patientIds.length > MAX_EXPORT_SUBJECTS) {
    throw new Error(
      `The Lead-Group export is limited to ${MAX_EXPORT_SUBJECTS} patients.`,
    );
  }
  const patientIds = value.patientIds.map((id) =>
    safeSegment(id, 'patient ID'),
  );
  uniqueStrings(patientIds, 'patient');
  return {
    directoryPath: safeDirectoryPath(value.directoryPath),
    leadDBS: value.leadDBS,
    patientIds,
  };
};

export const validateLeadGroupExportRequest = (
  value: unknown,
): LeadGroupExportRequest => {
  if (!isRecord(value)) {
    throw new Error('The Lead-Group export request is missing.');
  }
  if (typeof value.leadDBS !== 'boolean') {
    throw new Error('The Lead-DBS dataset flag must be a boolean.');
  }
  if (typeof value.allowMissing !== 'boolean') {
    throw new Error('The missing-outcome setting must be a boolean.');
  }
  const analysisId = safeSegment(
    value.analysisId,
    'analysis ID',
    MAX_ANALYSIS_ID_LENGTH,
  );
  if (!/^[A-Za-z0-9]+$/.test(analysisId)) {
    throw new Error('The analysis ID may contain letters and numbers only.');
  }
  if (!Array.isArray(value.subjects) || value.subjects.length === 0) {
    throw new Error('Select at least one patient to export.');
  }
  if (value.subjects.length > MAX_EXPORT_SUBJECTS) {
    throw new Error(
      `The Lead-Group export is limited to ${MAX_EXPORT_SUBJECTS} patients.`,
    );
  }
  const subjects = value.subjects.map((subject) => {
    if (!isRecord(subject)) throw new Error('Invalid Lead-Group subject.');
    return {
      id: safeSegment(subject.id, 'patient ID'),
      stimulationTimeline: safeSegment(
        subject.stimulationTimeline,
        'stimulation session',
      ),
    };
  });
  uniqueStrings(
    subjects.map(({ id }) => id),
    'patient',
  );

  if (!Array.isArray(value.outcomeKeys) || value.outcomeKeys.length === 0) {
    throw new Error('Select at least one clinical outcome.');
  }
  if (value.outcomeKeys.length > MAX_SELECTED_OUTCOMES) {
    throw new Error(
      `Select no more than ${MAX_SELECTED_OUTCOMES} clinical outcomes.`,
    );
  }
  const outcomeKeys = value.outcomeKeys.map(safeOutcomeKey);
  if (new Set(outcomeKeys).size !== outcomeKeys.length) {
    throw new Error('Each clinical outcome may only be included once.');
  }

  return {
    directoryPath: safeDirectoryPath(value.directoryPath),
    leadDBS: value.leadDBS,
    analysisId,
    subjects,
    outcomeKeys,
    allowMissing: value.allowMissing,
  };
};

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const outcomeKey = (
  timeline: string,
  scoreType: string,
  mode: 'total' | 'item',
  item = '',
): string => JSON.stringify([timeline, scoreType, mode, item]);

const stripTrailingSeparators = (value: string): string =>
  value.replace(/[\\/]+$/, '');

const pathIsWithin = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`))
  );
};

const assertPathWithin = (
  root: string,
  candidate: string,
  label: string,
): void => {
  if (!pathIsWithin(root, candidate)) {
    throw new LeadGroupPathError(`${label} is outside the selected dataset.`);
  }
};

const findDatasetRootInPath = (candidate: string): string => {
  const normalized = path.resolve(candidate);
  const components = normalized.split(path.sep);
  for (let index = 0; index < components.length - 1; index += 1) {
    if (
      components[index] === 'derivatives' &&
      ['leadgroup', 'leaddbs'].includes(components[index + 1])
    ) {
      const root = components.slice(0, index).join(path.sep);
      return root || path.parse(normalized).root;
    }
  }
  return normalized;
};

const realDirectory = async (directory: string, label: string) => {
  let canonical: string;
  try {
    canonical = await fs.promises.realpath(directory);
  } catch {
    throw new LeadGroupPathError(`${label} does not exist: ${directory}`);
  }
  const stats = await fs.promises.stat(canonical);
  if (!stats.isDirectory()) {
    throw new LeadGroupPathError(`${label} is not a directory: ${directory}`);
  }
  return canonical;
};

const realDirectoryIfPresent = async (
  directory: string,
): Promise<string | null> => {
  try {
    const canonical = await fs.promises.realpath(directory);
    const stats = await fs.promises.stat(canonical);
    return stats.isDirectory() ? canonical : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
};

export const resolveLeadGroupDatasetRoot = async (
  directoryPath: string,
  _launchData: LeadGroupLaunchData = {},
): Promise<string> => {
  if (!isRecord(_launchData)) {
    throw new Error('Invalid Lead-Group launch data.');
  }
  const requested = safeDirectoryPath(directoryPath);
  const canonicalRequested = await realDirectory(
    stripTrailingSeparators(requested),
    'The selected dataset path',
  );
  const derived = findDatasetRootInPath(canonicalRequested);
  return realDirectory(derived, 'The selected dataset root');
};

const launchSubjectFolder = (
  patientId: string,
  launchData: LeadGroupLaunchData,
): string | null => {
  const subject = Array.isArray(launchData.subjects)
    ? launchData.subjects.find(
        (candidate) =>
          isRecord(candidate) &&
          (candidate.id || candidate.patientname) === patientId,
      )
    : undefined;
  const explicitFolder = subject?.folder || subject?.patientFolder;
  if (typeof explicitFolder === 'string' && explicitFolder) {
    return path.basename(explicitFolder).toLowerCase() === 'clinical'
      ? path.dirname(explicitFolder)
      : explicitFolder;
  }

  let patientNames: string[] = [];
  if (Array.isArray(launchData.patientname)) {
    patientNames = launchData.patientname.filter(
      (name): name is string => typeof name === 'string',
    );
  } else if (typeof launchData.patientname === 'string') {
    patientNames = [launchData.patientname];
  }
  const index = patientNames.indexOf(patientId);
  let rawFolders: unknown = launchData.patientfolders;
  if (
    Array.isArray(launchData.patientfolders) &&
    Array.isArray(launchData.patientfolders[0])
  ) {
    [rawFolders] = launchData.patientfolders;
  }
  const legacyFolder =
    index >= 0 && Array.isArray(rawFolders) ? rawFolders[index] : undefined;
  if (typeof legacyFolder !== 'string' || !legacyFolder) return null;
  return path.basename(legacyFolder).toLowerCase() === 'clinical'
    ? path.dirname(legacyFolder)
    : legacyFolder;
};

const patientContainer = async (
  datasetRoot: string,
  leadDBS: boolean,
): Promise<string> => {
  if (!leadDBS) return datasetRoot;
  const container = await realDirectory(
    path.join(datasetRoot, 'derivatives', 'leaddbs'),
    'The Lead-DBS patient directory',
  );
  assertPathWithin(datasetRoot, container, 'The Lead-DBS patient directory');
  return container;
};

export const resolveLeadGroupPatientFolder = async (
  datasetRoot: string,
  patientId: string,
  leadDBS: boolean,
  launchData: LeadGroupLaunchData = {},
): Promise<string> => {
  if (typeof leadDBS !== 'boolean') {
    throw new Error('The Lead-DBS dataset flag must be a boolean.');
  }
  const safeId = safeSegment(patientId, 'patient ID');
  const canonicalDataset = await realDirectory(datasetRoot, 'Dataset root');
  const container = await patientContainer(canonicalDataset, leadDBS);
  const folderName =
    !leadDBS && !safeId.startsWith('sub-') ? `sub-${safeId}` : safeId;
  const explicit = launchSubjectFolder(safeId, launchData);

  if (explicit) {
    if (!path.isAbsolute(explicit) || explicit.length > MAX_PATH_LENGTH) {
      throw new LeadGroupPathError(
        `${safeId}: the launch subject folder is not an absolute path.`,
      );
    }
    const canonical = await realDirectory(
      explicit,
      `${safeId}: launch subject folder`,
    );
    assertPathWithin(container, canonical, `${safeId}: launch subject folder`);
    const relative = path.relative(container, canonical);
    if (
      relative.includes(path.sep) ||
      path.basename(canonical).toLocaleLowerCase('en-US') !==
        folderName.toLocaleLowerCase('en-US')
    ) {
      throw new LeadGroupPathError(
        `${safeId}: the launch subject folder does not match the selected patient.`,
      );
    }
    return canonical;
  }

  const candidate = path.join(container, folderName);
  assertPathWithin(container, candidate, `${safeId}: patient folder`);
  const canonical = await realDirectoryIfPresent(candidate);
  if (canonical) {
    assertPathWithin(container, canonical, `${safeId}: patient folder`);
    return canonical;
  }
  return candidate;
};

const readJson = async (
  filePath: string,
  budget: JsonReadBudget,
): Promise<unknown> => {
  let handle: fs.promises.FileHandle | undefined;
  try {
    const noFollow = fs.constants.O_NOFOLLOW || 0;
    handle = await fs.promises.open(filePath, fs.constants.O_RDONLY | noFollow);
    const stats = await handle.stat();
    if (!stats.isFile()) throw new Error(`Not a file: ${filePath}`);
    if (stats.size > MAX_JSON_BYTES) {
      throw new LeadGroupLimitError(
        `JSON file is too large to export: ${filePath}`,
      );
    }
    budget.consume(stats.size);
    const contents = await handle.readFile();
    if (contents.byteLength > stats.size) {
      budget.consume(contents.byteLength - stats.size);
    }
    if (contents.byteLength > MAX_JSON_BYTES) {
      throw new LeadGroupLimitError(
        `JSON file is too large to export: ${filePath}`,
      );
    }
    return JSON.parse(contents.toString('utf8'));
  } finally {
    await handle?.close();
  }
};

const resolveSessionJsonPath = async (
  patientFolder: string,
  patientId: string,
  timeline: string,
  leadDBS: boolean,
  kind: 'stimulation' | 'clinical',
): Promise<string | null> => {
  const safeTimeline = safeSegment(timeline, 'session name');
  const clinicalRootPath = leadDBS
    ? path.join(patientFolder, 'clinical')
    : patientFolder;
  const clinicalRoot = await realDirectoryIfPresent(clinicalRootPath);
  if (!clinicalRoot) return null;
  assertPathWithin(patientFolder, clinicalRoot, 'The clinical directory');

  const sessionFolder = await realDirectoryIfPresent(
    path.join(clinicalRoot, `ses-${safeTimeline}`),
  );
  if (!sessionFolder) return null;
  assertPathWithin(patientFolder, sessionFolder, 'The clinical session');

  const entries = await fs.promises.readdir(sessionFolder, {
    withFileTypes: true,
  });
  if (entries.length > MAX_SESSION_DIRECTORY_ENTRIES) {
    throw new LeadGroupLimitError(
      `${patientId} / ${safeTimeline} contains too many files to inspect.`,
    );
  }
  let fileId = patientId;
  if (!leadDBS && !patientId.startsWith('sub-')) fileId = `sub-${patientId}`;
  const suffix =
    kind === 'stimulation'
      ? leadDBS
        ? 'stimparameters.json'
        : 'stim.json'
      : 'clinical.json';
  const expected = `${fileId}_ses-${safeTimeline}_${suffix}`;
  const regularFiles = entries.filter(
    (entry) => entry.isFile() && !entry.name.startsWith('._'),
  );
  const exactMatches = regularFiles.filter(
    (entry) =>
      entry.name.toLocaleLowerCase('en-US') ===
      expected.toLocaleLowerCase('en-US'),
  );
  const sessionSuffix = `_ses-${safeTimeline}_${suffix}`.toLocaleLowerCase(
    'en-US',
  );
  const suffixMatches = regularFiles.filter((entry) =>
    entry.name.toLocaleLowerCase('en-US').endsWith(sessionSuffix),
  );
  const matches = suffixMatches.length > 0 ? suffixMatches : exactMatches;
  if (matches.length === 0) return null;
  if (matches.length !== 1) {
    throw new LeadGroupPathError(
      `${patientId} / ${safeTimeline} has multiple ${kind} JSON files matching the canonical name.`,
    );
  }
  const resolved = await fs.promises.realpath(
    path.join(sessionFolder, matches[0].name),
  );
  assertPathWithin(sessionFolder, resolved, 'The session JSON file');
  return resolved;
};

const clinicalName = (value: string, label: string): string => {
  if (
    !value ||
    value.length > MAX_CLINICAL_NAME_LENGTH ||
    value.includes('\0')
  ) {
    throw new LeadGroupLimitError(`Invalid or oversized clinical ${label}.`);
  }
  return value;
};

const outcomesForClinicalData = (
  timeline: string,
  data: unknown,
): Array<{
  key: string;
  label: string;
  scoreType: string;
  mode: 'total' | 'item';
  item?: string;
  value: number;
}> => {
  if (!isRecord(data)) return [];
  const result: Array<{
    key: string;
    label: string;
    scoreType: string;
    mode: 'total' | 'item';
    item?: string;
    value: number;
  }> = [];

  Object.entries(data).forEach(([rawScoreType, scoreValue]) => {
    if (!isRecord(scoreValue)) return;
    const scoreType = clinicalName(rawScoreType, 'score name');
    const numericItems = Object.entries(scoreValue)
      .filter(([item]) => item.toLowerCase() !== 'timeline')
      .map(([rawItem, value]) => ({
        item: clinicalName(rawItem, 'item name'),
        value: asFiniteNumber(value),
      }))
      .filter(
        (entry): entry is { item: string; value: number } =>
          entry.value !== null,
      );
    if (numericItems.length === 0) return;
    numericItems.forEach(({ item, value }) => {
      if (result.length >= MAX_DISCOVERED_OUTCOMES) {
        throw new LeadGroupLimitError(
          `A clinical session may contain at most ${MAX_DISCOVERED_OUTCOMES} numeric outcomes.`,
        );
      }
      result.push({
        key: outcomeKey(timeline, scoreType, 'item', item),
        label: `${timeline} — ${scoreType}: ${item}`,
        scoreType,
        mode: 'item',
        item,
        value,
      });
    });
  });
  return result;
};

const mapWithConcurrency = async <Input, Output>(
  values: Input[],
  concurrency: number,
  operation: (value: Input, index: number) => Promise<Output>,
): Promise<Output[]> => {
  const results = new Array<Output>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await operation(values[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
};

const shouldAbortDiscovery = (error: unknown): boolean =>
  error instanceof LeadGroupLimitError || error instanceof LeadGroupPathError;

const discoverPatient = async (
  datasetRoot: string,
  patientId: string,
  leadDBS: boolean,
  launchData: LeadGroupLaunchData,
  budget: JsonReadBudget,
): Promise<{ patient: LeadGroupPatientOptions; warnings: string[] }> => {
  const safeId = safeSegment(patientId, 'patient ID');
  const patientFolder = await resolveLeadGroupPatientFolder(
    datasetRoot,
    safeId,
    leadDBS,
    launchData,
  );
  const warnings: string[] = [];
  const stimulations: LeadGroupPatientOptions['stimulations'] = [];
  const clinicalSessions: LeadGroupPatientOptions['clinicalSessions'] = [];
  const canonicalPatientFolder = await realDirectoryIfPresent(patientFolder);
  if (!canonicalPatientFolder) {
    warnings.push(
      `${safeId}: patient folder does not exist (${patientFolder}).`,
    );
    return {
      patient: { id: safeId, patientFolder, stimulations, clinicalSessions },
      warnings,
    };
  }

  const clinicalRootPath = leadDBS
    ? path.join(canonicalPatientFolder, 'clinical')
    : canonicalPatientFolder;
  const clinicalRoot = await realDirectoryIfPresent(clinicalRootPath);
  if (!clinicalRoot) {
    warnings.push(`${safeId}: clinical folder does not exist.`);
    return {
      patient: {
        id: safeId,
        patientFolder: canonicalPatientFolder,
        stimulations,
        clinicalSessions,
      },
      warnings,
    };
  }
  assertPathWithin(
    canonicalPatientFolder,
    clinicalRoot,
    `${safeId}: clinical folder`,
  );

  const entries = await fs.promises.readdir(clinicalRoot, {
    withFileTypes: true,
  });
  if (entries.length > MAX_SESSION_DIRECTORY_ENTRIES) {
    throw new LeadGroupLimitError(
      `${safeId}: clinical directory contains too many entries.`,
    );
  }
  const sessionNames = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('ses-'))
    .map((entry) => safeSegment(entry.name.slice(4), 'session name'))
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true }),
    );
  if (sessionNames.length > MAX_SESSIONS_PER_PATIENT) {
    throw new LeadGroupLimitError(
      `${safeId} has more than ${MAX_SESSIONS_PER_PATIENT} clinical sessions.`,
    );
  }
  uniqueStrings(sessionNames, 'clinical session');

  for (const timeline of sessionNames) {
    let stimulationOption: {
      timeline: string;
      label: string;
      model: string;
    } | null = null;
    let clinicalSession:
      | LeadGroupPatientOptions['clinicalSessions'][number]
      | null = null;

    const stimulationPath = await resolveSessionJsonPath(
      canonicalPatientFolder,
      safeId,
      timeline,
      leadDBS,
      'stimulation',
    );
    if (stimulationPath) {
      try {
        const saved = await readJson(stimulationPath, budget);
        const stimulation = isRecord(saved) && 'S' in saved ? saved.S : saved;
        if (isRecord(stimulation)) {
          const model =
            typeof stimulation.model === 'string' && stimulation.model
              ? stimulation.model
              : 'Unspecified VTA model';
          stimulationOption = {
            timeline,
            label:
              typeof stimulation.label === 'string' && stimulation.label
                ? `${timeline} (${stimulation.label}) — ${model}`
                : `${timeline} — ${model}`,
            model,
          };
        } else {
          warnings.push(
            `${safeId} / ${timeline}: stimulation JSON has no S object.`,
          );
        }
      } catch (error) {
        if (shouldAbortDiscovery(error)) throw error;
        warnings.push(
          `${safeId} / ${timeline}: could not read stimulation (${
            error instanceof Error ? error.message : String(error)
          }).`,
        );
      }
    }

    const clinicalPath = await resolveSessionJsonPath(
      canonicalPatientFolder,
      safeId,
      timeline,
      leadDBS,
      'clinical',
    );
    if (clinicalPath) {
      try {
        const clinicalData = await readJson(clinicalPath, budget);
        clinicalSession = {
          timeline,
          outcomes: outcomesForClinicalData(timeline, clinicalData),
        };
      } catch (error) {
        if (shouldAbortDiscovery(error)) throw error;
        warnings.push(
          `${safeId} / ${timeline}: could not read clinical data (${
            error instanceof Error ? error.message : String(error)
          }).`,
        );
      }
    }
    if (stimulationOption) stimulations.push(stimulationOption);
    if (clinicalSession) clinicalSessions.push(clinicalSession);
  }

  return {
    patient: {
      id: safeId,
      patientFolder: canonicalPatientFolder,
      stimulations,
      clinicalSessions,
    },
    warnings,
  };
};

const discoverLeadGroupExportOptionsWithBudget = async (
  request: LeadGroupExportOptionsRequest,
  launchData: LeadGroupLaunchData,
  budget: JsonReadBudget,
): Promise<LeadGroupExportOptions> => {
  const datasetRoot = await resolveLeadGroupDatasetRoot(
    request.directoryPath,
    launchData,
  );
  await patientContainer(datasetRoot, request.leadDBS);
  const discoveries = await mapWithConcurrency(
    request.patientIds,
    DISCOVERY_CONCURRENCY,
    (id) =>
      discoverPatient(datasetRoot, id, request.leadDBS, launchData, budget),
  );
  const patients = discoveries.map(({ patient }) => patient);
  const warnings = discoveries.flatMap(
    ({ warnings: patientWarnings }) => patientWarnings,
  );

  const catalog = new Map<
    string,
    Omit<LeadGroupOutcomeOption, 'coverage' | 'values'> & {
      values: Record<string, number | null>;
    }
  >();
  patients.forEach((patient) => {
    patient.clinicalSessions.forEach((session) => {
      session.outcomes.forEach((outcome) => {
        const entry = catalog.get(outcome.key) || {
          key: outcome.key,
          label: outcome.label,
          timeline: session.timeline,
          scoreType: outcome.scoreType,
          mode: outcome.mode,
          item: outcome.item,
          values: Object.fromEntries(
            request.patientIds.map((id) => [id, null]),
          ),
        };
        entry.values[patient.id] = outcome.value;
        catalog.set(outcome.key, entry);
        if (catalog.size > MAX_DISCOVERED_OUTCOMES) {
          throw new LeadGroupLimitError(
            `Lead-Group discovery is limited to ${MAX_DISCOVERED_OUTCOMES} clinical outcomes.`,
          );
        }
      });
    });
  });

  const totalGroups = new Map<
    string,
    {
      timeline: string;
      scoreType: string;
      items: Array<{
        key: string;
        values: Record<string, number | null>;
      }>;
    }
  >();
  catalog.forEach((entry) => {
    if (entry.mode !== 'item') return;
    const key = JSON.stringify([entry.timeline, entry.scoreType]);
    const group = totalGroups.get(key) || {
      timeline: entry.timeline,
      scoreType: entry.scoreType,
      items: [],
    };
    group.items.push({ key: entry.key, values: entry.values });
    totalGroups.set(key, group);
  });

  totalGroups.forEach(({ timeline, scoreType, items }) => {
    const key = outcomeKey(timeline, scoreType, 'total');
    const label = `${timeline} — ${scoreType} total`;
    const values = Object.fromEntries(
      request.patientIds.map((id) => {
        const itemValues = items.map((item) => item.values[id]);
        const complete = itemValues.every(
          (value): value is number =>
            typeof value === 'number' && Number.isFinite(value),
        );
        return [
          id,
          complete ? itemValues.reduce((sum, value) => sum + value, 0) : null,
        ];
      }),
    );
    catalog.set(key, {
      key,
      label,
      timeline,
      scoreType,
      mode: 'total',
      values,
    });

    patients.forEach((patient) => {
      const value = values[patient.id];
      if (value === null) return;
      const session = patient.clinicalSessions.find(
        (candidate) => candidate.timeline === timeline,
      );
      if (!session) return;
      session.outcomes.push({
        key,
        label,
        scoreType,
        mode: 'total',
        value,
      });
    });
  });

  if (catalog.size > MAX_DISCOVERED_OUTCOMES) {
    throw new LeadGroupLimitError(
      `Lead-Group discovery is limited to ${MAX_DISCOVERED_OUTCOMES} clinical outcomes.`,
    );
  }
  const outcomes = Array.from(catalog.values())
    .map((entry) => ({
      ...entry,
      coverage: request.patientIds.filter((id) => entry.values[id] !== null)
        .length,
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { numeric: true }),
    );

  return { success: true, datasetRoot, patients, outcomes, warnings };
};

export const discoverLeadGroupExportOptions = async (
  directoryPath: string,
  leadDBS: boolean,
  patientIds: string[],
  launchData: LeadGroupLaunchData = {},
): Promise<LeadGroupExportOptions> => {
  const request = validateLeadGroupExportOptionsRequest({
    directoryPath,
    leadDBS,
    patientIds,
  });
  return discoverLeadGroupExportOptionsWithBudget(
    request,
    launchData,
    new JsonReadBudget(),
  );
};

const sanitizeDatasetId = (datasetRoot: string): string => {
  const datasetName = path.basename(stripTrailingSeparators(datasetRoot));
  // The dataset entity in the analysis filename cannot carry BIDS entity
  // separators, so strip everything non-alphanumeric (as Lead-DBS does)
  // instead of rejecting common folder names like "My_DBS-Data".
  const sanitized = datasetName.replace(/[^A-Za-z0-9]/g, '');
  if (!sanitized) {
    throw new Error(
      `The dataset folder name "${datasetName}" contains no letters or numbers to build a Lead-Group filename from.`,
    );
  }
  return sanitized;
};

const resolveReconstructionIn = async (
  patientFolder: string,
  patientId: string,
  subdirectory: string,
  fileName: string,
): Promise<string | null> => {
  const directoryPath = path.join(patientFolder, subdirectory);
  let reconstructionDirectory: string;
  try {
    reconstructionDirectory = await fs.promises.realpath(directoryPath);
  } catch {
    return null;
  }
  assertPathWithin(
    patientFolder,
    reconstructionDirectory,
    `${patientId}: reconstruction directory`,
  );
  const entries = await fs.promises.readdir(reconstructionDirectory, {
    withFileTypes: true,
  });
  if (entries.length > MAX_SESSION_DIRECTORY_ENTRIES) {
    throw new LeadGroupLimitError(
      `${patientId}: ${subdirectory} directory contains too many files.`,
    );
  }
  const matches = entries.filter(
    (entry) =>
      entry.isFile() &&
      !entry.name.startsWith('._') &&
      entry.name.toLocaleLowerCase('en-US') ===
        fileName.toLocaleLowerCase('en-US'),
  );
  if (matches.length === 0) return null;
  if (matches.length > 1) {
    throw new Error(
      `${patientId}: multiple canonical reconstruction files were found.`,
    );
  }
  const resolved = await fs.promises.realpath(
    path.join(reconstructionDirectory, matches[0].name),
  );
  assertPathWithin(
    reconstructionDirectory,
    resolved,
    `${patientId}: reconstruction file`,
  );
  const stats = await fs.promises.stat(resolved);
  if (!stats.isFile() || stats.size === 0) return null;
  return resolved;
};

/**
 * A Lead-Group analysis needs the patient's electrode reconstruction.
 * Lead-DBS keeps it as reconstruction/<sub>_desc-reconstruction.mat; patients
 * managed by this app may only carry clinical/<sub>_desc-reconstruction.json.
 * Either satisfies the export.
 */
const resolveRequiredReconstruction = async (
  patientFolder: string,
  patientId: string,
): Promise<string> => {
  const subject = path.basename(patientFolder);
  const matReconstruction = await resolveReconstructionIn(
    patientFolder,
    patientId,
    'reconstruction',
    `${subject}_desc-reconstruction.mat`,
  );
  if (matReconstruction) return matReconstruction;

  const jsonReconstruction = await resolveReconstructionIn(
    patientFolder,
    patientId,
    'clinical',
    `${subject}_desc-reconstruction.json`,
  );
  if (jsonReconstruction) return jsonReconstruction;

  throw new Error(
    `${patientId}: no electrode reconstruction was found (looked for reconstruction/${subject}_desc-reconstruction.mat and clinical/${subject}_desc-reconstruction.json).`,
  );
};

export const prepareLeadGroupExport = async (
  request: LeadGroupExportRequest,
  launchData: LeadGroupLaunchData = {},
): Promise<PreparedLeadGroupExport> => {
  const validated = validateLeadGroupExportRequest(request);
  const budget = new JsonReadBudget();
  const options = await discoverLeadGroupExportOptionsWithBudget(
    {
      directoryPath: validated.directoryPath,
      leadDBS: validated.leadDBS,
      patientIds: validated.subjects.map(({ id }) => id),
    },
    launchData,
    budget,
  );
  const patientOptions = new Map(
    options.patients.map((patient) => [patient.id, patient]),
  );
  const outcomeOptions = new Map(
    options.outcomes.map((outcome) => [outcome.key, outcome]),
  );

  const patients = await mapWithConcurrency(
    validated.subjects,
    DISCOVERY_CONCURRENCY,
    async ({ id, stimulationTimeline }) => {
      const patient = patientOptions.get(id);
      if (!patient) throw new Error(`Patient ${id} is not available.`);
      if (
        !patient.stimulations.some(
          (option) => option.timeline === stimulationTimeline,
        )
      ) {
        throw new Error(
          `The selected stimulation for ${id} is no longer available.`,
        );
      }
      const canonicalPatientFolder = await realDirectory(
        patient.patientFolder,
        `${id}: patient folder`,
      );
      assertPathWithin(
        options.datasetRoot,
        canonicalPatientFolder,
        `${id}: patient folder`,
      );
      await resolveRequiredReconstruction(canonicalPatientFolder, id);
      const stimulationPath = await resolveSessionJsonPath(
        canonicalPatientFolder,
        id,
        stimulationTimeline,
        validated.leadDBS,
        'stimulation',
      );
      if (!stimulationPath) {
        throw new Error(
          `The selected stimulation for ${id} is no longer available.`,
        );
      }
      const saved = await readJson(stimulationPath, budget);
      const stimulation = isRecord(saved) && 'S' in saved ? saved.S : saved;
      if (!isRecord(stimulation)) {
        throw new Error(
          `${id} / ${stimulationTimeline} does not contain a valid S object.`,
        );
      }
      return {
        id,
        patientFolder: canonicalPatientFolder,
        stimulationTimeline,
        stimulation,
      };
    },
  );

  const outcomes = validated.outcomeKeys.map((key) => {
    const outcome = outcomeOptions.get(key);
    if (!outcome) {
      throw new Error('A selected clinical outcome is no longer available.');
    }
    if (!validated.allowMissing && outcome.coverage !== patients.length) {
      const missing = patients
        .filter(({ id }) => outcome.values[id] === null)
        .map(({ id }) => id);
      throw new Error(
        `${outcome.label} is missing for: ${missing.join(', ')}.`,
      );
    }
    return outcome;
  });

  const datasetId = sanitizeDatasetId(options.datasetRoot);
  const analysisDirectory = path.join(
    options.datasetRoot,
    'derivatives',
    'leadgroup',
    validated.analysisId,
  );
  const filePath = path.join(
    analysisDirectory,
    `dataset-${datasetId}_analysis-${validated.analysisId}.mat`,
  );
  assertPathWithin(
    options.datasetRoot,
    analysisDirectory,
    'The Lead-Group analysis directory',
  );
  assertPathWithin(analysisDirectory, filePath, 'The Lead-Group MAT file');

  return {
    datasetRoot: options.datasetRoot,
    analysisId: validated.analysisId,
    analysisDirectory,
    filePath,
    patients,
    outcomes,
  };
};

const removeIfPresent = async (filePath: string): Promise<void> => {
  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
};

const syncDirectory = async (directory: string): Promise<void> => {
  let handle: fs.promises.FileHandle | undefined;
  try {
    handle = await fs.promises.open(directory, 'r');
    await handle.sync();
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    const unsupported = ['EBADF', 'EINVAL', 'EISDIR', 'ENOTSUP', 'EPERM'];
    if (process.platform !== 'win32' && !unsupported.includes(code || '')) {
      throw error;
    }
  } finally {
    await handle?.close();
  }
};

export const writeNewLeadGroupAnalysis = async (
  prepared: PreparedLeadGroupExport,
  data: Buffer,
): Promise<void> => {
  if (!Buffer.isBuffer(data) || data.byteLength === 0) {
    throw new Error('The Lead-Group MAT file is empty.');
  }
  if (data.byteLength > MAX_MAT_BYTES) {
    throw new LeadGroupLimitError('The Lead-Group MAT file is too large.');
  }
  const datasetRoot = await realDirectory(prepared.datasetRoot, 'Dataset root');
  if (datasetRoot !== prepared.datasetRoot) {
    throw new LeadGroupPathError('The dataset root changed before export.');
  }
  const analysisId = safeSegment(
    prepared.analysisId,
    'analysis ID',
    MAX_ANALYSIS_ID_LENGTH,
  );
  if (!/^[A-Za-z0-9]+$/.test(analysisId)) {
    throw new Error('The analysis ID may contain letters and numbers only.');
  }
  const datasetId = sanitizeDatasetId(datasetRoot);
  const expectedDirectory = path.join(
    datasetRoot,
    'derivatives',
    'leadgroup',
    analysisId,
  );
  const expectedFile = path.join(
    expectedDirectory,
    `dataset-${datasetId}_analysis-${analysisId}.mat`,
  );
  if (
    path.resolve(prepared.analysisDirectory) !== expectedDirectory ||
    path.resolve(prepared.filePath) !== expectedFile
  ) {
    throw new LeadGroupPathError(
      'The requested Lead-Group output path is not canonical.',
    );
  }

  const derivatives = await realDirectory(
    path.join(datasetRoot, 'derivatives'),
    'Dataset derivatives directory',
  );
  assertPathWithin(datasetRoot, derivatives, 'Dataset derivatives directory');
  const leadGroupParentPath = path.join(derivatives, 'leadgroup');
  let createdLeadGroupParent = false;
  try {
    await fs.promises.mkdir(leadGroupParentPath, { mode: 0o700 });
    createdLeadGroupParent = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  const leadGroupParent = await realDirectory(
    leadGroupParentPath,
    'Lead-Group output directory',
  );
  assertPathWithin(derivatives, leadGroupParent, 'Lead-Group output directory');

  const analysisDirectory = path.join(leadGroupParent, analysisId);
  let claimedDirectory = false;
  let finalCreated = false;
  let handle: fs.promises.FileHandle | undefined;
  const temporaryPath = path.join(
    analysisDirectory,
    `.${path.basename(expectedFile)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const destinationPath = path.join(
    analysisDirectory,
    path.basename(expectedFile),
  );
  try {
    try {
      await fs.promises.mkdir(analysisDirectory, { mode: 0o700 });
      claimedDirectory = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error(
          `A Lead-Group analysis with this ID already exists: ${expectedDirectory}`,
        );
      }
      throw error;
    }
    const canonicalAnalysis = await realDirectory(
      analysisDirectory,
      'Lead-Group analysis directory',
    );
    assertPathWithin(
      leadGroupParent,
      canonicalAnalysis,
      'Lead-Group analysis directory',
    );

    handle = await fs.promises.open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;

    // A hard link is an atomic create-only publish operation. Unlike POSIX
    // rename, it never replaces an existing destination. Filesystems without
    // hard links (exFAT, some network shares) fall back to an exclusive
    // create-only copy; the freshly claimed analysis directory already
    // guarantees exclusivity.
    try {
      await fs.promises.link(temporaryPath, destinationPath);
    } catch (linkError) {
      const code = (linkError as NodeJS.ErrnoException).code;
      if (code !== 'ENOTSUP' && code !== 'EOPNOTSUPP' && code !== 'EPERM') {
        throw linkError;
      }
      await fs.promises.copyFile(
        temporaryPath,
        destinationPath,
        fs.constants.COPYFILE_EXCL,
      );
    }
    finalCreated = true;
    await removeIfPresent(temporaryPath);
    await syncDirectory(canonicalAnalysis);
    await syncDirectory(leadGroupParent);
  } catch (error) {
    try {
      await handle?.close();
    } catch {
      // Continue with best-effort cleanup below.
    }
    try {
      await removeIfPresent(temporaryPath);
    } catch {
      // Preserve the original export failure.
    }
    if (finalCreated) {
      try {
        await removeIfPresent(destinationPath);
      } catch {
        // Preserve the original export failure.
      }
    }
    if (claimedDirectory) {
      try {
        await fs.promises.rmdir(analysisDirectory);
      } catch {
        // Never recursively remove a directory that now contains unknown data.
      }
    }
    if (createdLeadGroupParent) {
      try {
        await fs.promises.rmdir(leadGroupParent);
      } catch {
        // The output parent may now contain another concurrent analysis.
      }
    }
    throw error;
  }
};

export const leadGroupOutcomeKey = outcomeKey;
