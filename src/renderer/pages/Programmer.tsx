/**
 * Programmer Component
 *
 * This is the main programming interface for the Lead-DBS application.
 * It handles stimulation parameter configuration, electrode management,
 * and data import/export functionality. The component supports both
 * individual patient programming and group programming modes.
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Styles
import '../styles/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// Components
import GroupArchitecture from '../components/group/GroupArchitecture';
import initializeS from '../utils/InitializeS';
import electrodeModelsSpecs from '../assets/data/electrodeModels.json';
import { OSSSettings, normalizeOSSSettings } from '../utils/OSSSettings';
import {
  exportSteeringQuantities,
  importedIPG,
  importSteeringSource,
  writeSteeringMetadata,
} from '../utils/stimulationUnits';
import withoutStimulationContacts, {
  LEAD_DBS_SOURCE_INDICES,
} from '../utils/leadDbsSources';
import { getSteeringUnit } from '../utils/currentSteering';

// Type definitions
interface Patient {
  id: string;
  name?: string;
  elmodel?: string;
  [key: string]: any;
}

interface PatientState {
  IPG: string;
  leftElectrode: string;
  rightElectrode: string;
  allQuantities: Record<string, any>;
  allSelectedValues: Record<string, any>;
  allTotalAmplitudes: Record<string, any>;
  allStimulationParameters: Record<string, any>;
  visModel: string;
  sessionTitle: string;
  allTogglePositions: Record<string, any>;
  allPercAmpToggles: Record<string, any>;
  allVolAmpToggles: Record<string, any>;
  importCount: number;
  importData: string;
  masterImportData: string;
  matImportFile: any;
  newImportFiles: any;
  showDropdown: boolean;
  filePath: string;
  stimChanged: boolean;
  allTemplateSpaces: number;
  ossSettings: OSSSettings;
}

interface LocationState {
  patient?: Patient;
  timeline?: string;
  directoryPath?: string;
  leadDBS?: boolean;
}

const normalizeTemplateSpace = (value: unknown): number => {
  if (typeof value === 'string') {
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()) ? 1 : 0;
  }
  return value === true || value === 1 ? 1 : 0;
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
      .filter(Boolean);
    if (subjectIds.length > 0) return subjectIds;
  }
  if (Array.isArray(stimulationData?.patientname)) {
    return stimulationData.patientname.filter(Boolean);
  }
  return stimulationData?.patientname ? [stimulationData.patientname] : [];
};

const launchElectrodeModel = (
  stimulationData: any,
  patientId: string,
  fallbackIndex = 0,
): string => {
  const subject = Array.isArray(stimulationData?.subjects)
    ? stimulationData.subjects.find(
        (candidate: any) =>
          (candidate?.id || candidate?.patientname) === patientId,
      )
    : null;
  if (subject?.electrodeModel) return subject.electrodeModel;

  const patientIndex = launchPatientIds(stimulationData).indexOf(patientId);
  if (Array.isArray(stimulationData?.electrodeModels)) {
    return (
      stimulationData.electrodeModels[
        patientIndex >= 0 ? patientIndex : fallbackIndex
      ] || 'Boston Vercise Directed'
    );
  }
  return (
    stimulationData?.electrodeModels ||
    stimulationData?.elmodel ||
    'Boston Vercise Directed'
  );
};

function Programmer() {
  // Context and navigation
  const location = useLocation();
  const navigate = useNavigate();

  // Extract data from location state
  const { patient, timeline, directoryPath, leadDBS } =
    (location.state as LocationState) || {};

  // State management
  const electrodeList: any[] = [];
  const [patientName, setPatientName] = useState<string>('');
  const [patients, setPatients] = useState<string[]>([]);
  const [patientStates, setPatientStates] = useState<
    Record<string, PatientState>
  >({});
  const [importNewS, setImportNewS] = useState<Record<string, any>>({});
  const [electrodeMaster, setElectrodeMaster] = useState<string>('');
  const [ipgMaster, setIpgMaster] = useState<string>('');
  const [totalS, setTotalS] = useState<Record<string, any>>({});
  const [mode, setMode] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(-3);
  const [historical, setHistorical] = useState<LocationState | null>(
    location.state,
  );
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Constants
  const initialState: PatientState = {
    IPG: '',
    leftElectrode: '',
    rightElectrode: '',
    allQuantities: {},
    allSelectedValues: {},
    allTotalAmplitudes: {},
    allStimulationParameters: {},
    visModel: '3',
    sessionTitle: '',
    allTogglePositions: {},
    allPercAmpToggles: {},
    allVolAmpToggles: {},
    importCount: 0,
    importData: '',
    masterImportData: '',
    matImportFile: null,
    newImportFiles: null,
    showDropdown: true,
    filePath: '',
    stimChanged: true,
    allTemplateSpaces: 0,
    ossSettings: normalizeOSSSettings(),
  };

  // Electrode models configuration
  const electrodeModels = [
    { displayName: 'Medtronic 3389', value: 'medtronic_3389' },
    { displayName: 'Medtronic 3387', value: 'medtronic_3387' },
    { displayName: 'Medtronic 3391', value: 'medtronic_3391' },
    { displayName: 'Medtronic B33005', value: 'medtronic_b33005' },
    { displayName: 'Medtronic B33015', value: 'medtronic_b33015' },
    { displayName: 'Boston Scientific Vercise', value: 'boston_vercise' },
    {
      displayName: 'Boston Scientific Vercise Directed',
      value: 'boston_vercise_directed',
    },
    {
      displayName: 'Boston Scientific Vercise Cartesia HX',
      value: 'boston_vercise_cartesia_hx',
    },
    {
      displayName: 'Boston Scientific Vercise Cartesia X',
      value: 'boston_vercise_cartesia_x',
    },
    {
      displayName: 'Abbott ActiveTip (6146-6149)',
      value: 'abbott_activetip_2mm',
    },
    {
      displayName: 'Abbott ActiveTip (6142-6145)',
      value: 'abbott_activetip_3mm',
    },
    {
      displayName: 'Abbott Directed 6172 (short)',
      value: 'abbott_directed_05',
    },
    { displayName: 'Abbott Directed 6173 (long)', value: 'abbott_directed_15' },
    { displayName: 'PINS Medical L301', value: 'pins_l301' },
    { displayName: 'PINS Medical L302', value: 'pins_l302' },
    { displayName: 'PINS Medical L303', value: 'pins_l303' },
    { displayName: 'SceneRay SR1200', value: 'sceneray_sr1200' },
    { displayName: 'SceneRay SR1210', value: 'sceneray_sr1210' },
    { displayName: 'SceneRay SR1211', value: 'sceneray_sr1211' },
    { displayName: 'SceneRay SR1242', value: 'sceneray_sr1242' },
    { displayName: 'SDE-08 S8 Legacy', value: 'sde_08_s8_legacy' },
    { displayName: 'SDE-08 S10 Legacy', value: 'sde_08_s10_legacy' },
    { displayName: 'SDE-08 S12 Legacy', value: 'sde_08_s12_legacy' },
    { displayName: 'SDE-08 S16 Legacy', value: 'sde_08_s16_legacy' },
    { displayName: 'SDE-08 S8', value: 'sde_08_s8' },
    { displayName: 'SDE-08 S10', value: 'sde_08_s10' },
    { displayName: 'SDE-08 S12', value: 'sde_08_s12' },
    { displayName: 'SDE-08 S14', value: 'sde_08_s14' },
    { displayName: 'SDE-08 S16', value: 'sde_08_s16' },
    { displayName: 'PMT 2102-04-091', value: 'pmt_2102_04_091' },
    { displayName: 'PMT 2102-06-091', value: 'pmt_2102_06_091' },
    { displayName: 'PMT 2102-08-091', value: 'pmt_2102_08_091' },
    { displayName: 'PMT 2102-10-091', value: 'pmt_2102_10_091' },
    { displayName: 'PMT 2102-12-091', value: 'pmt_2102_12_091' },
    { displayName: 'PMT 2102-14-091', value: 'pmt_2102_14_091' },
    { displayName: 'PMT 2102-16-091', value: 'pmt_2102_16_091' },
    { displayName: 'PMT 2102-16-092', value: 'pmt_2102_16_092' },
    { displayName: 'PMT 2102-16-093', value: 'pmt_2102_16_093' },
    { displayName: 'PMT 2102-16-131', value: 'pmt_2102_16_131' },
    { displayName: 'PMT 2102-16-142', value: 'pmt_2102_16_142' },
    { displayName: '2069-EPC-05C-35', value: 'epc_05c' },
    { displayName: '2069-EPC-15C-35', value: 'epc_15c' },
    { displayName: 'NeuroPace DL-344-3.5', value: 'neuropace_dl_344_35' },
    { displayName: 'NeuroPace DL-344-10', value: 'neuropace_dl_344_10' },
    { displayName: 'DIXI D08-05AM', value: 'dixi_d08_05am' },
    { displayName: 'DIXI D08-08AM', value: 'dixi_d08_08am' },
    { displayName: 'DIXI D08-10AM', value: 'dixi_d08_10am' },
    { displayName: 'DIXI D08-12AM', value: 'dixi_d08_12am' },
    { displayName: 'DIXI D08-15AM', value: 'dixi_d08_15am' },
    { displayName: 'DIXI D08-18AM', value: 'dixi_d08_18am' },
    { displayName: 'AdTech BF08R-SP05X', value: 'adtech_bf08r_sp05x' },
    { displayName: 'AdTech BF08R-SP21X', value: 'adtech_bf08r_sp21x' },
    { displayName: 'AdTech BF08R-SP61X', value: 'adtech_bf08r_sp61x' },
    { displayName: 'AdTech BF09R-SP61X-0BB', value: 'adtech_bf09r_sp61x_0bb' },
    { displayName: 'AdTech RD06R-SP05X', value: 'adtech_rd06r_sp05x' },
    { displayName: 'AdTech RD08R-SP05X', value: 'adtech_rd08r_sp05x' },
    { displayName: 'AdTech RD10R-SP03X', value: 'adtech_rd10r_sp03x' },
    { displayName: 'AdTech RD10R-SP05X', value: 'adtech_rd10r_sp05x' },
    { displayName: 'AdTech RD10R-SP06X', value: 'adtech_rd10r_sp06x' },
    { displayName: 'AdTech RD10R-SP07X', value: 'adtech_rd10r_sp07x' },
    { displayName: 'AdTech RD10R-SP08X', value: 'adtech_rd10r_sp08x' },
    { displayName: 'AdTech SD06R-SP26X', value: 'adtech_sd06r_sp26x' },
    { displayName: 'AdTech SD08R-SP05X', value: 'adtech_sd08r_sp05x' },
    { displayName: 'AdTech SD10R-SP05X', value: 'adtech_sd10r_sp05x' },
    {
      displayName: 'AdTech SD10R-SP05X Choi',
      value: 'adtech_sd10r_sp05x_choi',
    },
    { displayName: 'AdTech SD14R-SP05X', value: 'adtech_sd14r_sp05x' },
    { displayName: 'ELAINE Rat Electrode', value: 'elaine_rat_electrode' },
    { displayName: 'FHC WU Rat Electrode', value: 'fhc_wu_rat_electrode' },
    { displayName: 'NuMed Mini Lead', value: 'numed_minilead' },
    {
      displayName: 'Aleva directSTIM Directed',
      value: 'aleva_directstim_directed',
    },
    { displayName: 'Aleva directSTIM 11500', value: 'aleva_directstim_11500' },
    {
      displayName: 'SmartFlow Cannula NGS-NC-06',
      value: 'smartflow_ngs_nc_06',
    },
  ];

  /**
   * Maps imported electrode name to internal electrode model value
   * @param importedElectrode - The display name of the electrode
   * @returns The internal value for the electrode model
   */
  const handleImportedElectrode = (importedElectrode: string): string => {
    const electrodeName =
      typeof importedElectrode === 'string'
        ? importedElectrode
        : 'Boston Vercise Directed';
    const electrodeInfo = electrodeModels.find(
      (item) => item.displayName === electrodeName,
    );
    return electrodeInfo ? electrodeInfo.value : 'boston_vercise_directed';
  };

  /**
   * Determines the IPG (Implantable Pulse Generator) type based on electrode name
   * @param importedElectrode - The display name of the electrode
   * @returns The IPG type string
   */
  const handleIPG = (importedElectrode: string): string => {
    const electrodeName =
      typeof importedElectrode === 'string'
        ? importedElectrode
        : 'Boston Vercise Directed';
    if (electrodeName.includes('Boston')) {
      return 'Boston';
    }
    if (electrodeName.includes('Abbott')) {
      return 'Abbott';
    }
    if (
      electrodeName === 'Medtronic 3387' ||
      electrodeName === 'Medtronic 3389' ||
      electrodeName === 'Medtronic 3391'
    ) {
      return 'Medtronic_Activa';
    }
    if (electrodeName.includes('Medtronic')) {
      return 'Medtronic_Percept';
    }
    return 'Research';
  };

  // window.electron.ipcRenderer.sendMessage(
  //   'import-file',
  //   patient.id,
  //   timeline,
  //   directoryPath,
  //   leadDBS,
  // );

  function generateUniqueID() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Adding 1 because months are zero-based
    const day = currentDate.getDate().toString().padStart(2, '0');
    const randomNums = Math.floor(Math.random() * 1000000); // Generate random 4-digit number
    return `${year}${month}${day}${randomNums}`;
  }

  const gatherImportedDataNew = (
    jsonData: any,
    importedElectrode: any,
    runSettings: any = {},
  ) => {
    console.log('S: ', jsonData);
    setImportNewS(jsonData);
    const outputIPG = importedIPG(jsonData, handleIPG(importedElectrode));
    console.log('OutputIPG: ', outputIPG);
    const newQuantities: Record<number, any> = {};
    const newSelectedValues: Record<number, any> = {};
    const newTotalAmplitude: Record<number, any> = {};
    const newAllQuantities: Record<number, any> = {};
    const newAllVolAmpToggles: Record<number, any> = {};
    const newAllPercAmpToggles: Record<number, any> = {};
    const newAllTogglePositions: Record<number, any> = {};

    for (let position = 1; position <= 8; position += 1) {
      const hemisphere = position > 4 ? 0 : 1;
      const sourceIndex = (position - 1) % 4;
      const imported = importSteeringSource(
        jsonData,
        position,
        outputIPG,
        jsonData.amplitude?.[hemisphere]?.[sourceIndex],
      );
      newQuantities[position] = imported.quantities;
      newSelectedValues[position] = imported.selectedValues;
      newTotalAmplitude[position] = imported.totalAmplitude;
      newAllTogglePositions[position] = imported.unit;
      newAllPercAmpToggles[position] = imported.percAmpToggle;
      newAllVolAmpToggles[position] = imported.volAmpToggle;
    }

    const filteredValues = Object.keys(newSelectedValues)
      .filter((key) => Object.keys(newSelectedValues[key]).length > 0)
      .reduce((obj, key) => {
        obj[key] = newSelectedValues[key];
        return obj;
      }, {});

    const filteredQuantities = Object.keys(newQuantities)
      .filter((key) => Object.keys(newQuantities[key]).length > 0)
      .reduce((obj, key) => {
        obj[key] = newQuantities[key];
        return obj;
      }, {});

    console.log('filtered', filteredQuantities);
    let outputVisModel = '3';
    if (jsonData.model === 'Dembek 2017') {
      outputVisModel = '1';
    } else if (jsonData.model === 'Fastfield (Baniasadi 2020)') {
      outputVisModel = '2';
    } else if (jsonData.model === 'Kuncel 2008') {
      outputVisModel = '4';
    } else if (jsonData.model === 'Maedler 2012') {
      outputVisModel = '5';
    } else if (jsonData.model === 'OSS-DBS (Butenko 2020)') {
      outputVisModel = '6';
    }

    console.log('OutputIPG, 2: ', outputIPG);

    return {
      filteredQuantities,
      filteredValues,
      newTotalAmplitude,
      outputVisModel,
      newAllVolAmpToggles,
      newAllPercAmpToggles,
      outputIPG,
      newAllTogglePositions,
      allTemplateSpaces: normalizeTemplateSpace(
        jsonData.estimateInTemplate ?? runSettings.estimateInTemplate,
      ),
      ossSettings: normalizeOSSSettings(
        jsonData.ossSettings ?? runSettings.ossSettings ?? runSettings.oss,
      ),
    };

    // Need to add some type of filtering here that detects whether it is Medtronic Activa, and then needs to put just mA values, not %
  };

  const handleTimelines = (timelineOutput, stimulationData) => {
    console.log('Processing timelines:', timelineOutput);
    console.log('Processing stimulation data: ', stimulationData);
    setTotalS(
      stimulationData.S ||
        (Array.isArray(stimulationData.subjects)
          ? stimulationData.subjects.map(
              (subject) => subject?.stimulation?.S || subject?.stimulation,
            )
          : {}),
    );
    setMode(stimulationData.mode);
    setType(stimulationData.type);
    console.log('Stimulation Mode: ', stimulationData.mode);
    let initialStates = {}; // Initialize the object to store the processed states
    const launchTemplateSpace = normalizeTemplateSpace(
      stimulationData.runSettings?.estimateInTemplate,
    );
    const launchOSSSettings = normalizeOSSSettings(
      stimulationData.runSettings?.ossSettings ||
        stimulationData.runSettings?.oss,
    );
    if (stimulationData.mode === 'standalone') {
      if (!timelineOutput[timeline]) {
        // let electrodes = 'Boston Vercise Directed';
        let electrodes = patient.elmodel;
        const outputElectrode = handleImportedElectrode(electrodes);
        console.log('Output Electrode: ', outputElectrode);
        console.log('Electrode Models: ', electrodeModels);
        console.log('Electrode Model: ', electrodeModelsSpecs[outputElectrode]);
        const patientData = initializeS(
          timeline,
          electrodeModelsSpecs[outputElectrode].numel,
        );
        console.log('Patient Data: ', patientData);
        const processedS = patientData
          ? gatherImportedDataNew(
              patientData,
              electrodes,
              stimulationData.runSettings,
            )
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              newAllPercAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
              allTemplateSpaces: launchTemplateSpace,
              ossSettings: launchOSSSettings,
            };
        initialStates[timeline] = {
          ...initialState,
          leftElectrode: outputElectrode,
          rightElectrode: outputElectrode,
          IPG: processedS.outputIPG,
          allQuantities: processedS.filteredQuantities,
          allSelectedValues: processedS.filteredValues,
          allTotalAmplitudes: processedS.newTotalAmplitude,
          visModel: processedS.outputVisModel,
          allVolAmpToggles: processedS.newAllVolAmpToggles,
          allPercAmpToggles: processedS.newAllPercAmpToggles,
          allTogglePositions: processedS.newAllTogglePositions,
          allTemplateSpaces:
            processedS.allTemplateSpaces ?? initialState.allTemplateSpaces,
          ossSettings: processedS.ossSettings ?? initialState.ossSettings,
          model: electrodes,
        };
      }
      // Iterate over each key in the timelineOutput object
      Object.keys(timelineOutput).forEach((key, index) => {
        console.log(`Processing timeline for patient ${key}`);
        console.log('Timeline Output: ', timelineOutput);
        let electrodes = patient.elmodel || 'Boston Vercise Directed';
        const currentTimeline = key;
        const patientData = timelineOutput[key].S
          ? timelineOutput[key].S
          : timelineOutput[key];

        const outputElectrode = handleImportedElectrode(electrodes);
        console.log('Patient Data: ', patientData);
        const processedS = patientData
          ? gatherImportedDataNew(
              patientData,
              electrodes,
              stimulationData.runSettings,
            )
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              newAllPercAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
              allTemplateSpaces: launchTemplateSpace,
              ossSettings: launchOSSSettings,
            };

        // Store the processed state for each patient
        initialStates[currentTimeline] = {
          ...initialState,
          leftElectrode: outputElectrode,
          rightElectrode: outputElectrode,
          IPG: processedS.outputIPG,
          allQuantities: processedS.filteredQuantities,
          allSelectedValues: processedS.filteredValues,
          allTotalAmplitudes: processedS.newTotalAmplitude,
          visModel: processedS.outputVisModel,
          allVolAmpToggles: processedS.newAllVolAmpToggles,
          allPercAmpToggles: processedS.newAllPercAmpToggles,
          allTogglePositions: processedS.newAllTogglePositions,
          allTemplateSpaces:
            processedS.allTemplateSpaces ?? initialState.allTemplateSpaces,
          ossSettings: processedS.ossSettings ?? initialState.ossSettings,
          model: electrodes,
        };
      });
      console.log('Initial States: ', initialStates);
      return initialStates;
    }

    if (stimulationData.type === 'leaddbs') {
      // Iterate over each key in the timelineOutput object
      let defaultElectrode = launchElectrodeModel(stimulationData, patient.id);
      Object.keys(timelineOutput).forEach((key, index) => {
        console.log(`Processing timeline for patient ${key}`);
        console.log('Timeline Output: ', timelineOutput);
        const electrodes = launchElectrodeModel(
          stimulationData,
          patient.id,
          index,
        );
        defaultElectrode = electrodes;
        const currentTimeline = key;
        const patientData = timelineOutput[key].S;

        const outputElectrode = handleImportedElectrode(electrodes);

        const processedS = patientData
          ? gatherImportedDataNew(
              patientData,
              electrodes,
              stimulationData.runSettings,
            )
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              newAllPercAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
              allTemplateSpaces: launchTemplateSpace,
              ossSettings: launchOSSSettings,
            };

        // Store the processed state for each patient
        initialStates[currentTimeline] = {
          ...initialState,
          leftElectrode: outputElectrode,
          rightElectrode: outputElectrode,
          IPG: processedS.outputIPG,
          allQuantities: processedS.filteredQuantities,
          allSelectedValues: processedS.filteredValues,
          allTotalAmplitudes: processedS.newTotalAmplitude,
          visModel: processedS.outputVisModel,
          allVolAmpToggles: processedS.newAllVolAmpToggles,
          allPercAmpToggles: processedS.newAllPercAmpToggles,
          allTogglePositions: processedS.newAllTogglePositions,
          allTemplateSpaces:
            processedS.allTemplateSpaces ?? initialState.allTemplateSpaces,
          ossSettings: processedS.ossSettings ?? initialState.ossSettings,
          model: electrodes,
        };
      });
      if (!timelineOutput[timeline]) {
        const outputElectrode = handleImportedElectrode(defaultElectrode);
        const patientData = initializeS(
          timeline,
          electrodeModelsSpecs[outputElectrode].numel,
        );
        const processedS = patientData
          ? gatherImportedDataNew(
              patientData,
              defaultElectrode,
              stimulationData.runSettings,
            )
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              newAllPercAmpToggles: {},
              outputIPG: handleIPG(defaultElectrode),
              newAllTogglePositions: {},
              allTemplateSpaces: launchTemplateSpace,
              ossSettings: launchOSSSettings,
            };
        initialStates[timeline] = {
          ...initialState,
          leftElectrode: outputElectrode,
          rightElectrode: outputElectrode,
          IPG: processedS.outputIPG,
          allQuantities: processedS.filteredQuantities,
          allSelectedValues: processedS.filteredValues,
          allTotalAmplitudes: processedS.newTotalAmplitude,
          visModel: processedS.outputVisModel,
          allVolAmpToggles: processedS.newAllVolAmpToggles,
          allPercAmpToggles: processedS.newAllPercAmpToggles,
          allTogglePositions: processedS.newAllTogglePositions,
          allTemplateSpaces:
            processedS.allTemplateSpaces ?? initialState.allTemplateSpaces,
          ossSettings: processedS.ossSettings ?? initialState.ossSettings,
        };
      }
    } else if (stimulationData.type === 'leadgroup') {
      Object.keys(timelineOutput).forEach((key, index) => {
        console.log(`Processing timeline for patient ${key}`);
        console.log('Timeline Output: ', timelineOutput);
        // Patient here is the timeline
        const currentTimeline = key;
        const electrodes = launchElectrodeModel(stimulationData, key, index);
        const patientData = timelineOutput[key].S;

        const outputElectrode = handleImportedElectrode(electrodes);

        const processedS = patientData
          ? gatherImportedDataNew(
              patientData,
              electrodes,
              stimulationData.runSettings,
            )
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              newAllPercAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
              allTemplateSpaces: launchTemplateSpace,
              ossSettings: launchOSSSettings,
            };

        // Store the processed state for each patient
        initialStates[currentTimeline] = {
          ...initialState,
          leftElectrode: outputElectrode,
          rightElectrode: outputElectrode,
          IPG: processedS.outputIPG,
          allQuantities: processedS.filteredQuantities,
          allSelectedValues: processedS.filteredValues,
          allTotalAmplitudes: processedS.newTotalAmplitude,
          visModel: processedS.outputVisModel,
          allVolAmpToggles: processedS.newAllVolAmpToggles,
          allPercAmpToggles: processedS.newAllPercAmpToggles,
          allTogglePositions: processedS.newAllTogglePositions,
          allTemplateSpaces:
            processedS.allTemplateSpaces ?? initialState.allTemplateSpaces,
          ossSettings: processedS.ossSettings ?? initialState.ossSettings,
          model: electrodes,
        };
      });
    }

    console.log('Final initialStates:', initialStates);
    return initialStates;
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!directoryPath || !patient) return;

      try {
        // Fetch stimulation data
        const stimulationData = await window.electron.ipcRenderer.invoke(
          'get-stimulation-data',
          '',
        );

        // const stimulationData = getData('stimulationData');

        if (stimulationData.type === 'leaddbs') {
          console.log(
            "Stimulation data is of type 'leaddbs':",
            stimulationData,
          );

          // Fetch timelines
          const receivedTimelines = await window.electron.ipcRenderer.invoke(
            'get-timelines',
            directoryPath,
            patient.id,
            leadDBS,
          );

          console.log('Received timelines:', receivedTimelines);

          // Filter timelines with stimulation
          const stimulationTimelines = receivedTimelines.filter(
            (timelineData) => timelineData.hasStimulation,
          );

          console.log('Timelines with stimulation:', stimulationTimelines);

          // Process timelines with stimulation
          const timelineResults = await Promise.all(
            stimulationTimelines.map(async (timelineData) => {
              const { timeline } = timelineData;
              try {
                const importResult = await window.electron.ipcRenderer.invoke(
                  'import-file-2',
                  directoryPath,
                  patient.id,
                  timeline,
                  leadDBS,
                );
                return { timeline, data: importResult };
              } catch (error) {
                console.error(`Error importing timeline ${timeline}:`, error);
                return { timeline, data: null }; // Handle errors gracefully
              }
            }),
          );

          console.log('Processed timeline results:', timelineResults);

          // Aggregate results into a structured format
          const timelineOutput = timelineResults.reduce((acc, result) => {
            if (result.data) {
              acc[result.timeline] = result.data;
            }
            return acc;
          }, {});

          console.log('Final timeline output:', timelineOutput);
          const initialStates = handleTimelines(
            timelineOutput,
            stimulationData,
          );
          console.log('Initial States: ', initialStates);
          setPatientStates(initialStates);
          const tmppatients = Object.keys(initialStates);
          console.log('TEMPPatients: ', tmppatients);
          setPatients(tmppatients);
        } else if (stimulationData.type === 'leadgroup') {
          const patientIds = launchPatientIds(stimulationData);
          console.log('Patient IDs: ', patientIds);

          if (patientIds.length === 0) {
            throw new Error(
              'The Lead-Group launch request does not contain any patients.',
            );
          }

          console.log("Stimulation data type is not 'leaddbs'. Skipping...");
          const timelineResults = await Promise.all(
            patientIds.map(async (patientId) => {
              try {
                const importResult = await window.electron.ipcRenderer.invoke(
                  'import-file-2',
                  directoryPath,
                  patientId,
                  stimulationData.label,
                  leadDBS,
                );
                return { patientId, data: importResult };
              } catch (error) {
                console.error(`Error importing timeline ${patientId}:`, error);
                return { patientId, data: null }; // Handle errors gracefully
              }
            }),
          );
          // Aggregate results into a structured format
          const timelineOutput = timelineResults.reduce((acc, result) => {
            if (result.data) {
              acc[result.patientId] = result.data;
            }
            return acc;
          }, {});
          const initialStates = handleTimelines(
            timelineOutput,
            // timelineResults,
            stimulationData,
          );
          setPatientStates(initialStates);
          setPatients(patientIds);

          console.log(
            'Processed timeline results for leadgroup:',
            timelineResults,
          );
        }
      } catch (error) {
        console.error('Error fetching stimulation data or timelines:', error);
      }
    };

    fetchData();
  }, [directoryPath, patient, leadDBS]);

  const handleZoomChange = (event: any, newValue: number) => {
    setZoomLevel(newValue);
    if (window.electron && window.electron.zoom) {
      window.electron.zoom.setZoomLevel(newValue);
    } else {
      console.error('Zoom functionality is not available');
    }
  };

  const activeContacts = (valuesArray) => {
    const activeContactsArray = [];
    Object.keys(valuesArray).forEach((thing) => {
      // console.log(thing);
      if (thing !== 0) {
        if (valuesArray[thing] === 'left') {
          activeContactsArray.push(0);
        } else {
          activeContactsArray.push(1);
        }
      }
    });
    activeContactsArray.shift();
    console.log(activeContactsArray);
    return activeContactsArray;
  };

  const calculatePercentageFromAmplitude = (quantities, totalAmplitude) => {
    const updatedQuantities = { ...quantities };
    if (!Number.isFinite(totalAmplitude) || totalAmplitude <= 0) {
      Object.keys(updatedQuantities).forEach((element) => {
        updatedQuantities[element] = 0;
      });
      return updatedQuantities;
    }
    Object.keys(updatedQuantities).forEach((element) => {
      updatedQuantities[element] =
        (parseFloat(updatedQuantities[element]) * 100) / totalAmplitude;
    });
    console.log(updatedQuantities);
    return updatedQuantities;
  };

  const calculateVoltageFromAmplitude = (quantities) => {
    const updatedQuantities = { ...quantities };
    Object.keys(updatedQuantities).forEach((element) => {
      if (quantities[element] !== 0) {
        updatedQuantities[element] = 100;
      }
    });
    return updatedQuantities;
  };

  const handleTogglePositions = (
    allQuantities,
    allTotalAmplitudes,
    allTogglePositions,
    allSelectedValues,
    IPG,
    allPercAmpToggles,
    allVolAmpToggles,
  ) => {
    return exportSteeringQuantities(
      allQuantities,
      allTotalAmplitudes,
      allTogglePositions,
      allSelectedValues,
      IPG,
      allPercAmpToggles,
      allVolAmpToggles,
    );
  };

  const translatePolarity = (sideValue) => {
    let polar = 0;
    if (sideValue === 'center') {
      polar = 1;
    } else if (sideValue === 'right') {
      polar = 2;
    }

    return polar;
  };

  function handleExportAmplitude(amplitudeList) {
    const exportAmplitudeList = [];
    Object.keys(amplitudeList).forEach((thing) => {
      exportAmplitudeList.push(parseFloat(amplitudeList[thing]));
    });
    exportAmplitudeList.shift();
    return exportAmplitudeList;
  }

  const gatherExportedData5 = (
    allTotalAmplitudes,
    allQuantities,
    allSelectedValues,
    selectedElectrodeLeft,
    selectedElectrodeRight,
    IPG,
    visModel,
    allTogglePositions,
    allPercAmpToggles,
    allVolAmpToggles,
    index,
    allTemplateSpaces,
    patientId,
    ossSettings,
  ) => {
    // handleFileChange('1');
    // saveQuantitiesandValues();
    let updatedOutputQuantity = {};
    updatedOutputQuantity = handleTogglePositions(
      allQuantities,
      allTotalAmplitudes,
      allTogglePositions,
      allSelectedValues,
      IPG,
      allPercAmpToggles,
      allVolAmpToggles,
    );
    console.log('Updated output quantity: ', updatedOutputQuantity);
    // parseAllVariables();
    const exportAmplitudeData = handleExportAmplitude(allTotalAmplitudes);
    // console.log(exportAmplitudeData);
    const leftHemiArr = [];
    const rightHemiArr = [];
    console.log(importNewS);
    const indexedStimulation = Array.isArray(totalS)
      ? totalS[index]
      : patientId && totalS?.[patientId]
      ? totalS[patientId]
      : totalS;
    const data = {
      S: JSON.parse(
        JSON.stringify(indexedStimulation?.S || indexedStimulation || {}),
      ),
    };
    data.S.amplitude = [Array(4).fill(0), Array(4).fill(0)];
    data.S.activecontacts = {};
    console.log('Data: ', data);

    const programs = Object.keys(allQuantities);
    const firstProgram = programs[0];
    console.log('Programs: ', programs);
    console.log('length', programs[0]);

    const configuredContactCount = Math.max(
      Number(electrodeModelsSpecs[selectedElectrodeLeft]?.numel) || 0,
      Number(electrodeModelsSpecs[selectedElectrodeRight]?.numel) || 0,
    );
    const loopSize =
      (configuredContactCount ||
        Math.max(
          0,
          Object.keys(allQuantities[firstProgram] || {}).length - 1,
        )) + 1;
    // console.log('loopSize: ', loopSize);
    // data.S.label = 'Num1';
    const activeArray = [];
    const leftAmpArray = [];

    for (let j = 1; j < 5; j++) {
      const dynamicKey2 = `Ls${j}`;
      data.S[dynamicKey2] = withoutStimulationContacts(data.S[dynamicKey2]);
      if (allSelectedValues[j] && updatedOutputQuantity[j]) {
        // Need to change the i = 9 to number of electrodes to accomodate for 16 contact electrodes
        for (let i = 1; i < loopSize; i++) {
          let polarity = 0;
          if (allSelectedValues[j][i] === 'left') {
            polarity = 0;
          } else if (allSelectedValues[j][i] === 'center') {
            polarity = 1;
          } else if (allSelectedValues[j][i] === 'right') {
            polarity = 2;
          }
          const dynamicKey = `k${i}`;
          data.S[dynamicKey2][dynamicKey] = {
            perc: Number(updatedOutputQuantity[j][i] ?? 0),
            pol: polarity,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: Number(updatedOutputQuantity[j][0] ?? 0),
          pol: translatePolarity(allSelectedValues[j][0]),
        };
        data.S[dynamicKey2].amp = parseFloat(allTotalAmplitudes[j]);
        // data.S[dynamicKey2].frequency = parseFloat(
        //   allStimulationParameters[j].parameter2,
        // );
        // data.S[dynamicKey2].pulseWidth = parseFloat(
        //   allStimulationParameters[j].parameter1,
        // );
        data.S[dynamicKey2].va = 2;
        if (
          getSteeringUnit(
            IPG,
            allPercAmpToggles[j],
            allVolAmpToggles[j],
            allTogglePositions[j],
          ) === 'V'
        ) {
          data.S[dynamicKey2].va = 1;
        }
        activeArray.push(j);
        leftAmpArray[j] = parseFloat(allTotalAmplitudes[j]);
        // console.log(activeContacts(allSelectedValues[j]));
        leftHemiArr[j - 1] = activeContacts(allSelectedValues[j]);
        data.S.activecontacts[j - 1] = activeContacts(allSelectedValues[j]);
        // console.log(data.S.activecontacts);
      } else {
        for (let i = 1; i < loopSize; i++) {
          const dynamicKey = `k${i}`;
          data.S[dynamicKey2][dynamicKey] = {
            perc: 0,
            pol: 0,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: 0,
          pol: 0,
        };
        data.S[dynamicKey2].amp = 0;
        data.S[dynamicKey2].frequency = 0;
        data.S[dynamicKey2].pulseWidth = 0;
        data.S[dynamicKey2].va = 0;
      }
    }
    const leftLength = activeArray.length;
    const newActiveArray = [];
    const rightAmpArray = [];

    for (let j = 1; j < 5; j++) {
      const dynamicKey2 = `Rs${j}`;
      data.S[dynamicKey2] = withoutStimulationContacts(data.S[dynamicKey2]);
      if (allSelectedValues[j + 4] && updatedOutputQuantity[j + 4]) {
        for (let i = 1; i < loopSize; i++) {
          let polarity = 0;
          if (allSelectedValues[j + 4][i] === 'left') {
            polarity = 0;
          } else if (allSelectedValues[j + 4][i] === 'center') {
            polarity = 1;
          } else if (allSelectedValues[j + 4][i] === 'right') {
            polarity = 2;
          }
          const dynamicKey = `k${i}`;
          data.S[dynamicKey2][dynamicKey] = {
            perc: Number(updatedOutputQuantity[j + 4][i] ?? 0),
            pol: polarity,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: Number(updatedOutputQuantity[j + 4][0] ?? 0),
          pol: translatePolarity(allSelectedValues[j + 4][0]),
        };
        data.S[dynamicKey2].amp = parseFloat(allTotalAmplitudes[j + 4]);
        // data.S[dynamicKey2].frequency = parseFloat(
        //   allStimulationParameters[j + 4].parameter2,
        // );
        // data.S[dynamicKey2].pulseWidth = parseFloat(
        //   allStimulationParameters[j + 4].parameter1,
        // );
        data.S[dynamicKey2].va = 2;
        if (
          getSteeringUnit(
            IPG,
            allPercAmpToggles[j + 4],
            allVolAmpToggles[j + 4],
            allTogglePositions[j + 4],
          ) === 'V'
        ) {
          data.S[dynamicKey2].va = 1;
        }
        activeArray.push(j + 4);
        newActiveArray.push(j);
        console.log('All Selected Values: ', j);
        // rightHemiArr[j - 1] = activeContacts(allSelectedValues[j]);
        data.S.activecontacts[j + 3] = activeContacts(allSelectedValues[j + 4]);
        // rightAmpArray[j + 4] = parseFloat(allTotalAmplitudes[j + 4]);
      } else {
        for (let i = 1; i < loopSize; i++) {
          const dynamicKey = `k${i}`;
          data.S[dynamicKey2][dynamicKey] = {
            perc: 0,
            pol: 0,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: 0,
          pol: 0,
        };
        data.S[dynamicKey2].amp = 0;
        data.S[dynamicKey2].frequency = 0;
        data.S[dynamicKey2].pulseWidth = 0;
        data.S[dynamicKey2].va = 0;
      }
    }
    // data.S.activecontacts.push(rightHemiArr);
    // data.S.activecontacts.push(leftHemiArr);
    // const totalAmpArray = leftAmpArray.push(rightAmpArray);
    // data.S.amplitude{1} = leftAmpArray;
    // data.S.amplitude{2} = rightAmpArray;
    const leftAmplitude = [];
    const rightAmplitude = [];
    for (let i = 1; i < 5; i++) {
      if (allTotalAmplitudes[i]) {
        leftAmplitude.push(parseFloat(allTotalAmplitudes[i]));
        data.S.amplitude[1][i - 1] = parseFloat(allTotalAmplitudes[i]);
      } else {
        leftAmplitude.push(0);
      }
    }
    for (let i = 5; i < 9; i++) {
      if (allTotalAmplitudes[i]) {
        rightAmplitude.push(parseFloat(allTotalAmplitudes[i]));
        data.S.amplitude[0][i - 5] = parseFloat(allTotalAmplitudes[i]);
      } else {
        rightAmplitude.push(0);
      }
    }
    // data.S.amplitude = { rightAmplitude, leftAmplitude };
    // data.S.amplitude = exportAmplitudeData;
    // console.log(exportAmplitudeData);
    const rightLength = newActiveArray.length;
    // Lead-DBS numbers sources independently within each hemisphere (Ls1-4
    // and Rs1-4). UI program slots 5-8 must never leak into S.sources.
    data.S.sources = [...LEAD_DBS_SOURCE_INDICES];
    // data.S.active = [leftLength, rightLength];
    data.S.active = [1, 1];
    // data.S.activecontacts = activeContacts(allSelectedValues[1]);

    for (let i = 1; i < 9; i++) {
      const zerosArr = [];
      for (let j = 1; j < loopSize; j++) {
        zerosArr.push(0);
      }
      if (data.S.activecontacts[i - 1]) {
        if (data.S.activecontacts[i - 1] === null) {
          data.S.activecontacts[i - 1] = zerosArr;
        }
      } else {
        data.S.activecontacts[i - 1] = zerosArr;
      }
    }

    let exportVisModel = '';
    // visModel[1] = visModel;
    // console.log(visModel[1]);
    if (visModel === '1') {
      console.log('here');
      exportVisModel = 'Dembek 2017';
    } else if (visModel === '2') {
      exportVisModel = 'Fastfield (Baniasadi 2020)';
    } else if (visModel === '3') {
      exportVisModel = 'SimBio/FieldTrip (see Horn 2017)';
    } else if (visModel === '4') {
      exportVisModel = 'Kuncel 2008';
    } else if (visModel === '5') {
      exportVisModel = 'Maedler 2012';
    } else if (visModel === '6') {
      exportVisModel = 'OSS-DBS (Butenko 2020)';
    }
    // console.log('export vis model', exportVisModel);
    data.S.model = exportVisModel;
    data.S.estimateInTemplate = allTemplateSpaces;
    data.S.ossSettings = normalizeOSSSettings(ossSettings);
    const leftSideContacts = Object.values(data.S.activecontacts).slice(0, 4);
    const rightSideContacts = Object.values(data.S.activecontacts).slice(4, 8);

    const combineBinary = (contacts) => {
      return contacts.reduce((acc, curr) => {
        return acc.map((val, index) => val | curr[index]);
      });
    };

    const combinedLeftContacts = combineBinary(leftSideContacts);
    const combinedRightContacts = combineBinary(rightSideContacts);

    data.S.activecontacts = [combinedRightContacts, combinedLeftContacts];
    writeSteeringMetadata(
      data.S,
      IPG,
      allQuantities,
      allTotalAmplitudes,
      allTogglePositions,
      allPercAmpToggles,
      allVolAmpToggles,
    );

    // if (Array.isArray(data.S.activecontacts) && data.S.activecontacts.length > 0 && data.S.activecontacts[0] === undefined) {
    //   data.S.activecontacts.shift();
    // }
    console.log(data.S.activecontacts);
    return data;
  };

  const handleExport = async () => {
    console.log('Patient States for Export', patientStates);
    const outputData = [];
    setSaveError('');
    setSaveInProgress(true);
    try {
      const orderedPatientIds = patients.filter((patientId) =>
        Object.prototype.hasOwnProperty.call(patientStates, patientId),
      );
      if (orderedPatientIds.length !== patients.length) {
        throw new Error(
          'One or more patients are missing stimulation state. Reopen SPARK and try again.',
        );
      }

      orderedPatientIds.forEach((patientId, index) => {
        const tempStates = patientStates[patientId];
        console.log('TempStates: ', tempStates);
        const tempData: any = gatherExportedData5(
          tempStates.allTotalAmplitudes,
          tempStates.allQuantities,
          tempStates.allSelectedValues,
          tempStates.leftElectrode,
          tempStates.rightElectrode,
          tempStates.IPG,
          tempStates.visModel,
          tempStates.allTogglePositions,
          tempStates.allPercAmpToggles,
          tempStates.allVolAmpToggles,
          index,
          tempStates.allTemplateSpaces,
          patientId,
          tempStates.ossSettings,
        );
        tempData.subjectId = patientId;
        tempData.patientname = patientId;
        outputData[index] = tempData;
      });

      console.log('Output Data: ', outputData);
      const result = await window.electron.ipcRenderer.invoke(
        'save-file-stimulate',
        '',
        outputData,
      );
      if (!result?.success) {
        throw new Error('The stimulation parameters could not be saved.');
      }
      window.electron.ipcRenderer.sendMessage('close-window');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaveInProgress(false);
    }
  };

  return (
    <div style={{}}>
      {patientName && (
        <div
          style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20px' }}
        >
          Patient: {patientName}
        </div>
      )}
      <div>
        {patients.length > 0 && (
          <GroupArchitecture
            patients={patients}
            setPatients={setPatients}
            electrodeList={electrodeList}
            patientStates={patientStates}
            setPatientStates={setPatientStates}
            importNewS={importNewS}
            electrodeMaster={electrodeMaster}
            ipgMaster={ipgMaster}
            historical={historical}
            setHistorical={setHistorical}
            mode={mode}
            timeline={timeline}
            type={type}
          />
        )}
      </div>
      {mode !== 'stimulate' && (
        <button
          className="export-button"
          style={{
            position: 'fixed',
            top: '100px',
            left: '16px',
            zIndex: 100,
            width: '60px',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
            backgroundColor: 'white',
            color: 'black',
            borderRadius: '30px',
            padding: '8px 16px',
            fontSize: '16px',
            fontWeight: 'bold',
            border: 'none',
          }}
          onClick={() => navigate(-1)}
          title="Back to Patient Details"
        >
          ←
        </button>
      )}
      {type === 'leadgroup' && (
        <div>
          {saveError && (
            <div role="alert" style={{ color: '#b00020', marginBottom: '8px' }}>
              {saveError}
            </div>
          )}
          <button
            // className="export-button-final"
            onClick={handleExport}
            disabled={saveInProgress}
            // style={{ marginLeft: '1200px' }}
            style={{
              width: '200px',
              marginLeft: '20px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              backgroundColor: 'green',
              color: 'white',
              borderRadius: '30px',
              padding: '10px 20px',
              fontSize: '16px',
              outline: 'none',
              border: 'none',
            }}
          >
            {saveInProgress ? 'Saving…' : 'Save and Close'}
          </button>
        </div>
      )}
    </div>
  );
}

export default Programmer;
