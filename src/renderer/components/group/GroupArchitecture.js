/* eslint-disable react/no-unstable-nested-components */
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
// import './App.css';

import Dropdown from 'react-bootstrap/Dropdown';
import 'bootstrap/dist/css/bootstrap.min.css';
import { ButtonGroup, Button } from 'react-bootstrap';
import InputGroup from 'react-bootstrap/InputGroup';
import Form from 'react-bootstrap/Form';
import { render } from '@testing-library/react';
import StimulationSettings from '../stimulation/StimulationSettings';
import Navbar from '../common/Navbar';
import { Modal } from 'react-bootstrap';
import EditIcon from '@mui/icons-material/Edit';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';

// import './electrode_models/currentModels/ElecModelStyling/boston_vercise_directed.css';

function GroupArchitecture({
  patients,
  setPatients,
  electrodeList,
  patientStates,
  setPatientStates,
  importNewS,
  electrodeMaster,
  ipgMaster,
  historical,
  setHistorical,
  mode,
  timeline,
  type,
}) {
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [newPatientName, setNewPatientName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  console.log('Patients: ', patients);
  console.log('Patient States: ', patientStates);
  console.log('selectedPatient: ', selectedPatient);
  const location = useLocation();
  const patientInfo = location.state || {};
  console.log('patientInfo: ', patientInfo);
  // State for each patient
  const initialState = {
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
  };

  const [renderKey, setRenderKey] = useState(0); // Added state for forcing re-render
  console.log('Timeline: ', timeline);
  console.log('Patients: ', patients);

  useEffect(() => {
    if (patients.length > 0 && !selectedPatient) {
      // setSelectedPatient(patients[0]);
      setSelectedPatient(timeline);
    }
  }, [selectedPatient]);

  useEffect(() => {
    if (selectedPatient && !patientStates[selectedPatient]) {
      setPatientStates((prevStates) => ({
        ...prevStates,
        [selectedPatient]: initialState,
      }));
    }
    console.log('Patient states after selection:', patientStates);
  }, [selectedPatient, patientStates]);

  const handleStateChange = (patient, stateUpdater) => {
    setPatientStates((prevStates) => ({
      ...prevStates,
      [patient]: {
        ...prevStates[patient],
        ...stateUpdater,
      },
    }));
  };

  const [zoomLevel, setZoomLevel] = useState(-3);

  const handleZoomChange = (event, newValue) => {
    setZoomLevel(newValue);
    window.electron.zoom.setZoomLevel(newValue);
  };

  function generateUniqueID() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0'); // Adding 1 because months are zero-based
    const day = currentDate.getDate().toString().padStart(2, '0');
    const randomNums = Math.floor(Math.random() * 1000000); // Generate random 4-digit number
    return `${year}${month}${day}${randomNums}`;
  }

  const handleTabKeyPress = (event) => {
    if (event.key === 'Tab') {
      event.preventDefault(); // Prevent the default tab behavior
      const uniqueID = generateUniqueID();
      setNewPatientName(uniqueID);
      // setNewStim(uniqueID);
      // setNewStim(Date.now().toString());
      // Set the input field value to the placeholder text
    }
  };
  // Don't forget this

  // useEffect(() => {
  //   window.electron.zoom.setZoomLevel(zoomLevel);
  // }, [zoomLevel]);

  const currentPatientState = selectedPatient
    ? patientStates[selectedPatient] || initialState
    : initialState;

  function PatientSelector({
    selectedPatient,
    setSelectedPatient,
    setRenderKey,
  }) {
    const handleSelect = (eventKey) => {
      setSelectedPatient(eventKey);
      setRenderKey((prevKey) => prevKey + 1);
      importNewS.label = eventKey;
    };

    const [newStim, setNewStim] = useState('');

    const handleNewStimText = (event) => {
      setNewStim(event.target.value);
    };

    const handleOnAddButtonClick = () => {
      setPatients([...patients, newStim]);
      setSelectedPatient(newStim);
      setPatientStates((prevStates) => ({
        ...prevStates,
        [newStim]: {
          ...initialState, // Spread the initial state
          leftElectrode: electrodeMaster, // Override leftElectrode with electrodeMaster
          rightElectrode: electrodeMaster, // Override rightElectrode with electrodeMaster
          IPG: ipgMaster, // Override IPG with ipgMaster
        },
      }));
      setRenderKey(renderKey + 1);
    };

    return (
      <div>
        {/* <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', marginLeft: '-10px' }}>
          Stimulation Label
        </div> */}
        <Dropdown onSelect={handleSelect} style={{ borderRadius: '20px' }}>
          <Dropdown.Toggle
            variant="secondary"
            id="dropdown-basic"
            style={{
              borderRadius: '20px',
              width: type === 'leadgroup' ? '150px' : '250px',
              boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.2)',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              border: 'none',
            }}
          >
            {selectedPatient || 'Select Patient'}
          </Dropdown.Toggle>

          <Dropdown.Menu>
            {patients.map((patient, index) => (
              <Dropdown.Item key={index} eventKey={patient}>
                {patient}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      </div>
    );
  }

  const handlePreviousPatient = () => {
    const currentIndex = patients.indexOf(selectedPatient);
    const previousIndex =
      (currentIndex - 1 + patients.length) % patients.length;
    const updatedHistorical = { ...historical };
    updatedHistorical.patient.id = patients[previousIndex];
    updatedHistorical.timeline = patients[previousIndex];
    setHistorical(updatedHistorical);
    setSelectedPatient(patients[previousIndex]);
    setRenderKey(renderKey + 1);
  };

  const handleNextPatient = () => {
    const currentIndex = patients.indexOf(selectedPatient);
    const nextIndex = (currentIndex + 1) % patients.length;
    const updatedHistorical = { ...historical };
    updatedHistorical.patient.id = patients[nextIndex];
    updatedHistorical.timeline = patients[nextIndex];
    setHistorical(updatedHistorical);
    setSelectedPatient(patients[nextIndex]);
    setRenderKey(renderKey + 1);
  };

  const [navbardata, setNavbardata] = useState({
    text: '',
    text2: '',
    color1: '',
    color2: '',
  });

  useEffect(() => {
    if (patientInfo && selectedPatient) {
      console.log('patientInfo: ', patientInfo);
      console.log('selectedPatient: ', selectedPatient);
      console.log('currentPatientState: ', patientStates[selectedPatient]);
      console.log(
        'currentPatientState.model: ',
        patientStates[selectedPatient].model,
      );
      console.log('mode: ', mode);
      const text =
        type === 'leadgroup' ? selectedPatient : patientInfo.patient.id;
      const text2 =
        type === 'leadgroup'
          ? patientStates[selectedPatient].model
          : patientInfo.patient.elmodel;
      const color1 = '#375D7A';
      const color2 = 'lightgrey';
      console.log('navbardata: ', navbardata);
      setNavbardata({
        text,
        text2,
        color1,
        color2,
      });
    }
  }, [patientInfo, selectedPatient, renderKey]);



  const handleEditPatients = () => {
    setShowEditModal(true);
  };

  const handleModalClose = () => {
    setShowEditModal(false);
    setNewPatientName('');
  };

  const handleRenamePatient = () => {
    const updatedPatients = patients.map((patient) =>
      patient === selectedPatient ? newPatientName : patient,
    );

    // Update the patientStates object
    const updatedPatientStates = { ...patientStates };
    if (selectedPatient in updatedPatientStates) {
      updatedPatientStates[newPatientName] = updatedPatientStates[selectedPatient];
      delete updatedPatientStates[selectedPatient];
    }

    // Update the state with the new values
    setPatients(updatedPatients);
    setPatientStates(updatedPatientStates);
    setSelectedPatient(newPatientName);
    handleModalClose();
  };

  const handleNewPatient = () => {
    // Ensure the existing patient ID is valid
    console.log('Import Stimulation: ', importNewS);
    // Add the new patient to the patients list
    const updatedPatients = [...patients, newPatientName];

    // Copy the state of the existing patient to the new patient
    const updatedPatientStates = {
      ...patientStates,
      [newPatientName]: { ...patientStates[selectedPatient]},
    };
    importNewS.label = newPatientName;

    // Update the state with the new values
    setPatients(updatedPatients);
    setPatientStates(updatedPatientStates);
    setSelectedPatient(newPatientName);
    handleModalClose();
  };

  return (
    <div style={{ marginLeft: '-300px', marginTop: '200px' }}>
      {patientInfo && selectedPatient && navbardata && (
        // <Navbar
        //   text={
        //     mode === 'leadgroup' ? { selectedPatient } : patientInfo.patient.id
        //   }
        //   color1="#375D7A"
        //   text2={
        //     mode === 'leadgroup' ? { selectedPatient } : patientInfo.patient.elmodel
        //   }
        //   color2="lightgrey"
        // />
        <Navbar
          text={navbardata.text}
          color1={navbardata.color1}
          text2={navbardata.text2}
          color2={navbardata.color2}
        />
      )}
      {/* <div style={{ paddingLeft: '45px', marginBottom: '-100px' }}>
        <PatientSelector
          selectedPatient={selectedPatient}
          setSelectedPatient={setSelectedPatient}
          setRenderKey={setRenderKey}
        />
      </div> */}
      <div
        style={{
          position: 'absolute',
          ...(showViewer && {
            marginBottom: '-110px',
          }),
          marginTop: '-30px',
          marginLeft: '130px',
          zIndex: 5,
        }}
      >
        {type === 'leadgroup' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '-10px',
            }}
          >
            <Button
              // className="sticky-button"
              style={{
                borderRadius: '20px',
                marginLeft: '10px',
                marginRight: '-5px',
                boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.2)',
                backgroundColor: 'white',
                color: 'black',
                fontWeight: 'bold',
                border: 'none',
              }}
              variant="secondary"
              onClick={handlePreviousPatient}
            >
              ←
            </Button>

            <PatientSelector
              selectedPatient={selectedPatient}
              setSelectedPatient={setSelectedPatient}
              setRenderKey={setRenderKey}
            />

            <Button
              // className="sticky-button"
              style={{
                // marginRight: '10px',
                borderRadius: '20px',
                // width: '250px',
                marginRight: '10px',
                marginLeft: '-10px',
                boxShadow: 'inset 0 4px 8px rgba(0, 0, 0, 0.2)',
                backgroundColor: 'white',
                color: 'black',
                fontWeight: 'bold',
                border: 'none',
              }}
              variant="secondary"
              onClick={handleNextPatient}
            >
              →
            </Button>
          </div>
        )}

        {type !== 'leadgroup' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: '-10px',
              marginLeft: '-2px',
            }}
          >
            <PatientSelector
              selectedPatient={selectedPatient}
              setSelectedPatient={setSelectedPatient}
              setRenderKey={setRenderKey}
            />
            <Button
              variant="outline-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                padding: '5px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
                backgroundColor: 'white',
                color: 'black',
                border: 'none',
                cursor: 'pointer',
              }}
              onClick={handleEditPatients}
            >
              <EditIcon />
            </Button>
          </div>
        )}
      </div>
      <div>
        {selectedPatient && (
          <StimulationSettings
            key={renderKey}
            IPG={currentPatientState.IPG}
            setIPG={(value) =>
              handleStateChange(selectedPatient, { IPG: value })
            }
            leftElectrode={currentPatientState.leftElectrode}
            setLeftElectrode={(value) =>
              handleStateChange(selectedPatient, { leftElectrode: value })
            }
            rightElectrode={currentPatientState.rightElectrode}
            setRightElectrode={(value) =>
              handleStateChange(selectedPatient, { rightElectrode: value })
            }
            allQuantities={currentPatientState.allQuantities}
            setAllQuantities={(value) =>
              handleStateChange(selectedPatient, { allQuantities: value })
            }
            allSelectedValues={currentPatientState.allSelectedValues}
            setAllSelectedValues={(value) =>
              handleStateChange(selectedPatient, { allSelectedValues: value })
            }
            allTotalAmplitudes={currentPatientState.allTotalAmplitudes}
            setAllTotalAmplitudes={(value) =>
              handleStateChange(selectedPatient, { allTotalAmplitudes: value })
            }
            allTogglePositions={currentPatientState.allTogglePositions}
            setAllTogglePositions={(value) =>
              handleStateChange(selectedPatient, { allTogglePositions: value })
            }
            allPercAmpToggles={currentPatientState.allPercAmpToggles}
            setAllPercAmpToggles={(value) =>
              handleStateChange(selectedPatient, { allPercAmpToggles: value })
            }
            allVolAmpToggles={currentPatientState.allVolAmpToggles}
            setAllVolAmpToggles={(value) =>
              handleStateChange(selectedPatient, { allVolAmpToggles: value })
            }
            importCount={currentPatientState.importCount}
            setImportCount={(value) =>
              handleStateChange(selectedPatient, { importCount: value })
            }
            importDataTest={currentPatientState.importData}
            setImportDataTest={(value) =>
              handleStateChange(selectedPatient, { importData: value })
            }
            masterImportData={currentPatientState.masterImportData}
            setMasterImportData={(value) =>
              handleStateChange(selectedPatient, { masterImportData: value })
            }
            matImportFile={currentPatientState.matImportFile}
            setMatImportFile={(value) =>
              handleStateChange(selectedPatient, { matImportFile: value })
            }
            newImportFiles={currentPatientState.newImportFiles}
            setNewImportFiles={(value) =>
              handleStateChange(selectedPatient, { newImportFiles: value })
            }
            filePath={currentPatientState.filePath}
            setFilePath={(value) =>
              handleStateChange(selectedPatient, { filePath: value })
            }
            stimChanged={currentPatientState.stimChanged}
            setStimChanged={(value) =>
              handleStateChange(selectedPatient, { stimChanged: value })
            }
            allStimulationParameters={
              currentPatientState.allStimulationParameters
            }
            setAllStimulationParameters={(value) =>
              handleStateChange(selectedPatient, {
                allStimulationParameters: value,
              })
            }
            visModel={currentPatientState.visModel}
            setVisModel={(value) =>
              handleStateChange(selectedPatient, { visModel: value })
            }
            sessionTitle={currentPatientState.sessionTitle}
            setSessionTitle={(value) =>
              handleStateChange(selectedPatient, { sessionTitle: value })
            }
            patientStates={patientStates}
            importNewS={importNewS}
            selectedPatient={selectedPatient}
            historical={historical}
            mode={mode}
            type={type}
            allTemplateSpaces={currentPatientState.allTemplateSpaces}
            setAllTemplateSpaces={(value) =>
              handleStateChange(selectedPatient, { allTemplateSpaces: value })
            }
            showViewer={showViewer}
            setShowViewer={setShowViewer}
          />
        )}
      </div>
      <Modal show={showEditModal} onHide={handleModalClose} style={{ marginTop: '200px' }}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Stimulation ID</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            {/* <Form.Label>Create a new ID or rename the current one</Form.Label> */}
            <p style={{ margin: '0', fontSize: 'medium', color: 'gray' }}>
              Create a new ID or rename the current one
            </p>
            <Form.Group controlId="formPatientName">
              <Form.Control
                type="text"
                placeholder="Hit Tab for automatic ID"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab') {
                    e.preventDefault(); // Prevent the default tab behavior
                    handleTabKeyPress(e);
                  }
                }}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>
            Close
          </Button>
          <Button variant="primary" onClick={handleRenamePatient}>
            Rename
          </Button>
          <Button variant="primary" onClick={handleNewPatient}>
            Add
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default GroupArchitecture;
