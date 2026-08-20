import React from "react";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Box from "@mui/material/Box";
import PropTypes from "prop-types";
import { basename } from "../utils";
import { useRef, useState } from "react";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import StarBorder from "@mui/icons-material/StarBorder";

export function MeshItem({
  name,
  index,
  active = false,
  getLayerList = () => {},
  onSetVisibility = () => {},
  onSetActive = () => {},
  onRemove = () => {},
  onLayerDropped = (index, file) => {},
  setLayerVisibility = () => {},
  setActiveLayer = () => {},
  onAddLayer = () => {},
  layers,
  ...props
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(true);
  const [contextMenu, setContextMenu] = useState(null);
  const [files, setFiles] = useState([]);
  // const [layers, setLayers] = useState([]);
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(!open);
  };

  function toggleVisibility() {
    onSetVisibility(index, visible === true ? 0 : 1);
    setVisible(!visible);
  }

  function toggleActive() {
    onSetActive(name, !active);
  }

  function handleContextMenu(event) {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
          }
        : null,
    );
  }

  function handleClose() {
    setContextMenu(null);
  }

  function handleRemove() {
    handleClose();
    onRemove(index);
  }

  function handleAddLayer() {
    handleClose();
    onAddLayer(index);
    setOpen(true);
  }

  function toggleLayerVisibility(layerIndex) {
    const isVisible = !layers[layerIndex].visible;

    setLayerVisibility(index, layerIndex, isVisible ? 1.0 : 0.0);
  }

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFiles = event.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const newFiles = Array.from(droppedFiles);
      setFiles((prevFiles) => [...prevFiles, ...newFiles]);
      onLayerDropped(index, droppedFiles[0]);

      setOpen(true);
    }

    console.log("droppedFiles", droppedFiles);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        minWidth: "100%",
        width: "100%",
        // background color is very light blue if active
        backgroundColor: active ? "#E6F0FF" : "#F8F8F8",
        ...props,
      }}
      ref={ref}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <List>
        <ListItemButton onClick={handleClick}>
          <IconButton onClick={toggleVisibility}>
            {!visible ? <VisibilityOffIcon /> : <VisibilityIcon />}
          </IconButton>
          <Tooltip title={name}>
            <Typography
              sx={{
                marginLeft: "8px",
                wordBreak: "break-word", // wrap long names
                flexBasis: "75%", // allow for name wrapping for long names and alignment to the button
              }}
              onClick={toggleActive}
              // onMouseUp={toggleActive}
              onContextMenu={handleContextMenu}
            >
              {basename(name)}
            </Typography>
          </Tooltip>
          {open ? <ExpandLess align="right" /> : <ExpandMore align="right" />}
        </ListItemButton>
        <Menu
          open={contextMenu !== null}
          onClose={handleClose}
          anchorReference="anchorPosition"
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : undefined
          }
        >
          <MenuItem onClick={handleAddLayer}>Add Layer</MenuItem>
          <MenuItem onClick={handleRemove}>Remove</MenuItem>
        </Menu>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {layers.map((item, layerIndex) => (
              <ListItemButton
                sx={{ pl: 4 }}
                key={item.url}
                onClick={() => {
                  setActiveLayer(index, layerIndex);
                  setLayerVisibility(
                    index,
                    layerIndex,
                    layers[layerIndex].opacity,
                  );
                }}
              >
                <IconButton onClick={() => toggleLayerVisibility(layerIndex)}>
                  {item.visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </IconButton>
                <ListItemText primary={item.name} />
              </ListItemButton>
            ))}
          </List>
        </Collapse>
      </List>
    </Box>
  );
}

MeshItem.propTypes = {
  name: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  active: PropTypes.bool,
  onSetVisibility: PropTypes.func,
  onSetActive: PropTypes.func,
  onRemove: PropTypes.func,
  id: PropTypes.any,
  onLayerDropped: PropTypes.func,
  setLayerVisibility: PropTypes.func,
  setActiveLayer: PropTypes.func,
  getLayerList: PropTypes.func,
  onAddLayer: PropTypes.func,
  layers: PropTypes.array,
};
