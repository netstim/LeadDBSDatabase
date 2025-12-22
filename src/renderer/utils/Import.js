import { useLocation, useNavigate } from 'react-router-dom';
import React, { useState, useContext } from 'react';
import * as XLSX from 'xlsx'; // Import xlsx for Excel parsing
import { PatientContext } from '../contexts/PatientContext';
import initializeS from './InitializeS';
import electrodeData from '../assets/data/electrodeModels.json';

function Import({ leadDBS }) {
  const allPatients = useContext(PatientContext);
  const [timeline, setTimeline] = useState('');
  const navigate = useNavigate();

  const varargout = [
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

  const handleImportedElectrode = (importedElectrode) => {
    const electrodeInfo = varargout.find(
      (item) => item.displayName === importedElectrode,
    );
    return electrodeInfo ? electrodeInfo.value : 'boston_vercise_directed';
  };

  const contactMapper = (level, value, etageidx) => {
    const contactMapping = {
      a: 0,
      b: 1,
      c: 2,
    };

    // Parse etageidx to handle ranges like '2:4'
    const parseEtageIdx = (etage) => {
      if (etage.includes(':')) {
        const [start, end] = etage.split(':').map(Number);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }
      return [parseInt(etage, 10)];
    };

    const etageLevel = parseEtageIdx(etageidx[level - 1]);
    const contactValue = etageLevel[contactMapping[value]];

    console.log(level, value, contactValue);
    return contactValue;
  };

  // Helper function to process contacts
  const processContacts = (
    S,
    contacts,
    polarity,
    hemisphere,
    config,
    source,
  ) => {
    const isDirected = config.isdirected === 1;
    const etageIdx = isDirected
      ? config.etageidx
      : Array.from({ length: config.numel }, (_, i) => i + 1);

    console.log('Config', electrodeData);

    // Define a mapping from contact names to indices
    const contactMapping = {
      1: '1',
      '2a': '2',
      '2b': '3',
      '2c': '4',
      '3a': '5',
      '3b': '6',
      '3c': '7',
      4: '8',
    };
    // Parse the contacts
    const parsedContacts = contacts
      .split('/')
      .map((entry) => {
        let [contact, percentage] = entry.split(',').map((x) => x.trim());
        const percValue = percentage
          ? parseFloat(percentage.replace('%', ''))
          : 100 / contacts.split('/').length; // Use 100 / length of contacts if percentage not specified

        contact = contact.replace(/[+-]$/, '');
        if (contact === 'C') {
          return { contact: 'C', percValue };
        }
        if (/[a-z]/.test(contact)) {
          // If contact is like "2ab", split and distribute percentage
          const contactParts = contact.split(/(?=[a-z])/);
          const level = parseInt(contactParts.shift(), 10);
          console.log('Contact Parts', contactParts, contact);
          // const mappedContacts = contactParts.map((part) => {
          //   return contactMapper(level, part, etageIdx, percValue);
          // });
          // return contactParts.map((part) => ({
          //   contact: part,
          //   percValue: percValue / contactParts.length,
          // }));
          return contactParts.map((part) => {
            const mappedContact = contactMapper(level, part, etageIdx);
            return {
              contact: mappedContact,
              percValue: percValue / contactParts.length,
            };
          });
        }
        if (isDirected) {
          console.log('Contact', contact);
          const level = parseInt(contact, 10);
          console.log('Level', level);
          const etageValue = etageIdx[level - 1];
          console.log('Etage Value', etageValue);
          if (etageValue.includes(':')) {
            const [start, end] = etageValue.split(':').map(Number);
            const etageContacts = Array.from(
              { length: end - start + 1 },
              (_, i) => (start + i).toString(),
            );
            return etageContacts.map((etageContact) => ({
              contact: etageContact,
              percValue: percValue / etageContacts.length,
            }));
          }
          return {
            contact: parseInt(etageValue, 10),
            percValue,
          };
        }

        return { contact, percValue };
      })
      .flat(); // Flatten the array in case of split contacts

    console.log(parsedContacts);

    // Calculate percentages for contacts
    let totalPerc = 0;
    const missingPerc = [];
    parsedContacts.forEach(({ contact, percValue }) => {
      if (percValue === null) {
        missingPerc.push(contact);
      } else {
        totalPerc += percValue;
      }
    });

    console.log(missingPerc);
    console.log(totalPerc);

    const defaultPerc =
      missingPerc.length > 0 ? (100 - totalPerc) / missingPerc.length : 0;

    // Process each contact
    parsedContacts.forEach(({ contact, percValue }) => {
      const percentage = percValue === null ? defaultPerc : percValue;
      if (contact === 'C') {
        console.log('case');
        S[`${hemisphere}s${source}`].case = {
          perc: 100,
          pol: polarity === -1 ? 1 : 2,
        };
      } else {
        // S[`${hemisphere}s${source}`].case = {
        //   perc: 0,
        //   pol: polarity === 0,
        // };
        S[`${hemisphere}s${source}`][`k${contact}`] = {
          perc: percentage,
          pol: polarity === -1 ? 1 : 2,
          imp: 1,
        };
      }
    });

    return S;
  };

  function parseStimulationParameters(row) {
    const label = row.Label;
    const electrodeModelR = handleImportedElectrode(row.ElectrodeModel_R);
    const electrodeModelL = handleImportedElectrode(row.ElectrodeModel_L);

    // Get electrode configurations for both hemispheres

    // Will eventually need to put the contact parser in here
    const configR = electrodeData[electrodeModelR];
    const configL = electrodeData[electrodeModelL];

    // Initialize S using numel from the electrode configurations
    let S = initializeS(label, configR.numel);

    for (let source = 1; source <= 4; source++) {
      // Parse Right Hemisphere
      const rightNegative = row[`Right_${source}_Negative`];
      const rightPositive = row[`Right_${source}_Positive`];
      const rightAmpInput = row[`Right_${source}_Amp`];
      S[`Rs${source}`].case = { perc: 0, pol: 0 };
      S[`Ls${source}`].case = { perc: 0, pol: 0 };
      if (rightAmpInput) {
        const ampValue = parseFloat(rightAmpInput.replace(/[^\d.]/g, '')); // Extract amplitude
        const unit = rightAmpInput.includes('mA') ? 2 : 1; // Determine unit (mA or V)
        S[`Rs${source}`].amp = ampValue;
        S[`Rs${source}`].va = unit;
      }

      if (rightNegative) {
        console.log('Right Negative', rightNegative);
        S = processContacts(S, rightNegative, -1, 'R', configR, source);
      }

      if (rightPositive) {
        console.log('Right Positive', rightPositive);
        S = processContacts(S, rightPositive, 1, 'R', configR, source);

        // Reset case if positive contacts exist
        // S[`Rs${source}`].case = { perc: 0, pol: 0 };
      }

      // Parse Left Hemisphere
      const leftNegative = row[`Left_${source}_Negative`];
      const leftPositive = row[`Left_${source}_Positive`];
      const leftAmpInput = row[`Left_${source}_Amp`];

      if (leftAmpInput) {
        const ampValue = parseFloat(leftAmpInput.replace(/[^\d.]/g, ''));
        const unit = leftAmpInput.includes('mA') ? 2 : 1;
        S[`Ls${source}`].amp = ampValue;
        S[`Ls${source}`].va = unit;
      }

      if (leftNegative) {
        console.log('Left Negative', leftNegative);
        S = processContacts(S, leftNegative, -1, 'L', configL, source);
      }

      if (leftPositive) {
        console.log('Left Positive', leftPositive);
        S = processContacts(S, leftPositive, 1, 'L', configL, source);

        // Reset case if positive contacts exist
        // S[`Ls${source}`].case = { perc: 0, pol: 0 };
      }
    }

    return S;
  }

  const parseStimulations = (sheetData) => {
    const parsedData = sheetData.map((row) => {
      const patientID = row.PatientID;
      const S = parseStimulationParameters(row);
      return { id: patientID, S, timeline: S.label };
    });
    console.log('Parsed Stimulation Data:', parsedData);
    // window.electron.ipcRenderer.sendMessage(
    //   'batch-import-stimulation',
    //   parsedData,
    //   leadDBS,
    // );
  };
  // Clinical Scores

  function restructurePatientData(data) {
    // Extract Patient ID and Timeline
    const id = data.PatientID;
    const timeline = data.Timeline;

    // Filter out the scores by excluding non-score keys
    const scores = Object.keys(data)
      .filter((key) => key !== 'PatientID' && key !== 'timeline')
      .reduce((acc, key) => {
        acc[key] = data[key];
        return acc;
      }, {});

    // Return the restructured object
    return {
      id,
      timeline,
      scores,
    };
  }

  // Submit data to main process
  const handleSubmit = (sheetData) => {
    // if (!timeline || sheetData.length === 0) {
    //   alert('Please provide a timeline and import data!');
    //   return;
    // }

    // const patientData = sheetData.map((entry) => ({
    //   ...entry,
    //   timeline,
    // }));

    if (sheetData.length === 0) {
      alert('Please provide data!');
      return;
    }
    const patientData = sheetData.map((entry) => ({
      ...entry,
    }));
    console.log('Patient Data', patientData);
    const processedData = {};
    Object.keys(patientData).forEach((key) => {
      processedData[key] = restructurePatientData(patientData[key]);
    });

    console.log(processedData);
    window.electron.ipcRenderer.sendMessage(
      'batch-import',
      processedData,
      leadDBS,
    );

    alert('Data submitted successfully!');
  };

  const parseDemographics = (sheetData) => {
    console.log('Demographics Data', sheetData);
    const participantsData = [];
    // window.electron.ipcRenderer.invoke('get-participants', 'demographics').then((participants) => {
    //   console.log('Participants: ', participants);
    //   participantsData = participants;
    // }).catch((error) => {
    //   console.error('Error fetching participants:', error);
    // });
    const participants = allPatients.patients;
    sheetData.forEach((row) => {
      const participantIndex = participants.findIndex(
        (p) => {
          console.log(p);
          console.log(row.patientID);
          console.log(row.PatientID.trim());
          const newID = row.PatientID.trim();
          return p.id === newID;
        },
      );
      if (participantIndex !== -1) {
        // Update existing participant information
        console.log('Updating Participant: ', participants[participantIndex]);
        const { PatientID, ...updatedRow } = row; // Exclude PatientID from being saved
        participants[participantIndex] = {
          ...participants[participantIndex],
          ...updatedRow,
        };
      } else {
        // Add new participant if not found
        participants.push(row);
      }
    });
    console.log('Participants: ', participants);
    window.electron.ipcRenderer.sendMessage(
      'save-patients-json',
      null,
      participants,
    );
  };

  // Parse Excel file
  const parseFile = (uploadedFile, fileType) => {
    if (!uploadedFile) {
      alert('Please select a file!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });

      workbook.SheetNames.forEach((sheetName) => {
        const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (fileType === 'clinical') {
          handleSubmit(sheetData);
        } else if (fileType === 'demographics') {
          parseDemographics(sheetData);
        } else {
          parseStimulations(sheetData);
        }
      });
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const handleDemographicsExcel = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      parseFile(uploadedFile, 'demographics');
      e.target.value = ''; // Reset the file input
    }
  };

  const handleStimulationParametersExcel = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      parseFile(uploadedFile);
      e.target.value = ''; // Reset the file input
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      parseFile(uploadedFile, 'clinical');
      e.target.value = ''; // Reset the file input
    }
  };

  const containerStyle = {
    padding: '40px',
    maxWidth: '800px',
    margin: '0 auto',
    fontFamily: "'Roboto', sans-serif",
    color: '#333',
  };

  const headerStyle = {
    textAlign: 'center',
    fontSize: '32px',
    marginBottom: '20px',
    color: '#2C3E50',
  };

  const sectionCardStyle = {
    backgroundColor: '#f9f9f9',
    borderRadius: '10px',
    boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)',
    padding: '20px',
    marginBottom: '20px',
  };

  const sectionHeaderStyle = {
    fontSize: '24px',
    marginBottom: '10px',
    color: '#34495E',
  };

  const sectionDescriptionStyle = {
    fontSize: '16px',
    marginBottom: '20px',
    color: '#7F8C8D',
  };

  const buttonContainerStyle = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  };

  const actionButtonStyle = {
    padding: '10px 20px',
    fontSize: '16px',
    color: 'white',
    backgroundColor: '#007bff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, transform 0.2s ease',
  };

  const uploadContainerStyle = {
    display: 'grid',
    gap: '15px',
  };

  const uploadLabelStyle = {
    display: 'block',
    padding: '10px 20px',
    fontSize: '16px',
    color: '#333',
    backgroundColor: '#ecf0f1',
    borderRadius: '5px',
    border: '2px dashed #bdc3c7',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease, transform 0.2s ease',
  };

  const fileInputStyle = {
    display: 'none',
  };

  const backButtonStyle = {
    display: 'block',
    margin: '20px auto 0',
    padding: '10px 20px',
    fontSize: '16px',
    color: '#fff',
    backgroundColor: '#2c3e50',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'background-color 0.3s ease, transform 0.2s ease',
  };

  const downloadTemplate = async (templateName, displayName) => {
    try {
      // Use IPC to get the template file from the main process
      const fileBuffer = await window.electron.ipcRenderer.invoke(
        'download-template',
        templateName,
      );

      // Create a Blob from the ArrayBuffer
      const blob = new Blob([fileBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // Create a blob URL and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = templateName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error downloading template ${templateName}:`, error);
      alert(
        `Failed to download ${displayName || templateName}. Please check the console for details.`,
      );
    }
  };

  const downloadTemplateClinicalScores = () => {
    downloadTemplate(
      'Clinical_Scores_Template.xlsx',
      'Clinical Scores Template',
    );
  };

  const downloadTemplateStimulationParameters = () => {
    downloadTemplate(
      'Stimulation_Parameters_Template.xlsx',
      'Stimulation Parameters Template',
    );
  };

  const downloadTemplateDemographics = () => {
    downloadTemplate('Demographics_Template.xlsx', 'Demographics Template');
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>Import Data</h1>

      {/* Part 1: Download Template Excel */}
      <div style={sectionCardStyle}>
        <h2 style={sectionHeaderStyle}>Part 1: Download Template</h2>
        <p style={sectionDescriptionStyle}>
          Download a template to ensure your file format is compatible for
          upload.
        </p>
        <div style={buttonContainerStyle}>
          <button
            style={actionButtonStyle}
            onClick={downloadTemplateClinicalScores}
          >
            Download Clinical Scores Template
          </button>
          <button
            style={actionButtonStyle}
            onClick={downloadTemplateStimulationParameters}
          >
            Download Stimulation Parameters Template
          </button>
          <button
            style={actionButtonStyle}
            onClick={downloadTemplateDemographics}
          >
            Download Demographics Template
          </button>
        </div>
      </div>

      {/* Part 2: Upload File */}
      <div style={sectionCardStyle}>
        <h2 style={sectionHeaderStyle}>Part 2: Upload Files</h2>
        <p style={sectionDescriptionStyle}>
          Upload your completed Excel file for processing.
        </p>
        <div style={uploadContainerStyle}>
          <label style={uploadLabelStyle}>
            <span>Upload Clinical Scores</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              style={fileInputStyle}
            />
          </label>
          <label style={uploadLabelStyle}>
            <span>Upload Stimulation Parameters</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleStimulationParametersExcel}
              style={fileInputStyle}
            />
          </label>
          <label style={uploadLabelStyle}>
            <span>Upload Demographics</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleDemographicsExcel}
              style={fileInputStyle}
            />
          </label>
        </div>
      </div>

      <button style={backButtonStyle} onClick={() => navigate(-1)}>
        ← Back
      </button>
    </div>
  );
}

export default Import;
