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
import { useRef } from "react";
import { useDrag, useDrop } from "react-dnd";
export function FileItem({
  name,
  index,
  moveImage,
  id,
  active = false,
  frame = 0,
  maxFrame = 0,
  onSetVisibility = () => {},
  onSetActive = () => {},
  onRemove = () => {},
  onMoveUp = () => {},
  onMoveDown = () => {},
  onShowHeader = () => {},
  onNextFrame = () => {},
  onPreviousFrame = () => {},
  ...props
}) {
  const ref = useRef(null);
  const [visible, setVisible] = React.useState(true);
  const [contextMenu, setContextMenu] = React.useState(null);

  const [{ handlerId }, drop] = useDrop({
    accept: "fileItem",
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;
      // Don't replace items with themselves
      if (dragIndex === hoverIndex) {
        return;
      }
      // Determine rectangle on screen
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      // Determine mouse position
      const clientOffset = monitor.getClientOffset();
      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }
      // Time to actually perform the action
      moveImage(dragIndex, hoverIndex);
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: "fileItem",
    item: () => {
      return { id, index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  drag(drop(ref));

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

  function handleMoveUp() {
    handleClose();
    onMoveUp(index);
  }

  function handleMoveDown() {
    handleClose();
    onMoveDown(index);
  }

  function handleShowHeader() {
    handleClose();
    onShowHeader(index);
  }

  function handleNextFrame() {
    handleClose();
    onNextFrame(index);
  }

  function handlePreviousFrame() {
    handleClose();
    onPreviousFrame(index);
  }

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
        opacity: isDragging ? 0 : 1,
        ...props,
      }}
      ref={ref}
      data-handler-id={handlerId}
    >
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
        <MenuItem onClick={handleRemove}>Remove</MenuItem>
        <MenuItem onClick={handleMoveUp}>Move Up</MenuItem>
        <MenuItem onClick={handleMoveDown}>Move Down</MenuItem>
        <MenuItem onClick={handleShowHeader}>Show Header</MenuItem>
        <MenuItem onClick={handleNextFrame}>Next Frame</MenuItem>
        <MenuItem onClick={handlePreviousFrame}>Previous Frame</MenuItem>
      </Menu>
    </Box>
  );
}

FileItem.propTypes = {
  name: PropTypes.string.isRequired,
  index: PropTypes.number.isRequired,
  active: PropTypes.bool,
  onSetVisibility: PropTypes.func,
  onSetActive: PropTypes.func,
  onRemove: PropTypes.func,
  onMoveUp: PropTypes.func,
  onMoveDown: PropTypes.func,
  onShowHeader: PropTypes.func,
  onNextFrame: PropTypes.func,
  onPreviousFrame: PropTypes.func,
  frame: PropTypes.number,
  maxFrame: PropTypes.number,
  id: PropTypes.any,
  moveImage: PropTypes.func,
};
