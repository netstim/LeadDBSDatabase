import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";

export function MosaicInput({ onChange = () => {}, value = "", ...props }) {
  const defaultMosaic = "A 0 20 C 30 S 42";

  function handleChange(event) {
    onChange(event.target.value);
  }

  function reset() {
    onChange(defaultMosaic);
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        width: "100%",
        minHeight: "100px",
        ...props,
      }}
    >
      <TextField
        sx={{
          height: "100%",
          width: "100%",
        }}
        id="mosaic-input"
        label="Mosaic"
        helperText="set the mosaic command (double click resets)"
        type="textarea"
        multiline={true}
        maxRows={3}
        inputProps={{
          type: "textarea",
        }}
        // value should be set to 2 decimal places
        value={value}
        variant="standard"
        onChange={handleChange}
        onDoubleClick={reset}
      />
    </Box>
  );
}

MosaicInput.propTypes = {
  onChange: PropTypes.func,
  value: PropTypes.string,
};
