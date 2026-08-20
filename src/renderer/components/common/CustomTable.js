import React, { useState } from 'react';

const CustomTable = () => {
  // States for managing table headers and data rows
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [newHeader, setNewHeader] = useState('');
  const [newRow, setNewRow] = useState({});

  // Function to add a new header
  const handleAddHeader = () => {
    if (newHeader.trim() === '') return;
    setHeaders([...headers, newHeader]);
    setNewHeader('');
  };

  // Function to handle changes in row inputs
  const handleRowChange = (e, header) => {
    setNewRow({
      ...newRow,
      [header]: e.target.value,
    });
  };

  // Function to add a new row
  const handleAddRow = () => {
    setRows([...rows, newRow]);
    setNewRow({});
  };

  return (
    <div>
      {/* Header Input */}
      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={newHeader}
          onChange={(e) => setNewHeader(e.target.value)}
          placeholder="Enter new header"
        />
        <button onClick={handleAddHeader}>Add Header</button>
      </div>

      {/* Table Display */}
      {headers.length > 0 && (
        <table border="1">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={index}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers.map((header, headerIndex) => (
                  <td key={headerIndex}>{row[header] || ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Row Input */}
      {headers.length > 0 && (
        <div>
          <h3>Add a new row:</h3>
          {headers.map((header, index) => (
            <div key={index}>
              <label>{header}</label>
              <input
                type="text"
                value={newRow[header] || ''}
                onChange={(e) => handleRowChange(e, header)}
              />
            </div>
          ))}
          <button onClick={handleAddRow}>Add Row</button>
        </div>
      )}
    </div>
  );
};

export default CustomTable;
