/**
 * Programmer Component
 *
 * This is the main programming interface for the Lead-DBS application.
 * It handles stimulation parameter configuration, electrode management,
 * and data import/export functionality. The component supports both
 * individual patient programming and group programming modes.
 */

import React, { useState, useEffect, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Styles
import '../styles/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// Components
import GroupArchitecture from '../components/group/GroupArchitecture';
import { PatientContext } from '../contexts/PatientContext';
import initializeS from '../utils/InitializeS';
import electrodeModelsSpecs from '../assets/data/electrodeModels.json';

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
}

interface LocationState {
  patient?: Patient;
  timeline?: string;
  directoryPath?: string;
  leadDBS?: boolean;
}

function Programmer() {
  // Context and navigation
  const allPatients = useContext(PatientContext);
  const location = useLocation();
  const navigate = useNavigate();

  // Extract data from location state
  const { patient, timeline, directoryPath, leadDBS } = (location.state as LocationState) || {};

  // State management
  const electrodeList: any[] = [];
  const [patientName, setPatientName] = useState<string>('');
  const [patients, setPatients] = useState<string[]>([]);
  const [patientStates, setPatientStates] = useState<Record<string, PatientState>>({});
  const [importNewS, setImportNewS] = useState<Record<string, any>>({});
  const [electrodeMaster, setElectrodeMaster] = useState<string>('');
  const [ipgMaster, setIpgMaster] = useState<string>('');
  const [totalS, setTotalS] = useState<Record<string, any>>({});
  const [mode, setMode] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(-3);
  const [historical, setHistorical] = useState<LocationState | null>(location.state);

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
    const electrodeInfo = electrodeModels.find(
      (item) => item.displayName === importedElectrode,
    );
    return electrodeInfo ? electrodeInfo.value : 'boston_vercise_directed';
  };

  /**
   * Determines the IPG (Implantable Pulse Generator) type based on electrode name
   * @param importedElectrode - The display name of the electrode
   * @returns The IPG type string
   */
  const handleIPG = (importedElectrode: string): string => {
    if (importedElectrode.includes('Boston')) {
      return 'Boston';
    }
    if (importedElectrode.includes('Abbott')) {
      return 'Abbott';
    }
    if (
      importedElectrode === 'Medtronic 3387' ||
      importedElectrode === 'Medtronic 3389' ||
      importedElectrode === 'Medtronic 3391'
    ) {
      return 'Medtronic_Activa';
    }
    if (importedElectrode.includes('Medtronic')) {
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

  const gatherImportedDataNew = (jsonData: any, importedElectrode: any) => {
    console.log('S: ', jsonData);
    setImportNewS(jsonData);
    let outputIPG = handleIPG(importedElectrode);
    console.log('OutputIPG: ', outputIPG);
    const newQuantities: Record<number, any> = {};
    const newSelectedValues: Record<number, any> = {};
    const newTotalAmplitude: Record<number, any> = {};
    const newAllQuantities: Record<number, any> = {};
    const newAllVolAmpToggles: Record<number, any> = {};
    const newAllTogglePositions: Record<number, any> = {};

    console.log('Imported Amplitude: ', jsonData.amplitude);
    // To get the number of elements (contacts) in jsonData.Ls1 (excluding keys like 'case', 'amp', etc.):
    const ls1ContactKeys = Object.keys(jsonData.Ls1).filter(
      (key) => key.startsWith('k')
    );
    console.log('Number of contacts in Ls1:', ls1ContactKeys.length);
    const loopSize = ls1ContactKeys.length;
    for (let j = 1; j < 5; j++) {
      newTotalAmplitude[j+4] = jsonData.amplitude[0][j - 1];
      newTotalAmplitude[j] = jsonData.amplitude[1][j - 1];

      console.log('newTotalAmplitude: ', newTotalAmplitude);

      const dynamicKey2 = `Ls${j}`;
      const dynamicKey3 = `Rs${j}`;
      if (jsonData[dynamicKey2].va === 2) {
        newAllVolAmpToggles[j] = 'center';
        newAllTogglePositions[j] = '%';
      } else if (jsonData[dynamicKey2].va === 1) {
        newAllVolAmpToggles[j] = 'right';
        newAllTogglePositions[j] = 'V';
      }

      if (jsonData[dynamicKey3].va === 2) {
        newAllVolAmpToggles[j + 4] = 'center';
        newAllTogglePositions[j + 4] = '%';
      } else if (jsonData[dynamicKey3].va === 1) {
        newAllVolAmpToggles[j + 4] = 'right';
        newAllTogglePositions[j + 4] = 'V';
      }

      for (let i = 0; i < loopSize; i++) {
        const dynamicKey = `k${i + 1}`;
        const dynamicKey1 = `k${i + 1}`;

        if (jsonData[dynamicKey2] && jsonData[dynamicKey2][dynamicKey]) {
          newQuantities[j] = newQuantities[j] || {};
          newQuantities[j][i + 1] = parseFloat(
            jsonData[dynamicKey2][dynamicKey].perc,
          );
          newQuantities[j][0] = parseFloat(jsonData[dynamicKey2].case.perc);

          const { pol } = jsonData[dynamicKey2][dynamicKey];
          newSelectedValues[j] = newSelectedValues[j] || {};
          newSelectedValues[j][i + 1] =
            pol === 0 ? 'left' : pol === 1 ? 'center' : 'right';

          const casePol = jsonData[dynamicKey2].case.pol;
          newSelectedValues[j][0] =
            casePol === 0 ? 'left' : casePol === 1 ? 'center' : 'right';
        }

        if (jsonData[dynamicKey3] && jsonData[dynamicKey3][dynamicKey1]) {
          newQuantities[j + 4] = newQuantities[j + 4] || {};
          newQuantities[j + 4][i + 1] = parseFloat(
            jsonData[dynamicKey3][dynamicKey1].perc,
          );
          newQuantities[j + 4][0] = parseFloat(jsonData[dynamicKey3].case.perc);

          const { pol } = jsonData[dynamicKey3][dynamicKey1];
          newSelectedValues[j + 4] = newSelectedValues[j + 4] || {};
          newSelectedValues[j + 4][i + 1] =
            pol === 0 ? 'left' : pol === 1 ? 'center' : 'right';

          const casePol = jsonData[dynamicKey3].case.pol;
          newSelectedValues[j + 4][0] =
            casePol === 0 ? 'left' : casePol === 1 ? 'center' : 'right';
        }
      }

      newAllQuantities[j] = newQuantities[j];
      newAllQuantities[j + 4] = newQuantities[j + 4];
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

    console.log('TEST!L: ', outputIPG);
    if (outputIPG.includes('Medtronic')) {
      Object.keys(filteredQuantities).forEach((key) => {
        console.log('Test: ', filteredQuantities[key]);
        Object.keys(filteredQuantities[key]).forEach((key2) => {
          filteredQuantities[key][key2] =
            (filteredQuantities[key][key2] / 100) * newTotalAmplitude[key];
        });
      });
    }

    Object.keys(newAllVolAmpToggles).forEach((key) => {
      if (newAllVolAmpToggles[key] === 'right') {
        outputIPG = 'Medtronic_Activa';
        // setIpgMaster('Medtronic_Activa');
        return '';
      }
    });

    console.log('OutputIPG, 2: ', outputIPG);

    return {
      filteredQuantities,
      filteredValues,
      newTotalAmplitude,
      outputVisModel,
      newAllVolAmpToggles,
      outputIPG,
      newAllTogglePositions,
    };

    // Need to add some type of filtering here that detects whether it is Medtronic Activa, and then needs to put just mA values, not %
  };

  const handleTimelines = (timelineOutput, stimulationData) => {
    console.log('Processing timelines:', timelineOutput);
    console.log('Processing stimulation data: ', stimulationData);
    setTotalS(stimulationData.S);
    setMode(stimulationData.mode);
    setType(stimulationData.type);
    console.log('Stimulation Mode: ', stimulationData.mode);
    window.electron.ipcRenderer.sendMessage('revert-to-standard', '');
    let initialStates = {}; // Initialize the object to store the processed states
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
          ? gatherImportedDataNew(patientData, electrodes)
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
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
          allTogglePositions: processedS.newAllTogglePositions,
          model: electrodes,
        };
      }
      // Iterate over each key in the timelineOutput object
      Object.keys(timelineOutput).forEach((key, index) => {
        console.log(`Processing timeline for patient ${key}`);
        console.log('Timeline Output: ', timelineOutput);
        let electrodes = patient.elmodel || 'Boston Vercise Directed';
        const currentTimeline = key;
        const patientData = timelineOutput[key].S ? timelineOutput[key].S : timelineOutput[key];

        const outputElectrode = handleImportedElectrode(electrodes);
        console.log('Patient Data: ', patientData);
        const processedS = patientData
          ? gatherImportedDataNew(patientData, electrodes)
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
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
          allTogglePositions: processedS.newAllTogglePositions,
          model: electrodes,
        };
      });
      console.log('Initial States: ', initialStates);
      return initialStates;
    }

    if (stimulationData.type === 'leaddbs') {
      // Iterate over each key in the timelineOutput object
      let defaultElectrode = null;
      Object.keys(timelineOutput).forEach((key, index) => {
        console.log(`Processing timeline for patient ${key}`);
        console.log('Timeline Output: ', timelineOutput);
        let electrodes =
          stimulationData.electrodeModels || 'Boston Vercise Directed';
        if (stimulationData.filepath.includes('leadgroup')) {
          const patientIndex = stimulationData.patientname.findIndex(
            (name) => name === patient.id,
          );
          const electrodeModel = stimulationData.electrodeModels[patientIndex];
          console.log('Electrode model: ', electrodeModel);
          electrodes = electrodeModel;
        }
        defaultElectrode = electrodes;
        const currentTimeline = key;
        const patientData = timelineOutput[key].S;

        const outputElectrode = handleImportedElectrode(electrodes);

        const processedS = patientData
          ? gatherImportedDataNew(patientData, electrodes)
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
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
          allTogglePositions: processedS.newAllTogglePositions,
          model: electrodes,
        };
      });
      if (!timelineOutput[timeline]) {
        const outputElectrode = handleImportedElectrode(defaultElectrode);
        const patientData = initializeS(
          timeline,
          electrodeModels[outputElectrode].numel,
        );
        const processedS = patientData
          ? gatherImportedDataNew(patientData, defaultElectrode)
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              outputIPG: handleIPG(defaultElectrode),
              newAllTogglePositions: {},
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
          allTogglePositions: processedS.newAllTogglePositions,
        };
      }
    } else if (stimulationData.type === 'leadgroup') {
      Object.keys(timelineOutput).forEach((key, index) => {
        console.log(`Processing timeline for patient ${key}`);
        console.log('Timeline Output: ', timelineOutput);
        // Patient here is the timeline
        const currentTimeline = key;
        const electrodes = stimulationData.electrodeModels[index];
        const patientData = timelineOutput[key].S;

        const outputElectrode = handleImportedElectrode(electrodes);

        const processedS = patientData
          ? gatherImportedDataNew(patientData, electrodes)
          : {
              filteredQuantities: {},
              filteredValues: {},
              newTotalAmplitude: {},
              outputVisModel: '3',
              newAllVolAmpToggles: {},
              outputIPG: handleIPG(electrodes),
              newAllTogglePositions: {},
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
          allTogglePositions: processedS.newAllTogglePositions,
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
          const patientIds = allPatients.patients.map((patient) => patient.id);
          console.log('Patient IDs: ', patientIds);

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
  }, [directoryPath, patient, leadDBS, allPatients]);

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
  ) => {
    let outputQuantities = {};
    console.log(allQuantities);
    console.log(allTotalAmplitudes);
    console.log(allTogglePositions);
    const updatedQuantities = { ...allQuantities };
    Object.keys(allTogglePositions).forEach((position) => {
      // allTogglePositions[position] = 'mA';
      if (allTogglePositions[position] === 'mA') {
        console.log('position', position);
        console.log('quantity: ', allTogglePositions);
        console.log(allTotalAmplitudes[position]);
        console.log(allQuantities[position]);
        outputQuantities = calculatePercentageFromAmplitude(
          allQuantities[position],
          parseFloat(allTotalAmplitudes[position]),
        );
        // const updatedQuantities = {
        //   ...allQuantities,
        //   [position]: outputQuantities,
        // };
        updatedQuantities[position] = outputQuantities;
        console.log('updaredQuantities: ', updatedQuantities);
        outputQuantities = updatedQuantities;
      } else if (allTogglePositions[position] === 'V') {
        outputQuantities = calculateVoltageFromAmplitude(
          allQuantities[position],
        );
        // const updatedQuantities = {
        //   ...allQuantities,
        //   [position]: outputQuantities,
        // };
        updatedQuantities[position] = outputQuantities;
        outputQuantities = updatedQuantities;
      } else {
        outputQuantities[position] = allQuantities[position];
      }
      // return '';
    });
    // console.log(updatedQuantities);
  return outputQuantities;
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
    index,
    allTemplateSpaces,
  ) => {
    // handleFileChange('1');
    // saveQuantitiesandValues();
    let updatedOutputQuantity = {};
    updatedOutputQuantity = handleTogglePositions(
      allQuantities,
      allTotalAmplitudes,
      allTogglePositions,
    );
    console.log('Updated output quantity: ', updatedOutputQuantity);
    // parseAllVariables();
    const exportAmplitudeData = handleExportAmplitude(allTotalAmplitudes);
    // console.log(exportAmplitudeData);
    const leftHemiArr = [];
    const rightHemiArr = [];
    console.log(importNewS);
    const data = {
      S: {
        ...totalS[index],
      },
    };
    console.log('Data: ', data);

    const programs = Object.keys(allQuantities);
    const firstProgram = programs[0];
    console.log('Programs: ', programs);
    console.log('length', programs[0]);

    const loopSize = Object.keys(allQuantities[firstProgram]).length;
    // console.log('loopSize: ', loopSize);
    // data.S.label = 'Num1';
    const activeArray = [];
    const leftAmpArray = [];

    for (let j = 1; j < 5; j++) {
      const dynamicKey2 = `Ls${j}`;
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
            perc: parseFloat(updatedOutputQuantity[j][i]),
            pol: polarity,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: parseFloat(updatedOutputQuantity[j][0]),
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
        if (allTogglePositions[j] === 'V') {
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
            perc: parseFloat(updatedOutputQuantity[j + 4][i]),
            pol: polarity,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: parseFloat(updatedOutputQuantity[j + 4][0]),
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
        if (allTogglePositions[j + 4] === 'V') {
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
    const sourcesArray = activeArray;
    const rightLength = newActiveArray.length;
    data.S.sources = sourcesArray;
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

    // if (Array.isArray(data.S.activecontacts) && data.S.activecontacts.length > 0 && data.S.activecontacts[0] === undefined) {
    //   data.S.activecontacts.shift();
    // }
    console.log(data.S.activecontacts);
    return data;
  };


  const handleExport = () => {
    console.log('Patient States for Export', patientStates);
    const outputData = [];
    try {
      Object.values(patientStates).forEach((tempStates, index) => {
        console.log('TempStates: ', tempStates);
        const tempData = gatherExportedData5(
          tempStates.allTotalAmplitudes,
          tempStates.allQuantities,
          tempStates.allSelectedValues,
          tempStates.leftElectrode,
          tempStates.rightElectrode,
          tempStates.IPG,
          tempStates.visModel,
          tempStates.allTogglePositions,
          tempStates.allPercAmpToggles,
          index,
          tempStates.allTemplateSpaces,
        );
        outputData[index] = tempData; // Using index instead of key
      });
    } catch (err) {
      console.log(err);
    }

    console.log('Output Data: ', outputData);
    const filePath = '';
    window.electron.ipcRenderer.sendMessage(
      'save-file-stimulate',
      '',
      outputData,
    );
    window.electron.ipcRenderer.sendMessage('close-window');
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
        <div
          style={{ marginTop: '-120px' }}
        >
          <button
            className="export-button"
            style={{
              marginTop: '65px',
              marginLeft: '-200px',
              width: '100px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              backgroundColor: 'white',
              color: 'black',
              borderRadius: '30px',
              padding: '10px 20px',
              fontSize: '16px',
              fontWeight: 'bold',
            }}
            onClick={() => navigate(-1)}
          >
            {/* Back to Patient Details */}
            ←
          </button>
        </div>
      )}
      {type === 'leadgroup' && (
        <div>
          <button
            // className="export-button-final"
            onClick={handleExport}
            // style={{ marginLeft: '1200px' }}
            style={{
              width: '200px',
              marginLeft: '-125px',
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
            Save and Close
          </button>
        </div>
      )}
    </div>
  );
}

export default Programmer;
