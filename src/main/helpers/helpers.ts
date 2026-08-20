import path from 'path';
import { getData, setData } from '../data/data';

const fs = require('fs');

/**
 * Helper Function: Get the patient's folder path.
 * @param directoryPath - The base directory path.
 * @param patientId - The unique identifier for the patient.
 * @param leadDBS - Boolean indicating whether LeadDBS mode is enabled.
 * @returns The constructed patient folder path.
 */
function getPatientFolder(
  directoryPath: string,
  patientId: string,
  leadDBS: boolean,
): string {
  // Fetch stimulation data
  const stimulationData = getData('stimulationData');
  console.log(stimulationData);
  // Validate stimulationData
  if (!stimulationData) {
    return path.join(directoryPath, `sub-${patientId}`);
  }
  // console.log(stimulationData);
  if (stimulationData.mode === 'standalone') {
    return path.join(
      directoryPath ? directoryPath : stimulationData.path,
      'derivatives',
      'leaddbs',
      `${patientId}`,
      'clinical',
    );
  }

  console.log('Fetching patient folder...');
  console.log('Directory Path:', directoryPath);
  console.log('LeadDBS Mode:', leadDBS);
  console.log('Patient ID: ', patientId);
  // Check for leadgroup type
  const isLeadGroup =
    stimulationData.type === 'leadgroup' || stimulationData.filepath.includes('leadgroup');

  // Helper: Build folder path for leadgroup
  const getLeadGroupFolder = (): string => {
    const patientIndex = stimulationData.patientname.findIndex(
      (name: string) => name === patientId,
    );
    if (patientIndex === -1) {
      throw new Error(`Patient ID "${patientId}" not found in stimulation data.`);
    }
    console.log('Patient Index:', patientIndex);
    const newFolderPath = stimulationData.patientfolders[0][patientIndex];
    console.log('Patient Folder Path:', newFolderPath);
    return path.join(newFolderPath, 'clinical');
  };

  // Determine patient folder
  if (isLeadGroup) {
    return getLeadGroupFolder();
  }

  return path.join(directoryPath, 'derivatives', 'leaddbs', `${patientId}`, 'clinical');
}

/**
 * Helper Function: Example helper to demonstrate extensibility.
 * @param param1 - First parameter as a string.
 * @param param2 - Second parameter as a number.
 * @returns A formatted string.
 */
function exampleHelperFunction(param1: string, param2: number): string {
  return `Received ${param1} and ${param2}`;
}

/**
 * Helper Function: Get a relative path.
 * @param basePath - The base directory path.
 * @param targetPath - The target directory or file path.
 * @returns The relative path between the base and target.
 */
function getRelativePath(basePath: string, targetPath: string): string {
  return path.relative(basePath, targetPath);
}

/**
 * Helper Function: Check if a file exists in a directory.
 * @param directoryPath - The directory to search in.
 * @param fileName - The name of the file to check.
 * @returns True if the file exists, otherwise false.
 */
function fileExistsInDirectory(
  directoryPath: string,
  fileName: string
): boolean {
  const fullPath = path.join(directoryPath, fileName);
  return fs.existsSync(fullPath);
}

/**
 * Function to read JSON from the provided path
 * @param filePath - The path to the JSON file
 * @returns The parsed JSON data or null if error
 */
function readJSON(filePath: string): any {
  try {
    const data = fs.readFileSync(filePath, 'utf8'); // Synchronous file read
    return JSON.parse(data); // Parse and return the JSON data
  } catch (error) {
    console.error(`Error reading JSON file from ${filePath}:`, error);
    return null; // Return null or handle the error accordingly
  }
}

/**
 * Helper Function: Get the patient's folder path for PLY files.
 * @param directoryPath - The base directory path.
 * @param patientId - The unique identifier for the patient.
 * @param leadDBS - Boolean indicating whether LeadDBS mode is enabled.
 * @returns The constructed patient folder path.
 */
function getPatientFolderPly(directoryPath: string, patientId: string, leadDBS: boolean): string {
  let newFolderPath = ''; // Declare newFolderPath with a default value
  const stimulationData: any = getData('stimulationData');
  let outputFolderPath = '';
  if (stimulationData.mode === 'standalone') {
    outputFolderPath = path.join(
      directoryPath,
      'derivatives',
      'leaddbs',
      `${patientId}`,
    );
    return outputFolderPath;
  }
  if (
    stimulationData.type === 'leadgroup' ||
    stimulationData.filepath.includes('leadgroup')
  ) {
    // Ensure patientname is an array
    const patientIndex = stimulationData.patientname.findIndex(
      (name: string) => name === patientId,
    );
    console.log('Patient Index: ', patientIndex);
    // Check if patientIndex is valid
    console.log(stimulationData.patientfolders[0][patientIndex]);
    newFolderPath = stimulationData.patientfolders[0][patientIndex];
    outputFolderPath = newFolderPath;
  } else if (stimulationData.type === 'leaddbs') {
    outputFolderPath = path.join(
      stimulationData.filepath,
      'derivatives/leaddbs',
      patientId,
    );
  }
  return outputFolderPath;
}

// Export all helper functions
export {
  getPatientFolder,
  exampleHelperFunction,
  getRelativePath,
  fileExistsInDirectory,
  readJSON,
  getPatientFolderPly,
};
