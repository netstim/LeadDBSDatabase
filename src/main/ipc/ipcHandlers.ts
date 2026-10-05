import { app, ipcMain, dialog } from 'electron';
import path from 'path';
import zlib from 'zlib';
import { getData } from '../data/data';
import { getPatientFolder, getPatientFolderPly } from '../helpers/helpers';
import {
  discoverLeadGroupExportOptions,
  prepareLeadGroupExport,
  validateLeadGroupExportOptionsRequest,
  validateLeadGroupExportRequest,
  writeNewLeadGroupAnalysis,
} from '../utils/leadGroupExport';
import { buildLeadGroupMatFile } from '../utils/leadGroupMat';

const { execSync } = require('child_process');

const fs = require('fs');

let fileHandlersRegistered = false;

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const assertSafePathSegment = (value: unknown, label: string): string => {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value === '.' ||
    value === '..' ||
    value.includes('/') ||
    value.includes('\\') ||
    value.includes('\0')
  ) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
};

const exactArrayBuffer = (value: Buffer): ArrayBuffer =>
  value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength,
  ) as ArrayBuffer;

const isContainedPath = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== '..' &&
      !path.isAbsolute(relative))
  );
};

interface ViewerRequest {
  patient?: { id?: unknown };
  directoryPath?: unknown;
  leadDBS?: unknown;
}

const resolveViewerPatientFolder = async (
  historical: unknown,
): Promise<{ patientId: string; patientFolder: string } | null> => {
  if (
    typeof historical !== 'object' ||
    historical === null ||
    (historical as ViewerRequest).leadDBS !== true
  ) {
    return null;
  }

  const request = historical as ViewerRequest;
  const patientId = assertSafePathSegment(
    request.patient?.id,
    'viewer patient ID',
  );
  if (
    typeof request.directoryPath !== 'string' ||
    !path.isAbsolute(request.directoryPath)
  ) {
    throw new Error('Invalid viewer dataset directory.');
  }

  let datasetRoot: string;
  try {
    datasetRoot = await fs.promises.realpath(request.directoryPath);
  } catch {
    return null;
  }

  const requestedPatientFolder = getPatientFolderPly(
    datasetRoot,
    patientId,
    true,
  );
  if (!requestedPatientFolder || !path.isAbsolute(requestedPatientFolder)) {
    return null;
  }

  let patientFolder: string;
  try {
    patientFolder = await fs.promises.realpath(requestedPatientFolder);
  } catch {
    return null;
  }
  if (!isContainedPath(datasetRoot, patientFolder)) {
    throw new Error(
      'The viewer patient folder is outside the selected dataset.',
    );
  }

  return { patientId, patientFolder };
};

const resolveContainedViewerFile = async (
  root: string,
  requestedPath: string,
  label: string,
): Promise<string | null> => {
  let resolvedPath: string;
  try {
    resolvedPath = await fs.promises.realpath(requestedPath);
  } catch (error: any) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
    throw new Error(`${label} could not be resolved.`);
  }
  if (!isContainedPath(root, resolvedPath)) {
    throw new Error(`${label} is outside the patient folder.`);
  }
  const stats = await fs.promises.stat(resolvedPath);
  if (!stats.isFile()) return null;
  return resolvedPath;
};

const atomicWriteJson = async (
  filePath: string,
  data: unknown,
): Promise<void> => {
  const directory = path.dirname(filePath);
  await fs.promises.mkdir(directory, { recursive: true });

  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    await fs.promises.writeFile(
      temporaryPath,
      JSON.stringify(data, null, 2),
      'utf8',
    );
    await fs.promises.rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await fs.promises.unlink(temporaryPath);
    } catch {
      // The temporary file may not have been created.
    }
    throw error;
  }
};

const launchPatientIds = (stimulationData: any): string[] => {
  if (
    stimulationData?.scope === 'patient' &&
    typeof stimulationData?.selectedPatientId === 'string' &&
    stimulationData.selectedPatientId
  ) {
    return [stimulationData.selectedPatientId];
  }
  if (Array.isArray(stimulationData?.subjects)) {
    const subjectIds = stimulationData.subjects
      .map((subject: any) => subject?.id || subject?.patientname)
      .filter((id: unknown): id is string => typeof id === 'string' && !!id);
    if (subjectIds.length > 0) return subjectIds;
  }

  const patientNames = stimulationData?.patientname;
  if (Array.isArray(patientNames)) {
    return patientNames.filter(
      (id: unknown): id is string => typeof id === 'string' && !!id,
    );
  }

  return typeof patientNames === 'string' && patientNames ? [patientNames] : [];
};

interface DirectoryEntry {
  name: string;
  isFile: () => boolean;
}

