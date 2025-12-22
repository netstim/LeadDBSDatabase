import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function DatabasePlot({ clinicalData, scoretype, timelineOrder }) {
  const [showPercentage, setShowPercentage] = useState(true);

  // Define a clean color palette
  const colorPalette = [
    '#4E79A7',
    '#F28E2B',
    '#E15759',
    '#76B7B2',
    '#59A14F',
    '#EDC948',
    '#B07AA1',
    '#FF9DA7',
    '#9C755F',
    '#BAB0AC',
  ];

  // Get all unique timelines that have data for the selected scoretype
  const allTimelines = [
    ...new Set(
      clinicalData.flatMap((patient) =>
        Object.keys(patient.clinicalData).filter(timeline =>
          patient.clinicalData[timeline]?.[scoretype] !== undefined
        )
      )
    )
  ];

  // Use custom timeline order if provided, otherwise use default sorting
  const labels = timelineOrder && timelineOrder.length > 0
    ? timelineOrder.filter(timeline => allTimelines.includes(timeline))
    : allTimelines.sort((a, b) => {
        if (a === 'baseline') return -1;
        if (b === 'baseline') return 1;

        const aIsMonth = a.includes('month');
        const bIsMonth = b.includes('month');
        const aIsYear = a.includes('year');
        const bIsYear = b.includes('year');

        if (aIsMonth && !bIsMonth) return -1;
        if (!aIsMonth && bIsMonth) return 1;
        if (aIsYear && !bIsYear) return 1;
        if (!aIsYear && bIsYear) return -1;

        return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      });

  // Rebuild datasets to ensure all use the same labels array
  const alignedDatasets = clinicalData.map((patientData, index) => {
    const patientID = patientData.id;

    // Calculate baseline total score for percentage calculation
    const baselineData = patientData.clinicalData['baseline']?.[scoretype];
    const baselineScores = baselineData
      ? Object.values(baselineData).filter(score => typeof score === 'number')
      : [];
    const baselineTotal = baselineScores.reduce((sum, score) => sum + score, 0) || 1;

    // Map data points to the labels array, using null for missing timelines
    const data = labels.map((timeline) => {
      const timelineData = patientData.clinicalData[timeline]?.[scoretype];
      if (!timelineData) {
        return null;
      }
      const scores = Object.values(timelineData).filter(score => typeof score === 'number');
      const totalScore = scores.reduce((sum, score) => sum + score, 0);
      return showPercentage
        ? ((baselineTotal - totalScore) / baselineTotal) * 100 // Calculate percentage improvement
        : totalScore;
    });

    return {
      label: `Patient ${patientID}`,
      data,
      fill: false,
      borderColor: colorPalette[index % colorPalette.length], // Use colors from the palette
      tension: 0.2,
      spanGaps: false,
    };
  }).filter(dataset => dataset.data.some(value => value !== null && !Number.isNaN(value))); // Only include datasets with at least one valid data point

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Clinical Data Visualization',
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem) =>
            showPercentage
              ? `Percentage Improvement: ${tooltipItem.raw.toFixed(2)}%`
              : `Score: ${tooltipItem.raw.toFixed(2)}`,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time',
        },
      },
      y: {
        title: {
          display: true,
          text: showPercentage ? 'Percentage Improvement (%)' : 'Scores',
        },
      },
    },
  };

  const data = {
    labels,
    datasets: alignedDatasets,
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <h3 style={{fontSize: '16px'}}>
          <input
            type="checkbox"
            checked={showPercentage}
            onChange={() => setShowPercentage((prev) => !prev)}
          />
          Show Percentage Improvement
        </h3>
      </div>
      <Line data={data} options={options} />
    </div>
  );
}

export default DatabasePlot;
