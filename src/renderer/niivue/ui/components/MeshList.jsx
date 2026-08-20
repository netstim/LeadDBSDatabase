import PropTypes from "prop-types";
import Box from "@mui/material/Box";

export function MeshList({ children, ...props }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        minWidth: "100%",
        width: "100%",
        minHeight: "40%",
        // very light gray
        backgroundColor: "#F8F8F8",
        // slight border radius
        borderRadius: "4px",
        // overflow: 'hidden',
        overflowY: "scroll",
        ...props,
      }}
    >
      {children}
    </Box>
  );
}

MeshList.propTypes = {
  children: PropTypes.node,
};