export default function registerFileHandlers() {
  if (fileHandlersRegistered) {
    return;
  }
  fileHandlersRegistered = true;

  ipcMain.on('ipc-example', async (_event, arg) => {
    console.log('ipc-example');
  });

  ipcMain.handle(
    'get-lead-group-export-options',
    async (_event, request: unknown) => {
      const validated = validateLeadGroupExportOptionsRequest(request);
      return discoverLeadGroupExportOptions(
        validated.directoryPath,
        validated.leadDBS,
        validated.patientIds,
        getData('stimulationData') || {},
      );
    },
  );

  ipcMain.handle('export-lead-group', async (_event, request: unknown) => {
    const validated = validateLeadGroupExportRequest(request);
    const prepared = await prepareLeadGroupExport(
      validated,
      getData('stimulationData') || {},
    );
    const createdAt = new Date();
    const fileBuffer = buildLeadGroupMatFile(prepared, createdAt);
    await writeNewLeadGroupAnalysis(prepared, fileBuffer);

    return {
      success: true,
      filePath: prepared.filePath,
      patientCount: prepared.patients.length,
      outcomeCount: prepared.outcomes.length,
      byteLength: fileBuffer.byteLength,
      createdAt: createdAt.toISOString(),
    };
  });

  // Handle writing the JSON file
  ipcMain.on('save-patients-json', (event, folderPath, patients) => {
    let filePath;
    try {
      filePath = path.join(folderPath, 'participants.json');
    } catch (err) {
      const stimulationData = getData('stimulationData');
      console.log('Stimulation Data: ', stimulationData);
      filePath = path.join(stimulationData.path, 'participants.json');
    }
    console.log('File path: ', filePath);
    fs.writeFile(filePath, JSON.stringify(patients, null, 2), (err) => {
      if (err) {
        console.error('Error saving JSON file:', err);
        event.sender.send('json-save-error', 'Error saving file');
      } else {
        event.sender.send('json-saved', 'File saved successfully');
      }
    });
    console.log('');
  });

  ipcMain.handle('check-folder-exists', (event, folderPath) => {
    return new Promise((resolve) => {
      fs.access(folderPath, fs.constants.F_OK, (err) => {
        if (err) {
          resolve(false); // Folder does not exist
        } else {
          resolve(true); // Folder exists
        }
      });
    });
  });

  ipcMain.on('open-file', (event, arg) => {
    const f = fs.readFileSync(arg);
    console.log(event);
    event.reply('open-file', `pong: ${f}`);
  });

  const saveStimulationFile = async (data: any, historical: any) => {
    const { patient, timeline, directoryPath, leadDBS } = historical || {};
    if (!patient?.id || !timeline || !directoryPath) {
      throw new Error('Missing patient, timeline, or directory path.');
    }

    const patientId = assertSafePathSegment(patient.id, 'patient ID');
    const safeTimeline = assertSafePathSegment(timeline, 'session name');
    const patientDir = leadDBS
      ? getPatientFolder(directoryPath, patientId, true)
      : path.join(directoryPath, `sub-${patientId}`);
    const sessionDir = path.join(patientDir, `ses-${safeTimeline}`);
    const fileName = leadDBS
      ? `${patientId}_ses-${safeTimeline}_stimparameters.json`
      : `sub-${patientId}_ses-${safeTimeline}_stim.json`;
    const filePath = path.join(sessionDir, fileName);

    await atomicWriteJson(filePath, data);

    const masterJsonPath = path.join(directoryPath, 'dataset_master.json');
    if (fs.existsSync(masterJsonPath)) {
      const masterData = JSON.parse(
        await fs.promises.readFile(masterJsonPath, 'utf8'),
      );
      const masterPatientId = patientId.replace('-', '_');
      const clinicalData = masterData?.[masterPatientId]?.clinicalData;
      if (clinicalData) {
        const sessionKey = `ses_${safeTimeline}`;
        if (!Array.isArray(clinicalData[sessionKey])) {
          clinicalData[sessionKey] = [];
        }
        if (!clinicalData[sessionKey].includes(filePath)) {
          clinicalData[sessionKey].push(filePath);
        }
        await atomicWriteJson(masterJsonPath, masterData);
      }
    }

    return { success: true, filePath };
  };

  ipcMain.handle('save-file', async (_event, _file, data, historical) =>
    saveStimulationFile(data, historical),
  );

  // Keep the original event channel for older renderer builds.
  ipcMain.on('save-file', async (event, _file, data, historical) => {
    try {
      const result = await saveStimulationFile(data, historical);
      event.reply('file-saved', result.filePath);
    } catch (error) {
      event.reply('file-save-error', errorMessage(error));
    }
  });

  const saveStimulateResult = async (data: any) => {
    const stimulationData = getData('stimulationData');
    const responsePath =
      stimulationData?.responsePath ||
      stimulationData?.outputPath ||
      (stimulationData?.stimDir
        ? path.join(stimulationData.stimDir, 'data.json')
        : null);

    if (!responsePath || typeof responsePath !== 'string') {
      throw new Error('The launch request does not specify a result path.');
    }

    const expectedPatientIds = launchPatientIds(stimulationData);
    let normalizedData = data;

    if (
      stimulationData?.type === 'leadgroup' ||
      stimulationData?.scope === 'group'
    ) {
      if (expectedPatientIds.length === 0) {
        throw new Error(
          'The group launch request does not contain any patients.',
        );
      }
      if (!Array.isArray(normalizedData)) {
        const keyedResults = normalizedData?.resultsByPatient || normalizedData;
        if (
          keyedResults &&
          typeof keyedResults === 'object' &&
          expectedPatientIds.every((id) => keyedResults[id])
        ) {
          normalizedData = expectedPatientIds.map((id) => keyedResults[id]);
        }
      }

      if (!Array.isArray(normalizedData)) {
        throw new Error(
          'Group stimulation results must contain one result per patient.',
        );
      }
      if (normalizedData.length !== expectedPatientIds.length) {
        throw new Error(
          `Expected ${expectedPatientIds.length} group results, received ${normalizedData.length}.`,
        );
      }

      const resultIds = normalizedData.map(
        (result: any) => result?.subjectId || result?.patientname,
      );
      if (resultIds.every((id: unknown) => typeof id === 'string' && !!id)) {
        const resultsByPatient = new Map(
          normalizedData.map((result: any, index: number) => [
            resultIds[index],
            result,
          ]),
        );
        if (
          resultsByPatient.size !== normalizedData.length ||
          !expectedPatientIds.every((id) => resultsByPatient.has(id))
        ) {
          throw new Error(
            'Group result patient IDs do not match the launch request.',
          );
        }
        normalizedData = expectedPatientIds.map((id) =>
          resultsByPatient.get(id),
        );
      }
    }

    await atomicWriteJson(responsePath, normalizedData);
    return {
      success: true,
      filePath: responsePath,
      patientIds: expectedPatientIds,
      resultCount: Array.isArray(normalizedData) ? normalizedData.length : 1,
    };
  };

  ipcMain.handle('save-file-stimulate', async (_event, _file, data) =>
    saveStimulateResult(data),
  );

  // Keep the original event channel for older renderer builds.
  ipcMain.on('save-file-stimulate', async (event, _file, data) => {
    try {
      const result = await saveStimulateResult(data);
      event.reply('file-saved', result.filePath);
    } catch (error) {
      event.reply('file-save-error', errorMessage(error));
    }
  });

  ipcMain.on('save-file-test', (event, data) => {
    const dataString = JSON.stringify(data);
    // const newStimFilePath = path.join(stimulationDirectory, 'data.json');
    const newStimFilePath =
      '/Volumes/PdBwh/CompleteParkinsons/optimized_output.json';
    try {
      // fs.writeFileSync(filePath, dataString);
      console.log(newStimFilePath);
      fs.writeFileSync(newStimFilePath, dataString);
    } catch (error) {
      // Handle the error here
      console.error('Error writing to file:', error);
    }
    event.reply('file-saved', newStimFilePath);
  });

  const saveClinicalScores = async (
    data: any,
    historical: any,
    scoretype: string,
  ) => {
    const { patient, timeline, directoryPath, leadDBS } = historical || {};
    if (!patient?.id || !timeline || !directoryPath || !scoretype) {
      throw new Error(
        'Missing patient, timeline, directory path, or clinical score type.',
      );
    }

    const patientId = assertSafePathSegment(patient.id, 'patient ID');
    const safeTimeline = assertSafePathSegment(timeline, 'session name');
    const patientDir = leadDBS
      ? getPatientFolder(directoryPath, patientId, true)
      : path.join(directoryPath, `sub-${patientId}`);
    const sessionDir = path.join(patientDir, `ses-${safeTimeline}`);
    const fileName = leadDBS
      ? `${patientId}_ses-${safeTimeline}_clinical.json`
      : `sub-${patientId}_ses-${safeTimeline}_clinical.json`;
    const filePath = path.join(sessionDir, fileName);

    let clinicalScores: Record<string, any> = {};
    if (fs.existsSync(filePath)) {
      clinicalScores = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
    }
    clinicalScores[scoretype] = data;
    await atomicWriteJson(filePath, clinicalScores);

    return { success: true, filePath };
  };

  ipcMain.handle(
    'save-file-clinical',
    async (_event, data, historical, scoretype) =>
      saveClinicalScores(data, historical, scoretype),
  );

  // Keep the original event channel for older renderer builds.
  ipcMain.on(
    'save-file-clinical',
    async (event, data, historical, scoretype) => {
      try {
        const result = await saveClinicalScores(data, historical, scoretype);
        event.reply('file-saved', result.filePath);
      } catch (error) {
        event.reply('file-save-error', errorMessage(error));
      }
    },
  );

  ipcMain.handle(
    'delete-session',
    async (_event, directoryPath, patientId, timeline, leadDBS) => {
      if (!directoryPath) {
        throw new Error('Missing dataset directory.');
      }

      const safePatientId = assertSafePathSegment(patientId, 'patient ID');
      const safeTimeline = assertSafePathSegment(timeline, 'session name');
      const patientDir = leadDBS
        ? getPatientFolder(directoryPath, safePatientId, true)
        : path.join(directoryPath, `sub-${safePatientId}`);
      const sessionDir = path.resolve(patientDir, `ses-${safeTimeline}`);
      const resolvedPatientDir = path.resolve(patientDir);

      if (path.dirname(sessionDir) !== resolvedPatientDir) {
        throw new Error(
          'The requested session is outside the patient directory.',
        );
      }

      const allowedFileNames = new Set([
        `${safePatientId}_ses-${safeTimeline}_clinical.json`,
        `${safePatientId}_ses-${safeTimeline}_stimparameters.json`,
        `sub-${safePatientId}_ses-${safeTimeline}_clinical.json`,
        `sub-${safePatientId}_ses-${safeTimeline}_stim.json`,
      ]);
      const removedFiles: string[] = [];

      if (fs.existsSync(sessionDir)) {
        const entries = await fs.promises.readdir(sessionDir, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          if (entry.isFile() && allowedFileNames.has(entry.name)) {
            await fs.promises.unlink(path.join(sessionDir, entry.name));
            removedFiles.push(entry.name);
          }
        }

        const remainingEntries = await fs.promises.readdir(sessionDir);
        if (remainingEntries.length === 0) {
          await fs.promises.rmdir(sessionDir);
        }
      }
      const sessionRemoved = !fs.existsSync(sessionDir);

      const masterJsonPath = path.join(directoryPath, 'dataset_master.json');
      if (fs.existsSync(masterJsonPath)) {
        const masterData = JSON.parse(
          await fs.promises.readFile(masterJsonPath, 'utf8'),
        );
        const masterPatientId = safePatientId.replace('-', '_');
        const clinicalData = masterData?.[masterPatientId]?.clinicalData;
        const sessionKey = `ses_${safeTimeline}`;
        if (clinicalData && Array.isArray(clinicalData[sessionKey])) {
          const previousPaths = clinicalData[sessionKey];
          const remainingPaths = previousPaths.filter((storedPath: unknown) => {
            if (typeof storedPath !== 'string') return true;
            const resolvedStoredPath = path.resolve(directoryPath, storedPath);
            return !(
              path.dirname(resolvedStoredPath) === sessionDir &&
              allowedFileNames.has(path.basename(resolvedStoredPath))
            );
          });
          if (remainingPaths.length !== previousPaths.length) {
            if (remainingPaths.length === 0) {
              delete clinicalData[sessionKey];
            } else {
              clinicalData[sessionKey] = remainingPaths;
            }
            await atomicWriteJson(masterJsonPath, masterData);
          }
        }
      }

      return {
        success: true,
        removedFiles,
        sessionRemoved,
      };
    },
  );

  ipcMain.on(
    'import-file-clinical',
    async (event, id, timeline, directoryPath, leadDBS) => {
      const fs = require('fs');
      try {
        // Validate id, timeline, and directoryPath
        if (!id || !timeline || !directoryPath) {
          console.error('Missing patient ID, timeline, or directoryPath');
          event.reply(
            'import-file-error',
            'Missing patient ID, timeline, or directoryPath',
          );
          return;
        }

        // Construct the file path dynamically based on the directoryPath, patient id, and timeline
        // let patientDir = path.join(directoryPath, `sub-${id}`);
        const patientDir = getPatientFolder(directoryPath, id, leadDBS);
        let fileName = `sub-${id}_ses-${timeline}_clinical.json`;
        if (leadDBS) {
          // patientDir = path.join(
          //   directoryPath,
          //   'derivatives/leaddbs',
          //   id,
          //   'clinical',
          // );
          fileName = `${id}_ses-${timeline}_clinical.json`;
        }

        const sessionDir = path.join(patientDir, `ses-${timeline}`);
        const filePath = path.join(sessionDir, fileName);

        // Check if the file exists before trying to read it
        if (!fs.existsSync(filePath)) {
          console.error('File not found:', filePath);
          event.reply('import-file-clinical', 'File not found');
          return;
        }

        // Read the file
        const fileData = fs.readFileSync(filePath);

        // Parse the JSON data
        const jsonData = JSON.parse(fileData);

        // Log and send the data back to the renderer process
        console.log(jsonData);
        event.reply('import-file-clinical', jsonData);
      } catch (err) {
        // Handle specific errors
        if (err.code === 'ENOENT') {
          console.error('File not found:', filePath);
          event.reply('import-file-error', 'File not found');
        } else if (err.name === 'SyntaxError') {
          console.error('Error parsing JSON:', err.message);
          event.reply('import-file-error', 'Error parsing JSON');
        } else {
          console.error('An unexpected error occurred:', err);
          event.reply('import-file-error', err.message);
        }
      }
    },
  );

  ipcMain.on(
    'import-file-clinical-group',
    async (event, id, timeline, directoryPath, leadDBS) => {
      // const path = require('path');
      console.log('Timeline: ', timeline);
      const outputData = {};
      // Guard against callers mounted without navigation state: an exception
      // here would surface as an uncaught main-process error dialog.
      if (!id || !timeline || typeof timeline !== 'object' || !directoryPath) {
        event.reply('import-file-clinical-group', outputData);
        return;
      }
      Object.keys(timeline).forEach((key) => {
        try {
          // Loop through each timeline item and process it individually
          // Construct the file path dynamically
          // let patientDir = path.join(directoryPath, `${id}`);
          const patientDir = getPatientFolder(directoryPath, id, leadDBS);
          let fileName = `${id}_ses-${timeline[key]}_clinical.json`;
          if (leadDBS) {
            // patientDir = path.join(
            //   directoryPath,
            //   'derivatives/leaddbs',
            //   `${id}`,
            //   'clinical',
            // );
            fileName = `${id}_ses-${timeline[key]}_clinical.json`;
          }

          const sessionDir = path.join(patientDir, `ses-${timeline[key]}`);
          const filePath = path.join(sessionDir, fileName);

          // Check if the file exists before trying to read it
          if (!fs.existsSync(filePath)) {
            console.error('File not found:', filePath);
            // event.reply(`import-file-clinical-${timeline}`, 'File not found');
            return;
          }

          // Read and parse the JSON data
          const fileData = fs.readFileSync(filePath);
          const jsonData = JSON.parse(fileData);

          // Send the data back to the renderer process for this specific timeline
          console.log(`Sending data for ${timeline[key]}`, jsonData);
          outputData[timeline[key]] = jsonData;
          // event.reply(`import-file-clinical-${timeline}`, jsonData);
        } catch (err) {
          outputData[timeline[key]] = 'Does not exist';
          console.error('An unexpected error occurred:', err);

          // event.reply('import-file-error', err.message);
        }
      });
      event.reply('import-file-clinical-group', outputData);
    },
  );

  // PLY Viewer ipc functions

  ipcMain.handle('load-ply-file', async (_event, historical) => {
    const resolved = await resolveViewerPatientFolder(historical);
    if (!resolved) return null;
    const filePath = path.join(
      resolved.patientFolder,
      'export',
      'ply',
      'combined_electrodes.ply',
    );
    const resolvedFile = await resolveContainedViewerFile(
      resolved.patientFolder,
      filePath,
      'The patient electrode PLY file',
    );
    if (!resolvedFile) return null;
    try {
      return exactArrayBuffer(await fs.promises.readFile(resolvedFile));
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
      throw new Error('The patient electrode PLY file could not be read.');
    }
  });

  ipcMain.handle('load-ply-file-anatomy', async (_event, historical) => {
    const resolved = await resolveViewerPatientFolder(historical);
    if (!resolved) return null;
    const filePath = path.join(
      resolved.patientFolder,
      'export',
      'ply',
      'anatomy.ply',
    );
    const resolvedFile = await resolveContainedViewerFile(
      resolved.patientFolder,
      filePath,
      'The patient anatomy PLY file',
    );
    if (!resolvedFile) return null;
    try {
      return exactArrayBuffer(await fs.promises.readFile(resolvedFile));
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
      throw new Error('The patient anatomy PLY file could not be read.');
    }
  });

  ipcMain.handle('load-vis-coords', async (_event, historical) => {
    const resolved = await resolveViewerPatientFolder(historical);
    if (!resolved) return null;
    const requestedClinicalDirectory = path.join(
      resolved.patientFolder,
      'clinical',
    );
    let clinicalDirectory: string;
    let entries: string[];
    try {
      clinicalDirectory = await fs.promises.realpath(
        requestedClinicalDirectory,
      );
      if (!isContainedPath(resolved.patientFolder, clinicalDirectory)) {
        throw new Error(
          'The patient clinical directory is outside the patient folder.',
        );
      }
      entries = await fs.promises.readdir(clinicalDirectory);
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return null;
      throw new Error('The patient clinical directory could not be read.');
    }

    const expectedName =
      `${resolved.patientId}_desc-reconstruction.json`.toLowerCase();
    const matches = entries.filter(
      (entry) => entry.toLowerCase() === expectedName,
    );
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      throw new Error(
        'Multiple case-variant reconstruction JSON files were found for this patient.',
      );
    }

    const reconstructionPath = await resolveContainedViewerFile(
      clinicalDirectory,
      path.join(clinicalDirectory, matches[0]),
      'The patient reconstruction JSON',
    );
    if (!reconstructionPath) return null;
    try {
      return JSON.parse(await fs.promises.readFile(reconstructionPath, 'utf8'));
    } catch (error) {
      throw new Error(
        'The patient reconstruction JSON is invalid or unreadable.',
      );
    }
  });

  // ipcMain.handle('load-ply-file-2', async (event, filePath) => {

  //   const niiFiles = [];
  //   const atlasesPath = '/Users/savirmadan/Documents/GitHub/leaddbs/templates/space/MNI152NLin2009bAsym/atlases';
  //   try {
  //     const findNiiFiles = (dirPath) => {
  //       const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  //       for (const entry of entries) {
  //         const fullPath = path.join(dirPath, entry.name);
  //         if (entry.isDirectory()) {
  //           findNiiFiles(fullPath);
  //         } else if (entry.isFile() && (entry.name.endsWith('.nii') || entry.name.endsWith('.nii.gz'))) {
  //           niiFiles.push({
  //             fileName: entry.name,
  //             filePath: fullPath,
  //           });
  //         }
  //       }
  //     };

  //     findNiiFiles(atlasesPath);
  //     console.log(niiFiles);
  //   } catch (error) {
  //     console.error('Error reading atlas folders:', error);
  //   }
  //   console.log(niiFiles);
  //   return niiFiles;
  //   // try {
  //   //   // const stnFilePath = '/Users/savirmadan/Documents/GitHub/leaddbs/templates/space/MNI_ICBM_2009b_NLIN_ASYM/atlases/DISTAL Nano (Ewert 2017)/lh/STN.nii';
  //   //   // const fileData = fs.readFileSync(stnFilePath);
  //   //   const stnFilePath = '/Users/savirmadan/Documents/GitHub/leaddbs/templates/space/MNI_ICBM_2009b_NLIN_ASYM/atlases/DISTAL Nano (Ewert 2017)/lh/STN.nii.gz';
  //   //   const compressedData = fs.readFileSync(stnFilePath);
  //   //   const fileData = zlib.gunzipSync(compressedData); // Decompress the .nii.gz file
  //   //   return fileData.buffer;
  //   //   // const fileData = fs.readFileSync(filePath); // Read the PLY file as binary
  //   //   // return fileData.buffer; // Return as ArrayBuffer
  //   // } catch (error) {
  //   //   return null;
  //   // }
  // });

  ipcMain.handle('load-ply-file-2', async (event, filePath) => {
    try {
      const plyData = fs.readFileSync(filePath);
      return plyData.buffer;
    } catch (error) {
      console.error('Error reading atlas folders:', error);
    }
    // try {
    //   // const stnFilePath = '/Users/savirmadan/Documents/GitHub/leaddbs/templates/space/MNI_ICBM_2009b_NLIN_ASYM/atlases/DISTAL Nano (Ewert 2017)/lh/STN.nii';
    //   // const fileData = fs.readFileSync(stnFilePath);
    //   const stnFilePath = '/Users/savirmadan/Documents/GitHub/leaddbs/templates/space/MNI_ICBM_2009b_NLIN_ASYM/atlases/DISTAL Nano (Ewert 2017)/lh/STN.nii.gz';
    //   const compressedData = fs.readFileSync(stnFilePath);
    //   const fileData = zlib.gunzipSync(compressedData); // Decompress the .nii.gz file
    //   return fileData.buffer;
    //   // const fileData = fs.readFileSync(filePath); // Read the PLY file as binary
    //   // return fileData.buffer; // Return as ArrayBuffer
    // } catch (error) {
    //   return null;
    // }
  });

  ipcMain.handle('load-file-buffer', async (event, filePath) => {
    const fileData = fs.readFileSync(filePath);
    if (filePath.endsWith('.gz')) {
      const compressedData = fs.readFileSync(filePath);
      const fileData = zlib.gunzipSync(compressedData); // Decompress the .gz file
      return fileData.buffer;
    }
    return fileData.buffer;
  });

  // Import

  ipcMain.on('batch-import', async (event, data, leadDBS) => {
    const stimulationData = getData('stimulationData');
    const directoryPath = stimulationData.filepath;
    console.log(Object.keys(data));
    Object.keys(data).forEach((key) => {
      const { id, timeline, scores } = data[key];
      console.log('ID: ', id);
      const tempId = id.trim();
      const patientFolder = getPatientFolder(directoryPath, tempId, leadDBS);
      console.log('Patient Folder: ', patientFolder);
      console.log('Scores: ', scores);
      const scoretype = scores['Score Type'];
      // Remove 'Score Type' from scores
      delete scores['Score Type'];
      const sessionDir = path.join(patientFolder, `ses-${timeline}`);
      try {
        // Ensure that the directories exist, if not, create them
        if (!fs.existsSync(patientFolder))
          fs.mkdirSync(patientFolder, { recursive: true });
        if (!fs.existsSync(sessionDir))
          fs.mkdirSync(sessionDir, { recursive: true });
        // Convert the data to a string format (JSON)
        const dataString = JSON.stringify(scores, null, 2);
        // Dynamically name the file based on patient and timeline
        let fileName = `sub-${tempId}_ses-${timeline}_clinical.json`;
        if (leadDBS) {
          fileName = `${tempId}_ses-${timeline}_clinical.json`;
        }
        const filePath = path.join(sessionDir, fileName);
        // Write the data to the file
        if (fs.existsSync(filePath)) {
          const clinicalScores = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          clinicalScores[scoretype] = scores;
          fs.writeFileSync(filePath, JSON.stringify(clinicalScores, null, 2));
        } else {
          let clinicalScores = {};
          clinicalScores[scoretype] = scores;
          fs.writeFileSync(filePath, JSON.stringify(clinicalScores, null, 2));
        }
        // Send the file path back to the renderer process
        console.log(`Data saved successfully to ${filePath}`);
      } catch (error) {
        // Handle any errors in the saving process
        console.error('Error writing to file:', error);
      }
    });
    event.reply('batch-import', 'success');
  });

  const batchImportStimulation = async (data: any, leadDBS: boolean) => {
    const stimulationData = getData('stimulationData');
    const directoryPath = stimulationData?.filepath || stimulationData?.path;
    if (!directoryPath) {
      throw new Error('No dataset directory is available for the import.');
    }
    if (!data || typeof data !== 'object') {
      throw new Error('The stimulation import does not contain any rows.');
    }

    const errors: Array<{ row: string; error: string }> = [];
    let savedCount = 0;

    for (const key of Object.keys(data)) {
      try {
        const { id, S, timeline } = data[key] || {};
        const safePatientId = assertSafePathSegment(id, 'patient ID');
        const safeTimeline = assertSafePathSegment(timeline, 'session name');
        if (!S || typeof S !== 'object') {
          throw new Error('Missing stimulation settings.');
        }

        const patientFolder = leadDBS
          ? getPatientFolder(directoryPath, safePatientId, true)
          : path.join(directoryPath, `sub-${safePatientId}`);
        const sessionDir = path.join(patientFolder, `ses-${safeTimeline}`);
        const fileName = leadDBS
          ? `${safePatientId}_ses-${safeTimeline}_stimparameters.json`
          : `sub-${safePatientId}_ses-${safeTimeline}_stim.json`;
        const filePath = path.join(sessionDir, fileName);
        await atomicWriteJson(filePath, { S });
        savedCount += 1;
      } catch (error) {
        errors.push({
          row: Array.isArray(data) ? String(Number(key) + 2) : key,
          error: errorMessage(error),
        });
      }
    }

    return {
      success: errors.length === 0,
      savedCount,
      errors,
      error: errors.map(({ row, error }) => `Row ${row}: ${error}`).join('\n'),
    };
  };

  ipcMain.handle('batch-import-stimulation', async (_event, data, leadDBS) =>
    batchImportStimulation(data, !!leadDBS),
  );

  // Keep the original event channel for older renderer builds.
  ipcMain.on('batch-import-stimulation', async (event, data, leadDBS) => {
    try {
      const result = await batchImportStimulation(data, !!leadDBS);
      event.reply('batch-import-stimulation', result);
    } catch (error) {
      event.reply('batch-import-stimulation', {
        success: false,
        savedCount: 0,
        errors: [{ row: '', error: errorMessage(error) }],
        error: errorMessage(error),
      });
    }
  });

  ipcMain.handle('get-clinical-scores-types', async (event, text) => {
    console.log('text: ', text);
    const userDataPath = app.getPath('userData');
    const scoresFilePath = path.join(userDataPath, 'ClinicalScores.json');
    console.log('scoresFilePath: ', scoresFilePath);
    try {
      const data = fs.readFileSync(scoresFilePath, 'utf8');
      const scores = JSON.parse(data);
      return scores;
    } catch (err) {
      console.error('Error reading scores file:', err);
      return null;
    }
  });

  const addScoreType = async (name: string, newScore: any) => {
    const scoreName = typeof name === 'string' ? name.trim() : '';
    if (!scoreName) {
      throw new Error('Clinical score type name is required.');
    }

    const userDataPath = app.getPath('userData');
    const scoresFilePath = path.join(userDataPath, 'ClinicalScores.json');
    const scores = fs.existsSync(scoresFilePath)
      ? JSON.parse(await fs.promises.readFile(scoresFilePath, 'utf8'))
      : {};
    const scoreDefinition =
      newScore?.[name] ?? newScore?.[scoreName] ?? newScore;
    if (!scoreDefinition || typeof scoreDefinition !== 'object') {
      throw new Error('Clinical score fields are required.');
    }

    const replaced = Object.prototype.hasOwnProperty.call(scores, scoreName);
    scores[scoreName] = scoreDefinition;
    await atomicWriteJson(scoresFilePath, scores);
    return { success: true, name: scoreName, score: scoreDefinition, replaced };
  };

  ipcMain.handle('add-score-type', async (_event, name, newScore) =>
    addScoreType(name, newScore),
  );

  // Keep the original event channel for older renderer builds.
  ipcMain.on('add-score-type', async (event, name, newScore) => {
    try {
      const result = await addScoreType(name, newScore);
      event.reply('score-type-added', result);
    } catch (error) {
      event.reply('score-type-add-error', errorMessage(error));
    }
  });

  ipcMain.handle('get-unit-solutions', async (event, filePath) => {
    const patientFolder =
      '/Users/savirmadan/Documents/Localizations/Patient0401Output/derivatives/leaddbs/sub-CbctDbs0401/stimulations/MNI152NLin2009bAsym/initialize';
    const side = 'rh';
    const OSSFolder = path.join(patientFolder, `OSS_sim_files_${side}`);
    const numContacts = 8;
    const results = {};

    for (let i = 1; i <= numContacts; i++) {
      const contactFolder = path.join(OSSFolder, `ResultsE1C${i}`);
      const niiFilePath = path.join(
        contactFolder,
        'E_field_solution_Lattice.nii',
      );
      // const fileName = `sub-15454_sim-4D_efield_model-ossdbs_hemi-R_desc-C${i}.nii`;
      // const niiFilePath = path.join(patientFolder, fileName);
      try {
        const fileBuffer = fs.readFileSync(niiFilePath);
        results[i - 1] = fileBuffer.buffer;
      } catch (error) {
        console.error(`Error reading file for contact E1C${i}:`, error);
        results[`E1C${i}`] = null;
      }
    }
    // const arrayBufferArray = Object.values(results).map(buffer => {
    //   if (buffer) {
    //     return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    //   }
    //   return null;
    // });

    return results;
  });

  ipcMain.handle('get-participants', async (event, text) => {
    const stimulationData = getData('stimulationData');
    const userDataPath = stimulationData.path;
    const participantsFilePath = path.join(userDataPath, 'participants.json');
    console.log('participantsFilePath: ', participantsFilePath);
    const data = fs.readFileSync(participantsFilePath, 'utf8');
    const participants = JSON.parse(data);
    return participants;
  });

  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath);
      return data.buffer;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });

  ipcMain.handle('file-reader', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.on('create-miniset', async (event, folderPath, selectedPatients) => {
    console.log('folderPath: ', folderPath);
    console.log('selectedPatients: ', selectedPatients);
    const stimulationData = getData('stimulationData');
    const userDataPath = stimulationData.path;
    const uniqueFolderName = `miniset_${Date.now()}`;
    for (const patientId of selectedPatients) {
      const patientFolder = path.join(
        userDataPath,
        'derivatives',
        'leaddbs',
        patientId,
      );
      const rawdataFolder = path.join(userDataPath, 'rawdata', patientId);
      const newPatientFolder = path.join(
        folderPath,
        uniqueFolderName,
        'derivatives',
        'leaddbs',
        patientId,
      );
      const newRawdataFolder = path.join(
        folderPath,
        uniqueFolderName,
        'rawdata',
        patientId,
      );
      // Ensure the new patient directory exists
      if (!fs.existsSync(newPatientFolder)) {
        fs.mkdirSync(newPatientFolder, { recursive: true });
      }
      if (!fs.existsSync(newRawdataFolder)) {
        fs.mkdirSync(newRawdataFolder, { recursive: true });
      }

      // Define the subfolders to copy
      const subfolders = ['clinical', 'stimulations', 'reconstruction'];

      // Use system command to copy each subfolder
      subfolders.forEach((subfolder) => {
        const srcFolder = path.join(patientFolder, subfolder);
        const destFolder = path.join(newPatientFolder, subfolder);

        try {
          if (process.platform === 'win32') {
            // Windows
            execSync(`xcopy "${srcFolder}" "${destFolder}" /E /I /Y`);
          } else {
            // Unix-like (Linux, macOS)
            execSync(`cp -R "${srcFolder}/." "${destFolder}/"`);
          }
          console.log(`Copied ${subfolder} data to: `, destFolder);
        } catch (error) {
          console.error(`Error copying ${subfolder} directory:`, error);
        }
      });

      // Define the subfolders to copy
      const rawSubfolders = ['rawdata'];
      const rawSrcFile = path.join(
        rawdataFolder,
        'ses-preop',
        'anat',
        `${patientId}_ses-preop_acq-iso_T1w.nii.gz`,
      );
      const rawDestFolder = newRawdataFolder;

      // Ensure the raw destination directory exists
      if (!fs.existsSync(rawDestFolder)) {
        fs.mkdirSync(rawDestFolder, { recursive: true });
      }

      const rawDestFile = path.join(
        rawDestFolder,
        `${patientId}_ses-preop_acq-iso_T1w.nii.gz`,
      );
      fs.copyFileSync(rawSrcFile, rawDestFile);
    }
  });

  ipcMain.on('download-clinical-data', async (event, clinicalData) => {
    console.log('clinicalData: ', clinicalData);

    // Define the file path where you want to save the JSON data
    // Ask the user to select a folder where to save the file
    const { dialog } = require('electron');
    let filePath: string | undefined;

    const result = await dialog.showOpenDialog({
      title: 'Select a folder to save clinical data',
      properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      // User cancelled; abort saving and reply with error
      event.reply(
        'download-clinical-data-error',
        'User cancelled folder selection.',
      );
      return;
    }

    const selectedFolder = result.filePaths[0];
    filePath = path.join(selectedFolder, 'allClinicalScores.json');

    try {
      // Convert the clinicalData to a JSON string
      const dataString = JSON.stringify(clinicalData, null, 2);

      // Write the JSON string to the file
      fs.writeFileSync(filePath, dataString);

      console.log(`Clinical data saved successfully to ${filePath}`);
      event.reply('download-clinical-data-success', filePath);
    } catch (error) {
      console.error('Error saving clinical data:', error);
      event.reply('download-clinical-data-error', error.message);
    }
  });

  ipcMain.handle('get-clinical-data-for-plotting', async (event, message) => {
    const clinicalDataPath = path.join(
      '/Users/savirmadan/Downloads',
      'allClinicalScores.json',
    );
    const data = fs.readFileSync(clinicalDataPath, 'utf8');
    const clinicalData = JSON.parse(data);
    return clinicalData;
  });

  ipcMain.handle('read-seeg-file', async (event, filePath) => {
    const data = fs.readFileSync(filePath.path, 'utf8');
    return data;
  });

  ipcMain.handle(
    'load_seeg_stimulations',
    async (event, directoryPath, selectedPatientId) => {
      const stimDir = path.join(
        directoryPath,
        'derivatives',
        'leaddbs',
        selectedPatientId,
        'stimulations',
      );

      if (!fs.existsSync(stimDir)) return [];

      const prefix = `${selectedPatientId}_stimparameters_`;
      const suffix = '.csv';
      return fs
        .readdirSync(stimDir, { withFileTypes: true })
        .filter(
          (entry: DirectoryEntry) =>
            entry.isFile() &&
            entry.name.startsWith(prefix) &&
            entry.name.endsWith(suffix),
        )
        .sort((first: DirectoryEntry, second: DirectoryEntry) =>
          first.name.localeCompare(second.name),
        )
        .map((entry: DirectoryEntry) => {
          const stem = entry.name.slice(0, -suffix.length);
          const metadataPath = path.join(stimDir, `${stem}.json`);
          let metadata;
          let variableNames;
          if (fs.existsSync(metadataPath)) {
            try {
              const parsed = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
              if (Array.isArray(parsed?.sets)) metadata = parsed.sets;
              if (Array.isArray(parsed?.variableNames)) {
                variableNames = parsed.variableNames;
              }
            } catch (error) {
              console.warn(`Ignoring invalid sEEG metadata: ${metadataPath}`, error);
            }
          }
          return {
            electrodeName: entry.name.slice(prefix.length, -suffix.length),
            CSV: fs.readFileSync(path.join(stimDir, entry.name), 'utf8'),
            metadata,
            variableNames,
          };
        });
    },
  );

  ipcMain.on('save-file-seeg', async (event, data) => {
    console.log('data: ', data);
    const stimDir = path.join(
      data.directoryPath,
      'derivatives',
      'leaddbs',
      data.selectedPatientId,
      'stimulations',
    );
    // Make directory if needed
    if (!fs.existsSync(stimDir)) {
      fs.mkdirSync(stimDir, { recursive: true });
    }
    const filePath = path.join(
      stimDir,
      `${data.selectedPatientId}_stimparameters.tsv`,
    );
    fs.writeFileSync(filePath, data.TSV);

    data.electrodeCSVs.forEach(
      (electrodeCSV: {
        electrodeName: string;
        CSV: string;
        metadata?: unknown[];
        variableNames?: string[];
      }) => {
        const { electrodeName, CSV, metadata, variableNames } = electrodeCSV;
        // Keep the electrode name in the filename while preventing path traversal
        // or characters that are invalid on supported operating systems.
        const safeElectrodeName = electrodeName
          .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
          .trim();

        if (!safeElectrodeName) {
          throw new Error(
            'Cannot save an sEEG configuration without an electrode name',
          );
        }

        const csvFilePath = path.join(
          stimDir,
          `${data.selectedPatientId}_stimparameters_${safeElectrodeName}.csv`,
        );
        fs.writeFileSync(csvFilePath, CSV);
        if (Array.isArray(metadata)) {
          const metadataPath = path.join(
            stimDir,
            `${data.selectedPatientId}_stimparameters_${safeElectrodeName}.json`,
          );
          fs.writeFileSync(
            metadataPath,
            JSON.stringify({ version: 1, variableNames, sets: metadata }, null, 2),
          );
        }
      },
    );
  });

  // Template download handlers
  ipcMain.handle('download-template', async (event, templateName) => {
    try {
      let templatePath: string;

      if (app.isPackaged) {
        // In packaged app, extraResources are available at process.resourcesPath
        // The public folder structure is preserved, so path is resources/public/templateName
        templatePath = path.join(process.resourcesPath, 'public', templateName);

        // Fallback: try alternative locations if the primary path doesn't exist
        if (!fs.existsSync(templatePath)) {
          const fallbackPaths = [
            path.join(process.resourcesPath, templateName),
            path.join(__dirname, '..', '..', 'public', templateName),
          ];

          const foundPath = fallbackPaths.find((p) => fs.existsSync(p));
          if (foundPath) {
            templatePath = foundPath;
          }
        }
      } else {
        // In development, read from public folder relative to project root
        templatePath = path.join(
          __dirname,
          '..',
          '..',
          '..',
          'public',
          templateName,
        );
      }

      if (!fs.existsSync(templatePath)) {
        const errorMsg = `Template file not found: ${templateName}. Searched at: ${templatePath}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      const fileBuffer = fs.readFileSync(templatePath);
      return fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      );
    } catch (error) {
      console.error(`Error reading template ${templateName}:`, error);
      throw error;
    }
  });

  ipcMain.handle(
    'load_seeg_reco',
    async (event, directoryPath, selectedPatientId) => {
      const data = await fs.readFileSync(
        path.join(
          directoryPath,
          'derivatives',
          'leaddbs',
          selectedPatientId,
          'clinical',
          `${selectedPatientId}_desc-reconstruction.json`,
        ),
        'utf8',
      );
      const reconstructionData = JSON.parse(data);
      return reconstructionData;
    },
  );

  ipcMain.handle('load_patient_list', async (event, directoryPath) => {
    const data = fs.readFileSync(
      path.join(directoryPath, 'participants.json'),
      'utf8',
    );
    const patients = JSON.parse(data);
    return patients;
  });
}
