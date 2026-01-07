import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications (Android only - iOS uses client-side)
if ('serviceWorker' in navigator) {
  const basePath = import.meta.env.BASE_URL || (window.location.pathname.startsWith('/MotionBus_AI') ? '/MotionBus_AI/' : '/');
  const swPath = `${basePath}sw.js`.replace('//', '/');
  
  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
  
  function registerSW() {
    // Check if already registered to avoid duplicate registration
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      if (registrations.length > 0) {
        console.log('[main.tsx] ✅ Service worker already registered:', registrations[0].scope);
        return;
      }
      
      // Register only if not already registered - NO update checking to prevent refresh loop
      console.log('[main.tsx] Registering service worker:', swPath);
      navigator.serviceWorker.register(swPath, { scope: basePath, updateViaCache: 'none' })
        .then((registration) => {
          console.log('[main.tsx] ✅ Service worker registered:', registration.scope);
          // DON'T check for updates - this can cause refresh loops
        })
        .catch((error) => {
          console.error('[main.tsx] ❌ Service worker registration failed:', error);
        });
    });
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
