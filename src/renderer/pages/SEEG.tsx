import React, { useState, useContext, useEffect } from 'react';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  TextField,
  Button,
  Box,
  Grid,
  Paper,
  Typography,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import { makeStyles } from '@mui/styles';
import { PatientContext } from '../contexts/PatientContext';
import { useLocation, useNavigate } from 'react-router-dom';
import path from 'path';
import {
  createEmptyElectrodeSet,
  ElectrodeSet,
  parseElectrodeCSV,
} from '../utils/seegCsv';

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

interface ElectrodeProp {
  elname: string;
  elmodel: string;
  multiple_elmodel: string;
  labels: string[][];
}

interface ReconstructionData {
  props: ElectrodeProp[];
  native?: {
    coords_mm: number[][][];
  };
  scrf?: {
    coords_mm: number[][][];
  };
  mni?: {
    coords_mm: number[][][];
  };
  [key: string]: any;
}

interface SavedElectrodeCSV {
  electrodeName: string;
  CSV: string;
}

// Define styles for the grid and checkbox
const useStyles = makeStyles({
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    padding: '16px',
    minWidth: '400px',
  },
  checkboxLabel: {
    marginLeft: '8px',
    fontSize: '0.875rem',
    display: 'block',
    visibility: 'visible',
    opacity: 1,
  },
  sectionPaper: {
    padding: '24px',
    marginBottom: '24px',
  },
});

