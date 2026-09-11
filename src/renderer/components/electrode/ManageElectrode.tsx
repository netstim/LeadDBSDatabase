/**
 * ManageElectrode Component
 *
 * This component manages electrode selection, configuration, and stimulation parameters.
 * It provides a tabbed interface for different electrode types and handles the
 * complex state management for stimulation programming.
 */

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import ToggleButton from 'react-bootstrap/ToggleButton';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Button from 'react-bootstrap/Button';

// Styles
import '../../styles/TabbedElectrodeIPGSelection.css';

// Data and Components
import electrodeModels from '../../assets/data/electrodeModels.json';
import { OSSSettings, normalizeOSSSettings } from '../../utils/OSSSettings';
import Electrode from './Electrode';
import { getSteeringUnit } from '../../utils/currentSteering';
import {
  exportSteeringQuantities,
  importedIPG,
  importSteeringSource,
  unitTogglePositions,
  writeSteeringMetadata,
} from '../../utils/stimulationUnits';
import withoutStimulationContacts, {
  LEAD_DBS_SOURCE_INDICES,
} from '../../utils/leadDbsSources';

// Type definitions
interface HemisphereData {
  unit: string;
  value: string;
}

interface HemisphereState {
  left: HemisphereData[];
  right: HemisphereData[];
}

interface ManageElectrodeProps {
  IPG: string;
  setIPG?: (value: string) => void;
  selectedElectrodeLeft: string;
  selectedElectrodeRight: string;
  allQuantities: Record<string, any>;
  setAllQuantities: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  allSelectedValues: Record<string, any>;
  setAllSelectedValues: React.Dispatch<
    React.SetStateAction<Record<string, any>>
  >;
  allTotalAmplitudes: Record<string, any>;
  setAllTotalAmplitudes: React.Dispatch<
    React.SetStateAction<Record<string, any>>
  >;
  allStimulationParameters: Record<string, any>;
  setAllStimulationParameters: React.Dispatch<
    React.SetStateAction<Record<string, any>>
  >;
  visModel: string;
  setVisModel: (value: string) => void;
  sessionTitle: string;
  setSessionTitle: (value: string) => void;
  allTogglePositions: Record<string, any>;
  setAllTogglePositions: React.Dispatch<
    React.SetStateAction<Record<string, any>>
  >;
  allPercAmpToggles: Record<string, any>;
  setAllPercAmpToggles: React.Dispatch<
    React.SetStateAction<Record<string, any>>
  >;
  allVolAmpToggles: Record<string, any>;
  setAllVolAmpToggles: React.Dispatch<
    React.SetStateAction<Record<string, any>>
  >;
  filePath: string;
  setFilePath: (value: string) => void;
  matImportFile: any;
  stimChanged: boolean;
  setStimChanged: (value: boolean) => void;
  namingConvention: string;
  selectedPatient: any;
  historical: any;
  mode: string;
  templateS: any;
  type: string;
  allTemplateSpaces: number;
  setAllTemplateSpaces: (value: number) => void;
  showViewer: boolean;
  setShowViewer: (value: boolean) => void;
  ossSettings?: OSSSettings;
  setOSSSettings?: (value: OSSSettings) => void;
}

