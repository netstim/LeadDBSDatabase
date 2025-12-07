import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import PairedTTestComponent from './PairedTTestComponent';
import BoxPlotComponent from './BoxPlotComponent';
import LateralityAnalysisComponent from './LateralityAnalysisComponent';
// import SubscaleAnalysisComponent from './SubscaleAnalysisComponent';
// import ResponderAnalysisComponent from './ResponderAnalysisComponent';
import CorrelationAnalysisComponent from './CorrelationAnalysisComponent';
// import './electrode_models/currentModels/ElecModelStyling/boston_vercise_directed.css';
import SubscoreAnalysis from './SubscoreAnalysis';

function UPDRSAnalysisComponent({ currentStage, rawData, clinicalTimelines, scoretype }) {
  console.log(rawData);
  const [analysisType, setAnalysisType] = useState(scoretype === 'UPDRS' ? 'all' : 'raincloud');
  const [showPercentage, setShowPercentage] = useState(true);
  const [plotData, setPlotData] = useState(rawData);
  const navigate = useNavigate(); // Initialize the navigate hook

  const handleAnalysisChange = (e) => {
    setAnalysisType(e.target.value);
  };

  useEffect(() => {
    console.log(clinicalTimelines, rawData);
    try {
      // Check if rawData is valid
      if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
        console.warn('Invalid rawData provided to UPDRSAnalysisComponent');
        return;
      }

      // Check if clinicalTimelines is valid
      if (!clinicalTimelines || !Array.isArray(clinicalTimelines) || clinicalTimelines.length === 0) {
        console.warn('Invalid clinicalTimelines provided to UPDRSAnalysisComponent');
        return;
      }

      // Create a deep copy of rawData to avoid mutating the original
      const updatedRawData = rawData.map((patient) => ({ ...patient }));
      console.log('UPDRSAnalysisComponent - updatedRawData:', updatedRawData);

      // Safely check if updatedRawData[0] exists before accessing it
      if (updatedRawData[0] && typeof updatedRawData[0] === 'object') {
        clinicalTimelines.forEach((timeline) => {
          if (timeline && typeof timeline === 'object') {
            console.log('Timeline:', timeline.timeline, 'hasClinical:', timeline.hasClinical);
            if (updatedRawData[0][timeline.timeline]) {
              console.log(
                'Data for timeline',
                timeline.timeline,
                ':',
                updatedRawData[0][timeline.timeline],
              );
            }
            // Remove timelines that don't have clinical data
            if (!timeline.hasClinical && updatedRawData[0][timeline.timeline]) {
              delete updatedRawData[0][timeline.timeline];
              console.log('Removed timeline without clinical data:', timeline.timeline);
            }
          }
        });
      }
      console.log('UPDRSAnalysisComponent - rawData:', rawData);
      console.log('UPDRSAnalysisComponent - updatedRawData:', updatedRawData);
      setPlotData(updatedRawData);
    } catch (error) {
      console.error('Error processing clinical timelines:', error);
    }
  }, [clinicalTimelines, rawData]);

  const renderAnalysis = () => {
    switch (analysisType) {
      case 'raincloud':
        return (
          <PairedTTestComponent
            rawData={rawData}
            showPercentage={showPercentage}
            scoretype={scoretype}
          />
        );
      // case 'boxPlot':
      //   return (
      //     <BoxPlotComponent
      //       rawData={rawData}
      //     />
      //   );
      case 'laterality':
        return (
          <LateralityAnalysisComponent
            rawData={rawData}
            showPercentage={showPercentage}
            scoretype={scoretype}
          />
        );
      case 'subscore':
        return (
          <SubscoreAnalysis rawData={rawData} showPercentage={showPercentage} scoretype={scoretype} />
        );
      // // case 'subscale':
      // //   return (
      // //     <SubscaleAnalysisComponent
      // //       baselineValues={baselineValues}
      // //       postopValues={postopValues}
      // //       subscaleValues={subscaleValues}
      // //     />
      // //   );
      // // case 'responder':
      // //   return (
      // //     <ResponderAnalysisComponent
      // //       baselineValues={baselineValues}
      // //       postopValues={postopValues}
      // //     />
      // //   );
      // case 'correlation':
      //   return (
      //     <CorrelationAnalysisComponent
      //       baselineValues={baselineValues}
      //       postopValues={postopValues}
      //     />
      //   );
      case 'all':
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <PairedTTestComponent
                rawData={rawData}
                showPercentage={showPercentage}
                scoretype={scoretype}
              />
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              <LateralityAnalysisComponent
                rawData={rawData}
                showPercentage={showPercentage}
                scoretype={scoretype}
              />
            </div>
            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'flex-start',
                alignItems: 'center',
              }}
            >
              <SubscoreAnalysis
                rawData={rawData}
                showPercentage={showPercentage}
                scoretype={scoretype}
              />
            </div>
          </div>
        );

      default:
        return <p>Please select an analysis type.</p>;
    }
  };

  return (
    <div>
      <h2>{scoretype} Analysis</h2>
      {/* <div>
        <select value={analysisType} onChange={handleAnalysisChange}>
          <option value="raincloud">Trendline</option>
          <option value="laterality">Laterality Analysis</option>
          <option value="subscore">Subscores</option>
          <option value="all">View All Plots</option>
        </select>
      </div> */}
      <div style={{ marginTop: '30px', marginBottom: '-10px' }}>
        <h3 style={{ fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={showPercentage}
            onChange={() => setShowPercentage((prev) => !prev)}
          />
          Show Percentage Improvement
        </h3>
      </div>
      <div>{renderAnalysis()}</div>
    </div>
  );
}

export default UPDRSAnalysisComponent;
