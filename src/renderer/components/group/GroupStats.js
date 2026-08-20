/* eslint-disable jsx-a11y/mouse-events-have-key-events */
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Form, Button, Table, Container } from 'react-bootstrap';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import * as XLSX from 'xlsx';
import HomeIcon from '@mui/icons-material/Home';
// import './electrode_models/currentModels/ElecModelStyling/boston_vercise_directed.css';
import PairedTTestComponent from '../analysis/PairedTTestComponent';
import BoxPlotComponent from '../analysis/BoxPlotComponent';
import UPDRSAnalysisComponent from '../analysis/UPDRSAnalysisComponent';

function GroupStats() {
  const location = useLocation();
  const { patient, timeline, directoryPath, leadDBS } = location.state || {};
  const navigate = useNavigate();
  const [scoreTypes, setScoreTypes] = useState(['UPDRS', 'Y-BOCS']);
  const [selectedScoreType, setSelectedScoreType] = useState('UPDRS');
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
  const [initialScores, setInitialScores] = useState(UPDRS);

  const reorderTimeline = (timeline) => {
    return ['baseline', ...timeline.filter((time) => time !== 'baseline')];
  };
  const reorderedTimeline = reorderTimeline(timeline);

  const handleScoreChange = (score) => {
    if (score === 'UPDRS') {
      setInitialScores(UPDRS);
    } else if (score === 'Y-BOCS') {
      setInitialScores(YBOCS);
    }
    setSelectedScoreType(score);
  };

  const columnsPerRow = 7;

  const chunkArray = (arr, size) => {
    const result = [];
    for (let i = 0; i < arr.length; i += size) {
      result.push(arr.slice(i, i + size));
    }
    return result;
  };

  const keys = Object.keys(initialScores);
  const headerChunks = chunkArray(keys, columnsPerRow);

  const reorderScores = (importedScores) => {
    const { baseline, ...otherScores } = importedScores;
    return { baseline, ...otherScores };
  };

  const initializePatientData = () => {
    const timepointData = {};
    timeline.forEach((timepoint) => {
      timepointData[timepoint] = { ...initialScores };
    });
    const reorderedScores = reorderScores(timepointData);
    return { id: patient.id, ...reorderedScores };
  };

  const [patients, setPatients] = useState([initializePatientData()]);

  window.electron.ipcRenderer.sendMessage(
    'import-file-clinical-group',
    patient.id,
    timeline,
    directoryPath,
    leadDBS,
  );

  useEffect(() => {
    if (window.electron && window.electron.ipcRenderer) {
      const importedScores = {};

      const handleImportFile = (arg) => {
        Object.keys(timeline).forEach((key) => {
          if (!arg[timeline[key]]) {
            importedScores[timeline[key]] = { ...initialScores };
          } else {
            importedScores[timeline[key]] = arg[timeline[key]];
          }
        });
        const reorderedScores = reorderScores(importedScores);
        setPatients([
          {
            id: patient.id,
            ...reorderedScores,
          },
        ]);
      };

      window.electron.ipcRenderer.once(
        'import-file-clinical-group',
        handleImportFile,
      );
    } else {
      console.error('ipcRenderer is not available');
    }
  }, []);

  const updateScore = (patientIndex, timePoint, field, value) => {
    const updatedPatients = [...patients];
    updatedPatients[patientIndex][timePoint][field] = value;
    setPatients(updatedPatients);
  };

  const renderTable = (timePoint) => {
    return (
      <div style={{ overflowX: 'auto', maxHeight: '700px' }}>
        {headerChunks.map((headerChunk, chunkIndex) => (
          <div key={chunkIndex} style={{ marginBottom: '20px' }}>
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  {headerChunk.map((key) => (
                    <th
                      key={key}
                      style={{ whiteSpace: 'wrap', minWidth: '80px' }}
                    >
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patients.map((pt, rowIndex) => (
                  <tr key={rowIndex}>
                    {headerChunk.map((key, colIndex) => (
                      <td key={key}>
                        <Form.Control
                          type="number"
                          value={pt[timePoint][key]}
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

      const updatedPatients = [...patients];

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

  const handleAnalysisTabClick = (key) => {
    if (key === 'analysis') {
      setCurrentStage('analyze');
    } else {
      setCurrentStage('import');
    }
  };

  const [currentStage, setCurrentStage] = useState('analyze');
  const [clinicalTimelines, setClinicalTimelines] = useState(null);

  useEffect(() => {
    const timelinePromises = window.electron.ipcRenderer.invoke(
      'get-timelines',
      directoryPath,
      patient.id,
      true,
    );
    timelinePromises.then((result) => setClinicalTimelines(result));
    // Promise.all(timelinePromises)
    //   .then((allReceivedTimelines) => {
    //     const allFilteredTimelineNames = allReceivedTimelines.map(
    //       (receivedTimelines) =>
    //         receivedTimelines
    //           .filter((timelineData) => timelineData.hasClinical)
    //           .map((timelineData) => timelineData.timeline),
    //     );

    //     const patientsArray = patients;
    //     const patientsWithTimelines = patientsArray.map((patient, index) => ({
    //       id: patient.id,
    //       timelines: allFilteredTimelineNames[index] || [],
    //     }));
    //     return setClinicalTimelines(patientsWithTimelines);
    //   })
    // .catch((error) => {
    //   console.error('Error fetching timelines for all patients:', error);
    // });
  }, [patients]);

  return (
    <div>
      <div>
        <Container>
          {/* <HomeIcon
            onClick={() => navigate('/')}
            style={{
              fontSize: '36px',
              color: '#1a73e8',
              cursor: 'pointer',
              margin: '0 10px',
            }}
          /> */}
          {/* <Form.Select
            value={selectedScoreType}
            onChange={(e) => handleScoreChange(e.target.value)}
          >
            {scoreTypes.map((type, index) => (
              <option key={index} value={type}>
                {type}
              </option>
            ))}
          </Form.Select> */}
          {/* <Button
            variant="secondary"
            onClick={() => document.getElementById('baseline-upload').click()}
            className="mb-4 mx-2"
          >
            Import Excel
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
        </Container>
        <div>
          <Tabs
          // defaultIndex={0}
          // onSelect={(index) =>
          //   setCurrentStage(index === 1 ? 'analyze' : null)
          // }
          >
            <TabList>
              {/* <Tab>Scores</Tab> */}
              {/* <Tab onClick={handleAnalysisTabClick}>Analysis</Tab> */}
            </TabList>
            {/*
            <TabPanel>
              <Tabs defaultIndex={0}>
                <TabList>
                  {timeline.map((time, index) => (
                    <Tab key={index}>{time}</Tab>
                  ))}
                </TabList>

                {timeline.map((time, index) => (
                  <TabPanel key={index}>
                    <div className="tab-content mt-3">{renderTable(time)}</div>
                  </TabPanel>
                ))}
              </Tabs>
            </TabPanel> */}

            {/* <TabPanel>
              {currentStage === 'analyze' && clinicalTimelines && (
                <UPDRSAnalysisComponent
                  currentStage={currentStage}
                  rawData={patients}
                  clinicalTimelines={clinicalTimelines}
                />
              )}
            </TabPanel> */}
          </Tabs>
          {currentStage === 'analyze' && clinicalTimelines && (
            <UPDRSAnalysisComponent
              currentStage={currentStage}
              rawData={patients}
              clinicalTimelines={clinicalTimelines}
            />
          )}
        </div>
      </div>
      {/* {currentStage !== 'analyze' && (
        <div>
          <button className="export-button" onClick={() => navigate(-1)}>
            Back to Patient Details
          </button>
        </div>
      )} */}
                <button className="export-button" onClick={() => navigate(-1)}>
            Back to Patient Details
          </button>
    </div>
  );
}

export default GroupStats;
