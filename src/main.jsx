import React from "react";
import ReactDOM from "react-dom/client";
import { auth, db } from './src/firebase/config.js';
import App from "./App.jsx";
import "./styles/globals.css";

import { ThemeProvider } from "@/providers/ThemeProvider";
import { AuthProvider } from "@/modules/auth";
import { Toaster } from "@/components/toaster";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="theme">
      <AuthProvider>
        <App />
      </AuthProvider>
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>
);


