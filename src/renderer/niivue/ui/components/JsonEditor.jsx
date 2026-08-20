import { useState, useEffect } from "react";
import {
  TextField,
  Typography,
  Container,
  Box,
  Paper,
  Switch,
} from "@mui/material";
import { ColorPickerTile } from "./ColorPickerTile";

function getColorsFromJson(initialJsonObject) {
  const updatedJsonObject = { ...initialJsonObject };
  const colors = {};
  Object.keys(updatedJsonObject).forEach((key) => {
    if (key.toLowerCase().endsWith("color")) {
      const color = updatedJsonObject[key];
      colors[key] = {
        r: color[0] * 255,
        g: color[1] * 255,
        b: color[2] * 255,
        a: color[3],
      };
    }
  });
  return colors;
}

const JsonEditor = ({ initialJsonObject, onJsonChange, title }) => {
  const [jsonObject, setJsonObject] = useState(initialJsonObject);
  const [colorStates, setColorStates] = useState(
    getColorsFromJson(initialJsonObject),
  );
  const labelOverrides = new Map([
    ["show3Dcrosshair", "Show 3D Crosshair"],
    ["yoke3Dto2DZoom", "Yoke 3D to 2D Zoom"],
    ["limitFrames4D", "Limit Frames 4D"],
    ["meshThicknessOn2D", "Mesh Thickness On 2D"],
  ]);

  useEffect(() => {
    const updatedJsonObject = { ...initialJsonObject };
    const colors = {};
    Object.keys(updatedJsonObject).forEach((key) => {
      if (key.toLowerCase().endsWith("color")) {
        colors[key] = updatedJsonObject[key];
      }
    });
    setColorStates(colors);

    // Dynamically create color states from JSON properties
  }, [initialJsonObject]);

  const handleChange = (e, key) => {
    let { value } = e.target;
    if(typeof jsonObject[key] === 'number') {
      const n = Number(value);
      if(n && n % 1 === 0) {
        value = Number.parseInt(value);
      }
      else {
        value = Number.parseFloat(value);
      }
      
    }

    console.log('element', e);
    console.log('typeof value', typeof value);
    const updatedJsonObject = {
      ...jsonObject,
      [key]: value,
    };
    setJsonObject(updatedJsonObject);
    onJsonChange(updatedJsonObject, key, value);
  };

  const handleColorChange = (color, key) => {
    const updatedJsonObject = {
      ...jsonObject,
      [key]: color.rgb,
    };
    setJsonObject(updatedJsonObject);
    const colorArray = [
      color.rgb.r / 255,
      color.rgb.g / 255,
      color.rgb.b / 255,
      color.rgb.a,
    ];
    onJsonChange(updatedJsonObject, key, colorArray);
  };

  const handleBooleanChange = (e, key) => {
    const updatedJsonObject = {
      ...jsonObject,
      [key]: e.target.checked,
    };
    setJsonObject(updatedJsonObject);
    onJsonChange(updatedJsonObject, key, e.target.checked);
  };

  const translateCamlCaseToTitleCase = (text) => {
    if (labelOverrides.has(text)) {
      return labelOverrides.get(text);
    }
    const result = text.replace(/([A-Z])/g, " $1");
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Paper elevation={3} sx={{ p: 2 }}>
          {Object.keys(jsonObject).map((key) => (
            <Box key={key} sx={{ mb: 2 }}>
              {typeof jsonObject[key] === "boolean" ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="subtitle1">
                    {translateCamlCaseToTitleCase(key)}
                  </Typography>
                  <Switch
                    checked={jsonObject[key]}
                    onChange={(e) => handleBooleanChange(e, key)}
                  />
                </Box>
              ) : key.toLowerCase().endsWith("color") ? (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="subtitle1">
                    {translateCamlCaseToTitleCase(key)}
                  </Typography>
                  <ColorPickerTile
                    color={colorStates[key]}
                    onChange={(colorArray) =>
                      handleColorChange(colorArray, key)
                    }
                  />
                </Box>
              ) : typeof jsonObject[key] === "number" ? (
                <Box sx={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}>
                <Typography variant="subtitle1">
                    {translateCamlCaseToTitleCase(key)}
                  </Typography>
                  <TextField
                    size="small"
                    sx={{
                      textAlign: "right",
                      float: "right",
                      direction: "rtl",
                    }}
                    type="number"
                    variant="outlined"
                    inputProps={{
                      step: jsonObject[key] % 1 === 0 ? 1 : 0.05
                    }}
                    value={
                      null === jsonObject[key] || Number.isNaN(jsonObject[key])
                        ? 0
                        : jsonObject[key]
                    }
                    onChange={(e) => handleChange(e, key)}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="subtitle1">
                    {translateCamlCaseToTitleCase(key)}
                  </Typography>
                  <TextField
                    size="small"
                    sx={{
                      textAlign: "right",
                      float: "right",
                      direction: "rtl",
                    }}
                    variant="outlined"
                    value={
                      null === jsonObject[key] || Number.isNaN(jsonObject[key])
                        ? 0
                        : jsonObject[key]
                    }
                    onChange={(e) => handleChange(e, key)}
                  />
                </Box>
              )}
            </Box>
          ))}
        </Paper>
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" component="h2">
            Updated JSON:
          </Typography>
          <Paper elevation={3} sx={{ p: 2, whiteSpace: "pre-wrap" }}>
            <pre>{JSON.stringify(jsonObject, null, 2)}</pre>
          </Paper>
        </Box>
      </Box>
  );
};

export default JsonEditor;
