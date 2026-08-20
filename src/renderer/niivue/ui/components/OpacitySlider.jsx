import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";

export function OpacitySlider({
  opacity,
  onSetOpacity = () => {},
  children,
  ...props
}) {
  function handleOpacityChange(event, value) {
    console.log(value);
    onSetOpacity(Number(value));
  }
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "space-between",
        width: "100%",
        minHeight: "50px",
        gap: 1,
        ...props,
      }}
    >
      <Typography>Opacity</Typography>
      <Slider
        id="opacity-slider"
        label="Opacity"
        min={0}
        max={1}
        step={0.05}
        size="small"
        valueLabelDisplay="auto"
        value={opacity}
        onChange={handleOpacityChange}
      />
    </Box>
  );
}
