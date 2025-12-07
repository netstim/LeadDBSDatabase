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

function LateralityAnalysisComponent({ rawData, showPercentage, scoretype }) {
  const [threshold, setThreshold] = useState(0);

  const leftSideItems = [
    '3.3c: Rigidity- LUE', '3.3e: Rigidity- LLE', '3.4b: Finger tapping- Left hand',
    '3.5b: Hand movements- Left hand', '3.6b: Pronation- supination movements- Left hand',
    '3.7b: Toe tapping- Left foot', '3.8b: Leg agility- Left leg',
    '3.15b: Postural tremor- Left hand', '3.16b: Kinetic tremor- Left hand',
    '3.17b: Rest tremor amplitude- LUE', '3.17d: Rest tremor amplitude- LLE',
  ];

  const rightSideItems = [
    '3.3b: Rigidity- RUE', '3.3d: Rigidity- RLE', '3.4a: Finger tapping- Right hand',
    '3.5a: Hand movements- Right hand', '3.6a: Pronation- supination movements- Right hand',
    '3.7a: Toe tapping- Right foot', '3.8a: Leg agility- Right leg',
    '3.15a: Postural tremor- Right hand', '3.16a: Kinetic tremor- Right hand',
    '3.17a: Rest tremor amplitude- RUE', '3.17c: Rest tremor amplitude- RLE',
  ];

  const splitScoresByLaterality = (scores) => {
    const leftSideSum = leftSideItems.reduce((sum, item) => {
      const value = scores[item] || 0;
      return sum + (value >= threshold ? value : 0);
    }, 0);

    const rightSideSum = rightSideItems.reduce((sum, item) => {
      const value = scores[item] || 0;
      return sum + (value >= threshold ? value : 0);
    }, 0);

    return { leftSideSum, rightSideSum };
  };

  const leftSumsByTimepoint = {};
  const rightSumsByTimepoint = {};

  rawData.forEach((patientData) => {
    Object.keys(patientData).forEach((timepoint) => {
      if (timepoint !== 'id' && patientData[timepoint] && patientData[timepoint][scoretype]) {
        const { leftSideSum, rightSideSum } = splitScoresByLaterality(patientData[timepoint][scoretype]);

        if (!leftSumsByTimepoint[timepoint]) {
          leftSumsByTimepoint[timepoint] = 0;
          rightSumsByTimepoint[timepoint] = 0;
        }

        leftSumsByTimepoint[timepoint] += leftSideSum;
        rightSumsByTimepoint[timepoint] += rightSideSum;
      }
    });
  });

  // Filter out timepoints with no valid data (undefined or null)
  const validTimepoints = Object.keys(leftSumsByTimepoint).filter(
    (timepoint) =>
      leftSumsByTimepoint[timepoint] !== undefined &&
      leftSumsByTimepoint[timepoint] !== null &&
      rightSumsByTimepoint[timepoint] !== undefined &&
      rightSumsByTimepoint[timepoint] !== null
  );

  const orderedTimepoints = validTimepoints.sort((a, b) => {
    // Prioritize 'baseline' if it exists and has valid data, but don't require it
    if (a === 'baseline' && leftSumsByTimepoint[a] !== undefined && rightSumsByTimepoint[a] !== undefined) return -1;
    if (b === 'baseline' && leftSumsByTimepoint[b] !== undefined && rightSumsByTimepoint[b] !== undefined) return 1;

    const aIsDay = a.includes('day');
    const bIsDay = b.includes('day');
    const aIsMonth = a.includes('month');
    const bIsMonth = b.includes('month');
    const aIsYear = a.includes('year');
    const bIsYear = b.includes('year');

    if (aIsDay && !bIsDay) return -1;
    if (!aIsDay && bIsDay) return 1;
    if (aIsMonth && !bIsMonth) return -1;
    if (!aIsMonth && bIsMonth) return 1;
    if (aIsYear && !bIsYear) return 1;
    if (!aIsYear && bIsYear) return -1;

    return a.localeCompare(b, undefined, { numeric: true });
  });

  // Use the first timepoint as the reference for percentage calculation
  // This will be 'baseline' if it exists and has valid data, otherwise the earliest timepoint
  const referenceTimepoint = orderedTimepoints[0];
  const referenceLeft = referenceTimepoint && leftSumsByTimepoint[referenceTimepoint] ? leftSumsByTimepoint[referenceTimepoint] : 1;
  const referenceRight = referenceTimepoint && rightSumsByTimepoint[referenceTimepoint] ? rightSumsByTimepoint[referenceTimepoint] : 1;

  const leftYValues = orderedTimepoints.map((timepoint) =>
    showPercentage
      ? ((referenceLeft - leftSumsByTimepoint[timepoint]) / referenceLeft) * 100
      : leftSumsByTimepoint[timepoint]
  );

  const rightYValues = orderedTimepoints.map((timepoint) =>
    showPercentage
      ? ((referenceRight - rightSumsByTimepoint[timepoint]) / referenceRight) * 100
      : rightSumsByTimepoint[timepoint]
  );

  const data = {
    labels: orderedTimepoints,
    datasets: [
      {
        label: 'Left Side',
        data: leftYValues,
        borderColor: 'rgba(0, 123, 255, 0.7)',
        backgroundColor: 'rgba(0, 123, 255, 0.2)',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
      },
      {
        label: 'Right Side',
        data: rightYValues,
        borderColor: 'rgba(255, 99, 132, 0.7)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      title: {
        display: true,
        text: 'Laterality Analysis',
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

  const handleThresholdChange = (e) => {
    setThreshold(Number(e.target.value));
  };

  return (
    <div>
      <div style={{ width: '500px', height: '600px' }}>
        <Line data={data} options={options} />
      </div>
      <div style={{ marginLeft: '70px', marginTop: '-360px' }}>
        <h3 style={{ fontSize: '12px' }}>Set Threshold:</h3>
        <input
          type="number"
          value={threshold}
          onChange={handleThresholdChange}
          placeholder="Enter threshold value"
          style={{ marginLeft: '10px', padding: '5px', fontSize: '14px' }}
        />
      </div>
    </div>
  );
}

export default LateralityAnalysisComponent;