function ManageElectrode({
  IPG,
  setIPG,
  selectedElectrodeLeft,
  selectedElectrodeRight,
  allQuantities,
  setAllQuantities,
  allSelectedValues,
  setAllSelectedValues,
  allTotalAmplitudes,
  setAllTotalAmplitudes,
  allStimulationParameters,
  setAllStimulationParameters,
  visModel,
  setVisModel,
  sessionTitle,
  setSessionTitle,
  allTogglePositions,
  setAllTogglePositions,
  allPercAmpToggles,
  setAllPercAmpToggles,
  allVolAmpToggles,
  setAllVolAmpToggles,
  filePath,
  setFilePath,
  matImportFile,
  stimChanged,
  setStimChanged,
  namingConvention,
  selectedPatient,
  historical,
  mode,
  templateS,
  type,
  allTemplateSpaces,
  setAllTemplateSpaces,
  showViewer,
  setShowViewer,
  ossSettings: controlledOSSSettings,
  setOSSSettings: setControlledOSSSettings,
}: ManageElectrodeProps) {
  // Refs
  const testElectrodeRef = React.createRef();
  const fileInputRef = useRef(null);

  // State management
  const [hemisphereData, setHemisphereData] = useState<HemisphereState>({
    left: [
      { unit: 'V', value: '' },
      { unit: 'V', value: '' },
      { unit: 'V', value: '' },
      { unit: 'V', value: '' },
    ],
    right: [
      { unit: 'V', value: '' },
      { unit: 'V', value: '' },
      { unit: 'V', value: '' },
      { unit: 'V', value: '' },
    ],
  });

  const [key, setKey] = useState<string>('5');
  const activeElectrode =
    Number(key) > 4
      ? selectedElectrodeRight || selectedElectrodeLeft
      : selectedElectrodeLeft || selectedElectrodeRight;
  const [visualizationModel, setVisualizationModel] = useState<string>('3');
  const [localOSSSettings, setLocalOSSSettings] = useState<OSSSettings>(() =>
    normalizeOSSSettings(templateS?.ossSettings),
  );
  const hasControlledOSSSettings =
    controlledOSSSettings !== undefined &&
    setControlledOSSSettings !== undefined;
  const ossSettings =
    hasControlledOSSSettings && controlledOSSSettings
      ? controlledOSSSettings
      : localOSSSettings;
  const updateOSSSettings = (settings: OSSSettings) => {
    const normalizedSettings = normalizeOSSSettings(settings);
    setLocalOSSSettings(normalizedSettings);
    setControlledOSSSettings?.(normalizedSettings);
  };
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!hasControlledOSSSettings) {
      setLocalOSSSettings(normalizeOSSSettings(templateS?.ossSettings));
    }
  }, [hasControlledOSSSettings, templateS?.ossSettings]);

  // Constants
  const hemisphereButtons = [
    { name: 'Right', value: '5' },
    { name: 'Left', value: '1' },
  ];

  // Debug logging
  console.log('Electrode models: ', electrodeModels);
  console.log('Selected electrode', selectedElectrodeLeft);

  // const handleChange = () => {
  //   console.log("key="+key + ","+ Tabs.key);
  //   setKey(Tabs.key);
  // };

  // const getVariant = (value) => {
  //   return 'outline-secondary';
  // };

  // const namingConventionDef = [
  //   { name: 'clinical', value: 'clinical' },
  //   { name: 'lead-dbs', value: 'lead-dbs' },
  // ];

  // const handleNamingConventionChange = (newConvention) => {
  //   setNamingConvention(newConvention);
  // };

  useEffect(() => {
    if (stimChanged) {
      // Reset states or do necessary updates on stimChanged
      console.log('Stim changed, re-rendering...');
      setStimChanged(false); // Reset stimChanged if it’s a one-time trigger
    }
  }, [stimChanged, setStimChanged]);

  /**
   * Handles tab change events
   * @param k - The new tab key
   */
  const handleTabChange = (k: string): void => {
    setKey(k);
  };

  console.log('tab key=', key);

  // Send a message to the main process

  /**
   * Saves quantities and values from the electrode component
   * This function extracts all state from the electrode component and updates
   * the parent component's state arrays
   */
  const saveQuantitiesandValues = (): void => {
    allQuantities[key] = testElectrodeRef.current.getStateQuantities();
    allSelectedValues[key] = testElectrodeRef.current.getStateSelectedValues();
    allTotalAmplitudes[key] = testElectrodeRef.current.getStateAmplitude();
    allStimulationParameters[key] =
      testElectrodeRef.current.getStateStimulationParameters();

    try {
      visModel[key] = testElectrodeRef.current.getStateVisModel();
    } catch (error) {
      console.log(error);
    }

    sessionTitle[key] = testElectrodeRef.current.getStateSessionTitle();
    allTogglePositions[key] = testElectrodeRef.current.getStateTogglePosition();
  };

  /**
   * Converts electrode model key to display name
   * @param electrode - The electrode model key
   * @returns The display name for the electrode
   */
  const convertElectrode = (electrode: string): string => {
    switch (electrode) {
      case 'boston_vercise_directed':
        return 'Boston Scientific Vercise Directed';
      case 'medtronic_3389':
        return 'Medtronic 3389';
      case 'medtronic_3387':
        return 'Medtronic 3387';
      case 'medtronic_3391':
        return 'Medtronic 3391';
      case 'medtronic_b33005':
        return 'Medtronic B33005';
      case 'medtronic_b33015':
        return 'Medtronic B33015';
      case 'boston_scientific_vercise':
        return 'Boston Scientific Vercise';
      case 'boston_scientific_vercise_cartesia_hx':
        return 'Boston Scientific Vercise Cartesia HX';
      case 'boston_scientific_vercise_cartesia_x':
        return 'Boston Scientific Vercise Cartesia X';
      case 'abbott_activetip_2mm':
        return 'Abbott ActiveTip (6146-6149)';
      case 'abbott_activetip_3mm':
        return 'Abbott ActiveTip (6142-6145)';
      case 'abbott_directed_05':
        return 'Abbott Directed 6172 (short)';
      case 'abbott_directed_15':
        return 'Abbott Directed 6173 (long)';
      default:
        return '';
    }
  };

  // Additional state
  const [importedData, setImportedData] = useState<any>(null);

  /**
   * Handles export amplitude data processing
   * @param amplitudeList - The amplitude list to process
   * @returns Processed amplitude list for export
   */
  const handleExportAmplitude = (
    amplitudeList: Record<string, any>,
  ): number[] => {
    const exportAmplitudeList: number[] = [];
    Object.keys(amplitudeList).forEach((key) => {
      exportAmplitudeList.push(parseFloat(amplitudeList[key]));
    });
    exportAmplitudeList.shift();
    return exportAmplitudeList;
  };

  /**
   * Calculates percentage values from amplitude data
   * @param quantities - The quantities object to update
   * @param totalAmplitude - The total amplitude value
   * @returns Updated quantities with percentage values
   */
  const calculatePercentageFromAmplitude = (
    quantities: Record<string, any>,
    totalAmplitude: number,
  ): Record<string, any> => {
    const updatedQuantities = { ...quantities };
    if (!Number.isFinite(totalAmplitude) || totalAmplitude <= 0) {
      Object.keys(updatedQuantities).forEach((element) => {
        updatedQuantities[element] = 0;
      });
      return updatedQuantities;
    }
    Object.keys(updatedQuantities).forEach((element) => {
      const contactAmplitude = parseFloat(updatedQuantities[element]);
      updatedQuantities[element] = Number.isFinite(contactAmplitude)
        ? (contactAmplitude * 100) / totalAmplitude
        : 0;
    });
    console.log(updatedQuantities);
    return updatedQuantities;
  };

  /**
   * Calculates voltage values from amplitude data
   * @param quantities - The quantities object to update
   * @returns Updated quantities with voltage values
   */
  const calculateVoltageFromAmplitude = (
    quantities: Record<string, any>,
  ): Record<string, any> => {
    const updatedQuantities = { ...quantities };
    Object.keys(updatedQuantities).forEach((element) => {
      if (quantities[element] !== 0) {
        updatedQuantities[element] = 100;
      }
    });
    return updatedQuantities;
  };

  const handleTogglePositions = () => {
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

  // const handleIPGForOutput = () => {
  //   if (IPG = 'Boston') {
  //     if (handlePercAmp)
  //   }
  // }

  function handleFileChange(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const jsonData = JSON.parse(e.target.result);
          setImportedData(jsonData);
        } catch (error) {
          console.error('Error parsing JSON:', error);
        }
      };
      reader.readAsText(file);
    }
  }

  // Inside the TabbedElectrodeIPGSelection component

  const translatePolarity = (sideValue) => {
    let polar = 0;
    if (sideValue === 'center') {
      polar = 1;
    } else if (sideValue === 'right') {
      polar = 2;
    }

    return polar;
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

  const parseAllVariables = () => {
    for (let i = 1; i < 9; i++) {
      if (!allQuantities[i]) {
        Object.keys(allQuantities).forEach((key3) => {
          allQuantities[i][key3] = 0;
          allSelectedValues[i][key3] = 0;
          allTotalAmplitudes[i] = 0;
          allStimulationParameters[i].parameter2 = 0;
          allStimulationParameters[i].parameter1 = 0;
        });
      }
    }
  };

  const gatherExportedData3 = () => {
    // handleFileChange('1');
    const data = {
      S: {
        label: sessionTitle[1],
        Rs1: {},
        Rs2: {},
        Rs3: {},
        Rs4: {},
        Ls1: {},
        Ls2: {},
        Ls3: {},
        Ls4: {},
        active: {},
        model: '',
        monopolarmodel: 0,
        amplitude: [],
        activecontacts: {},
        template: 'warp',
        sources: {},
        elmodel: {},
        volume: [0, 0],
      },
    };

    for (let i = 1; i < 9; i++) {
      if (allTotalAmplitudes[i]) {
        data.S.amplitude[i - 1] = parseFloat(allTotalAmplitudes[i]);
      } else {
        data.S.amplitude[i - 1] = 0;
      }
    }

    data.S.elmodel = [selectedElectrodeLeft, selectedElectrodeRight];
    const activeArray = [];
    let exportVisModel = '';
    if (visModel[1] === '1') {
      console.log('here');
      exportVisModel = 'Dembek 2017';
    } else if (visModel[1] === '2') {
      exportVisModel = 'Fastfield (Baniasadi 2020)';
    } else if (visModel[1] === '3') {
      exportVisModel = 'SimBio/FieldTrip (see Horn 2017)';
    } else if (visModel[1] === '4') {
      exportVisModel = 'Kuncel 2008';
    } else if (visModel[1] === '5') {
      exportVisModel = 'Maedler 2012';
    }

    data.S.model = exportVisModel;
    data.S.ossSettings = normalizeOSSSettings(ossSettings);

    // for (let j = 1; j < 5; j++) {
    //   let dynamicKey2 = `Ls${j}`;
    //   if (allSelectedValues[j] && allQuantities[j]) {
    //     for (let i = 1; i < 9; i++) {
    //       let polarity = 0;
    //       if (allSelectedValues[j][i] === 'left') {
    //         polarity = 0;
    //       } else if (allSelectedValues[j][i] === 'center') {
    //         polarity = 1;
    //       } else if (allSelectedValues[j][i] === 'right') {
    //         polarity = 2;
    //       }
    //       let dynamicKey = `k${i + 7}`;
    //       data.S[dynamicKey2][dynamicKey] = {
    //         perc: parseFloat(allQuantities[j][i]),
    //         pol: polarity,
    //         imp: 1,
    //       };
    //     }
    //     data.S[dynamicKey2].case = {
    //       perc: parseFloat(allQuantities[j][0]),
    //       pol: translatePolarity(allSelectedValues[j][0]),
    //     };
    //     data.S[dynamicKey2].amp = allTotalAmplitudes[j];
    //     data.S[dynamicKey2].frequency = allStimulationParameters[j].parameter2;
    //     data.S[dynamicKey2].pulsewidth = allStimulationParameters[j].parameter1;
    //     activeArray.push(j);
    //     data.S.activeContacts[j] = activeContacts(allSelectedValues[j]);
    //   }
    // }

    for (let j = 1; j < 5; j++) {
      const dynamicKey2 = `Ls${j}`;
      if (allSelectedValues[j] && allQuantities[j]) {
        for (let i = 1; i < 9; i++) {
          let polarity = 0;
          if (allSelectedValues[j][i] === 'left') {
            polarity = 0;
          } else if (allSelectedValues[j][i] === 'center') {
            polarity = 1;
          } else if (allSelectedValues[j][i] === 'right') {
            polarity = 2;
          }
          const dynamicKey = `k${i + 7}`;
          data.S[dynamicKey2][dynamicKey] = {
            perc: parseFloat(allQuantities[j][i]),
            pol: polarity,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: parseFloat(allQuantities[j][0]),
          pol: translatePolarity(allSelectedValues[j][0]),
        };
        data.S[dynamicKey2].amp = parseFloat(allTotalAmplitudes[j]);
        data.S[dynamicKey2].frequency = parseFloat(
          allStimulationParameters[j].parameter2,
        );
        data.S[dynamicKey2].pulsewidth = parseFloat(
          allStimulationParameters[j].parameter1,
        );
        activeArray.push(j);
        data.S.activecontacts[j] = activeContacts(allSelectedValues[j]);
      } else {
        for (let i = 1; i < 9; i++) {
          // console.log('j: ', dynamicKey2);
          const dynamicKey = `k${i + 7}`;
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
        data.S[dynamicKey2].frequency = 130;
        data.S[dynamicKey2].pulsewidth = 60;
      }
    }

    const leftLength = activeArray.length;
    const newActiveArray = [];

    for (let j = 1; j < 5; j++) {
      const dynamicKey2 = `Rs${j}`;
      if (allSelectedValues[j + 4] && allQuantities[j + 4]) {
        for (let i = 1; i < 9; i++) {
          let polarity = 0;
          if (allSelectedValues[j + 4][i] === 'left') {
            polarity = 0;
          } else if (allSelectedValues[j + 4][i] === 'center') {
            polarity = 1;
          } else if (allSelectedValues[j + 4][i] === 'right') {
            polarity = 2;
          }
          const dynamicKey = `k${i - 1}`;
          data.S[dynamicKey2][dynamicKey] = {
            perc: parseFloat(allQuantities[j + 4][i]),
            pol: polarity,
            imp: 1,
          };
        }
        data.S[dynamicKey2].case = {
          perc: parseFloat(allQuantities[j + 4][0]),
          pol: translatePolarity(allSelectedValues[j + 4][0]),
        };
        data.S[dynamicKey2].amp = allTotalAmplitudes[j + 4];
        data.S[dynamicKey2].frequency =
          allStimulationParameters[j + 4].parameter2;
        data.S[dynamicKey2].pulsewidth =
          allStimulationParameters[j + 4].parameter1;
        activeArray.push(j + 4);
        newActiveArray.push(j);
        data.S.activecontacts[j + 4] = activeContacts(allSelectedValues[j + 4]);
      } else {
        for (let i = 1; i < 9; i++) {
          const dynamicKey = `k${i - 1}`;
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
        data.S[dynamicKey2].frequency = 130;
        data.S[dynamicKey2].pulsewidth = 60;
      }
    }
    const rightLength = newActiveArray.length;
    data.S.sources = [...LEAD_DBS_SOURCE_INDICES];
    data.S.active = [1, 1];
    console.log(data);
    return data;
    // data.S.activecontacts = activeContacts(allSelectedValues[1]);
  };

  const gatherExportedData6 = () => {
    // handleFileChange('1');
    // saveQuantitiesandValues();
    let updatedOutputQuantity = {};
    updatedOutputQuantity = handleTogglePositions();
    console.log('Updated output quantity: ', updatedOutputQuantity);
    // parseAllVariables();
    // console.log(exportAmplitudeData);
    const leftHemiArr = [];
    const rightHemiArr = [];
    console.log('Template S: ', templateS);
    const data = {
      S: JSON.parse(JSON.stringify(templateS || {})),
    };
    data.S.amplitude = [Array(4).fill(0), Array(4).fill(0)];
    console.log(data);
    // data.S.elmodel = [selectedElectrodeLeft, selectedElectrodeRight];
    const programs = Object.keys(allQuantities);
    const firstProgram = programs[0];
    console.log('Programs: ', programs);
    console.log('length', programs[0]);

    const configuredContactCount = Math.max(
      Number(electrodeModels[selectedElectrodeLeft]?.numel) || 0,
      Number(electrodeModels[selectedElectrodeRight]?.numel) || 0,
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
    data.S.activecontacts = {};
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
        console.log('All Selected Values: ', allSelectedValues);
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
    console.log('Initialized Amplitude: ', data.S.amplitude);
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
    console.log('Amplitude: ', allTotalAmplitudes);
    // data.S.amplitude = { rightAmplitude, leftAmplitude };
    // data.S.amplitude = exportAmplitudeData;
    // console.log(exportAmplitudeData);
    const rightLength = newActiveArray.length;
    // Source numbers are 1-4 on each side in Lead-DBS. The UI's right-side
    // program slots (5-8) are state keys, not valid Lead-DBS source numbers.
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
    data.S.ossSettings = normalizeOSSSettings(ossSettings);
    // data.S.estimateInTemplate = exportTemplateSpace;
    // if (Array.isArray(data.S.activecontacts) && data.S.activecontacts.length > 0 && data.S.activecontacts[0] === undefined) {
    //   data.S.activecontacts.shift();
    // }
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
    data.S.estimateInTemplate = allTemplateSpaces;
    console.log(data.S.activecontacts);
    return data;
  };

  const [responseData, setResponseData] = useState('');

  // Define a function to handle button click event
  const handleClick = async () => {
    const outputData = gatherExportedData3();
    try {
      // Make a POST request to send data to the server
      const response = await axios.post('http://localhost:3001/api/data', {
        outputData, // Replace with the data you want to send
      });

      // Handle the response data
      console.log(response.data);
      setResponseData(response.data.message); // Update state with response data
    } catch (error) {
      // Handle error
      console.error('Error:', error);
    }
  };

  const sendDataToMain = async () => {
    if (isSaving) return;
    const outputData = gatherExportedData6();
    console.log('OUTPUTDATA: ', outputData);
    console.log('Historical: ', historical);
    if (mode === 'stimulate') {
      setIsSaving(true);
      setSaveStatus('Saving stimulation…');
      try {
        const result = await window.electron.ipcRenderer.invoke(
          'save-file-stimulate',
          filePath,
          outputData,
        );
        if (!result?.success) {
          throw new Error(
            result.error || 'The stimulation could not be saved.',
          );
        }
        setSaveStatus('Stimulation saved. Closing…');
        window.electron.ipcRenderer.sendMessage('close-window');
      } catch (error) {
        console.error('Error saving stimulation:', error);
        setSaveStatus(
          error instanceof Error
            ? `Save failed: ${error.message}`
            : 'The stimulation could not be saved.',
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }
    setIsSaving(true);
    setSaveStatus('Saving stimulation settings…');
    try {
      const result = await window.electron.ipcRenderer.invoke(
        'save-file',
        filePath,
        outputData,
        historical,
      );
      if (!result?.success) {
        throw new Error(result.error || 'The settings could not be saved.');
      }
      setSaveStatus('Stimulation settings saved.');
    } catch (error) {
      console.error('Error saving stimulation settings:', error);
      setSaveStatus(
        error instanceof Error
          ? `Save failed: ${error.message}`
          : 'The settings could not be saved.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  let saveButtonLabel = 'Save';
  if (isSaving) {
    saveButtonLabel = 'Saving…';
  } else if (mode === 'stimulate') {
    saveButtonLabel = 'Stimulate and Close';
  }

  const closeFunction = () => {
    window.electron.ipcRenderer.sendMessage('close-window-new');
  };

  const quitApp = () => {
    // window.electron.ipcRenderer.sendMessage('set-status');
    window.electron.ipcRenderer.sendMessage('close-window');
  };

  const initializeElectrodeVariables = () => {
    console.log('Here');
    console.log(electrodeModels);
    const elspec = electrodeModels[activeElectrode];
    if (!elspec) return;
    console.log('Electrode: ', selectedElectrodeLeft);
    console.log('Elspec: ', elspec);
    const initialSelectedValues = { 0: 'right' };
    const initialQuantityBoston = { 0: 100 };
    const initialQuantity = { 0: 0 };
    const initialAnimation = { 0: null };
    const initialUnit = getSteeringUnit(
      IPG,
      allPercAmpToggles[key],
      allVolAmpToggles[key],
      allTogglePositions[key],
    );
    const {
      percAmpToggle: initialpercAmpToggle,
      volAmpToggle: initialVolAmpToggle,
    } = unitTogglePositions(initialUnit);
    const initialVisModel = visModel || '3';
    const initialTotalAmplitude = 0;
    for (let i = 0; i < elspec.numel; i++) {
      initialSelectedValues[i + 1] = 'left';
      initialQuantityBoston[i + 1] = 0;
      initialQuantity[i + 1] = 0;
      initialAnimation[i + 1] = null;
    }
    console.log('Initial quantity: ', initialQuantity);
    const newInitialQuantities =
      initialUnit === '%' ? initialQuantityBoston : initialQuantity;

    console.log(
      'Initialization test: ',
      electrodeModels[selectedElectrodeLeft],
    );
    if (!allQuantities[key]) {
      setAllQuantities((previous) => ({
        ...previous,
        [key]: newInitialQuantities,
      }));
    }

    if (!allSelectedValues[key]) {
      setAllSelectedValues((previous) => ({
        ...previous,
        [key]: initialSelectedValues,
      }));
    }

    if (!allPercAmpToggles[key]) {
      setAllPercAmpToggles((previous) => ({
        ...previous,
        [key]: initialpercAmpToggle,
      }));
    }

    if (!allVolAmpToggles[key]) {
      setAllVolAmpToggles((previous) => ({
        ...previous,
        [key]: initialVolAmpToggle,
      }));
    }

    if (!allTogglePositions[key]) {
      setAllTogglePositions((previous) => ({
        ...previous,
        [key]: initialUnit,
      }));
    }

    if (allTotalAmplitudes[key] === undefined) {
      setAllTotalAmplitudes((previous) => ({
        ...previous,
        [key]: initialTotalAmplitude,
      }));
    }

    // For visModel, ensure it's set only if it's not already set
    if (!visModel) {
      setVisModel(initialVisModel);
    }
    console.log('All Quantities from initialize: ', newInitialQuantities);
  };

  useEffect(() => {
    if (activeElectrode) {
      initializeElectrodeVariables();
    }
  }, [
    IPG,
    selectedElectrodeLeft,
    selectedElectrodeRight,
    key,
    electrodeModels,
  ]);

  const gatherImportedData = (jsonData: any) => {
    const stimulation = jsonData?.S || jsonData;
    if (!stimulation?.Ls1 && !stimulation?.Rs1) {
      setSaveStatus(
        'Import failed: the file does not contain Lead-DBS stimulation sources.',
      );
      return;
    }
    const nextIPG = setIPG ? importedIPG(stimulation, IPG) : IPG;
    const quantities: Record<string, any> = {};
    const selected: Record<string, any> = {};
    const amplitudes: Record<string, any> = {};
    const units: Record<string, any> = {};
    const percentages: Record<string, any> = {};
    const voltages: Record<string, any> = {};
    for (let position = 1; position <= 8; position += 1) {
      const source = importSteeringSource(
        stimulation,
        position,
        nextIPG,
        stimulation.amplitude?.[position > 4 ? 0 : 1]?.[(position - 1) % 4],
      );
      quantities[position] = source.quantities;
      selected[position] = source.selectedValues;
      amplitudes[position] = source.totalAmplitude;
      units[position] = source.unit;
      percentages[position] = source.percAmpToggle;
      voltages[position] = source.volAmpToggle;
    }
    setAllQuantities(quantities);
    setAllSelectedValues(selected);
    setAllTotalAmplitudes(amplitudes);
    setAllTogglePositions(units);
    setAllPercAmpToggles(percentages);
    setAllVolAmpToggles(voltages);
    setIPG?.(nextIPG);
  };

  useEffect(() => {
    if (importedData) {
      gatherImportedData(importedData);
    }
    // handleTabChange('1');
    console.log('Tabbed all quantities: ', allQuantities);
    if (stimChanged) {
      handleTabChange(key);
      setStimChanged(false);
    }
  }, [importedData]);

  const [tempParamInput, setTempParamInput] = useState('0-/C+; 2mA');

  const handleQuantityChange = (updatedQuantities) => {
    setAllQuantities((previous) => ({
      ...previous,
      [key]:
        typeof updatedQuantities === 'function'
          ? updatedQuantities(previous[key])
          : updatedQuantities,
    }));
  };

  const handleSelectedValueChange = (updatedSelectedValues) => {
    setAllSelectedValues((previous) => ({
      ...previous,
      [key]:
        typeof updatedSelectedValues === 'function'
          ? updatedSelectedValues(previous[key])
          : updatedSelectedValues,
    }));
  };

  const handleAmplitudeChange = (updatedAmplitude) => {
    setAllTotalAmplitudes((previous) => ({
      ...previous,
      [key]: updatedAmplitude,
    }));
  };

  const handleParameterChange = (updatedParameters) => {
    setAllStimulationParameters((previous) => ({
      ...previous,
      [key]:
        typeof updatedParameters === 'function'
          ? updatedParameters(previous[key])
          : updatedParameters,
    }));
  };

  const handleVisModelChange = (updatedVisModel) => {
    setVisModel(updatedVisModel);
  };

  const handleTogglePositionChange = (updatedTogglePosition) => {
    console.log('Updated toggle position: ', allTogglePositions);
    console.log('Key: ', key);
    setAllTogglePositions((previous) => ({
      ...previous,
      [key]: updatedTogglePosition,
    }));
  };

  const handlePercAmpToggleChange = (updatedPercAmpToggle) => {
    setAllPercAmpToggles((previous) => ({
      ...previous,
      [key]: updatedPercAmpToggle,
    }));
  };

  const handleVolAmpToggleChange = (updatedVolAmpToggle) => {
    setAllVolAmpToggles((previous) => ({
      ...previous,
      [key]: updatedVolAmpToggle,
    }));
  };

  const handleTemplateSpaceChange = (updatedTemplateSpace) => {
    setAllTemplateSpaces(updatedTemplateSpace);
  };

  const handleShowViewer = (updatedShowViewer) => {
    setShowViewer(updatedShowViewer);
  };

  const testing = () => {
    console.log('All Toggle positions: ', allTogglePositions);
  };

  const mountVariables = () => {
    return (
      key &&
      allQuantities &&
      allQuantities[key] &&
      allSelectedValues &&
      allSelectedValues[key] &&
      IPG &&
      allTotalAmplitudes &&
      allTotalAmplitudes[key] &&
      allStimulationParameters &&
      allStimulationParameters[key] &&
      visModel &&
      sessionTitle &&
      sessionTitle[1] &&
      allTogglePositions &&
      allTogglePositions[key] &&
      allPercAmpToggles &&
      allVolAmpToggles &&
      electrodeModels &&
      selectedElectrodeLeft
    );
  };

  useEffect(() => {
    mountVariables();
  }, [
    key,
    allQuantities,
    allSelectedValues,
    IPG,
    allTotalAmplitudes,
    allStimulationParameters,
    visModel,
    sessionTitle,
    allTogglePositions,
    allPercAmpToggles,
    allVolAmpToggles,
    selectedElectrodeLeft,
    namingConvention,
    historical,
  ]);

  return (
    <div className="TabbedIPGContainer">
      <div style={{ marginTop: '-90px' }} />
      {/* <div className="stimCloseContainer" /> */}
      {/* <ButtonGroup>
        <Button onClick={() => handleTabChange('5')}>Right Hemisphere</Button>
        <Button onClick={() => handleTabChange('1')}>Left Hemisphere</Button>
      </ButtonGroup> */}
      <div
        style={{
          position: 'absolute',
          zIndex: 1,
          marginTop: '200px',
          marginLeft: '100px',
          width: '260px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <p style={{ fontSize: '18px', marginBottom: '-4px' }}>Hemisphere</p>
        <ButtonGroup className="mb-2" style={{ gap: '10px' }}>
          {hemisphereButtons.map((radio, idx) => (
            <ToggleButton
              key={idx}
              id={`radio-${idx}`}
              type="radio"
              name="radio"
              value={radio.value}
              checked={key === radio.value}
              onChange={(e) => handleTabChange(e.currentTarget.value)}
              style={{
                borderRadius: '20px',
                width: '110px',
                backgroundColor: 'white',
                color: 'navy',
                fontWeight: 'bold',
                boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
                border: 'none',
                ...(((parseFloat(key) >= 5 && radio.value === '5') ||
                  (parseFloat(key) < 5 && radio.value === '1')) && {
                  // backgroundColor: 'grey',
                  color: 'black',
                  fontWeight: 'bold',
                  border: 'none',
                  boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.4)', // Inward shadow for selected
                }),
              }}
            >
              {radio.name}
            </ToggleButton>
          ))}
        </ButtonGroup>
        <p style={{ fontSize: '18px', marginBottom: '-4px' }}>Source</p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            style={{
              borderRadius: '20px',
              width: '56px',
              backgroundColor: 'white',
              color: 'navy',
              fontWeight: 'bold',
              border: 'none',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              ...((key === '5' || key === '1') && {
                // backgroundColor: 'grey',
                color: 'black',
                fontWeight: 'bold',
                border: 'none',
                boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.4)',
              }),
            }}
            onClick={() => handleTabChange(parseFloat(key) >= 5 ? '5' : '1')}
          >
            1
          </Button>
          <Button
            style={{
              borderRadius: '20px',
              width: '56px',
              backgroundColor: 'white',
              color: 'navy',
              fontWeight: 'bold',
              border: 'none',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              ...((key === '6' || key === '2') && {
                // backgroundColor: 'grey',
                color: 'black',
                fontWeight: 'bold',
                border: 'none',
                boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.4)',
              }),
            }}
            onClick={() => handleTabChange(parseFloat(key) >= 5 ? '6' : '2')}
          >
            2
          </Button>
          <Button
            style={{
              borderRadius: '20px',
              width: '56px',
              backgroundColor: 'white',
              color: 'navy',
              fontWeight: 'bold',
              border: 'none',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              ...((key === '7' || key === '3') && {
                // backgroundColor: 'grey',
                color: 'black',
                fontWeight: 'bold',
                border: 'none',
                boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.4)',
              }),
            }}
            onClick={() => handleTabChange(parseFloat(key) >= 5 ? '7' : '3')}
          >
            3
          </Button>
          <Button
            style={{
              borderRadius: '20px',
              width: '56px',
              backgroundColor: 'white',
              color: 'navy',
              fontWeight: 'bold',
              border: 'none',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              ...((key === '8' || key === '4') && {
                // backgroundColor: 'grey',
                color: 'black',
                fontWeight: 'bold',
                border: 'none',
                boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.4)',
              }),
            }}
            onClick={() => handleTabChange(parseFloat(key) >= 5 ? '8' : '4')}
          >
            4
          </Button>
        </div>
      </div>
      <div className="form-container">
        <Electrode
          key={key}
          name={key}
          allQuantities={allQuantities}
          quantities={allQuantities[key]}
          setQuantities={(updatedQuantities) =>
            handleQuantityChange(updatedQuantities)
          }
          selectedValues={allSelectedValues[key]}
          setSelectedValues={(updatedSelectedValues) =>
            handleSelectedValueChange(updatedSelectedValues)
          }
          IPG={IPG}
          totalAmplitude={allTotalAmplitudes[key]}
          setTotalAmplitude={(updatedAmplitude) =>
            handleAmplitudeChange(updatedAmplitude)
          }
          parameters={allStimulationParameters[key]}
          setParameters={(updatedParameters) =>
            handleParameterChange(updatedParameters)
          }
          visModel={visModel}
          setVisModel={(updatedVisModel) =>
            handleVisModelChange(updatedVisModel)
          }
          sessionTitle={sessionTitle[1]}
          togglePosition={allTogglePositions[key]}
          setTogglePosition={(updatedTogglePosition) =>
            handleTogglePositionChange(updatedTogglePosition)
          }
          percAmpToggle={
            allPercAmpToggles[key] ? allPercAmpToggles[key] : 'left'
          }
          setPercAmpToggle={(updatedPercAmpToggle) =>
            handlePercAmpToggleChange(updatedPercAmpToggle)
          }
          volAmpToggle={allVolAmpToggles[key]}
          setVolAmpToggle={(updatedVolAmpToggle) =>
            handleVolAmpToggleChange(updatedVolAmpToggle)
          }
          contactNaming={namingConvention}
          adornment={allVolAmpToggles[key] === 'right' ? 'V' : 'mA'}
          historical={historical}
          elspec={electrodeModels[activeElectrode]}
          electrodeLabel={convertElectrode(activeElectrode)}
          templateSpace={allTemplateSpaces}
          setTemplateSpace={(updatedTemplateSpace) =>
            handleTemplateSpaceChange(updatedTemplateSpace)
          }
          showViewer={showViewer}
          setShowViewer={(updatedShowViewer) =>
            handleShowViewer(updatedShowViewer)
          }
          ossSettings={ossSettings}
          setOSSSettings={updateOSSSettings}
        />
      </div>
      <div className="export-button-container">
        <input
          ref={fileInputRef}
          className="file-input"
          type="file"
          accept=".json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          // Hide the input element
        />
      </div>
      {type !== 'leadgroup' && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginLeft: '150px',
            marginTop: '-20px',
            // paddingBottom: '35px',
          }}
        >
          {/* <button
                className="export-button-final-discard"
                onClick={closeFunction}
                style={{ marginRight: '15px' }}
              >
                Discard
              </button> */}
          {/* <button
            className="export-button-final"
            onClick={sendDataToMain}
            style={{ marginLeft: '1000px' }}
          >
            {mode === 'stimulate' ? 'Stimulate and Close' : 'Save'}
          </button> */}
          <Button
            // className="export-button-final"
            onClick={sendDataToMain}
            disabled={isSaving}
            style={{
              // left: '-000px',
              // marginTop: -10,
              width: '200px',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              backgroundColor: 'green',
              color: 'white',
              borderRadius: '30px',
              padding: '10px 20px',
              fontSize: '16px',
              // fontWeight: 'bold',
            }}
          >
            {saveButtonLabel}
          </Button>
          {saveStatus && (
            <span role="status" style={{ marginLeft: '12px' }}>
              {saveStatus}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default ManageElectrode;
