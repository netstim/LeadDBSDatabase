import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";

export function MinMaxInput({
  onSetMinMax = () => {},
  precision = 2,
  min,
  max,
  calMin,
  calMax,
  ...props
}) {
  function handleMinChange(event) {
    console.log(event.target.value);
    onSetMinMax(Number(event.target.value), max);
  }

  function handleMaxChange(event) {
    console.log(event.target.value);
    onSetMinMax(min, Number(event.target.value));
  }

  // on double click, set the min to the cal_min to reset
  function handleMinDoubleClick() {
    onSetMinMax(calMin, max);
  }

  // on double click, set the max to the cal_max to reset
  function handleMaxDoubleClick() {
    onSetMinMax(min, calMax);
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minHeight: "50px",
        ...props,
      }}
    >
      <TextField
        sx={
          {
            // minWidth: '50%',
          }
        }
        id="min-number"
        label="Min"
        helperText="double click to reset"
        type="number"
        // value should be set to 2 decimal places
        value={Number(min.toFixed(precision))}
        inputProps={{
          min: calMin,
          max: calMax,
          type: "number",
        }}
        variant="standard"
        size="small"
        onInput={handleMinChange}
        onDoubleClick={handleMinDoubleClick}
      />
      <TextField
        sx={
          {
            // minWidth: '50%',
          }
        }
        id="max-number"
        label="Max"
        helperText="double click to reset"
        type="number"
        value={Number(max.toFixed(precision))}
        inputProps={{
          min: calMin,
          max: calMax,
          type: "number",
        }}
        variant="standard"
        size="small"
        onInput={handleMaxChange}
        onDoubleClick={handleMaxDoubleClick}
      />
    </Box>
  );
}

MinMaxInput.propTypes = {
  onSetMinMax: PropTypes.func,
  precision: PropTypes.number,
  min: PropTypes.number,
  max: PropTypes.number,
  calMin: PropTypes.number,
  calMax: PropTypes.number,
};