function SEEG({ directoryPath }) {
  // Extract data from location state
  const navigate = useNavigate();

  const [data, setData] = useState<ReconstructionData | null>(null);
  const [patientList, setPatientList] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [savedElectrodeCSVs, setSavedElectrodeCSVs] = useState<
    SavedElectrodeCSV[]
  >([]);

  useEffect(() => {
    const loadPatients = async () => {
      const patients = await window.electron.ipcRenderer.invoke(
        'load_patient_list',
        directoryPath,
      );
      console.log('Patient List: ', patients);
      setPatientList(patients);
    };
    loadPatients();
  }, [directoryPath]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const [reconstructionData, stimulationFiles] = await Promise.all([
        window.electron.ipcRenderer.invoke(
          'load_seeg_reco',
          directoryPath,
          selectedPatientId,
        ),
        window.electron.ipcRenderer.invoke(
          'load_seeg_stimulations',
          directoryPath,
          selectedPatientId,
        ),
      ]);

      if (!cancelled) {
        setData((reconstructionData as { reco: ReconstructionData }).reco);
        setSavedElectrodeCSVs(stimulationFiles as SavedElectrodeCSV[]);
      }
    };

    if (selectedPatientId) {
      setData(null);
      setSavedElectrodeCSVs([]);
      loadData();
    }

    return () => {
      cancelled = true;
    };
  }, [selectedPatientId, directoryPath]);

  const classes = useStyles();

  // Safely compute electrode names and models only when data is available
  const electrodeNames = data?.props?.map((item) => item.elname) || [];
  const electrodeModels = data?.props?.map((item) => item.multiple_elmodel) || [];

  const [selectedElectrode, setSelectedElectrode] = useState<string>('');

  // Initialize selectedPatientId when patientList loads
  useEffect(() => {
    if (patientList.length > 0 && !selectedPatientId) {
      const firstPatientId = patientList[0]?.id || '';
      if (firstPatientId) {
        setSelectedPatientId(firstPatientId);
      }
    }
  }, [patientList, selectedPatientId]);

  // Initialize selectedElectrode when data loads
  useEffect(() => {
    if (
      electrodeNames.length > 0 &&
      !electrodeNames.includes(selectedElectrode)
    ) {
      setSelectedElectrode(electrodeNames[0]);
    }
  }, [electrodeNames, selectedElectrode]);

  const handlePatientIdChange = (event: any) => {
    setSelectedPatientId(event.target.value);
  };

  const getNumberOfContacts = () => {
    const index = electrodeNames.indexOf(selectedElectrode);
    const model = electrodeModels[index];
    const match = model.match(/(\d+)AM$/);
    return match ? parseInt(match[1], 10) : 0;
  };

  // Function to generate contact names based on the number of contacts
  // const generateContactNames = () => {
  //   const numContacts = getNumberOfContacts();
  //   return Array.from({ length: numContacts }, (_, i) => `A${i + 1}`);
  // };

  // Example: Set contact names based on a specific electrode's number of contacts
  // const contactNames = generateContactNames(); // Replace 16 with the desired number of contacts

  const generateContactNames = () => {
    if (!data?.props || !selectedElectrode) return [];
    const index = electrodeNames.indexOf(selectedElectrode);
    if (index === -1) return [];
    return data.props[index]?.labels?.[0] || [];
  };

  function TriStateCheckbox({ value, onChange }) {
    // value: "none" | "plus" | "minus"
    const next = (curr) =>
      curr === "none" ? "plus" :
      curr === "plus" ? "minus" :
      "none";

    const handleClick = () => {
      onChange(next(value));
    };

    return (
      <Checkbox
        icon={<CropSquareIcon />}          // empty
        checkedIcon={<AddIcon />}          // +
        indeterminateIcon={<RemoveIcon />} // -
        checked={value === "plus"}
        indeterminate={value === "minus"}
        onChange={handleClick}
        color="primary"
      />
    );
  }


  const contactNames = generateContactNames();

  const [variableNames, setVariableNames] = useState([
    'Variable1',
    'Variable2',
  ]); // Example variable names

  // Initialize electrodeSets only when electrodeNames are available
  const [electrodeSets, setElectrodeSets] = useState<
    Record<string, ElectrodeSet[]>
  >({});

  // Initialize each electrode from its saved CSV, or use a blank set if no
  // saved stimulation file exists.
  useEffect(() => {
    if (!data?.props) return;

    const savedByElectrode = new Map(
      savedElectrodeCSVs.map((savedFile) => [
        savedFile.electrodeName,
        savedFile.CSV,
      ]),
    );
    const initialSets = data.props.reduce((acc, electrode) => {
      const labels = electrode.labels?.[0] || [];
      const savedCSV = savedByElectrode.get(electrode.elname);
      acc[electrode.elname] = savedCSV
        ? parseElectrodeCSV(savedCSV, labels)
        : [createEmptyElectrodeSet()];
      return acc;
    }, {} as Record<string, ElectrodeSet[]>);

    setElectrodeSets(initialSets);
  }, [data, savedElectrodeCSVs]);

  const handleElectrodeChange = (event) => {
    setSelectedElectrode(event.target.value);
  };

  // const handleContactChange = (index, event) => {
  //   const contact = event.target.name;
  //   setElectrodeSets((prevSets) => {
  //     const currentSet = prevSets[selectedElectrode][index];
  //     const updatedContacts = currentSet.contacts.includes(contact)
  //       ? currentSet.contacts.filter((c) => c !== contact)
  //       : [...currentSet.contacts, contact];
  //     const updatedSet = { ...currentSet, contacts: updatedContacts };
  //     const updatedSets = [...prevSets[selectedElectrode]];
  //     updatedSets[index] = updatedSet;
  //     return {
  //       ...prevSets,
  //       [selectedElectrode]: updatedSets,
  //     };
  //   });
  // };

  const handleContactTriStateChange = (setIndex, contact, nextValue) => {
    setElectrodeSets((prev) => {
      const currentSets = prev[selectedElectrode];
      const currentSet = currentSets[setIndex];

      // update contactStates with polarity info
      const updatedContactStates = {
        ...currentSet.contactStates,
        [contact]: nextValue,
      };

      // contacts should now only store the names that are active (plus/minus)
      const activatedContacts = Object.entries(updatedContactStates)
        .filter(([, val]) => val === "plus" || val === "minus")
        .map(([name]) => name); // only the name

      // build the updated set
      const updatedSet = {
        ...currentSet,
        contactStates: updatedContactStates, // e.g. { LACC1: "plus", LACC4: "minus" }
        contacts: activatedContacts,         // e.g. ["LACC1", "LACC4"]
      };

      // replace the set in the array
      const updatedSets = [...currentSets];
      updatedSets[setIndex] = updatedSet;

      // return the full structure
      return {
        ...prev,
        [selectedElectrode]: updatedSets,
      };
    });
  };

  const handleAmplitudeChange = (index, event) => {
    const value = event.target.value;
    setElectrodeSets((prevSets) => {
      const updatedSet = {
        ...prevSets[selectedElectrode][index],
        amplitude: value,
      };
      const updatedSets = [...prevSets[selectedElectrode]];
      updatedSets[index] = updatedSet;
      return {
        ...prevSets,
        [selectedElectrode]: updatedSets,
      };
    });
  };

  const handlePulseWidthChange = (index, event) => {
    const value = event.target.value;
    setElectrodeSets((prevSets) => {
      const updatedSet = {
        ...prevSets[selectedElectrode][index],
        pulseWidth: value,
      };
      const updatedSets = [...prevSets[selectedElectrode]];
      updatedSets[index] = updatedSet;
      return {
        ...prevSets,
        [selectedElectrode]: updatedSets,
      };
    });
  };

  const handleAmplitudeUnitChange = (index, event) => {
    const value = event.target.value;
    setElectrodeSets((prevSets) => {
      const updatedSet = {
        ...prevSets[selectedElectrode][index],
        amplitudeUnit: value,
      };
      const updatedSets = [...prevSets[selectedElectrode]];
      updatedSets[index] = updatedSet;
      return {
        ...prevSets,
        [selectedElectrode]: updatedSets,
      };
    });
  };

  const handleVariableValueChange = (index, varName, event) => {
    const value = event.target.value;
    setElectrodeSets((prevSets) => {
      const updatedVariableValues = {
        ...prevSets[selectedElectrode][index].variableValues,
        [varName]: value,
      };
      const updatedSet = {
        ...prevSets[selectedElectrode][index],
        variableValues: updatedVariableValues,
      };
      const updatedSets = [...prevSets[selectedElectrode]];
      updatedSets[index] = updatedSet;
      return {
        ...prevSets,
        [selectedElectrode]: updatedSets,
      };
    });
  };

  const addSet = () => {
    setElectrodeSets((prevSets) => ({
      ...prevSets,
      [selectedElectrode]: [
        ...prevSets[selectedElectrode],
        {
          contacts: [],
          contactStates: {},
          amplitude: '',
          amplitudeUnit: 'mA',
          pulseWidth: '',
          variableValues: {},
        },
      ],
    }));
  };

  const removeSet = (index) => {
    setElectrodeSets((prevSets) => {
      const updatedSets = prevSets[selectedElectrode].filter(
        (_, i) => i !== index,
      );
      return {
        ...prevSets,
        [selectedElectrode]: updatedSets,
      };
    });
  };

  const addVariableName = () => {
    setVariableNames((prevNames) => [
      ...prevNames,
      `Variable${prevNames.length + 1}`,
    ]);
  };

  const saveTSV = (coordinateSpace: 'native' | 'scrf' | 'mni' = 'native') => {
    if (!data?.props) return '';

    const tsvData = [];

    // Header row
    tsvData.push(['name', 'x', 'y', 'z', 'size', 'group', 'type', 'electrode', 'Electrode_ID']);

    // Get coordinate data from the specified space
    const coordsData = data[coordinateSpace]?.coords_mm || [];

    // Iterate through each electrode
    data.props.forEach((electrode, electrodeIndex) => {
      const electrodeName = electrode.elname;
      const electrodeModel = electrode.elmodel;
      const contactLabels = electrode.labels?.[0] || [];
      const electrodeCoords = coordsData[electrodeIndex] || [];

      // Create a row for each contact
      contactLabels.forEach((contactName, contactIndex) => {
        const coords = electrodeCoords[contactIndex] || [0, 0, 0];
        const [x, y, z] = coords;

        // Extract group name from electrode name (e.g., "ELECA" -> "ELECA", or could be derived differently)
        const group = electrodeName;

        tsvData.push([
          contactName,           // name
          x.toString(),          // x
          y.toString(),          // y
          z.toString(),          // z
          'n/a',                 // size
          group,                 // group
          'depth',               // type
          electrodeModel,        // electrode
          (electrodeIndex + 1).toString() // Electrode_ID
        ]);
      });
    });

    // Convert to TSV string
    const tsvString = tsvData.map(row => row.join('\t')).join('\n');
    // console.log("tsvString: ", tsvData);
    return tsvString;
  };

  const saveElectrodeConfigToCSV = () => {
    if (!data?.props) return;

    const electrodeCSVs = data.props.map((electrode) => {
      const labels = electrode.labels?.[0] || [];
      const csvData = [labels];

      // Build one row per stimulation set for this electrode.
      const sets = electrodeSets[electrode.elname] || [];
      sets.forEach((set) => {
        const amp = set.amplitude ?? '';
        const row = labels.map((label) => {
          const polarity = set.contactStates?.[label];
          if (polarity === 'plus') return `+${amp}`;
          if (polarity === 'minus') return `-${amp}`;
          return 'None';
        });
        csvData.push(row);
      });

      return {
        electrodeName: electrode.elname,
        CSV: csvData.map((row) => row.join(',')).join('\n'),
      };
    });

    const tsvString = saveTSV();
    window.electron.ipcRenderer.sendMessage('save-file-seeg', {
      TSV: tsvString,
      electrodeCSVs,
      directoryPath: directoryPath,
      selectedPatientId: selectedPatientId,
    });
  };

  // Show loading state while data is being fetched
  if (!data) {
    return <div>Loading...</div>;
  }

  // Extract patient IDs from patientList
  const patientIds = patientList.map((patient) => patient.id).filter(Boolean);

  return (
    <Box sx={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header Section - Patient and Electrode Selection */}
      <Paper className={classes.sectionPaper} elevation={2}>
        <Typography variant="h6" gutterBottom>
          Configuration
        </Typography>
        <Divider sx={{ marginBottom: '20px' }} />
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel id="patient-id-select-label">Select Patient</InputLabel>
              <Select
                labelId="patient-id-select-label"
                id="patient-id-select"
                value={selectedPatientId}
                label="Select Patient"
                onChange={handlePatientIdChange}
              >
                {patientIds.map((patientId) => (
                  <MenuItem key={patientId} value={patientId}>
                    {patientId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth>
              <InputLabel id="electrode-select-label">Choose an Electrode</InputLabel>
              <Select
                labelId="electrode-select-label"
                id="electrode-select"
                value={selectedElectrode}
                label="Choose an Electrode"
                onChange={handleElectrodeChange}
              >
                {electrodeNames.map((electrode, index) => (
                  <MenuItem key={electrode} value={electrode}>
                    {electrode} - {electrodeModels[index]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Variables Section */}
      <Paper className={classes.sectionPaper} elevation={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Typography variant="h6">Custom Variables</Typography>
          <Button onClick={addVariableName} variant="contained" color="primary" size="small">
            Add Variable
          </Button>
        </Box>
        <Divider sx={{ marginBottom: '20px' }} />
        <Grid container spacing={2}>
          {variableNames.map((varName, varIndex) => (
            <Grid item xs={12} sm={6} md={4} key={varIndex}>
              <TextField
                fullWidth
                label={`Variable Name ${varIndex + 1}`}
                value={varName}
                onChange={(event) => {
                  const newName = event.target.value;
                  setVariableNames((prevNames) => {
                    const updatedNames = [...prevNames];
                    updatedNames[varIndex] = newName;
                    return updatedNames;
                  });
                }}
                margin="normal"
              />
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Stimulation Sets Section */}
      <Paper className={classes.sectionPaper} elevation={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <Typography variant="h6">Stimulation Sets</Typography>
          <Button onClick={addSet} variant="contained" color="primary" size="small">
            Add Set
          </Button>
        </Box>
        <Divider sx={{ marginBottom: '20px' }} />

        {electrodeSets[selectedElectrode]?.map((set, index) => (
          <Box key={index} sx={{ marginBottom: '32px', padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', backgroundColor: '#fafafa' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Set {index + 1}
              </Typography>
              <Button
                onClick={() => removeSet(index)}
                variant="contained"
                color="secondary"
                size="small"
                disabled={electrodeSets[selectedElectrode].length === 1}
              >
                Remove
              </Button>
            </Box>

            {/* Contact Selection - Dropdown */}
            <Grid container spacing={2} sx={{ marginTop: '16px' }}>
              <Grid item xs={12}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id={`contact-select-label-${index}`}>
                    Select Contacts
                  </InputLabel>
                  <Select
                    labelId={`contact-select-label-${index}`}
                    id={`contact-select-${index}`}
                    multiple
                    value={set.contacts}
                    renderValue={(selected) => {
                      if (selected.length === 0) return 'No contacts selected';
                      return selected.join(', ');
                    }}
                    MenuProps={{
                      PaperProps: {
                        style: {
                          maxHeight: 400,
                          width: 'auto',
                          minWidth: 300,
                        },
                      },
                    }}
                  >
                    <div className={classes.gridContainer}>
                      {contactNames.map((contact) => (
                        <FormControlLabel
                          key={contact}
                          control={
                            <TriStateCheckbox
                              value={set.contactStates?.[contact] || "none"}
                              onChange={(nextValue) =>
                                handleContactTriStateChange(index, contact, nextValue)
                              }
                            />
                          }
                          label={<span style={{ marginLeft: '8px', fontSize: '0.875rem', color: 'black' }}>{contact}</span>}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ))}
                    </div>
                  </Select>
                </FormControl>
              </Grid>

              {/* Stimulation Parameters */}
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label={`Amplitude (${set.amplitudeUnit})`}
                  value={set.amplitude}
                  onChange={(event) => handleAmplitudeChange(index, event)}
                  margin="normal"
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id={`amplitude-unit-select-label-${index}`}>
                    Amplitude Unit
                  </InputLabel>
                  <Select
                    labelId={`amplitude-unit-select-label-${index}`}
                    id={`amplitude-unit-select-${index}`}
                    value={set.amplitudeUnit}
                    onChange={(event) => handleAmplitudeUnitChange(index, event)}
                  >
                    <MenuItem value="mA">mA</MenuItem>
                    <MenuItem value="V">V</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="Pulse Width"
                  value={set.pulseWidth}
                  onChange={(event) => handlePulseWidthChange(index, event)}
                  margin="normal"
                />
              </Grid>
            </Grid>

            {/* Variable Values */}
            {variableNames.length > 0 && (
              <Box sx={{ marginTop: '16px' }}>
                <Typography variant="subtitle2" gutterBottom sx={{ marginBottom: '12px', fontWeight: 'bold' }}>
                  Variable Values
                </Typography>
                <Grid container spacing={2}>
                  {variableNames.map((varName, varIndex) => (
                    <Grid item xs={12} sm={6} md={4} key={varIndex}>
                      <TextField
                        fullWidth
                        label={`Value for ${varName}`}
                        value={set.variableValues[varName] || ''}
                        onChange={(event) => handleVariableValueChange(index, varName, event)}
                        margin="normal"
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        ))}
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px', marginBottom: '80px' }}>
        <Button
          variant="outlined"
          onClick={() => navigate(-1)}
        >
          ← Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={saveElectrodeConfigToCSV}
        >
          Save All Electrode Configurations
        </Button>
      </Box>
    </Box>
  );
}

export default SEEG;
