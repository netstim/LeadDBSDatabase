/**
 * Patient Database Component
 *
 * This component displays and manages the patient database. It provides functionality
 * for viewing, editing, searching, sorting, and exporting patient data. The component
 * integrates with the PatientContext for global state management and provides
 * navigation to individual patient details.
 */

import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

// Material-UI Components
import {
  TextField,
  Button,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Typography,
  TableSortLabel,
  Select,
  MenuItem,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tooltip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Edit, Delete, Save, Cancel } from '@mui/icons-material';

// Local Components
import { PatientContext } from '../../contexts/PatientContext';
import ExportToLeadGroupDialog from '../group/ExportToLeadGroupDialog';

// Type definitions
interface Patient {
  id: string;
  [key: string]: any;
}

interface PatientDatabaseProps {
  directoryPath: string | null;
  leadDBS: boolean;
}

const getRequestedPatientIds = (launchData: any): string[] => {
  if (
    launchData?.scope === 'patient' &&
    typeof launchData?.selectedPatientId === 'string' &&
    launchData.selectedPatientId
  ) {
    return [launchData.selectedPatientId];
  }
  if (Array.isArray(launchData?.subjects)) {
    const subjectIds = launchData.subjects
      .map((subject) => subject?.id || subject?.patientname)
      .filter(Boolean);
    if (subjectIds.length > 0) return subjectIds;
  }
  if (Array.isArray(launchData?.patientname)) {
    return launchData.patientname.filter(Boolean);
  }
  return launchData?.patientname ? [launchData.patientname] : [];
};

