/* eslint-disable import/no-duplicates */
import React, { useState, useEffect, useRef } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import SettingsIcon from '@mui/icons-material/Settings';

// Styles
import '../styles/App.css';
import 'bootstrap/dist/css/bootstrap.min.css';

// Components
import Navbar from '../components/common/Navbar';
import PatientDatabase from '../components/patient/PatientDatabase';
import PatientDetails from '../components/patient/PatientDetails';
import { PatientProvider } from '../contexts/PatientContext';
import Programmer from './Programmer';
import ClinicalScores from '../utils/ClinicalScores';
import CustomTable from '../components/common/CustomTable';
import GroupStats from '../components/group/GroupStats';
import DatabaseStats from '../utils/DatabaseStats';
import Import from '../utils/Import';
import NiiViewer from '../components/viewers/NiiViewer';
import SEEG from './SEEG';
import TestApp from '../niivue/ui/TestApp';

/**
 * Main App Component
 *
 * This is the root component of the Lead-DBS Programmer application.
 * It manages the overall application state including directory selection,
 * settings visibility, and routing between different views.
 */
export default function App() {
  // State management
  const [directoryPath, setDirectoryPath] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [renderKey, setRenderKey] = useState<number>(0);
  const [isLeadDBSFolder, setIsLeadDBSFolder] = useState<boolean | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoomLevel, setZoomLevel] = useState<number>(-1);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Constants
  /**
   * Updates the window dimensions and notifies the main process
   */
  const updateWindowSize = (): void => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height });
      window.electron.ipcRenderer.sendMessage('resize-window-2', width, height);
    }
  };

  /**
   * Handles folder selection by sending IPC message to main process
   */
  const selectFolder = (): void => {
    window.electron.ipcRenderer.sendMessage('select-folder', null);
  };

  // Initialize IPC communication
  window.electron.ipcRenderer.sendMessage('import-inputdata-file', ['ping']);
  window.electron.ipcRenderer.sendMessage('ipc-example', ['ping']);
  /**
   * Effect hook to handle folder selection and initialization
   */
  useEffect(() => {
    // Listen for folder selection events from main process
    const unsubscribe = window.electron.ipcRenderer.on(
      'folder-selected',
      (selectedPath: string) => {
        setDirectoryPath(selectedPath);
        setRenderKey((prevKey) => prevKey + 1);
        setIsLeadDBSFolder(true);
      },
    );

    // Load saved directory path on component mount
    const loadSavedDirectory = async (): Promise<void> => {
      try {
        const savedPath = await window.electron.ipcRenderer.invoke('get-saved-directory');
        if (savedPath) {
          setDirectoryPath(savedPath);
          window.electron.ipcRenderer.sendMessage('select-folder', savedPath);
        }
      } catch (error) {
        console.error('Error loading saved directory:', error);
      }
    };

    loadSavedDirectory();

    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * Effect hook to handle zoom level changes
   */
  useEffect(() => {
    if (window.electron?.zoom) {
      window.electron.zoom.setZoomLevel(zoomLevel);
    }
  }, [zoomLevel]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <PatientProvider>
        <Router>
          <Routes>
            {/* Main Dashboard Route */}
            <Route
              path="/"
              element={
                <div style={{ marginTop: '0px' }}>
                  <Navbar text="" color1="#375D7A" />

                  {/* Settings Panel */}
                  <div className="Navbar">
                    <SettingsIcon
                      className="settings-icon"
                      onClick={() => setShowSettings(!showSettings)}
                      style={{
                        cursor: 'pointer',
                        fontSize: '24px',
                        color: '#6c757d',
                        zIndex: '10',
                        marginLeft: '-70px',
                      }}
                    />

                    {showSettings && (
                      <div className="settings-panel">
                        <button className="select-button" onClick={selectFolder}>
                          Change Directory
                        </button>
                        {directoryPath && (
                          <p className="selected-directory">
                            Selected Directory: {directoryPath}
                          </p>
                        )}
                        <p className="lead-dbs-status">
                          {isLeadDBSFolder
                            ? 'This is a Lead-DBS folder.'
                            : 'This is not a Lead-DBS folder.'
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Main Patient Database Component */}
                  <PatientDatabase
                    key={String(renderKey)}
                    directoryPath={directoryPath}
                  />
                </div>
              }
            />
            {/* Patient Details Route */}
            <Route
              path="/patient/:id"
              element={
                <div>
                  <Navbar text="" color1="#375D7A" />
                  <div style={{ paddingTop: '50px' }} />
                  <PatientDetails
                    directoryPath={directoryPath}
                    leadDBS={isLeadDBSFolder}
                  />
                </div>
              }
            />

            {/* Programmer Route */}
            <Route path="/programmer" element={<Programmer />} />

            {/* Clinical Scores Route */}
            <Route
              path="/clinical-scores"
              element={
                <div>
                  <ClinicalScores />
                </div>
              }
            />

            {/* Viewer Route */}
            <Route
              path="/viewer"
              element={
                <div style={{ maxWidth: '1000px' }}>
                  {/* Placeholder for future viewer component */}
                </div>
              }
            />

            {/* Custom Table Route */}
            <Route
              path="/custom-table"
              element={
                <div style={{ maxWidth: '1000px' }}>
                  <CustomTable />
                </div>
              }
            />

            {/* Group Statistics Route */}
            <Route
              path="/group"
              element={
                <div style={{ maxWidth: '1000px' }}>
                  <GroupStats />
                </div>
              }
            />

            {/* Database Statistics Route */}
            <Route
              path="/groupstats"
              element={
                <div>
                  <Navbar text="" color1="#375D7A" />
                  <div style={{ paddingTop: '100px' }} />
                  <DatabaseStats directoryPath={directoryPath} />
                </div>
              }
            />

            {/* Import Route */}
            <Route
              path="/import"
              element={
                <div style={{ maxWidth: '1000px' }}>
                  <Import leadDBS={isLeadDBSFolder} />
                </div>
              }
            />

            {/* NiiVue Viewer Route */}
            <Route
              path="/niivue"
              element={
                <div>
                  <div style={{ marginTop: '100px' }}>
                    <TestApp />
                  </div>
                </div>
              }
            />

            {/* SEEG Route */}
            <Route
              path="/seeg"
              element={
                <div>
                  <Navbar text="" color1="#375D7A" />
                  <div>
                    <div style={{ marginTop: '100px' }}>
                      <SEEG directoryPath={directoryPath} />
                    </div>
                  </div>
                </div>
              }
            />
          </Routes>
        </Router>
      </PatientProvider>
    </div>
  );
}
