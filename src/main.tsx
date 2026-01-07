import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// TEMPORARY: Disable service worker registration to prevent refresh loop
// TODO: Re-enable once refresh loop is fixed
// Service worker registration is disabled to prevent refresh loops
// Notifications will work client-side only (when app is open)
console.log('[main.tsx] Service worker registration disabled (temporary fix for refresh loop)');

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
