import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "./styles/globals.css";

import { ThemeProvider } from "@/providers/ThemeProvider";
import { Toaster } from "@/components/toaster";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <App />
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>
);

