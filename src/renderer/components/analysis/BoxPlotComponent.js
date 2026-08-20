import React from 'react';
import Plot from 'react-plotly.js';

function BoxPlotComponent({ baselineValues, postopValues }) {
  return (
    <div>
      <Plot
        data={[
          // Box plot for baseline values
          {
            type: 'box',
            x: baselineValues.map(() => 'Baseline'),
            y: baselineValues,
            name: 'Baseline',
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8,
            marker: {
              color: 'rgba(0, 123, 255, 0.7)', // Blue points
              size: 10,
            },
            line: {
              color: 'rgba(0, 123, 255, 1)', // Blue box outline
            },
            fillcolor: 'rgba(0, 123, 255, 0.3)', // Softer blue fill
          },
          // Box plot for postoperative values
          {
            type: 'box',
            x: postopValues.map(() => 'Postoperative'),
            y: postopValues,
            name: 'Postoperative',
            boxpoints: 'all',
            jitter: 0.3,
            pointpos: -1.8,
            marker: {
              color: 'rgba(255, 99, 132, 0.7)', // Red points
              size: 10,
            },
            line: {
              color: 'rgba(255, 99, 132, 1)', // Red box outline
            },
            fillcolor: 'rgba(255, 99, 132, 0.3)', // Softer red fill
          },
        ]}
        layout={{
          title: {
            text: 'Baseline vs Postoperative UPDRS Scores',
            font: {
              family: 'Arial, sans-serif',
              size: 18,
            },
          },
          yaxis: {
            zeroline: false,
            title: {
              text: 'Scores',
              font: {
                family: 'Arial, sans-serif',
                size: 14,
              },
            },
          },
          xaxis: {
            title: {
              font: {
                family: 'Arial, sans-serif',
                size: 14,
              },
            },
            showticklabels: true,
          },
          hovermode: 'closest',
          margin: {
            l: 60,
            r: 60,
            t: 80,
            b: 60,
          },
          boxmode: 'group',
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default BoxPlotComponent;
