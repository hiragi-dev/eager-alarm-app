import { createTheme } from "@mui/material/styles";

export const themeColor = "#1976d2";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: themeColor,
    },
  },
  cssVariables: true,
});

export default theme;