function PatientDatabase({ directoryPath, leadDBS }: PatientDatabaseProps) {
  // Context and navigation
  const { patients, setPatients } = useContext(PatientContext);
  const navigate = useNavigate();

  // State management
  const [editRowId, setEditRowId] = useState<string | null>(null);
  const [editedPatient, setEditedPatient] = useState<Partial<Patient>>({});
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [orderBy, setOrderBy] = useState<string>('id');
  const [editMode, setEditMode] = useState<boolean>(false);
  const [patientListLoaded, setPatientListLoaded] = useState(false);
  const [launchWarning, setLaunchWarning] = useState('');
  const launchHandledRef = useRef(false);
  // const [columns, setColumns] = useState(() => {
  //   if (patients.length > 0) {
  //     return Object.keys(patients[0])
  //       .filter((columnKey) => columnKey !== 'id') // Rename 'key' to 'columnKey'
  //       .map((columnKey) => ({
  //         id: columnKey,
  //         label: columnKey.charAt(0).toUpperCase() + columnKey.slice(1), // Capitalize the first letter
  //       }));
  //   }
  //   return [];
  // });

  const [columns, setColumns] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState(new Set());

  useEffect(() => {
    if (patients.length > 0) {
      const allColumnKeys = new Set();
      patients.forEach((patient) => {
        Object.keys(patient).forEach((key) => {
          if (key !== 'PatientID' && key !== 'id') {
            allColumnKeys.add(key);
          }
        });
      });

      const updatedColumns = Array.from(allColumnKeys).map((columnKey) => ({
        id: columnKey,
        label: columnKey.charAt(0).toUpperCase() + columnKey.slice(1),
      }));

      setColumns(updatedColumns);
      // setVisibleColumns(new Set(['elmodel', 'Age' || 'age', 'Sex' || 'sex', 'Condition' || 'diagnosis'])); // Initialize only specific columns as visible
      setVisibleColumns(
        new Set([
          'City',
          'Netstim / CBCT Publications',
          'Condition',
          'Target',
          'elmodel',
        ]),
      );
    }
  }, [patients]);

  const toggleColumnVisibility = (columnId) => {
    setVisibleColumns((prevVisibleColumns) => {
      const newVisibleColumns = new Set(prevVisibleColumns);
      if (newVisibleColumns.has(columnId)) {
        newVisibleColumns.delete(columnId);
      } else {
        newVisibleColumns.add(columnId);
      }
      return newVisibleColumns;
    });
  };

  const [newColumnId, setNewColumnId] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [columnToDelete, setColumnToDelete] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<Set<string>>(
    new Set(),
  );
  const [leadGroupExportOpen, setLeadGroupExportOpen] = useState(false);
  const [leadGroupExportSuccess, setLeadGroupExportSuccess] = useState('');

  const fileInputRef = useRef(null);

  const handleButtonClick = () => {
    fileInputRef.current.click(); // Trigger file input click
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        console.log(jsonData); // Pass data to your handler function
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Handle input changes for the edited patient
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditedPatient((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle editing a patient
  const handleEditClick = (patient) => {
    setEditRowId(patient.id);
    setEditedPatient({ ...patient });
  };

  // Save updated patient
  const handleSaveClick = () => {
    const updatedPatients = patients.map((p) =>
      p.id === editRowId ? editedPatient : p,
    );
    setPatients(updatedPatients);
    savePatientsToJson(updatedPatients, directoryPath); // Save to JSON
    setEditRowId(null); // Exit edit mode
  };

  // Cancel editing
  const handleCancelClick = () => {
    setEditRowId(null);
    setEditedPatient({});
  };

  // Handle sorting when a column header is clicked
  const handleRequestSort = (property) => {
    const isAsc = orderBy === property && order === 'asc';
    setOrder(isAsc ? 'desc' : 'asc');
    setOrderBy(property);
  };

  // Sort patients based on the column and order
  // const sortPatients = (patients, comparator) => {
  //   const stabilizedPatients = patients.map((el, index) => [el, index]);
  //   stabilizedPatients.sort((a, b) => {
  //     const order = comparator(a[0], b[0]);
  //     if (order !== 0) return order;
  //     return a[1] - b[1];
  //   });
  //   return stabilizedPatients.map((el) => el[0]);
  // };

  const countNonEmptyFields = (patient) => {
    return Object.values(patient).filter(
      (value) => value !== null && value !== '',
    ).length;
  };

  // Sort patients based on the column and order
  const sortPatients = (patients, comparator) => {
    const stabilizedPatients = patients.map((el, index) => [el, index]);
    stabilizedPatients.sort((a, b) => {
      // First, sort by the number of non-empty fields
      const countA = countNonEmptyFields(a[0]);
      const countB = countNonEmptyFields(b[0]);
      if (countA !== countB) {
        return countB - countA; // Descending order
      }
      // If counts are equal, use the provided comparator
      const order = comparator(a[0], b[0]);
      if (order !== 0) return order;
      return a[1] - b[1];
    });
    return stabilizedPatients.map((el) => el[0]);
  };

  // Sorting comparator function
  const getComparator = (order, orderBy) => {
    return order === 'desc'
      ? (a, b) => descendingComparator(a, b, orderBy)
      : (a, b) => -descendingComparator(a, b, orderBy);
  };

  // Descending comparator
  const descendingComparator = (a, b, orderBy) => {
    if (b[orderBy] < a[orderBy]) {
      return -1;
    }
    if (b[orderBy] > a[orderBy]) {
      return 1;
    }
    return 0;
  };

  // Save the patients data to a JSON file in the selected directory
  const savePatientsToJson = (patientsData, path) => {
    console.log('PATIENTS DATA: ', patientsData);
    if (path) {
      window.electron.ipcRenderer.sendMessage(
        'save-patients-json',
        path,
        patientsData,
      );
    } else {
      console.error('No folder selected');
    }
  };

  const sortedPatients = sortPatients(patients, getComparator(order, orderBy));

  // Filter patients based on the search term
  const filteredPatients = sortedPatients.filter((patient) =>
    Object.values(patient).some(
      (value) =>
        value &&
        value
          .toString()
          .toLowerCase()
          .includes(searchTerm.toString().toLowerCase()),
    ),
  );
  const selectedPatientRows = sortedPatients.filter((patient) =>
    selectedPatients.has(patient.id),
  );
  const filteredSelectedCount = filteredPatients.filter((patient) =>
    selectedPatients.has(patient.id),
  ).length;
  const leadGroupExportDisabled =
    !leadDBS || selectedPatientRows.length === 0 || !directoryPath;
  let leadGroupExportTooltip =
    'Create a Lead-Group analysis from the selected patients.';
  if (!leadDBS) {
    leadGroupExportTooltip =
      'Lead-Group export requires a Lead-DBS dataset with reconstructed patient folders.';
  } else if (selectedPatientRows.length === 0) {
    leadGroupExportTooltip = 'Select at least one patient to export.';
  } else if (!directoryPath) {
    leadGroupExportTooltip = 'Choose a Lead-DBS dataset before exporting.';
  }

  useEffect(() => {
    if (!leadDBS && leadGroupExportOpen) {
      setLeadGroupExportOpen(false);
    }
  }, [leadDBS, leadGroupExportOpen]);

  const [currentPatient, setCurrentPatient] = useState({
    id: '',
    name: '',
    age: '',
    gender: '',
    diagnosis: '',
  });
  const [originalId, setOriginalId] = useState(null); // Track the original ID
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const unsubscribeSuccess = window.electron.ipcRenderer.on(
      'file-read-success',
      (patientsData) => {
        console.log(patientsData);
        setPatients(Array.isArray(patientsData) ? patientsData : []);
        setSelectedPatients(new Set());
        setLeadGroupExportSuccess('');
        setPatientListLoaded(true);
      },
    );

    const unsubscribeNotFound = window.electron.ipcRenderer.on(
      'file-not-found',
      () => {
        console.log(
          'No dataset_description.json found in the selected directory',
        );
      },
    );

    const unsubscribeError = window.electron.ipcRenderer.on(
      'file-read-error',
      (error) => {
        console.error(error);
        setPatientListLoaded(true);
        setLaunchWarning(String(error));
      },
    );

    return () => {
      unsubscribeSuccess();
      unsubscribeNotFound();
      unsubscribeError();
    };
  }, [setPatients]);

  useEffect(() => {
    if (!directoryPath || !patientListLoaded || launchHandledRef.current)
      return;

    let active = true;
    const openLaunchRequest = async () => {
      try {
        const arg = await window.electron.ipcRenderer.invoke('get-launch-data');
        if (!active || arg?.mode !== 'stimulate') {
          launchHandledRef.current = true;
          return;
        }

        const requestedPatientIds = getRequestedPatientIds(arg);

        if (requestedPatientIds.length === 0) {
          launchHandledRef.current = true;
          setLaunchWarning(
            'No patients were selected in Lead-DBS. Select at least one patient and open SPARK again.',
          );
          return;
        }

        const requestedPatient = patients.find(
          (candidate) => candidate.id === requestedPatientIds[0],
        );
        if (!requestedPatient) {
          launchHandledRef.current = true;
          setLaunchWarning(
            `Patient ${requestedPatientIds[0]} could not be found in this dataset.`,
          );
          return;
        }

        const outputTimeline =
          arg.type === 'leadgroup' || arg.scope === 'group'
            ? requestedPatientIds[0]
            : arg.labels?.[0] || arg.label;
        const route = arg.type === 'seeg' ? '/seeg' : '/programmer';
        launchHandledRef.current = true;
        navigate(route, {
          state: {
            patient: requestedPatient,
            timeline: outputTimeline,
            directoryPath,
            leadDBS: true,
          },
        });
      } catch (error) {
        if (active) {
          launchHandledRef.current = true;
          setLaunchWarning(
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    };

    openLaunchRequest();
    return () => {
      active = false;
    };
  }, [directoryPath, navigate, patientListLoaded, patients]);

  // Handle input changes in the form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentPatient({ ...currentPatient, [name]: value });
  };

  // Add a new patient and save JSON file
  const addPatient = () => {
    const newPatient = {
      id: Date.now().toString(), // Generate a unique ID
      // name: '',
      // age: '',
      // gender: '',
      // diagnosis: '',
    };

    const updatedPatients = [...patients, newPatient];
    setPatients(updatedPatients);
    savePatientsToJson(updatedPatients, directoryPath); // Save to JSON
  };

  // Update a patient and save JSON file
  const updatePatient = () => {
    const updatedPatients = patients.map((p) =>
      p.id === originalId ? currentPatient : p,
    );
    setPatients(updatedPatients);
    savePatientsToJson(updatedPatients, directoryPath); // Save to JSON
    clearForm();
    setOpenDialog(false);
  };

  // Delete a patient and save the JSON file
  const deletePatient = (id) => {
    const updatedPatients = patients.filter((p) => p.id !== id);
    setPatients(updatedPatients);
    savePatientsToJson(updatedPatients, directoryPath); // Save to JSON
  };

  // Clear the form
  const clearForm = () => {
    setCurrentPatient({ id: '', name: '', age: '', gender: '', diagnosis: '' });
    setOriginalId(null); // Reset originalId
    setIsEditing(false);
  };

  const addColumn = (id, label) => {
    if (!columns.some((column) => column.id === id)) {
      setColumns([...columns, { id, label }]);
    } else {
      console.error('Column with this ID already exists');
    }
  };

  const removeColumn = (id) => {
    setColumns(columns.filter((column) => column.id !== id));
    Object.keys(patients).forEach((patient) => {
      delete patients[patient][id];
    });
    console.log('Patients: ', patients);
    savePatientsToJson(patients, directoryPath);
  };

  const handleCheckboxChange = (id) => {
    setSelectedPatients((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  const handleSelectAllClick = (event) => {
    setSelectedPatients((current) => {
      const next = new Set(current);
      filteredPatients.forEach(({ id }) => {
        if (event.target.checked) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleCreateMiniset = () => {
    window.electron.ipcRenderer
      .invoke('file-reader')
      .then((folderPath) => {
        if (folderPath) {
          console.log('Selected folder path:', folderPath);
          // You can now use the folderPath to save or manipulate files
          window.electron.ipcRenderer.sendMessage(
            'create-miniset',
            folderPath,
            selectedPatients,
          );
        } else {
          console.log('No folder selected');
        }
      })
      .catch((error) => {
        console.error('Error selecting folder:', error);
      });
    console.log(selectedPatients);
  };

  return (
    <div style={{ width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <Typography
        variant="h3"
        style={{
          fontWeight: 'bold',
          marginBottom: '-20px',
          textAlign: 'center',
        }}
      >
        SPARK-DBS
      </Typography>

      <Container style={{ display: 'flex', flexDirection: 'column' }}>
        {launchWarning && (
          <Alert severity="warning" onClose={() => setLaunchWarning('')}>
            {launchWarning}
          </Alert>
        )}
        {leadGroupExportSuccess && (
          <Alert
            severity="success"
            onClose={() => setLeadGroupExportSuccess('')}
            sx={{ overflowWrap: 'anywhere' }}
          >
            Lead-Group export saved to {leadGroupExportSuccess}
          </Alert>
        )}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '-20px',
          }}
        >
          {/* Search Field */}
          {!editMode && (
            <TextField
              label="Search"
              variant="standard"
              margin="normal"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputLabelProps={{ style: { fontSize: '14px' } }}
              InputProps={{ style: { fontSize: '14px' } }}
            />
          )}
          <Button
            // variant="contained"
            // color="default"
            onClick={() => setEditMode((prev) => !prev)}
            style={{ width: '180px', marginLeft: 'auto' }}
          >
            {editMode ? 'Close Edit Mode' : 'Edit Table Columns'}
          </Button>
          {editMode && (
            <>
              <TextField
                label="New Column ID"
                value={newColumnId}
                onChange={(e) => setNewColumnId(e.target.value)}
                variant="outlined"
                size="small"
              />
              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  addColumn(newColumnId, newColumnId);
                  setNewColumnId('');
                }}
              >
                Add Column
              </Button>
              <Select
                value={columnToDelete}
                onChange={(e) => setColumnToDelete(e.target.value)}
                displayEmpty
                style={{ minWidth: '150px' }}
              >
                <MenuItem value="" disabled>
                  Select column to delete
                </MenuItem>
                {columns.map((column) => (
                  <MenuItem key={column.id} value={column.id}>
                    {column.label}
                  </MenuItem>
                ))}
              </Select>
              <Button
                variant="contained"
                color="secondary"
                onClick={() => {
                  removeColumn(columnToDelete);
                  setColumnToDelete('');
                }}
              >
                Remove Column
              </Button>
              <div>
                <Accordion>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="panel1a-content"
                    id="panel1a-header"
                  >
                    <Typography variant="subtitle1">
                      Column Visibility
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {columns.map((column) => (
                      <div key={column.id}>
                        <Checkbox
                          checked={visibleColumns.has(column.id)}
                          onChange={() => toggleColumnVisibility(column.id)}
                        />
                        {column.label}
                      </div>
                    ))}
                  </AccordionDetails>
                </Accordion>
              </div>
            </>
          )}

          {/* Add Patient Button */}
          {!editMode && (
            <div>
              {/* <Button
                // variant="contained"
                // color="primary"
                onClick={addPatient}
                style={{
                  fontSize: '14px',
                  padding: '10px 20px',
                  // marginLeft: 'auto',
                }}
              >
                Add Patient
              </Button> */}
              {/* <Button
                // variant="contained"
                // color="default"
                onClick={() => navigate('/niivue')}
                style={{ marginLeft: '5px' }}
              >
                NiiVue
              </Button> */}
              <Button
                // variant="contained"
                // color="default"
                onClick={() => navigate('/seeg')}
                style={{ marginLeft: '5px' }}
              >
                SEEG
              </Button>
              <Button
                onClick={() => handleCreateMiniset()}
                style={{ marginLeft: '5px' }}
              >
                Create Miniset
              </Button>
              <Tooltip title={leadGroupExportTooltip} arrow describeChild>
                <span style={{ display: 'inline-flex', marginLeft: '5px' }}>
                  <Button
                    onClick={() => {
                      if (!leadDBS) return;
                      setLeadGroupExportSuccess('');
                      setLeadGroupExportOpen(true);
                    }}
                    disabled={leadGroupExportDisabled}
                  >
                    Export to Lead-Group…
                  </Button>
                </span>
              </Tooltip>
              <Button
                // variant="contained"
                // color="default"
                onClick={() => navigate('/groupstats')}
                style={{ marginLeft: '5px' }}
              >
                Group Stats
              </Button>
              <Button
                // variant="contained"
                // color="default"
                onClick={() => navigate('/import')}
                style={{ marginLeft: '5px' }}
              >
                Import
              </Button>
              {/* <Button
                // variant="contained"
                // color="default"
                onClick={() => navigate('/niivue')}
                style={{ marginLeft: '5px' }}
              >
                NiiVue
              </Button> */}
              {/* <Button
                style={{ marginLeft: '5px' }}
                onClick={handleButtonClick}
              >
                Import Stimulation Parameters
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".xlsx, .xls"
                onChange={handleFileChange}
              /> */}
            </div>
          )}
        </div>
        <TableContainer
          component={Paper}
          style={{ flex: 1, marginTop: '20px' }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      filteredSelectedCount > 0 &&
                      filteredSelectedCount < filteredPatients.length
                    }
                    checked={
                      filteredPatients.length > 0 &&
                      filteredSelectedCount === filteredPatients.length
                    }
                    onChange={handleSelectAllClick}
                  />
                </TableCell>
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'id'}
                    direction={orderBy === 'id' ? order : 'asc'}
                    onClick={() => handleRequestSort('id')}
                  >
                    ID
                  </TableSortLabel>
                </TableCell>
                {/* {columns.map((column) => (
                  <TableCell key={column.id}>
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleRequestSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  </TableCell>
                ))} */}
                {columns.map(
                  (column) =>
                    visibleColumns.has(column.id) && (
                      <TableCell key={column.id}>
                        <TableSortLabel
                          active={orderBy === column.id}
                          direction={orderBy === column.id ? order : 'asc'}
                          onClick={() => handleRequestSort(column.id)}
                        >
                          {column.label}
                        </TableSortLabel>
                      </TableCell>
                    ),
                )}
                <TableCell style={{}}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedPatients.has(patient.id)}
                      onChange={() => handleCheckboxChange(patient.id)}
                    />
                  </TableCell>
                  <TableCell
                    style={{
                      cursor: editRowId === patient.id ? 'default' : 'pointer',
                      color: editRowId === patient.id ? 'black' : 'blue',
                    }}
                    onClick={
                      editRowId !== patient.id
                        ? () =>
                            navigate(`/patient/${patient.id}`, {
                              state: { patient },
                            })
                        : undefined
                    }
                  >
                    {editRowId === patient.id ? (
                      <TextField
                        value={editedPatient.id || ''}
                        name="id"
                        onChange={handleEditChange}
                      />
                    ) : (
                      patient.id
                    )}
                  </TableCell>
                  {/* {columns.map((column) => (
                    <TableCell key={column.id}>
                      {editRowId === patient.id ? (
                        <TextField
                          value={editedPatient[column.id] || ''}
                          name={column.id}
                          onChange={handleEditChange}
                        />
                      ) : (
                        patient[column.id]
                      )} */}
                  {columns.map(
                    (column) =>
                      visibleColumns.has(column.id) && (
                        <TableCell key={column.id}>
                          {editRowId === patient.id ? (
                            <TextField
                              value={editedPatient[column.id] || ''}
                              name={column.id}
                              onChange={handleEditChange}
                            />
                          ) : (
                            patient[column.id]
                          )}
                        </TableCell>
                      ),
                  )}
                  <TableCell>
                    {editRowId === patient.id ? (
                      <>
                        <IconButton onClick={handleSaveClick} color="primary">
                          <Save />
                        </IconButton>
                        <IconButton
                          onClick={handleCancelClick}
                          color="secondary"
                        >
                          <Cancel />
                        </IconButton>
                      </>
                    ) : (
                      <>
                        <IconButton
                          onClick={() => handleEditClick(patient)}
                          color="primary"
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          onClick={() => deletePatient(patient.id)}
                          color="secondary"
                        >
                          <Delete />
                        </IconButton>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Container>
      <div>
        {/* {directoryPath && patients.length > 0 && (
          // <DatabaseStats patients={patients} directoryPath={directoryPath} />
          <button onClick={() => navigate('/groupstats')}>Group Stats</button>
        )} */}
        {/* <Button onClick={() => handleCreateMiniset()}>Create Miniset</Button> */}
      </div>
      <ExportToLeadGroupDialog
        open={leadDBS && leadGroupExportOpen}
        directoryPath={directoryPath}
        leadDBS={leadDBS}
        patients={selectedPatientRows}
        onClose={() => setLeadGroupExportOpen(false)}
        onExportSuccess={setLeadGroupExportSuccess}
      />
    </div>
  );
}

export default PatientDatabase;
