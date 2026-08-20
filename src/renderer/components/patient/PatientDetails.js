/* eslint-disable react/button-has-type */
/* eslint-disable promise/always-return */
import React, { useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
// import './electrode_models/currentModels/ElecModelStyling/boston_vercise_directed.css';
// import { TreeView, TreeItem } from '@mui/x-tree-view';
import { Dropdown, Button } from 'react-bootstrap';
import { RichTreeView } from '@mui/x-tree-view';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeIcon from '@mui/icons-material/Home';
import { PatientContext } from '../../contexts/PatientContext';
import PatientStats from './PatientStats';
// import NiivueViewer from './NiivueViewer';
// import NiftiViewer from './NiftiViewer';
import '../../styles/PatientDetails.css';

function PatientDetails({ directoryPath, leadDBS }) {
  useEffect(() => {
    window.electron.zoom.setZoomLevel(-1);
  }, []);

  const location = useLocation();
  const { patient } = location.state || {}; // Retrieve patient from state
  const { patients } = useContext(PatientContext); // Optional: Use context for patient data
  console.log(patient);
  console.log(patients);
  const navigate = useNavigate(); // Initialize the navigate hook

  const [timeline, setTimeline] = useState(''); // For timeline selection
  const [newTimeline, setNewTimeline] = useState(''); // To track user input for new timeline
  const [timelines, setTimelines] = useState([]); // Predefined timelines

  const [treeData, setTreeData] = useState([]); // Store timelines with clinical and stimulation data
  const [selectedItems, setSelectedItems] = useState([]);

  // useEffect(() => {
  //   // Request timelines from main process
  //   if (directoryPath && patient) {
  //     window.electron.ipcRenderer
  //       .invoke('get-timelines', directoryPath, patient.id)
  //       .then((receivedTimelines) => {
  //         console.log(receivedTimelines);
  //         const timelineArray = receivedTimelines.map((timelineObj) => timelineObj.timeline);
  //         setTimelines(timelineArray);
  //       setTreeData(receivedTimelines);
  //     }).catch((error) => {
  //       console.error('Error fetching timelines:', error);
  //     });
  //   }
  // }, [directoryPath, patient]);

  useEffect(() => {
    // Request timelines from main process
    if (directoryPath && patient) {
      window.electron.ipcRenderer
        .invoke('get-timelines', directoryPath, patient.id, leadDBS)
        .then((receivedTimelines) => {
          const timelineNames = receivedTimelines.map(
            (timelineData) => timelineData.timeline,
          );
          setTimelines(timelineNames); // Set only the timeline names
          const items = receivedTimelines.map((timelineData, index) => ({
            id: `${timelineData.timeline}-${index}`,
            label: timelineData.timeline,
            children: [
              timelineData.hasStimulation && {
                id: `${timelineData.timeline}-stim`,
                label: 'Stimulation Parameters',
                action: () =>
                  navigate('/programmer', {
                    state: {
                      patient,
                      timeline: timelineData.timeline,
                      directoryPath,
                      leadDBS,
                    },
                  }), // Define action
              },
              timelineData.hasClinical && {
                id: `${timelineData.timeline}-clinical`,
                label: 'Clinical Scores',
                action: () =>
                  navigate('/clinical-scores', {
                    state: {
                      patient,
                      timeline: timelineData.timeline,
                      directoryPath,
                      leadDBS,
                    },
                  }), // Define action
              },
            ].filter(Boolean),
          }));
          console.log(leadDBS);
          setTreeData(items);
        })
        .catch((error) => {
          console.error('Error fetching timelines:', error);
        });
    }
  }, [directoryPath, patient, navigate]);

  const handleNodeClick = (event, node) => {
    if (node?.action) {
      node.action(); // Execute the action defined for the clicked node
    }
  };

  const addChildToTimeline = (timelineLabel, newChild) => {
    const updatedTreeData = treeData.map((node) => {
      if (node.label === timelineLabel) {
        // If the timeline matches, append the new child to the existing children
        return {
          ...node,
          children: [...(node.children || []), newChild], // Safely add to children array
        };
      }
      return node;
    });

    setTreeData(updatedTreeData); // Update the state with the modified tree
  };

  const handleAddClinicalScores = (timelineLabel) => {
    console.log(timelineLabel);
    const newChild = {
      id: `${timelineLabel}-clinical`,
      label: 'Clinical Scores',
      action: () =>
        navigate('/clinical-scores', {
          state: { patient, timeline: timelineLabel, directoryPath, leadDBS },
        }),
    };
    addChildToTimeline(timelineLabel, newChild); // Add the Clinical Scores child to the specified timeline
  };

  // const handleGroupStats = () => {
  //   navigate('/group', {
  //     state: { patient, timeline: timelines, directoryPath, leadDBS },
  //   });
  // };

  const handleGroupStats = () => {
    return (
      <PatientStats
        patient={patient}
        timeline={timeline}
        directoryPath={directoryPath}
        leadDBS={leadDBS}
      />
    );
  };

  const handleAddStimulationParameters = (timelineLabel) => {
    console.log(timelineLabel);
    const newChild = {
      id: `${timelineLabel}-stim`,
      label: 'Stimulation Parameters',
      action: () =>
        navigate('/programmer', {
          state: { patient, timeline: timelineLabel, directoryPath, leadDBS },
        }),
    };
    addChildToTimeline(timelineLabel, newChild); // Add the Clinical Scores child to the specified timeline
  };

  const handleAddNewTimelineToTree = (timelineLabel) => {
    const newNode = {
      id: `${timelineLabel}-${treeData.length}`,
      label: timelineLabel,
      children: [],
    };
    setTreeData([...treeData, newNode]);
  };

  if (!patient) {
    return <div>Patient not found</div>;
  }

  // Handles the navigation to the Stimulation Parameters page
  const handleNavigateToStimulation = () => {
    if (timeline) {
      navigate('/programmer', { state: { patient, timeline, directoryPath } });
    } else {
      alert('Please select a timeline first');
    }
  };

  // Handles the navigation to the Clinical Scores page
  const handleNavigateToClinicalScores = () => {
    if (timeline) {
      navigate('/clinical-scores', {
        state: { patient, timeline, directoryPath },
      });
    } else {
      alert('Please select a timeline first');
    }
  };

  // Handle adding a new timeline
  const handleAddTimeline = () => {
    if (newTimeline && !timelines.includes(newTimeline)) {
      setTimelines([...timelines, newTimeline]);
      handleAddNewTimelineToTree(newTimeline); // Add to Tree
      setNewTimeline(''); // Clear the input field after adding
    } else {
      alert('Timeline already exists or is empty');
    }
  };

  // Quick add predefined timeline
  const handleQuickAdd = (quickTimeline) => {
    if (!timelines.includes(quickTimeline)) {
      setTimelines([...timelines, quickTimeline]);
      handleAddNewTimelineToTree(quickTimeline); // Add to Tree
      setTimeline(quickTimeline);
    } else {
      alert('Timeline already exists');
    }
  };

  const handleTreeClick = (event, nodeId) => {
    console.log('Node clicked:', nodeId); // Perform actions based on the clicked node
  };

  // Helper function to find the item by ID
  const findItemById = (items, id) => {
    // Use find and map through the children
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const handleSelectionChange = (event, itemIds) => {
    setSelectedItems(itemIds);

    // Find the selected item in treeData and execute its action if it exists
    const selectedItem = findItemById(treeData, itemIds);
    if (
      selectedItem.label &&
      (selectedItem.label !== 'Clinical Scores' ||
        selectedItem.label !== 'Stimulation Parameters')
    ) {
      setTimeline(selectedItem.label);
    }
    console.log(selectedItem);
    if (selectedItem && selectedItem.action) {
      selectedItem.action(); // Execute the action function
    }
  };

  const [niiVue, setNiiVue] = useState(false);

  return (
    <div className="patient-details">
      {/* Section Title */}
      <HomeIcon
        onClick={() => navigate('/')}
        style={{
          fontSize: '36px', // Customize size
          color: '#375D7A', // Customize color
          cursor: 'pointer', // Add pointer cursor on hover
          margin: '0 10px', // Add some margin for spacing
        }}
      />
      <h1 className="patient-title">Patient Details</h1>

      {/* Divider */}
      <div className="divider"></div>

      {/* Patient Information Section */}
      <h2 className="section-title">Patient Information</h2>
      <div className="patient-info-container">
        {Object.entries(patient).map(([key, value]) => (
          <p className="patient-info" key={key}>
            <strong style={{ color: 'black' }}>
              {key.charAt(0).toUpperCase() + key.slice(1)}:
            </strong>{' '}
            {value}
          </p>
        ))}
      </div>
      <div>
        <Dropdown>
          <Dropdown.Toggle
            variant="success"
            id="dropdown-basic"
            style={{ backgroundColor: '#375D7A', color: 'white' }}
          >
            Stats
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <PatientStats
              patient={patient}
              timeline={timelines}
              directoryPath={directoryPath}
              leadDBS={leadDBS}
            />
          </Dropdown.Menu>
        </Dropdown>
      </div>

      {/* Another Divider */}
      <div className="divider"></div>
      <h2 className="section-title">Saved Sessions</h2>
      {!timeline && (
        <div>
          <p>No timeline selected - Add a session below to get started</p>
        </div>
      )}
      {/* Divider */}
      <RichTreeView
        items={treeData}
        defaultCollapseIcon={<ExpandMoreIcon />}
        defaultExpandIcon={<ChevronRightIcon />}
        // onClick={handleTreeClick}
        // onClick={(event) => handleTreeClick(event, event.target.nodeId)} // Pass event to the function
        onSelectedItemsChange={handleSelectionChange} // Listen for selection changes
        selectedItems={selectedItems} // Control the selected items
      />
      <div>
        {timeline && (
          <Button
            onClick={() => handleAddStimulationParameters(timeline)}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            Add Stimulation Parameters
          </Button>
        )}
        {timeline && (
          <Button
            onClick={() => handleAddClinicalScores(timeline)}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            Add Clinical Scores
          </Button>
        )}
        {/* <button className="export-button" onClick={() => handleGroupStats()}>
          Stats
        </button> */}
      </div>
      {/* <button className="back-button" onClick={() => navigate('/viewer')}>
          Go To Viewer
        </button> */}

      {/* Quick Add Timelines Section */}
      <h2 className="section-title">Quick Add Session</h2>
      <div className="quick-add-timelines">
        <div>
          <button
            className="timeline-button"
            onClick={() => handleQuickAdd('baseline')}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            Baseline
          </button>
          <button
            className="timeline-button"
            onClick={() => handleQuickAdd('3months')}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            3 Months
          </button>
          <button
            className="timeline-button"
            onClick={() => handleQuickAdd('6months')}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            6 Months
          </button>
          <button
            className="timeline-button"
            onClick={() => handleQuickAdd('12months')}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            12 Months
          </button>
          <button
            className="timeline-button"
            onClick={() => handleQuickAdd('24months')}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            24 Months
          </button>
          <button
            className="timeline-button"
            onClick={() => handleQuickAdd('36months')}
            style={{
              borderRadius: '20px',
              backgroundColor: 'white',
              color: 'black',
              fontWeight: 'bold',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
              border: 'none',
              marginRight: '10px',
            }}
          >
            36 Months
          </button>
        </div>
      </div>

      {/* Another Divider */}
      <div className="divider"></div>

      {/* Add Timeline Input */}
      <h2 className="section-title">Custom Session Label</h2>
      <div className="add-timeline">
        <input
          className="timeline-input"
          type="text"
          placeholder="Add new session"
          value={newTimeline}
          onChange={(e) => setNewTimeline(e.target.value)}
        />
        <button
          className="add-timeline-button"
          onClick={handleAddTimeline}
          style={{
            borderRadius: '20px',
            backgroundColor: 'white',
            color: '#375D7A',
            fontWeight: 'bold',
            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.4)',
            border: 'none',
            marginRight: '10px',
          }}
        >
          +
        </button>
      </div>

      {/* Navigation Buttons */}
      {/* <HomeIcon
        onClick={() => navigate('/')}
        style={{
          fontSize: '36px', // Customize size
          color: '#1a73e8', // Customize color
          cursor: 'pointer', // Add pointer cursor on hover
          margin: '0 10px' // Add some margin for spacing
        }}
      /> */}
      {/* <button className="back-button" onClick={() => navigate('/')}>
        Back to Table
      </button> */}
      {/* <button onClick={() => setNiiVue(!niiVue)}>Show NiivueViewer</button> */}
      {/* {niiVue && (
        <div>
          <NiftiViewer />
        </div>
      )} */}
      {/* <button className="export-button" onClick={() => handleAddStimulationParameters(timeline)}>Add Stimulation Parameters</button>
      <button className="export-button" onClick={() => handleAddClinicalScores(timeline)}>Add Clinical Scores</button> */}
    </div>
  );
}

export default PatientDetails;
