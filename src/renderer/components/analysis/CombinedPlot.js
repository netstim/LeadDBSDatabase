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
import { Select, MenuItem, Checkbox, ListItemText } from '@mui/material';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

function CombinedPlot({ clinicalData, scoretype, timelineOrder }) {
  const [showPercentage, setShowPercentage] = useState(true);
  const [showGroupAverage, setShowGroupAverage] = useState(true);
  const [selectedTimelines, setSelectedTimelines] = useState(new Set());
  console.log('Patient data: ', clinicalData);
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

  // Collect all timelines and sort with 'baseline' first
  // const timelines = [
  //   ...new Set(
  //     clinicalData.flatMap((patient) => Object.keys(patient.clinicalData)),
  //   ),
  // ];
  const timelines = [
    ...new Set(
      clinicalData.flatMap((patient) =>
        Object.keys(patient.clinicalData).filter(timeline =>
          patient.clinicalData[timeline]?.[scoretype] !== undefined
        ),
      ),
    ),
  ];
  console.log('Timelines: ', timelines);
  // Initialize selectedTimelines with all timelines if not set
  if (selectedTimelines.size === 0) {
    setSelectedTimelines(new Set(timelines));
  }

  // Use custom timeline order if provided, otherwise use default sorting
  const orderedTimelines = timelineOrder && timelineOrder.length > 0
    ? timelineOrder.filter(timeline => timelines.includes(timeline))
    : timelines.sort((a, b) => {
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
  console.log('Ordered timelines: ', orderedTimelines);
  // Filter orderedTimelines based on selectedTimelines
  const filteredTimelines = orderedTimelines.filter(timeline => selectedTimelines.has(timeline));
  // Calculate average and standard deviation for each timeline
  const averages = [];
  const stdDeviations = [];

  filteredTimelines.forEach((timeline) => {
    const values = clinicalData.map((patientData) => {
      // Check if the patient has clinical data for the baseline and the current timeline
      if (patientData.clinicalData === {}) {
        return null;
      }
      const baselineData = patientData.clinicalData.baseline?.[scoretype];
      const timelineData = patientData.clinicalData[timeline]?.[scoretype];
      console.log(baselineData, timelineData);
      if (!baselineData || !timelineData) {
        return null; // Return null if data is missing
      }

      const baselineScores = Object.values(baselineData).filter(score => typeof score === 'number');

      const baselineTotal =
        baselineScores.reduce((sum, score) => sum + score, 0) || 1;

      const scores = Object.values(timelineData).filter(score => typeof score === 'number');
      const totalScore = scores.reduce((sum, score) => sum + score, 0);
      console.log(baselineTotal, totalScore);
      return showPercentage
        ? ((baselineTotal - totalScore) / baselineTotal) * 100
        : totalScore;
    }).filter(value => value !== null && !isNaN(value)); // Filter out null and NaN values
    console.log(values);
    if (values.length === 0) {
      averages.push(0); // Handle case where no valid values are present
      stdDeviations.push(0);
      return;
    }

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length,
    );

    averages.push(mean);
    stdDeviations.push(stdDev);
  });
  console.log('Averages: ', averages);
  console.log('Std deviations: ', stdDeviations);
  // Create datasets for individual patients
  const patientDatasets = clinicalData.map((patientData, index) => {
    const patientID = patientData.id;
    const baselineScores = Object.values(
      patientData.clinicalData.baseline?.[scoretype] || {},
    ).filter(score => typeof score === 'number');
    const baselineTotal =
      baselineScores.reduce((sum, score) => sum + score, 0) || 1;

    const data = filteredTimelines.map((timeline) => {
      const timelineData = patientData.clinicalData[timeline]?.[scoretype];
      if (!timelineData) {
        return null; // Return null if timeline data is missing
      }
      const scores = Object.values(timelineData).filter(score => typeof score === 'number');
      const totalScore = scores.reduce((sum, score) => sum + score, 0);
      return showPercentage
        ? ((baselineTotal - totalScore) / baselineTotal) * 100
        : totalScore;
    }).filter(value => value !== null && !isNaN(value)); // Filter out null and NaN values

    return {
      label: `Patient ${patientID}`,
      data,
      fill: false,
      borderColor: colorPalette[index % colorPalette.length],
      tension: 0.2,
      spanGaps: false,
    };
  }).filter(dataset => dataset.data.length > 0); // Filter out datasets with no data

  // Create datasets for group average
  const groupAverageDataset = [
    {
      label: 'Group Average',
      data: averages,
      borderColor: 'blue',
      backgroundColor: 'rgba(0, 0, 255, 0.1)',
      borderWidth: 2,
      tension: 0.3,
      pointRadius: 3,
    },
    // {
    //   label: 'Standard Deviation',
    //   data: averages.map((avg, i) => avg + stdDeviations[i]),
    //   backgroundColor: 'rgba(173, 216, 230, 0.3)',
    //   borderWidth: 0,
    //   fill: '+1',
    //   tension: 0.3,
    //   pointRadius: 0,
    // },
    // {
    //   label: '',
    //   data: averages.map((avg, i) => avg - stdDeviations[i]),
    //   backgroundColor: 'rgba(173, 216, 230, 0.3)',
    //   borderWidth: 0,
    //   fill: false,
    //   tension: 0.3,
    //   pointRadius: 0,
    // },
  ];

  const data = {
    labels: filteredTimelines,
    datasets: showGroupAverage ? groupAverageDataset : patientDatasets,
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: !showGroupAverage,
        // display: false,
        position: 'top',
        labels: {
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
      title: {
        display: true,
        text: showGroupAverage
          ? 'Scores'
          : 'Scores',
        font: { size: 18 },
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem) => {
            const dataset = tooltipItem.dataset;
            const patientLabel = dataset.label || 'Unknown';
            const value = tooltipItem.raw.toFixed(2);
            return showPercentage
              ? `Patient: ${patientLabel}, Percentage Improvement: ${value}%`
              : `Patient: ${patientLabel}, Score: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Time',
        },
        ticks: {
          callback: function(value, index, values) {
            // Replace 'postop' with '6months'
            if (this.getLabelForValue(value) === 'postop') {
              return 'postop';
            } else if (this.getLabelForValue(value) === 'baseline-med ON') {
              return '3months';
            }
            return this.getLabelForValue(value); // Default label
          },
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

  // Function to handle timeline selection
  const handleTimelineChange = (timeline) => {
    setSelectedTimelines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(timeline)) {
        newSet.delete(timeline);
      } else {
        newSet.add(timeline);
      }
      return newSet;
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '10px' }}>
        <h3 style={{ fontSize: '16px' }}>
          <input
            type="checkbox"
            checked={showPercentage}
            onChange={() => setShowPercentage((prev) => !prev)}
          />
          Show Percentage Improvement
        </h3>
        <h3 style={{ fontSize: '16px' }}>
          <input
            type="checkbox"
            checked={showGroupAverage}
            onChange={() => setShowGroupAverage((prev) => !prev)}
          />
          Show Group Average
        </h3>
        <div>
          {/* <h4>Select Timelines:</h4> */}
          <Select
            multiple
            value={Array.from(selectedTimelines)}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTimelines(new Set(value));
            }}
            // renderValue={(selected) => selected.join(', ')}
            renderValue={() => 'Timelines'} // Change this line
            style={{ minWidth: 200 }}
          >
            {orderedTimelines.map((timeline) => (
              <MenuItem key={timeline} value={timeline}>
                <Checkbox checked={selectedTimelines.has(timeline)} />
                <ListItemText primary={timeline} />
              </MenuItem>
            ))}
          </Select>
        </div>
      </div>
      <Line data={data} options={options} />
    </div>
  );
}

export default CombinedPlot;
