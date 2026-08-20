import React from 'react';
import Plot from 'react-plotly.js';

function calculatePearsonCorrelation(x, y) {
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  const numerator = x.map((xi, i) => (xi - meanX) * (y[i] - meanY)).reduce((a, b) => a + b, 0);
  const denominatorX = Math.sqrt(x.map(xi => (xi - meanX) ** 2).reduce((a, b) => a + b, 0));
  const denominatorY = Math.sqrt(y.map(yi => (yi - meanY) ** 2).reduce((a, b) => a + b, 0));

  return numerator / (denominatorX * denominatorY);
}

function CorrelationAnalysisComponent({ baselineValues, postopValues }) {
  // Calculate the Pearson correlation coefficient between baseline and postoperative scores
  const correlationCoefficient = calculatePearsonCorrelation(baselineValues, postopValues);

  return (
    <div>
      {/* <h3>Correlation Analysis</h3>
      <p>
        Pearson Correlation Coefficient (r) between Baseline and Postoperative Scores:
        {correlationCoefficient.toFixed(2)}
      </p> */}
      <Plot
        data={[
          {
            type: 'scatter',
            mode: 'markers',
            x: baselineValues,
            y: postopValues,
            marker: { color: 'rgba(0, 123, 255, 0.7)', size: 10 },
          },
        ]}
        layout={{
          title: 'Correlation between Baseline and Postoperative Scores',
          xaxis: { title: 'Baseline Scores' },
          yaxis: { title: 'Postoperative Scores' },
          showlegend: false,
          annotations: [
            {
              xref: 'paper',
              yref: 'paper',
              x: 0.95,
              y: 1.05,
              xanchor: 'right',
              yanchor: 'bottom',
              text: `r = ${correlationCoefficient.toFixed(2)}`,
              showarrow: false,
              font: {
                size: 16,
                color: 'black',
              },
            },
          ],
        }}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

export default CorrelationAnalysisComponent;
