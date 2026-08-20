import Box from "@mui/material/Box";

export function ImageTools({ children, ...props }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        minWidth: "100%",
        width: "100%",
        minHeight: "100px",
        backgroundColor: "#F8F8F8",
        borderRadius: "4px",
        gap: 1.5,
        // padding: 1,
        ...props,
      }}
    >
      {children}
    </Box>
  );
}
