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
  Filler,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function GroupSubscoreAnalysisPlot({ clinicalData, scoretype }) {
  const [showPercentage, setShowPercentage] = useState(true);
  const [showGroupAverage, setShowGroupAverage] = useState(true);

  // Filter out patients with no clinical data
  const filteredClinicalData = clinicalData.filter(patient =>
    Object.keys(patient.clinicalData).length > 0
  );

  const bradykinesiaItems = [
    '3.4a: Finger tapping- Right hand', '3.4b: Finger tapping- Left hand',
    '3.5a: Hand movements- Right hand', '3.5b: Hand movements- Left hand',
    '3.6a: Pronation- supination movements- Right hand', '3.6b: Pronation- supination movements- Left hand',
    '3.7a: Toe tapping- Right foot', '3.7b: Toe tapping- Left foot',
    '3.8a: Leg agility- Right leg', '3.8b: Leg agility- Left leg',
    '3.14: Global spontaneity of movement',
  ];

  const rigidityItems = [
    '3.3a: Rigidity- Neck', '3.3b: Rigidity- RUE', '3.3c: Rigidity- LUE',
    '3.3d: Rigidity- RLE', '3.3e: Rigidity- LLE',
  ];

  const tremorItems = [
    '3.15a: Postural tremor- Right hand', '3.15b: Postural tremor- Left hand',
    '3.16a: Kinetic tremor- Right hand', '3.16b: Kinetic tremor- Left hand',
    '3.17a: Rest tremor amplitude- RUE', '3.17b: Rest tremor amplitude- LUE',
    '3.17c: Rest tremor amplitude- RLE', '3.17d: Rest tremor amplitude- LLE',
    '3.17e: Rest tremor amplitude- Lip/jaw', '3.18: Constancy of rest tremor',
  ];

  const axialItems = [
    '3.1: Speech', '3.2: Facial expression', '3.9: Arising from chair',
    '3.10: Gait', '3.11: Freezing of gait', '3.12: Postural stability',
    '3.13: Posture',
  ];

  const subscoreCategories = [
    { name: 'Bradykinesia', items: bradykinesiaItems, color: '#4E79A7' },
    { name: 'Rigidity', items: rigidityItems, color: '#59A14F' },
    { name: 'Tremor', items: tremorItems, color: '#E15759' },
    { name: 'Axial', items: axialItems, color: '#F28E2B' },
  ];

  const timelines = [...new Set(clinicalData.flatMap((patient) => Object.keys(patient.clinicalData)))];
  const orderedTimelines = timelines.sort((a, b) => {
    if (a === 'baseline') return -1;
    if (b === 'baseline') return 1;

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

  const calculateStats = (values) => {
    console.log('Values: ', values);

    // Filter out undefined values
    const filteredValues = values.filter(val => val !== undefined);

    const mean = filteredValues.reduce((sum, val) => sum + val, 0) / filteredValues.length;
    const stdDev = Math.sqrt(
      filteredValues.reduce((sum, val) => sum + (val - mean) ** 2, 0) / filteredValues.length
    );
    return { mean, stdDev };
  };

  const datasets = [];

  subscoreCategories.forEach(({ name, items, color }) => {
    const patientData = filteredClinicalData.map((patientData) =>
      orderedTimelines.map((timeline) => {
        // Check if the scoretype data exists for the baseline and current timeline
        const baselineData = patientData.clinicalData['baseline']?.[scoretype];
        const timelineData = patientData.clinicalData[timeline]?.[scoretype];

        if (!baselineData || !timelineData) return null; // Skip if data is missing

        const baselineScores = Object.entries(baselineData)
          .filter(([item]) => items.includes(item) && typeof baselineData[item] === 'number')
          .map(([, score]) => score);
        console.log('Baseline Scores: ', baselineScores);
        const baselineTotal = baselineScores.reduce((sum, score) => sum + score, 0);
        if (baselineTotal === 0) return null; // Skip if the sum of baseline scores is zero

        const scores = Object.entries(timelineData)
          .filter(([item]) => items.includes(item) && typeof timelineData[item] === 'number')
          .map(([, score]) => score);
        const totalScore = scores.reduce((sum, score) => sum + score, 0);

        return showPercentage ? ((baselineTotal - totalScore) / baselineTotal) * 100 : totalScore;
      }).filter(score => score !== null) // Filter out null values
    );

    if (!showGroupAverage) {
      patientData.forEach((data, i) => {
        datasets.push({
          label: `Patient ${filteredClinicalData[i].id} - ${name}`,
          data,
          borderColor: `${color}88`, // Lighter color for visibility
          borderWidth: 1.5,
          tension: 0.2,
          pointRadius: 3, // Set point radius for interactivity
          showLine: true,
        });
      });
    } else {
      const averages = orderedTimelines.map((_, i) => calculateStats(patientData.map((patient) => patient[i])).mean);
      const stdDevs = orderedTimelines.map((_, i) => calculateStats(patientData.map((patient) => patient[i])).stdDev);
      console.log('Averages: ', averages);
      console.log('StDevs: ', stdDevs);
      datasets.push({
        label: `${name} Average`,
        data: averages,
        borderColor: color,
        backgroundColor: `${color}33`,
        borderWidth: 2.5,
        fill: false,
        tension: 0.3,
        pointRadius: 3,
      });

      // datasets.push({
      //   label: `${name} Std Dev Upper`,
      //   data: averages.map((avg, i) => avg + stdDevs[i]),
      //   backgroundColor: `${color}33`,
      //   borderWidth: 0,
      //   fill: '+1',
      //   pointRadius: 0,
      // });

      // datasets.push({
      //   label: `${name} Std Dev Lower`,
      //   data: averages.map((avg, i) => avg - stdDevs[i]),
      //   backgroundColor: `${color}33`,
      //   borderWidth: 0,
      //   fill: false,
      //   pointRadius: 0,
      // });
    }
  });

  const data = {
    labels: orderedTimelines,
    datasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: showGroupAverage,
        labels: {
          filter: (legendItem) => !legendItem.text.includes('Std Dev'), // Filter out std dev from legend
        },
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            if (context.dataset.label.includes('Patient')) {
              return `${context.dataset.label}: ${context.raw}`;
            }
            return `${context.dataset.label}`;
          },
        },
      },
      title: {
        display: true,
        text: showGroupAverage ? 'Subscores' : 'Subscores',
        font: { size: 18 },
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

  return (
    <div>
      <div style={{ marginTop: '20px', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={showPercentage}
            onChange={() => setShowPercentage((prev) => !prev)}
          />
          Show Percentage Improvement
        </h3>
        <h3 style={{ fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={showGroupAverage}
            onChange={() => setShowGroupAverage((prev) => !prev)}
          />
          Show Group Average
        </h3>
      </div>
      <Line data={data} options={options} />
    </div>
  );
}

export default GroupSubscoreAnalysisPlot;
