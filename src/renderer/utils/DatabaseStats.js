import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import Dropdown from 'react-bootstrap/Dropdown';
import VisibilityIcon from '@mui/icons-material/Visibility';
import {
  Slider,
  TextField,
  Select,
  MenuItem,
  Button,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ReorderIcon from '@mui/icons-material/Reorder';
import * as XLSX from 'xlsx';
import * as nifti from 'nifti-reader-js';
import { Niivue, SLICE_TYPE } from '@niivue/niivue';
import DatabasePlot from '../components/analysis/DatabasePlot';
import GroupAveragePlot from '../components/group/GroupAveragePlot';
import { PatientContext } from '../contexts/PatientContext';
import GroupLateralityAnalysisPlot from '../components/group/GroupLateralityAnalysisPlot';
import GroupSubscoreAnalysisPlot from '../components/group/GroupSubscoreAnalysisPlot';
import CombinedPlot from '../components/analysis/CombinedPlot';
import '../styles/DatabaseStats.css'; // Ensure this CSS file is correctly linked
import { optimizeDatabase } from './OptimizeDatabase';
import electrodeModels from '../assets/data/electrodeModels.json';
import * as math from 'mathjs';
import GroupViewer from '../components/group/GroupViewer';
import Raincloud from '../components/analysis/Raincloud';

function DatabaseStats({ directoryPath }) {
  const { patients } = useContext(PatientContext);
  const [filteredPatients, setFilteredPatients] = useState(patients);
  const navigate = useNavigate();
  const [analysisType, setAnalysisType] = useState('raincloud');
  const [clinicalTimelines, setClinicalTimelines] = useState(null);
  const [clinicalData, setClinicalData] = useState(null);
  const [clinicalDataForPlotting, setClinicalDataForPlotting] = useState(null);
  const [ageRange, setAgeRange] = useState([0, 100]);
  const [gender, setGender] = useState('all');
  const [sortField, setSortField] = useState('age');
  const [sortDirection, setSortDirection] = useState('asc');
  const [displayedPatients, setDisplayedPatients] = useState([]);
  const [filters, setFilters] = useState({});
  const [scoretype, setScoretype] = useState('UPDRS');
  const [scoreTypes, setScoreTypes] = useState(['UPDRS', 'Y-BOCS']); // Default score types
  const [reorderDialogOpen, setReorderDialogOpen] = useState(false);
  const [customTimelineOrder, setCustomTimelineOrder] = useState(null);

  console.log('Patients for real: ', patients);
  useEffect(() => {
    if (directoryPath && filteredPatients.length > 0) {
      const timelinePromises = filteredPatients.map((patient) =>
        window.electron.ipcRenderer.invoke(
          'get-timelines',
          directoryPath,
          patient.id,
          true,
        ),
      );
      Promise.all(timelinePromises)
        .then((allReceivedTimelines) => {
          const allFilteredTimelineNames = allReceivedTimelines.map(
            (receivedTimelines) =>
              receivedTimelines
                .filter((timelineData) => timelineData.hasClinical)
                .map((timelineData) => timelineData.timeline),
          );

          const patientsArray = filteredPatients;
          const patientsWithTimelines = patientsArray.map((patient, index) => ({
            id: patient.id,
            timelines: allFilteredTimelineNames[index] || [],
          }));
          console.log(patientsWithTimelines);
          return setClinicalTimelines(patientsWithTimelines);
        })
        .catch((error) => {
          console.error('Error fetching timelines for all patients:', error);
        });
    }
  }, [directoryPath, filteredPatients]);

  useEffect(() => {
    if (clinicalTimelines) {
      console.log('Clinical Timelines: ', clinicalTimelines);
      window.electron.ipcRenderer
        .invoke('get-clinical-data', directoryPath, clinicalTimelines)
        .then((clinicalData) => {
          setClinicalData(clinicalData);
          setClinicalDataForPlotting(clinicalData);
          // window.electron.ipcRenderer.sendMessage('download-clinical-data', clinicalData);
          return clinicalData;
        })
        .catch((error) => {
          console.error('Error retrieving clinical data:', error);
        });
    }
  }, [clinicalTimelines]);

  // useEffect(() => {
  //   window.electron.ipcRenderer
  //     .invoke('get-clinical-data-for-plotting', 'test')
  //     .then((clinicalData) => {
  //       setClinicalData(clinicalData);
  //       setClinicalDataForPlotting(clinicalData);
  //     })
  //     .catch((error) => {
  //       console.error('Error retrieving clinical data:', error);
  //     });
  // }, []);

  useEffect(() => {
    let filtered = patients.filter((patient) => {
      const inAgeRange =
        patient.age >= ageRange[0] && patient.age <= ageRange[1];
      const matchesGender = gender === 'all' || patient.gender === gender;
      return inAgeRange && matchesGender;
    });

    filtered = filtered.sort((a, b) => {
      const compareA = a[sortField];
      const compareB = b[sortField];
      if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    setDisplayedPatients(filtered);
    setFilteredPatients(filtered);
  }, [patients, ageRange, gender, sortField, sortDirection]);

  const handleExportToExcel = () => {
    const exportData = [];

    clinicalDataForPlotting.forEach((patientData) => {
      const { id, clinicalData } = patientData;

      Object.keys(clinicalData).forEach((timeline) => {
        const timelineData = clinicalData[timeline];

        exportData.push({
          PatientID: id,
          Timeline: timeline,
          ...timelineData,
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Clinical Data');
    XLSX.writeFile(workbook, 'ClinicalData.xlsx');
  };

  const handleAnalysisChange = (e) => {
    setAnalysisType(e.target.value);
  };

  // const detectAttributeTypes = () => {
  //   if (patients.length === 0) return {};

  //   const samplePatient = patients[0];
  //   const attributeTypes = {};
  //   console.log('Sample Patient: ', samplePatient);
  //   Object.keys(samplePatient).forEach((key) => {
  //     const value = samplePatient[key];
  //     console.log('Value: ', value);
  //     if (typeof value === 'number' || !isNaN(parseFloat(value))) {
  //       attributeTypes[key] = 'number';
  //     } else if (typeof value === 'string') {
  //       attributeTypes[key] = 'string';
  //     }
  //     // Add more type checks as needed
  //   });

  //   return attributeTypes;
  // };

  const detectAttributeTypes = () => {
    if (patients.length === 0) return {};

    const attributeTypes = {};
    patients.forEach((patient) => {
      Object.keys(patient).forEach((key) => {
        const value = patient[key];
        if (key === 'PatientID' || key === 'DOB' || key === 'City ') {
          return;
        }
        if (key === 'DOIs') {
          attributeTypes[key] = 'string';
          return;
        }
        if (typeof value === 'number' || !isNaN(parseFloat(value))) {
          attributeTypes[key] = 'number';
        } else if (typeof value === 'string') {
          attributeTypes[key] = 'string';
        }
        // Add more type checks as needed
      });
    });

    return attributeTypes;
  };

  const generateFilterUI = () => {
    const attributeTypes = detectAttributeTypes();
    const uniqueValues = {};

    // Collect unique values for string attributes
    patients.forEach((patient) => {
      Object.keys(attributeTypes).forEach((key) => {
        if (attributeTypes[key] === 'string') {
          if (!uniqueValues[key]) {
            uniqueValues[key] = new Set();
          }
          uniqueValues[key].add(patient[key]);
        }
      });
    });

    return (
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 2,
        }}
      >
        {Object.keys(attributeTypes).map((key) => {
          const type = attributeTypes[key];
          if (type === 'number') {
            return (
              <Box key={key} className="filter-group" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontSize: '0.8rem' }}>
                  {key}:
                </Typography>
                <Slider
                  value={filters[key] || [0, 120]}
                  onChangeCommitted={(e, newValue) =>
                    setFilters((prev) => ({
                      ...prev,
                      [key]: newValue,
                    }))
                  }
                  valueLabelDisplay="auto"
                  min={0}
                  max={120}
                  sx={{ mt: 1 }}
                />
              </Box>
            );
          }
          if (type === 'string') {
            return (
              <Box key={key} className="filter-group" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontSize: '0.8rem' }}>
                  {key}:
                </Typography>
                <TextField
                  value={filters[key] || ''}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setFilters((prev) => ({
                      ...prev,
                      [key]: newValue,
                    }));
                  }}
                  onBlur={(e) => {
                    const newValue = e.target.value;
                    setFilters((prev) => {
                      const updatedFilters = { ...prev };
                      if (newValue === '') {
                        delete updatedFilters[key];
                      } else {
                        updatedFilters[key] = newValue;
                      }
                      return updatedFilters;
                    });
                  }}
                  variant="outlined"
                  fullWidth
                  placeholder="none"
                  sx={{ mt: 1 }}
                />
              </Box>
            );
          }
          return null;
        })}
      </Box>
    );
  };

  // const generateFilterUI = () => {
  //   const attributeTypes = detectAttributeTypes();
  //   return Object.keys(attributeTypes).map((key) => {
  //     const type = attributeTypes[key];
  //     if (type === 'number') {
  //       return (
  //         <Box key={key} className="filter-group" sx={{ mb: 2 }}>
  //           <Typography variant="subtitle1">{key}:</Typography>
  //           <Slider
  //             value={filters[key] || [0, 100]}
  //             onChange={(e, newValue) =>
  //               setFilters((prev) => ({
  //                 ...prev,
  //                 [key]: newValue,
  //               }))
  //             }
  //             valueLabelDisplay="auto"
  //             min={0}
  //             max={100}
  //           />
  //         </Box>
  //       );
  //     } else if (type === 'string') {
  //       return (
  //         <Box key={key} className="filter-group" sx={{ mb: 2 }}>
  //           <Typography variant="subtitle1">{key}:</Typography>
  //           <TextField
  //             value={filters[key] || ''}
  //             onChange={(e) =>
  //               setFilters((prev) => ({
  //                 ...prev,
  //                 [key]: e.target.value,
  //               }))
  //             }
  //             variant="outlined"
  //             fullWidth
  //           />
  //         </Box>
  //       );
  //     }
  //     return null;
  //   });
  // };

  const applyFilters = (filters) => {
    console.log('Filters:', filters);
    return patients.filter((patient) => {
      return Object.keys(filters).every((key) => {
        const filter = filters[key];
        const value = patient[key];

        if (value === undefined || value === null) {
          return false; // Exclude patients without information for the key
        }

        if (typeof filter === 'object') {
          // Numeric filter
          const [min, max] = filter;
          return (
            (min === undefined || value >= min) &&
            (max === undefined || value <= max)
          );
        }
        // String filter
        return value.toLowerCase().includes(filter.toLowerCase());
      });
    });
  };

  useEffect(() => {
    const filtered = applyFilters(filters);
    console.log('Filtered Patients:', filtered);
    setFilteredPatients(filtered);
    setDisplayedPatients(filtered);
    // Filter clinical data based on filtered patients
    if (clinicalData) {
      const filteredClinicalData = clinicalData.filter((data) =>
        filtered.some((patient) => patient.id === data.id),
      );
      setClinicalDataForPlotting(filteredClinicalData);
    }
  }, [filters]);

  useEffect(() => {
    if (clinicalDataForPlotting) {
      // Extract unique score types from clinical data
      console.log('Clinical Data For Plotting: ', clinicalDataForPlotting);
      const uniqueScoreTypes = new Set();
      clinicalData.forEach((patientData) => {
        Object.keys(patientData.clinicalData).forEach((timeline) => {
          const timelineData = patientData.clinicalData[timeline];
          Object.keys(timelineData).forEach((scoreType) => {
            uniqueScoreTypes.add(scoreType);
          });
        });
      });
      setScoreTypes(Array.from(uniqueScoreTypes));
    }
  }, [clinicalDataForPlotting]);

  const handleNiiUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) {
        throw new Error('No file selected');
      }

      // Read the file as an ArrayBuffer
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileData = e.target.result;

          // Validate if the file is a valid NIfTI file
          if (!nifti.isNIFTI(fileData)) {
            throw new Error('File is not a valid NIfTI file');
          }

          const header = nifti.readHeader(fileData);
          let image = nifti.readImage(header, fileData);
          console.log('Header: ', header);
          // Ensure `image` is a valid ArrayBuffer
          if (!(image instanceof ArrayBuffer)) {
            console.log('Adjusting image to ArrayBuffer...');
            image = new Uint8Array(image).buffer;
          }

          // Handle endian mismatch
          if (!header.littleEndian) {
            console.warn('File is in big-endian format. Adjusting...');
            const dataView = new DataView(image);
            const correctedData = new Float32Array(image.byteLength / 4);
            for (let i = 0; i < correctedData.length; i++) {
              correctedData[i] = dataView.getFloat32(i * 4, false); // false = big-endian
            }
            image = correctedData;
          } else {
            image = new Float32Array(image);
          }

          // Apply scaling factors
          const { scl_slope = 1, scl_inter = 0 } = header;
          const img = new Float32Array(
            image.map((value) => value * scl_slope + scl_inter),
          );

          // Extract dimensions
          const dimensions = header.dims.slice(1, 4);
          console.log('Dimensions:', dimensions);

          // Generate voxel coordinates
          const voxelCoordinates = [];
          img.forEach((value, index) => {
            if (!isNaN(value)) {
              const z = Math.floor(index / (dimensions[0] * dimensions[1]));
              const y = Math.floor(
                (index % (dimensions[0] * dimensions[1])) / dimensions[0],
              );
              const x = index % dimensions[0];
              voxelCoordinates.push([x, y, z, value]);
            }
          });

          console.log('Voxel Coordinates:', voxelCoordinates);

          // Transform to MNI coordinates using affine matrix
          const affineMatrix = header.affine;
          const mniCoordinates = voxelCoordinates.map(([x, y, z, value]) => {
            const voxelHomogeneous = [x, y, z, 1]; // Add 1 for homogeneous transformation
            const transformedVoxels = math.multiply(
              affineMatrix,
              voxelHomogeneous,
            );
            const [wx, wy, wz] = transformedVoxels.slice(0, 3);
            return [wx, wy, wz, value];
          });

          console.log('MNI Coordinates:', mniCoordinates);

          // plotNifti(mniCoordinates);
          // Set the state with the transformed coordinates
          // setNiiCoords(mniCoordinates);
          // handleNiiMap(mniCoordinates);
          optimizeDatabase(
            patients,
            directoryPath,
            electrodeModels,
            mniCoordinates,
          );
          // return mniCoordinates;
          // setIsLoading(false); // Hide spinner
        } catch (error) {
          console.error('Error processing NIfTI file:', error);
          // setIsLoading(false); // Hide spinner
        }
      };

      reader.onerror = () => {
        console.error('Failed to read file');
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error loading NIfTI file:', error);
    }
  };

  const handleOptimizeDatabase = () => {
    const niiCoords = handleNiiUpload();
    optimizeDatabase(patients, directoryPath, electrodeModels, niiCoords);
  };

  const [showGroupViewer, setShowGroupViewer] = useState(false);

  // Get all available timelines from clinical data
  const getAllTimelines = () => {
    if (!clinicalDataForPlotting || clinicalDataForPlotting.length === 0) {
      return [];
    }
    const timelines = new Set();
    clinicalDataForPlotting.forEach((patientData) => {
      Object.keys(patientData.clinicalData).forEach((timeline) => {
        if (patientData.clinicalData[timeline]?.[scoretype] !== undefined) {
          timelines.add(timeline);
        }
      });
    });
    return Array.from(timelines);
  };

  // Get default sorted timelines
  const getDefaultSortedTimelines = (timelines) => {
    return [...timelines].sort((a, b) => {
      if (a === 'baseline') return -1;
      if (b === 'baseline') return 1;

      const aIsDay = a.includes('day');
      const bIsDay = b.includes('day');
      const aIsMonth = a.includes('month');
      const bIsMonth = b.includes('month');
      const aIsYear = a.includes('year');
      const bIsYear = b.includes('year');

      if (aIsDay && !bIsDay) return -1;
      if (!aIsDay && bIsDay) return 1;
      if (aIsMonth && !bIsMonth) return -1;
      if (!aIsMonth && bIsMonth) return 1;
      if (aIsYear && !bIsYear) return 1;
      if (!aIsYear && bIsYear) return -1;

      return a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  };

  // Initialize timeline order when dialog opens
  const handleOpenReorderDialog = () => {
    const timelines = getAllTimelines();
    if (timelines.length === 0) {
      setReorderDialogOpen(true);
      return;
    }
    const defaultOrder = getDefaultSortedTimelines(timelines);
    // If custom order exists and has the same timelines, use it; otherwise use default
    if (customTimelineOrder && customTimelineOrder.length > 0) {
      // Check if custom order needs updating (new timelines added)
      const customSet = new Set(customTimelineOrder);
      const timelineSet = new Set(timelines);
      const hasNewTimelines = timelines.some(t => !customSet.has(t));
      if (!hasNewTimelines) {
        setReorderDialogOpen(true);
        return;
      }
    }
    setCustomTimelineOrder(defaultOrder);
    setReorderDialogOpen(true);
  };

  // Handle moving timeline up
  const handleMoveUp = (index) => {
    if (index === 0) return;
    const newOrder = [...customTimelineOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setCustomTimelineOrder(newOrder);
  };

  // Handle moving timeline down
  const handleMoveDown = (index) => {
    if (index === customTimelineOrder.length - 1) return;
    const newOrder = [...customTimelineOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setCustomTimelineOrder(newOrder);
  };

  // Reset to default order
  const handleResetOrder = () => {
    const timelines = getAllTimelines();
    const defaultOrder = getDefaultSortedTimelines(timelines);
    setCustomTimelineOrder(defaultOrder);
  };

  // Get the timeline order to use (custom or default)
  const getTimelineOrder = () => {
    if (customTimelineOrder && customTimelineOrder.length > 0) {
      return customTimelineOrder;
    }
    const timelines = getAllTimelines();
    return getDefaultSortedTimelines(timelines);
  };

  const renderAnalysis = () => {
    const timelineOrder = getTimelineOrder();
    switch (analysisType) {
      case 'raincloud':
        return (
          <DatabasePlot
            clinicalData={clinicalDataForPlotting}
            scoretype={scoretype}
            timelineOrder={timelineOrder}
          />
        );
      case 'average':
        return (
          <GroupAveragePlot
            clinicalData={clinicalDataForPlotting}
            scoretype={scoretype}
            timelineOrder={timelineOrder}
          />
        );
      case 'laterality':
        return (
          <GroupLateralityAnalysisPlot
            clinicalData={clinicalDataForPlotting}
            timelineOrder={timelineOrder}
          />
        );
      case 'subscore':
        return (
          <GroupSubscoreAnalysisPlot
            clinicalData={clinicalDataForPlotting}
            timelineOrder={timelineOrder}
          />
        );
      case 'all':
        return (
          <div className="analysis-container" style={{ height: '1000px' }}>
            {/* <CombinedPlot
              clinicalData={clinicalDataForPlotting}
              scoretype={scoretype}
            /> */}
            <div style={{ scale: 2 }}>
              {' '}
              {/* Adjust width and height as needed */}
              <Raincloud
                clinicalData={clinicalDataForPlotting}
                scoretype={scoretype}
                timelineOrder={timelineOrder}
              />
            </div>
            {/* {scoretype === 'UPDRS' && (
              <>
                <GroupLateralityAnalysisPlot
                  clinicalData={clinicalDataForPlotting}
                  scoretype={scoretype}
                />
                <GroupSubscoreAnalysisPlot
                  clinicalData={clinicalDataForPlotting}
                  scoretype={scoretype}
                />
              </>
            )} */}
          </div>
        );
      case 'new':
        return (
          <CombinedPlot
            clinicalData={clinicalDataForPlotting}
            scoretype={scoretype}
            timelineOrder={timelineOrder}
          />
        );
      default:
        return <p>Please select an analysis type.</p>;
    }
  };

  return (
    <div className="database-stats-container">
      <HomeIcon onClick={() => navigate('/')} className="home-icon" />
      {/* <div className="filter-controls">
        <div className="filter-group">
          <h3>Age Range:</h3>
          <input
            type="number"
            value={ageRange[0]}
            onChange={(e) => setAgeRange([Number(e.target.value), ageRange[1]])}
            className="age-input"
          />
          <span>to</span>
          <input
            type="number"
            value={ageRange[1]}
            onChange={(e) => setAgeRange([ageRange[0], Number(e.target.value)])}
            className="age-input"
          />
        </div>

        <div className="filter-group">
          <h3 style={{ fontSize: '10px' }}>Gender:</h3>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="gender-select"
          >
            <option value="all">All</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div> */}
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="filter-controls-content"
          id="filter-controls-header"
        >
          <Typography>Filters</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div className="filter-controls">{generateFilterUI()}</div>
        </AccordionDetails>
      </Accordion>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="patient-list-content"
          id="patient-list-header"
        >
          <Typography>Patient List</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <div className="patient-list">
            <ul>
              {displayedPatients.map((patient, index) => (
                <li key={index}>
                  {Object.entries(patient).map(([key, value]) => (
                    <p key={key}>
                      <strong>
                        {key.charAt(0).toUpperCase() + key.slice(1)}:
                      </strong>{' '}
                      {value}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        </AccordionDetails>
      </Accordion>
      <div>
        {/* <Select
          value={scoretype}
          onChange={(e) => setScoretype(e.target.value)}
          className="analysis-select"
        >
          <MenuItem value="UPDRS">UPDRS</MenuItem>
          <MenuItem value="Y-BOCS">Y-BOCS</MenuItem>
        </Select> */}
      </div>
      {clinicalDataForPlotting && filteredPatients && (
        <div className="analysis-section">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Select
              value={scoretype}
              onChange={(e) => setScoretype(e.target.value)}
              className="analysis-select"
            >
              {scoreTypes.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
            <Button
              variant="outlined"
              startIcon={<ReorderIcon />}
              onClick={handleOpenReorderDialog}
              size="small"
            >
              Reorder Timelines
            </Button>
          </div>
          {/* <select
              value={analysisType}
              onChange={handleAnalysisChange}
              className="analysis-select"
            >
              <option value="none">Choose an option</option>
              <option value="new">Trendlines</option>
              <option value="laterality">Laterality Analysis</option>
              <option value="subscore">Subscores</option>
              <option value="all">View All Plots</option>
            </select> */}
          {renderAnalysis()}
          {/* <Raincloud
              clinicalData={clinicalDataForPlotting}
              scoretype={scoretype}
            /> */}
        </div>
      )}
      <button
        onClick={handleExportToExcel}
        className="export-button"
        style={{ float: 'right' }}
      >
        Export to Excel
      </button>

      {/* <button onClick={handleNiiUpload} className="export-button">
        Calculate stimulation parameters
      </button> */}
      {/* <Button
        variant="primary"
        onClick={() => document.getElementById('nifti-upload').click()}
        className="mb-4 mx-2"
      >
        Import NIfTI File and Provide Solution
      </Button>
      <input
        id="nifti-upload"
        type="file"
        style={{ display: 'none' }}
        accept=".nii"
        onChange={(e) => handleNiiUpload(e)}
      /> */}
      <VisibilityIcon
        onClick={() => setShowGroupViewer((prev) => !prev)}
        style={{
          cursor: 'pointer',
          // padding: '10px',
          borderRadius: '8px',
          backgroundColor: '#f0f0f0',
          transition: 'background-color 0.3s',
        }}
        onMouseEnter={(e) => (e.target.style.backgroundColor = '#e0e0e0')}
        onMouseLeave={(e) => (e.target.style.backgroundColor = '#f0f0f0')}
      />
      {showGroupViewer && (
        <div>
          {filteredPatients && (
            <GroupViewer
              filteredPatients={filteredPatients}
              directoryPath={directoryPath}
              filters={filters}
            />
          )}
        </div>
      )}
      {/* <div style={{ padding: '20px', borderRadius: '8px', marginTop: '150px' }}>
        {filteredPatients && (
          <GroupViewer
            filteredPatients={filteredPatients}
            directoryPath={directoryPath}
          />
        )}
      </div> */}

      {/* {filteredPatients && (
        <GroupViewer
          filteredPatients={filteredPatients}
          directoryPath={directoryPath}
        />
      )} */}

      {/* Reorder Timelines Dialog */}
      <Dialog
        open={reorderDialogOpen}
        onClose={() => setReorderDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reorder Timelines</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Drag timelines up or down to reorder them. The order will be applied to all plots.
          </Typography>
          {customTimelineOrder && customTimelineOrder.length > 0 ? (
            <List>
              {customTimelineOrder.map((timeline, index) => (
                <ListItem
                  key={timeline}
                  sx={{
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    mb: 1,
                    backgroundColor: '#fafafa',
                  }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <IconButton
                        edge="end"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        size="small"
                      >
                        <ArrowUpwardIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === customTimelineOrder.length - 1}
                        size="small"
                      >
                        <ArrowDownwardIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemText
                    primary={timeline}
                    primaryTypographyProps={{
                      fontWeight: index === 0 ? 'bold' : 'normal',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography>No timelines available</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleResetOrder}>Reset to Default</Button>
          <Button onClick={() => setReorderDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={() => setReorderDialogOpen(false)}
            variant="contained"
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}

export default DatabaseStats;
