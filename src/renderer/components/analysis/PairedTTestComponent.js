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

function PairedTTestComponent({ rawData, showPercentage, scoretype }) {
  // const [showPercentage, setShowPercentage] = useState(false);
  console.log(rawData);
  const scoreSums = {};

  // Calculate the total score for each time point, excluding 'id'
  rawData.forEach((patient) => {
    Object.keys(patient).forEach((timepoint) => {
      if (timepoint !== 'id' && patient[timepoint] && patient[timepoint][scoretype]) {
        const scores = Object.values(patient[timepoint][scoretype]);
        console.log(timepoint, scores);
        const numericScores = scores.filter(score => typeof score === 'number');
        const totalScore = numericScores.reduce((sum, score) => sum + score, 0);

        // Initialize or add to the total for this time point
        if (!scoreSums[timepoint]) {
          scoreSums[timepoint] = 0;
        }
        scoreSums[timepoint] += totalScore;
      }
    });
  });

  // Filter out timepoints with no valid data (undefined or null)
  const validTimepoints = Object.keys(scoreSums).filter(
    (timepoint) => scoreSums[timepoint] !== undefined && scoreSums[timepoint] !== null
  );

  // Determine ordered data for the line chart
  const orderedTimepoints = validTimepoints.sort((a, b) => {
    // Prioritize 'baseline' if it exists and has valid data, but don't require it
    if (a === 'baseline' && scoreSums[a] !== undefined && scoreSums[a] !== null) return -1;
    if (b === 'baseline' && scoreSums[b] !== undefined && scoreSums[b] !== null) return 1;

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

    return a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

  // Use the first timepoint as the reference for percentage calculation
  // This will be 'baseline' if it exists and has valid data, otherwise the earliest timepoint
  const referenceTimepoint = orderedTimepoints[0];
  const referenceValue = referenceTimepoint && scoreSums[referenceTimepoint] ? scoreSums[referenceTimepoint] : 1;

  const xValues = orderedTimepoints;
  const yValues = orderedTimepoints.map((timepoint) =>
    showPercentage
      ? ((referenceValue - scoreSums[timepoint]) / referenceValue) * 100 // Calculate percentage improvement
      : scoreSums[timepoint]
  );

  const data = {
    labels: xValues,
    datasets: [
      {
        label: showPercentage ? 'Percentage Improvement (%)' : 'Scores',
        data: yValues,
        borderColor: '#1f77b4',
        backgroundColor: 'rgba(31, 119, 180, 0.2)',
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
        text: 'Clinical Scores',
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
        // min: showPercentage ? Math.min(...yValues) - 10 : 0,
        // max: Math.max(...yValues) + 10,
      },
    },
  };

  return (
    <div style={{ width: '500px', height: '600px', marginBottom: '-370px' }}>
      <Line data={data} options={options} />
    </div>
  );
}

export default PairedTTestComponent;
