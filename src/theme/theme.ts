import { createTheme } from "@mui/material/styles";

export const themeColor = "#D9FF4D";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: themeColor,
      light: "#F2FFB8",
      dark: "#A8E63A",
      contrastText: "#111111",
    },
    background: {
      default: "#000000",
      paper: "#111111",
    },
    text: {
      primary: "#F7FFE8",
      secondary: "#B7C7A5",
    },
  },
  typography: {
    fontFamily: ["Inter", "Noto Sans JP", "Arial", "sans-serif"].join(","),
  },
  cssVariables: true,
});

export default theme;
