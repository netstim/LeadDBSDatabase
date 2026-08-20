import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import { SketchPicker } from "react-color";

export const ColorPickerDialog = ({
  isOpen = false,
  pickedColor = { r: 255, g: 0, b: 0, a: 1 },
  isFullScreen = true,
  onChange,
  onClose,
}) => {
  return (
    <React.Fragment>
      <Dialog
        fullScreen={isFullScreen}
        open={isOpen}
        onClose={onClose}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle id="responsive-dialog-title">{"Pick a color"}</DialogTitle>
        <DialogContent>
          <SketchPicker color={pickedColor} onChangeComplete={onChange} />
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={() => onClose(true)}>
            Cancel
          </Button>
          <Button onClick={() => onClose(false)} autoFocus>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};
