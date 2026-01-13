import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications (Android only - iOS uses client-side)
// Register service worker for push notifications (Android only - iOS uses client-side)
if ('serviceWorker' in navigator) {
  // Determine correct base path - handle both dev and prod (MotionAG)
  // We prioritize the known deployment path if we detect we are on that URL
  const isMotionAG = window.location.pathname.includes('/MotionAG/');
  const basePath = isMotionAG ? '/MotionAG/' : (import.meta.env.BASE_URL || '/');

  const swPath = `${basePath}push-worker.js`.replace('//', '/');

  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }

  async function registerSW() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Cleanup OLD or WRONG registrations (e.g. from MotionBus_AI or root if we are in MotionAG)
      for (const registration of registrations) {
        const scope = new URL(registration.scope).pathname;
        if (scope !== basePath && scope !== basePath.slice(0, -1)) { // Handle trailing slash diffs
          console.log('[main.tsx] 🗑️ Unregistering old/wrong scope:', scope, 'Current base:', basePath);
          await registration.unregister();
        }
      }

      // Now register the CORRECT one always (updateViaCache: 'none' ensures we get fresh SW)
      console.log('[main.tsx] Registering service worker:', swPath, 'Scope:', basePath);
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: basePath,
        updateViaCache: 'none'
      });
      console.log('[main.tsx] ✅ Service worker registered:', registration.scope);

    } catch (error) {
      console.error('[main.tsx] ❌ Service worker registration failed:', error);
    }
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
