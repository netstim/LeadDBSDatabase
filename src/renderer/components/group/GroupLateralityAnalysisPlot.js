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

function GroupLateralityAnalysisPlot({ clinicalData, scoretype }) {
  const [showPercentage, setShowPercentage] = useState(true);
  const [showGroupAverage, setShowGroupAverage] = useState(true);

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

  const parseTimeline = (timeline) => {
    if (timeline === 'baseline') return 0;
    const match = timeline.match(/(\d+)(years|months|day)/);
    if (!match) return Infinity;
    const [_, value, unit] = match;
    const multiplier = unit === 'years' ? 365 : unit === 'months' ? 30 : 1;
    return parseInt(value, 10) * multiplier;
  };

  const timelines = [...new Set(clinicalData.flatMap((patient) => Object.keys(patient.clinicalData)))];
  // const orderedTimelines = timelines.sort((a, b) => parseTimeline(a) - parseTimeline(b));
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

    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  const calculateStats = (values) => {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
    return { mean, stdDev };
  };

  // Filter out patients with no clinical data
  const filteredClinicalData = clinicalData.filter(patient =>
    Object.keys(patient.clinicalData).length > 0
  );

  const leftPatientData = filteredClinicalData.map((patientData) =>
    orderedTimelines.map((timeline) => {
      if (!patientData.clinicalData[timeline]) return 0;

      const baselineScores = Object.entries(patientData.clinicalData['baseline'][scoretype] || {})
        .filter(([item]) => leftSideItems.includes(item) && typeof patientData.clinicalData['baseline'][scoretype][item] === 'number')
        .map(([, score]) => score);
      const baselineTotal = baselineScores.reduce((sum, score) => sum + score, 0);
      if (baselineTotal === 0) return null; // Skip if the sum of baseline scores is zero

      const scores = patientData.clinicalData[timeline][scoretype]
        ? Object.entries(patientData.clinicalData[timeline][scoretype])
            .filter(([item]) => leftSideItems.includes(item) && typeof patientData.clinicalData[timeline][scoretype][item] === 'number')
            .map(([, score]) => score)
        : [];
      const totalScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) : 0;

      return showPercentage ? ((baselineTotal - totalScore) / baselineTotal) * 100 : totalScore;
    })
  );
  console.log(leftPatientData);

  const rightPatientData = filteredClinicalData.map((patientData) =>
    orderedTimelines.map((timeline) => {
      if (!patientData.clinicalData[timeline]) return 0;

      const baselineScores = Object.entries(patientData.clinicalData['baseline'][scoretype] || {})
        .filter(([item]) => rightSideItems.includes(item) && typeof patientData.clinicalData['baseline'][scoretype][item] === 'number')
        .map(([, score]) => score);
      const baselineTotal = baselineScores.reduce((sum, score) => sum + score, 0);
      if (baselineTotal === 0) return null; // Skip if the sum of baseline scores is zero

      const scores = patientData.clinicalData[timeline][scoretype]
        ? Object.entries(patientData.clinicalData[timeline][scoretype])
            .filter(([item]) => rightSideItems.includes(item) && typeof patientData.clinicalData[timeline][scoretype][item] === 'number')
            .map(([, score]) => score)
        : [];
      const totalScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) : 0;

      return showPercentage ? ((baselineTotal - totalScore) / baselineTotal) * 100 : totalScore;
    })
  );
  console.log(rightPatientData);
  const leftAverages = orderedTimelines.map((_, i) => calculateStats(leftPatientData.map((patient) => patient[i])).mean);
  const leftStdDevs = orderedTimelines.map((_, i) => calculateStats(leftPatientData.map((patient) => patient[i])).stdDev);

  const rightAverages = orderedTimelines.map((_, i) => calculateStats(rightPatientData.map((patient) => patient[i])).mean);
  const rightStdDevs = orderedTimelines.map((_, i) => calculateStats(rightPatientData.map((patient) => patient[i])).stdDev);

  const individualDatasets = [
    ...leftPatientData.map((data, i) => ({
      label: `Patient ${filteredClinicalData[i].id} - Left`,
      data,
      borderColor: 'rgba(78, 121, 167, 1)',
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 3,
      showLine: true,
      fill: false,
    })),
    ...rightPatientData.map((data, i) => ({
      label: `Patient ${filteredClinicalData[i].id} - Right`,
      data,
      borderColor: 'rgba(242, 142, 43, 1)',
      borderWidth: 2,
      tension: 0.2,
      pointRadius: 3,
      showLine: true,
    })),
  ];

  const groupAverageDatasets = [
    {
      label: 'Left',
      data: leftAverages,
      borderColor: '#4E79A7',
      backgroundColor: 'rgba(78, 121, 167, 0.2)',
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      order: 1,
    },
    {
      label: 'Right',
      data: rightAverages,
      borderColor: '#F28E2B',
      backgroundColor: 'rgba(242, 142, 43, 0.2)',
      borderWidth: 2,
      fill: false,
      tension: 0.3,
      pointRadius: 3,
      order: 1,
    },
    // {
    //   label: 'Left Side Std Dev Upper',
    //   data: leftAverages.map((avg, i) => avg + leftStdDevs[i]),
    //   backgroundColor: 'rgba(78, 121, 167, 0.1)',
    //   borderWidth: 0,
    //   fill: '+1',
    //   tension: 0.3,
    //   pointRadius: 0,
    //   order: 0,
    // },
    // {
    //   label: 'Left Side Std Dev Lower',
    //   data: leftAverages.map((avg, i) => avg - leftStdDevs[i]),
    //   backgroundColor: 'rgba(78, 121, 167, 0.1)',
    //   borderWidth: 0,
    //   fill: false,
    //   tension: 0.3,
    //   pointRadius: 0,
    //   order: 0,
    // },
    // {
    //   label: 'Right Side Std Dev Upper',
    //   data: rightAverages.map((avg, i) => avg + rightStdDevs[i]),
    //   backgroundColor: 'rgba(242, 142, 43, 0.1)',
    //   borderWidth: 0,
    //   fill: '+1',
    //   tension: 0.3,
    //   pointRadius: 0,
    //   order: 0,
    // },
    // {
    //   label: 'Right Side Std Dev Lower',
    //   data: rightAverages.map((avg, i) => avg - rightStdDevs[i]),
    //   backgroundColor: 'rgba(242, 142, 43, 0.1)',
    //   borderWidth: 0,
    //   fill: false,
    //   tension: 0.3,
    //   pointRadius: 0,
    //   order: 0,
    // },
  ];

  const data = {
    labels: orderedTimelines,
    datasets: showGroupAverage ? groupAverageDatasets : individualDatasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: showGroupAverage,
        fill: true,
        // labels: {
        //   filter: (legendItem) => !legendItem.text.includes('Std Dev'),
        // },
        labels: {
          filter: (legendItem) => !legendItem.text.includes('Std Dev'),
          generateLabels: (chart) => {
            const original = ChartJS.defaults.plugins.legend.labels.generateLabels;
            const labels = original(chart);
            labels.forEach(label => {
              label.fillStyle = label.strokeStyle; // Use the stroke color to fill the legend
            });
            return labels;
          },
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
        text: showGroupAverage ? 'Laterality' : 'Laterality',
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

export default GroupLateralityAnalysisPlot;
