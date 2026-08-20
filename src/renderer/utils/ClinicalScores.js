/* eslint-disable jsx-a11y/mouse-events-have-key-events */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Table, Container, Dropdown } from 'react-bootstrap';
import Modal from 'react-bootstrap/Modal';
import * as XLSX from 'xlsx';
// import './electrode_models/currentModels/ElecModelStyling/boston_vercise_directed.css';
import PairedTTestComponent from '../components/analysis/PairedTTestComponent';
import BoxPlotComponent from '../components/analysis/BoxPlotComponent';
import UPDRSAnalysisComponent from '../components/analysis/UPDRSAnalysisComponent';
import '../assets/icons/icons.css';

// Use direct file paths - no webpack processing needed
// These are just image files that can be loaded directly

function ClinicalScores() {
  const location = useLocation();
  const { patient, timeline, directoryPath, leadDBS } = location.state || {};
  const navigate = useNavigate(); // Initialize the navigate hook

  const UPDRS = {
    '3.1: Speech': 0,
    '3.2: Facial expression': 0,
    '3.3a: Rigidity- Neck': 0,
    '3.3b: Rigidity- RUE': 0,
    '3.3c: Rigidity- LUE': 0,
    '3.3d: Rigidity- RLE': 0,
    '3.3e: Rigidity- LLE': 0,
    '3.4a: Finger tapping- Right hand': 0,
    '3.4b: Finger tapping- Left hand': 0,
    '3.5a: Hand movements- Right hand': 0,
    '3.5b: Hand movements- Left hand': 0,
    '3.6a: Pronation- supination movements- Right hand': 0,
    '3.6b: Pronation- supination movements- Left hand': 0,
    '3.7a: Toe tapping- Right foot': 0,
    '3.7b: Toe tapping- Left foot': 0,
    '3.8a: Leg agility- Right leg': 0,
    '3.8b: Leg agility- Left leg': 0,
    '3.9: Arising from chair': 0,
    '3.10: Gait': 0,
    '3.11: Freezing of gait': 0,
    '3.12: Postural stability': 0,
    '3.13: Posture': 0,
    '3.14: Global spontaneity of movement': 0,
    '3.15a: Postural tremor- Right hand': 0,
    '3.15b: Postural tremor- Left hand': 0,
    '3.16a: Kinetic tremor- Right hand': 0,
    '3.16b: Kinetic tremor- Left hand': 0,
    '3.17a: Rest tremor amplitude- RUE': 0,
    '3.17b: Rest tremor amplitude- LUE': 0,
    '3.17c: Rest tremor amplitude- RLE': 0,
    '3.17d: Rest tremor amplitude- LLE': 0,
    '3.17e: Rest tremor amplitude- Lip/jaw': 0,
    '3.18: Constancy of rest tremor': 0,
  };
  const [totalScores, setTotalScores] = useState();
  const [scoreTypes, setScoreTypes] = useState([]);
  const [selectedScoreType, setSelectedScoreType] = useState('UPDRS');
  const [initialScores, setInitialScores] = useState(UPDRS);
  const [allScores, setAllScores] = useState([]);

  /* Setting up loading in of preloaded score types that exist for this particular patient */

  useEffect(() => {
    const loadScores = async () => {
      console.log('Loading scores...');
      const scores = await window.electron.ipcRenderer.invoke(
        'get-clinical-scores-types',
        'text',
      );
      if (scores) {
        console.log('scores: ', scores);
        setScoreTypes(Object.keys(scores));
        // setSelectedScoreType(Object.keys(scores)[0]);
        // setInitialScores(scores[Object.keys(scores)[0]]);
        setTotalScores(scores);
        // setPatients([
        //   {
        //     id: patient.id,
        //     baseline: { ...scores[Object.keys(scores)[0]] },
        //     postop: { ...scores[Object.keys(scores)[0]] },
        //   },
        // ]);
      }
    };

    loadScores();
  }, []);

  // Map of UPDRS keys to direct image file paths
  // Using relative paths from utils folder (../) to assets/icons folder
  // Fixed typo: changed .PpngNG to .png for 3-15_Postural-tremor-of-hands-R
  // const UPDRSImages = {
  //   '3-1_Speech': '../assets/icons/3-1_Speech.png',
  //   '3-2_Facial-expression': '../assets/icons/3-2_Facial-expression.png',
  //   '3-3_Rigidity-neck': '../assets/icons/3-3_Rigidity-neck.png',
  //   '3-3_Rigidity_RUE': '../assets/icons/3-3_Rigidity_RUE.png',
  //   '3-3_Rigidity_LUE': '../assets/icons/3-3_Rigidity_LUE.png',
  //   '3-3_Rigidity_RLE': '../assets/icons/3-3_Rigidity_RLE.png',
  //   '3-3_Rigidity_LLE': '../assets/icons/3-3_Rigidity_LLE.png',
  //   '3-4_Finger-tapping_R': '../assets/icons/3-4_Finger-tapping_R.png',
  //   '3-4_Finger-tapping_L': '../assets/icons/3-4_Finger-tapping_L.png',
  //   '3-5_Hand-movements_R': '../assets/icons/3-5_Hand-movements_R.png',
  //   '3-5_Hand-movements_L': '../assets/icons/3-5_Hand-movements_L.png',
  //   '3-6_Pronation-supination-R': '../assets/icons/3-6_Pronation-supination-R.png',
  //   '3-6_Pronation-supination-L': '../assets/icons/3-6_Pronation-supination-L.png',
  //   '3-7_Toe-tapping_R': '../assets/icons/3-7_Toe-tapping_R.png',
  //   '3-7_Toe-tapping_L': '../assets/icons/3-7_Toe-tapping_L.png',
  //   '3-8_Leg-agility_R': '../assets/icons/3-8_Leg-agility_R.png',
  //   '3-8_Leg-agility_L': '../assets/icons/3-8_Leg-agility_L.png',
  //   '3-9_Arise-from-chair': '../assets/icons/3-9_Arise-from-chair.png',
  //   '3-10_Gait': '../assets/icons/3-10_Gait.png',
  //   '3-11_Freezing-of-gait': '../assets/icons/3-11_Freezing-of-gait.png',
  //   '3-12_Postural-stability': '../assets/icons/3-12_Postural-stability.png',
  //   '3-13_Posture': '../assets/icons/3-13_Posture.png',
  //   '3-14_Global-spontaneity-of-movement': '../assets/icons/3-14_Global-spontaneity-of-movement.png',
  //   '3-15_Postural-tremor-of-hands-R': '../assets/icons/3-15_Postural-tremor-of-hands-R.png',
  //   '3-15_Postural-tremor-of-hands-L': '../assets/icons/3-15_Postural-tremor-of-hands-L.png',
  //   '3-16_Kinetic-tremor-of-the-hands_R': '../assets/icons/3-16_Kinetic-tremor-of-the-hands_R.png',
  //   '3-16_Kinetic-tremor-of-the-hands_L': '../assets/icons/3-16_Kinetic-tremor-of-the-hands_L.png',
  //   '3-17_Rest-tremor_RUE': '../assets/icons/3-17_Rest-tremor_RUE.png',
  //   '3-17_Rest-tremor_LUE': '../assets/icons/3-17_Rest-tremor_LUE.png',
  //   '3-17_Rest-tremor-amp_RLE': '../assets/icons/3-17_Rest-tremor-amp_RLE.png',
  //   '3-17_Rest-tremor-amp_LLE': '../assets/icons/3-17_Rest-tremor-amp_LLE.png',
  //   '3-17_Rest-tremor-amplitude_lip-jaw': '../assets/icons/3-17_Rest-tremor-amplitude_lip-jaw.png',
  //   '3-18_Constancy-of-rest-tremor': '../assets/icons/3-18_Constancy-of-rest-tremor.png',
  // };
  function importAll(r) {
    let images = {};
    r.keys().forEach((item) => {
      const key = item.replace('./', '').replace(/\.[^/.]+$/, ''); // Remove './' and file extension
      images[key] = r(item);
    });
    return images;
  }
  const UPDRSImages = importAll(
    require.context('../assets/icons', false, /\.(PNG|jpe?g|svg|png)$/),
  );
  console.log('UPDRSImages: ', UPDRSImages);
  const YBOCS = {
    'Time occupied by obsessive thoughts': 0,
    'Interference due to obsessive thoughts': 0,
    'Distress associated with obsessive thoughts': 0,
    'Resistance against obsessions': 0,
    'Degree of control over obsessive thoughts': 0,
    'Time spent performing compulsive behaviors': 0,
    'Interference due to compulsive behaviors': 0,
    'Distress associated with compulsive behavior': 0,
    'Resistance against compulsions': 0,
    'Degree of control over compulsive behavior': 0,
  };

  const keyMapping = {
    '3.1: Speech': '3-1_Speech',
    '3.2: Facial expression': '3-2_Facial-expression',
    '3.3a: Rigidity- Neck': '3-3_Rigidity-neck',
    '3.3b: Rigidity- RUE': '3-3_Rigidity_RUE',
    '3.3c: Rigidity- LUE': '3-3_Rigidity_LUE',
    '3.3d: Rigidity- RLE': '3-3_Rigidity_RLE',
    '3.3e: Rigidity- LLE': '3-3_Rigidity_LLE',
    '3.4a: Finger tapping- Right hand': '3-4_Finger-tapping_R',
    '3.4b: Finger tapping- Left hand': '3-4_Finger-tapping_L',
    '3.5a: Hand movements- Right hand': '3-5_Hand-movements_R',
    '3.5b: Hand movements- Left hand': '3-5_Hand-movements_L',
    '3.6a: Pronation- supination movements- Right hand':
      '3-6_Pronation-supination-R',
    '3.6b: Pronation- supination movements- Left hand':
      '3-6_Pronation-supination-L',
    '3.7a: Toe tapping- Right foot': '3-7_Toe-tapping_R',
    '3.7b: Toe tapping- Left foot': '3-7_Toe-tapping_L',
    '3.8a: Leg agility- Right leg': '3-8_Leg-agility_R',
    '3.8b: Leg agility- Left leg': '3-8_Leg-agility_L',
    '3.9: Arising from chair': '3-9_Arise-from-chair',
    '3.10: Gait': '3-10_Gait',
    '3.11: Freezing of gait': '3-11_Freezing-of-gait',
    '3.12: Postural stability': '3-12_Postural-stability',
    '3.13: Posture': '3-13_Posture',
    '3.14: Global spontaneity of movement':
      '3-14_Global-spontaneity-of-movement',
    '3.15a: Postural tremor- Right hand': '3-15_Postural-tremor-of-hands-R',
    '3.15b: Postural tremor- Left hand': '3-15_Postural-tremor-of-hands-L',
    '3.16a: Kinetic tremor- Right hand': '3-16_Kinetic-tremor-of-the-hands_R',
    '3.16b: Kinetic tremor- Left hand': '3-16_Kinetic-tremor-of-the-hands_L',
    '3.17a: Rest tremor amplitude- RUE': '3-17_Rest-tremor_RUE',
    '3.17b: Rest tremor amplitude- LUE': '3-17_Rest-tremor_LUE',
    '3.17c: Rest tremor amplitude- RLE': '3-17_Rest-tremor-amp_RLE',
    '3.17d: Rest tremor amplitude- LLE': '3-17_Rest-tremor-amp_LLE',
    '3.17e: Rest tremor amplitude- Lip/jaw':
      '3-17_Rest-tremor-amplitude_lip-jaw',
    '3.18: Constancy of rest tremor': '3-18_Constancy-of-rest-tremor',
  };

  const [patients, setPatients] = useState([
    {
      id: patient.id,
      baseline: { ...initialScores },
      postop: { ...initialScores },
    },
  ]);

  const handleScoreChange = (score) => {
    console.log('Total score change: ', allScores[score]);
    setInitialScores(allScores[score]);
    setSelectedScoreType(score);
    setPatients([
      {
        id: patient.id,
        baseline: { ...allScores[score] },
        postop: { ...allScores[score] },
      },
    ]);
    // if (score === 'UPDRS') {
    //   setInitialScores(UPDRS);
    // } else if (score === 'Y-BOCS') {
    //   setInitialScores(YBOCS);
    // }
    // setSelectedScoreType(score);
  };

  // Set how many columns you want per "wrapped" table row
  const columnsPerRow = 7; // Change this number based on how wide you want each section

  // Split the keys into chunks of 'columnsPerRow'
  const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  // Get chunks of headers (column titles) and data (table rows)
  const keys = Object.keys(initialScores);
  const headerChunks = chunkArray(keys, columnsPerRow);

  window.electron.ipcRenderer.sendMessage(
    'import-file-clinical',
    patient.id,
    timeline,
    directoryPath,
    leadDBS,
  );

  useEffect(() => {
    // Ensure that the ipcRenderer is available
    if (window.electron && window.electron.ipcRenderer) {
      // Event listener for import-file
      const handleImportFile = (arg) => {
        const importedScores = arg;
        if (importedScores === 'File not found') {
          setAllScores(totalScores);
          setPatients([
            {
              id: patient.id,
              baseline: { ...initialScores(Object.keys(totalScores)[0]) },
              postop: { ...initialScores(Object.keys(totalScores)[0]) },
            },
          ]);
          setSelectedScoreType(Object.keys(totalScores)[0]);
          return;
        }
        console.log('initialScores: ', totalScores);
        const newAllScores = {
          ...totalScores,
        };
        Object.keys(importedScores).forEach((score) => {
          console.log('score: ', score);

          newAllScores[score] = importedScores[score];
          if (newAllScores[score].hasOwnProperty('Timeline')) {
            delete newAllScores[score].Timeline;
          }
          // if (newAllScores[score].hasOwnProperty('Levodopa Equivalent Dose of DBS')) {
          //   const updatedLEDD = {};
          //   updatedLEDD['Levodopa Equivalent Daily Dose'] = newAllScores[score]['Levodopa Equivalent Dose of DBS'];
          //   newAllScores[score] = updatedLEDD;
          // }
        });
        console.log('newAllScores: ', newAllScores);
        setAllScores(newAllScores);
        setScoreTypes(Object.keys(newAllScores));
        setPatients([
          {
            id: patient.id,
            baseline: importedScores[Object.keys(importedScores)[0]],
            postop: { ...initialScores },
          },
        ]);
        setSelectedScoreType(Object.keys(importedScores)[0]);
        setInitialScores(importedScores[Object.keys(importedScores)[0]]);
        // const matchingScores = Object.keys(totalScores).find((score) => {
        //   const totalScoreItems = Object.keys(totalScores[score]);
        //   const importedScoreItems = Object.keys(importedScores);
        //   return (
        //     totalScoreItems.length === importedScoreItems.length &&
        //     totalScoreItems.every((item) => importedScoreItems.includes(item))
        //   );
        // });

        // if (matchingScores) {
        //   console.log('Matching score found: ', matchingScores);
        // } else {
        //   console.log('No matching score found');
        // }
        // if (importedScores === 'File not found') {
        //   console.log('No File Found');
        // } else {
        //   setPatients([
        //     {
        //       id: patient.id,
        //       baseline: importedScores,
        //       postop: { ...initialScores },
        //     },
        //   ]);
        //   setAllScores(newAllScores);
        // }
      };

      // Attach listeners using 'once' so that it only listens for the event once
      window.electron.ipcRenderer.once(
        'import-file-clinical',
        handleImportFile,
      );
    } else {
      console.error('ipcRenderer is not available');
    }
  }, [totalScores]);

  const addPatient = () => {
    setPatients([
      ...patients,
      {
        id: `Patient ${patients.length + 1}`,
        baseline: { ...initialScores },
        postop: { ...initialScores },
      },
    ]);
  };

  const [selectedRows, setSelectedRows] = useState({});
  const [showGraph, setShowGraph] = useState(false);
  const [baselineValues, setBaselineValues] = useState([]);
  const [postopValues, setPostopValues] = useState([]);
  const [currentStage, setCurrentStage] = useState('import');

  const toggleRowSelection = (patientIndex) => {
    setSelectedRows((prevSelectedRows) => ({
      ...prevSelectedRows,
      [patientIndex]: !prevSelectedRows[patientIndex],
    }));
  };

  const updateScore = (patientIndex, timePoint, field, value) => {
    const updatedPatients = [...patients];
    updatedPatients[patientIndex][timePoint][field] = value;
    setPatients(updatedPatients);
  };

  const updatePatientID = (patientIndex, newID) => {
    const updatedPatients = [...patients];
    updatedPatients[patientIndex].id = newID;
    setPatients(updatedPatients);
  };

  const renderTable = (timePoint) => {
    const allSelected =
      patients.length > 0 &&
      patients.every((_, rowIndex) => selectedRows[rowIndex]);

    const toggleSelectAll = () => {
      if (allSelected) {
        setSelectedRows({});
      } else {
        const newSelectedRows = {};
        patients.forEach((_, rowIndex) => {
          newSelectedRows[rowIndex] = true;
        });
        setSelectedRows(newSelectedRows);
      }
    };

    const calculateOpacity = (score) => {
      // Assuming scores range from 0 to 4, adjust as needed
      // console.log(patients);
      const minOpacity = 0.2;
      const maxOpacity = 1.0;
      const maxScore = 4; // Adjust this based on your scoring system
      return 1;
      return minOpacity + (score / maxScore) * (maxOpacity - minOpacity);
    };

    return (
      <div style={{ overflowX: 'auto', maxHeight: '1500px' }}>
        {headerChunks.map((headerChunk, chunkIndex) => (
          <div key={chunkIndex} style={{ marginBottom: '20px' }}>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  {/* <th>Patient ID</th> */}
                  {headerChunk.map((key) => (
                    <th
                      key={key}
                      style={{
                        whiteSpace: 'wrap',
                        minWidth: '80px',
                        border: 'none',
                      }}
                    >
                      {/* {key} */}
                      {selectedScoreType === 'UPDRS' &&
                        (() => {
                          const imageKey = keyMapping[key];
                          const imageSrc = imageKey
                            ? UPDRSImages[imageKey]
                            : null;
                          if (!imageKey) {
                            console.warn(`No keyMapping found for: ${key}`);
                          } else if (!imageSrc) {
                            console.warn(
                              `Image not found for key "${key}" with mapping "${imageKey}". Available images:`,
                              Object.keys(UPDRSImages),
                            );
                          }
                          return imageKey && imageSrc ? (
                            <div className="tooltip-container">
                              <img
                                src={imageSrc}
                                alt={key}
                                title={key}
                                className="updrs-image"
                                onError={(e) => {
                                  console.error(
                                    `Failed to load image for ${key} (mapped to ${imageKey}):`,
                                    imageSrc,
                                  );
                                  e.target.style.display = 'none';
                                }}
                                // style={{
                                //   opacity: calculateOpacity(
                                //     patients[0][timePoint][key],
                                //   ),
                                // }}
                              />
                              <br />
                              <span className="tooltip-text">{key}</span>
                            </div>
                          ) : (
                            <div className="tooltip-container">
                              <span className="tooltip-text">{key}</span>
                            </div>
                          );
                        })()}
                      {selectedScoreType !== 'UPDRS' && (
                        <div className="tooltip-text">{key}</div>
                      )}
                      {/* {key} */}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((patient, rowIndex) => (
                  <tr key={rowIndex}>
                    {/* <td>
                      <Form.Control
                        type="text"
                        value={patient.id}
                        onChange={(e) =>
                          updatePatientID(rowIndex, e.target.value)
                        }
                        style={{ width: 'auto' }}
                      />
                    </td> */}
                    {headerChunk.map((key, colIndex) => (
                      <td key={key}>
                        <Form.Control
                          type="number"
                          value={patient[timePoint][key]}
                          onChange={(e) =>
                            updateScore(
                              rowIndex,
                              timePoint,
                              key,
                              parseInt(e.target.value, 10),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ))}
      </div>
    );
  };

  const handleFileUpload = (event, timePoint) => {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(worksheet, {
        raw: true,
      });

      const updatedPatients = [...patients]; // Copy the existing patients state

      json.forEach((patientData) => {
        const normalizedScores = {};

        Object.keys(patientData).forEach((rawKey) => {
          const normalizedKey = rawKey.trim().replace(/^["']+|["']+$/g, '');
          normalizedScores[normalizedKey] = patientData[rawKey];
        });

        const patientID = normalizedScores['Patient ID'];
        delete normalizedScores['Patient ID'];

        const existingPatientIndex = updatedPatients.findIndex(
          (patient) => patient.id === patientID,
        );

        if (existingPatientIndex > -1) {
          // Update existing patient
          if (timePoint === 'baseline') {
            updatedPatients[existingPatientIndex].baseline = {
              ...updatedPatients[existingPatientIndex].baseline,
              ...normalizedScores,
            };
          } else if (timePoint === 'postop') {
            updatedPatients[existingPatientIndex].postop = {
              ...updatedPatients[existingPatientIndex].postop,
              ...normalizedScores,
            };
          }
        } else {
          // Add new patient
          const newPatient = {
            id: patientID,
            baseline:
              timePoint === 'baseline'
                ? { ...initialScores, ...normalizedScores }
                : { ...initialScores },
            postop:
              timePoint === 'postop'
                ? { ...initialScores, ...normalizedScores }
                : { ...initialScores },
          };
          updatedPatients.push(newPatient);
        }
      });

      setPatients(updatedPatients);
    };
    reader.readAsArrayBuffer(file);
  };

  const analyzeSelectedRowsAndColumns = () => {
    const baselineScores = [];
    const postopScores = [];

    Object.keys(selectedRows).forEach((rowIndex) => {
      if (selectedRows[rowIndex]) {
        const patient = patients[rowIndex];
        // console.log(patient);
        // Sum all the baseline scores for this patient
        const baselineSum = Object.values(patient.baseline).reduce(
          (sum, value) => sum + (value || 0),
          0,
        );

        // Sum all the postop scores for this patient
        const postopSum = Object.values(patient.postop).reduce(
          (sum, value) => sum + (value || 0),
          0,
        );

        baselineScores.push(baselineSum);
        postopScores.push(postopSum);
      }
    });

    console.log('Baseline: ', baselineScores);
    console.log('Postop: ', postopScores);
    setBaselineValues(baselineScores);
    setPostopValues(postopScores);
    setShowGraph(true);
    setCurrentStage('analyze');
  };

  const prepareDataForExport = () => {
    const baselineScores = [];

    Object.keys(selectedRows).forEach((rowIndex) => {
      if (selectedRows[rowIndex]) {
        const patient1 = patients[rowIndex];
        // Sum all the baseline scores for this patient
        const baselineSum = Object.values(patient1.baseline).reduce(
          (sum, value) => sum + (value || 0),
          0,
        );

        baselineScores.push(baselineSum);
      }
    });

    console.log('Baseline: ', baselineScores);
    setBaselineValues(baselineScores);
  };

  const sendDataToMain = () => {
    console.log(patients);
    console.log(patients[0].baseline);
    window.electron.ipcRenderer.sendMessage(
      'save-file-clinical',
      patients[0].baseline,
      location.state,
      selectedScoreType,
    );
  };
  const [addScore, setAddScore] = useState(false);
  const handleAddScoreType = () => {
    console.log('add score type');
    setAddScore(true);
  };

  const [newScoreName, setNewScoreName] = useState('');
  const [newScoreValues, setNewScoreValues] = useState('');

  const handleAddScore = () => {
    console.log('add score');
    console.log(newScoreName);
    console.log(newScoreValues);
    const newScore = {
      [newScoreName]: newScoreValues.split(',').reduce((acc, item) => {
        acc[item.trim()] = 0;
        return acc;
      }, {}),
    };

    console.log(newScore);
    window.electron.ipcRenderer.sendMessage(
      'add-score-type',
      newScoreName,
      newScore,
    );
    // setAddScore(false);
  };

  return (
    <div>
      {currentStage === 'import' && (
        <div>
          {/* <h3 className="my-4">Import Data</h3> */}
          {/* <div
            style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20px' }}
          >
            Patient: {patient.name}
          </div> */}
          {/* <div style={{ textAlign: 'center', fontSize: '20px' }}>
            {timeline}
          </div> */}
          <Container>
            {/* <Button variant="primary" onClick={addPatient} className="mb-4">
              Add Patient
            </Button> */}
            {/* <h4>Choose Score Type</h4> */}
            <Form.Select
              value={selectedScoreType}
              onChange={(e) => handleScoreChange(e.target.value)}
              style={{ width: '200px' }}
            >
              {scoreTypes.map((type, index) => (
                <option key={index} value={type}>
                  {type}
                </option>
              ))}
            </Form.Select>
            <Button
              style={{ marginLeft: '10px' }}
              onClick={() => handleAddScoreType()}
            >
              +
            </Button>
            <Modal show={addScore} onHide={() => setAddScore(false)}>
              <Modal.Header closeButton>
                <Modal.Title>Create Clinical Score Type</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                <Form.Group controlId="newScoreType">
                  <Form.Label>Enter New Score Type</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter Score Name"
                    value={newScoreName}
                    onChange={(e) => setNewScoreName(e.target.value)}
                  />
                  <Form.Control
                    type="text"
                    placeholder="Enter Score Values"
                    value={newScoreValues}
                    onChange={(e) => setNewScoreValues(e.target.value)}
                  />
                  <p>separated by commas (Ex: 'Obsessions', 'Compulsions')</p>
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setAddScore(false)}>
                  Close
                </Button>
                <Button variant="primary" onClick={handleAddScore}>
                  Add
                </Button>
              </Modal.Footer>
            </Modal>
            {/* <Button
              variant="secondary"
              onClick={() => document.getElementById('baseline-upload').click()}
              className="mb-4 mx-2"
            >
              Import Excel
            </Button> */}
            {/* <Button
              variant="secondary"
              onClick={() => document.getElementById('postop-upload').click()}
              className="mb-4 mx-2"
            >
              Import Postoperative Excel
            </Button> */}
            <input
              id="baseline-upload"
              type="file"
              style={{ display: 'none' }}
              accept=".xlsx"
              onChange={(e) => handleFileUpload(e, 'baseline')}
            />
            <input
              id="postop-upload"
              type="file"
              style={{ display: 'none' }}
              accept=".xlsx"
              onChange={(e) => handleFileUpload(e, 'postop')}
            />
            {/* <Button
              variant="success"
              // onClick={() => setCurrentStage('analyze')}
              onClick={analyzeSelectedRowsAndColumns}
              className="mb-4"
            >
              Proceed to Analysis
            </Button> */}
          </Container>
          <div>
            <h4>{timeline} scores</h4>
            {renderTable('baseline')}
            {/* <h4>Postoperative Scores</h4>
            {renderTable('postop')} */}
          </div>
        </div>
      )}
      {/* {currentStage === 'analyze' && (
        <div>
          <Button variant="secondary" onClick={() => setCurrentStage('import')}>
            Go Back to Import
          </Button>
          <div />
          {showGraph && (
            <div
              style={{
                float: 'left',
                width: '50%',
              }}
            >
              <UPDRSAnalysisComponent
                baselineValues={baselineValues}
                postopValues={postopValues}
                rawData={patients}
              />
            </div>
          )}
        </div>
      )} */}
      <button className="export-button" onClick={() => navigate(-1)}>
        Back to Patient Details
      </button>
      <button className="export-button-final" onClick={sendDataToMain}>
        Save Clinical Scores
      </button>
      {/* <button onClick={() => navigate('/custom-table')}>
        Add custom table
      </button> */}
    </div>
  );
}

export default ClinicalScores;
