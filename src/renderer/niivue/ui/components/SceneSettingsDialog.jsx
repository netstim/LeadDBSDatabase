import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";

import JsonEditor from "./JsonEditor";

export const SceneSettingsDialog = ({
  initialJsonObject,
  onJsonChange,
  onClose,
  isOpen = false,
  isFullScreen = true,
}) => {
  return (
    <React.Fragment>
      <Dialog
        fullScreen={isFullScreen}
        open={isOpen}
        onClose={onClose}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle id="responsive-dialog-title">Scene Settings</DialogTitle>
        <DialogContent>
          <JsonEditor
            initialJsonObject={initialJsonObject}
            onJsonChange={onJsonChange}
          ></JsonEditor>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => onClose(false)} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};
