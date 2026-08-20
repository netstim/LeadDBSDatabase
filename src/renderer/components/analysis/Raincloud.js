import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import { Select, MenuItem, Checkbox, ListItemText } from '@mui/material';

function Raincloud({ clinicalData, scoretype, timelineOrder }) {
  const [selectedTimelines, setSelectedTimelines] = useState(new Set());

  // Collect all timelines and sort with 'baseline' first
  const timelines = [
    ...new Set(
      clinicalData.flatMap((patient) =>
        Object.keys(patient.clinicalData).filter(timeline =>
          patient.clinicalData[timeline]?.[scoretype] !== undefined
        ),
      ),
    ),
  ];

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

  // Filter timelines to only include 'baseline' and 'postop'
  const filteredTimelines = orderedTimelines.filter(timeline =>
    timeline === 'baseline' || timeline === 'postop'
  );

  // Prepare data for raincloud plots using filtered timelines
  const raincloudData = filteredTimelines.map((timeline) => {
    return clinicalData.map((patientData) => {
      const timelineData = patientData.clinicalData[timeline]?.[scoretype];
      if (!timelineData) {
        return null;
      }
      // Sum all numeric scores for this timeline
      const numericScores = Object.values(timelineData).filter(score => typeof score === 'number');
      return numericScores.length > 0 ? numericScores.reduce((sum, score) => sum + score, 0) : null;
    }).filter(value => value !== null);
  });

  // Create traces for raincloud plot using filtered timelines
  const traces = raincloudData.map((data, index) => {
    const timelineName = filteredTimelines[index];
    const isBaseline = timelineName === 'baseline';
    const isPostop = timelineName === 'postop';

    return {
      type: 'violin',
      y: data,
      name: timelineName,
      points: 'all',
      jitter: 0.2,
      pointpos: 0,
      marker: {
        size: 6,
        opacity: 0.5,
        color: isBaseline ? 'rgb(31, 119, 180)' : 'rgb(255, 127, 14)',
        line: {
          color: 'white',
          width: 1
        }
      },
      box: {
        visible: true,
        width: 0.2,
        fillcolor: isBaseline ? 'rgba(75, 73, 73, 0.7)' : 'rgba(241, 185, 145, 0.7)',
        line: {
          color: isBaseline ? 'rgb(75, 73, 73)' : 'rgb(241, 185, 145)',
          width: 2
        }
      },
      line: {
        color: isBaseline ? 'rgb(75, 73, 73)' : 'rgb(241, 185, 145)',
        width: 3
      },
      fillcolor: isBaseline ? 'rgba(75, 73, 73, 0.3)' : 'rgba(241, 185, 145, 0.3)',
      meanline: {
        visible: true,
        color: 'black',
        width: 3,
      },
    };
  });

  // Create lines connecting baseline to postop
  const baselineIndex = filteredTimelines.indexOf('baseline');
  const postopIndex = filteredTimelines.indexOf('postop');

  if (baselineIndex !== -1 && postopIndex !== -1) {
    const baselineData = raincloudData[baselineIndex];
    const postopData = raincloudData[postopIndex];

    // Draw one line per patient connecting their baseline to postop total scores
    baselineData.forEach((baselineScore, i) => {
      const postopScore = postopData[i];
      if (baselineScore !== null && postopScore !== null) {
        traces.push({
          type: 'scatter',
          mode: 'lines+markers',
          x: ['baseline', 'postop'],
          y: [baselineScore, postopScore],
          line: {
            color: 'rgba(128, 128, 128, 0.4)',
            width: 1,
          },
          marker: {
            // color: 'rgba(128, 128, 128, 0.6)',
            color: 'transparent',
            size: 4,
          },
          name: `Patient ${i + 1}`,
          showlegend: false,
          hoverinfo: 'y',
          hovertemplate: 'Score: %{y:.1f}<extra></extra>'
        });
      }
    });
  }

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
        <div>
          <Select
            multiple
            value={Array.from(selectedTimelines)}
            onChange={(event) => {
              const value = event.target.value;
              setSelectedTimelines(new Set(value));
            }}
            renderValue={() => 'Timelines'}
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
      <Plot
        data={traces}
        layout={{
          title: {
            text: 'Score Distribution Over Time',
            font: {
              size: 24,
              family: 'Arial, sans-serif'
            },
            x: 0.5,
            y: 0.95
          },
          yaxis: {
            title: {
              text: 'Total Score',
              font: {
                size: 16,
                family: 'Arial, sans-serif'
              }
            },
            gridcolor: 'rgba(128, 128, 128, 0.1)',
            zerolinecolor: 'rgba(128, 128, 128, 0.2)',
            tickfont: {
              family: 'Arial, sans-serif',
              size: 12
            }
          },
          xaxis: {
            title: {
              text: 'Timeline',
              font: {
                size: 16,
                family: 'Arial, sans-serif'
              }
            },
            gridcolor: 'rgba(128, 128, 128, 0.1)',
            zerolinecolor: 'rgba(128, 128, 128, 0.2)',
            tickfont: {
              family: 'Arial, sans-serif',
              size: 12
            }
          },
          showlegend: false,
          legend: {
            x: 1,
            xanchor: 'right',
            y: 1,
            yanchor: 'top',
            font: {
              family: 'Arial, sans-serif',
              size: 12
            }
          },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          margin: {
            l: 200, // Increase left margin
            r: 200, // Increase right margin
            t: 80,
            b: 60,
            pad: 10
          },
          hovermode: 'closest',
          hoverlabel: {
            bgcolor: 'white',
            font: {
              family: 'Arial, sans-serif',
              size: 12
            }
          }
        }}
        // style={{ scale: 1.5 }}
        config={{
          responsive: true,
          displayModeBar: false
        }}
      />
    </div>
  );
}

export default Raincloud;
