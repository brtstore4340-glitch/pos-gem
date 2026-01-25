import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const container = document.getElementById("app-root");
if (!container) throw new Error("Missing #app-root in index.html");

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// ✅ remove HTML loading screen once app has painted at least 1 frame
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    const el = document.getElementById("app-loading");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  });
});
