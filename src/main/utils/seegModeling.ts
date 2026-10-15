import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

export const DEFAULT_LEADDBS_ROOT = '/Volumes/PdBwh/leaddbs';

const isFile = (filePath: string): boolean => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

const isFolder = (folderPath: string): boolean => {
  try {
    return fs.statSync(folderPath).isDirectory();
  } catch {
    return false;
  }
};

export const resolveLeadDbsRoot = (
  preferredRoot?: string,
  executablePath = process.execPath,
): string => {
  if (preferredRoot) return preferredRoot;
  if (process.env.LEADDBS_ROOT) return process.env.LEADDBS_ROOT;

  // ea_getProgrammerPath writes this preference beside the installed app.
  // Walk up from its executable so macOS, Windows, and Linux layouts work.
  let directory = path.dirname(executablePath);
  for (let depth = 0; depth < 7; depth += 1) {
    const preferencePath = path.join(directory, 'Preferences.json');
    if (isFile(preferencePath)) {
      try {
        const preferences = JSON.parse(fs.readFileSync(preferencePath, 'utf8'));
        if (typeof preferences.LeadDBS_Path === 'string' &&
            isFolder(preferences.LeadDBS_Path)) {
          return preferences.LeadDBS_Path;
        }
      } catch {
        // Keep looking if a neighboring preference file is malformed.
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return DEFAULT_LEADDBS_ROOT;
};

export const resolveMatlabExecutable = (): string | null => {
  const override = process.env.MATLAB_BIN;
  if (override) return isFile(override) ? override : null;

  if (process.platform === 'darwin' && isFolder('/Applications')) {
    const installations = fs
      .readdirSync('/Applications')
      .filter((name) => /^MATLAB_R\d{4}[ab]\.app$/.test(name))
      .sort()
      .reverse();
    for (const installation of installations) {
      const candidate = path.join('/Applications', installation, 'bin', 'matlab');
      if (isFile(candidate)) return candidate;
    }
  }

  const executable = process.platform === 'win32' ? 'matlab.exe' : 'matlab';
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, executable);
    if (isFile(candidate)) return candidate;
  }
  return null;
};

const matlabString = (value: string): string => `'${value.replace(/'/g, "''")}'`;

export const buildSeegMatlabCommand = (
  leaddbsRoot: string,
  stimDir: string,
): string =>
  `addpath(${matlabString(leaddbsRoot)}); ea_setpath; ` +
  `sEEG_RF_pipeline(${matlabString(stimDir)});`;

export interface SeegModelingPreparation {
  matlabPath: string;
  leaddbsRoot: string;
  stimDir: string;
  logPath: string;
  command: string;
}

export const prepareSeegModeling = (
  datasetRoot: string,
  patientId: string,
  preferredLeadDbsRoot?: string,
): SeegModelingPreparation => {
  const leaddbsRoot = resolveLeadDbsRoot(preferredLeadDbsRoot);
  if (!path.isAbsolute(datasetRoot) || !isFolder(datasetRoot)) {
    throw new Error('Select a valid dataset folder before modeling.');
  }
  if (!patientId || patientId === '.' || patientId === '..' || /[/\\\0]/.test(patientId)) {
    throw new Error('Select a valid patient before modeling.');
  }
  const stimDir = path.join(datasetRoot, 'derivatives', 'leaddbs', patientId, 'stimulations');
  const tablePath = path.join(stimDir, `${patientId}_stimparameters.tsv`);
  if (!isFile(tablePath)) {
    throw new Error('The sEEG contact table is missing. Save the configuration first.');
  }
  const tableLines = fs.readFileSync(tablePath, 'utf8').trim().split(/\r?\n/);
  const headers = tableLines[0].split('\t');
  const groupIndex = headers.indexOf('group');
  if (groupIndex < 0) throw new Error('The sEEG contact table has no electrode group column.');
  const electrodeGroups = new Set(
    tableLines.slice(1).map((line) => line.split('\t')[groupIndex]).filter(Boolean),
  );
  const prefix = `${patientId}_stimparameters_`;
  const protocolFiles = fs.readdirSync(stimDir).filter(
    (name) => name.startsWith(prefix) && name.endsWith('.csv') &&
      electrodeGroups.has(name.slice(prefix.length, -4)),
  );
  let hasActiveProtocol = false;
  protocolFiles.forEach((name) => {
    const rows = fs.readFileSync(path.join(stimDir, name), 'utf8').trim().split(/\r?\n/).slice(1);
    rows.forEach((row) => row.split(',').forEach((cell) => {
      const value = cell.trim();
      if (value === '' || value.toLowerCase() === 'none') return;
      if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ||
          !Number.isFinite(Number(value))) {
        throw new Error(`Invalid amplitude "${value}" in ${name}. Enter a numeric amplitude before modeling.`);
      }
      hasActiveProtocol = true;
    }));
  });
  if (!hasActiveProtocol) {
    throw new Error('No active sEEG stimulation was found. Activate a contact and set its amplitude.');
  }
  const pipeline = path.join(leaddbsRoot, 'ext_libs', 'OSS-DBS', 'sEEG', 'sEEG_RF_pipeline.m');
  if (!isFile(pipeline)) throw new Error(`Lead-DBS sEEG pipeline was not found at ${pipeline}.`);
  const spaceTemplates = path.join(leaddbsRoot, 'templates', 'space');
  if (!isFolder(spaceTemplates)) {
    throw new Error(`Lead-DBS space templates were not found at ${spaceTemplates}.`);
  }
  const matlabPath = resolveMatlabExecutable();
  if (!matlabPath) throw new Error('MATLAB was not found. Set MATLAB_BIN to its executable path.');

  return {
    matlabPath,
    leaddbsRoot,
    stimDir,
    logPath: path.join(stimDir, `${patientId}_desc-seegModeling.log`),
    command: buildSeegMatlabCommand(leaddbsRoot, stimDir),
  };
};

export const launchSeegModeling = (
  prepared: SeegModelingPreparation,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const logDescriptor = fs.openSync(prepared.logPath, 'a');
    let child;
    try {
      child = spawn(prepared.matlabPath, ['-batch', prepared.command], {
        cwd: prepared.leaddbsRoot,
        detached: true,
        stdio: ['ignore', logDescriptor, logDescriptor],
      });
    } catch (error) {
      reject(error);
      return;
    } finally {
      fs.closeSync(logDescriptor);
    }
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
