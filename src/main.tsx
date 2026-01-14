// Force trailing slash for MotionAG to ensure Service Worker scope is always valid
if (window.location.pathname === '/MotionAG') {
  console.log('[main.tsx] 🔄 Force redirecting to trailing slash for SW scope...');
  window.location.replace(window.location.href + '/');
}

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications (Android only - iOS uses client-side)
if ('serviceWorker' in navigator) {
  // Determine correct base path - handle both dev and prod (MotionAG)
  const isMotionAG = window.location.pathname.includes('MotionAG');
  const basePath = isMotionAG ? '/MotionAG/' : '/';
  const regScope = isMotionAG ? '/MotionAG' : '/';

  const swPath = `${basePath}push-worker.js`.replace(/\/\/+/g, '/');

  // Wait for page to be fully loaded
  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }

  async function registerSW() {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Cleanup OLD or WRONG registrations
      for (const registration of registrations) {
        const scope = new URL(registration.scope).pathname;
        // If scope is exactly /MotionAG/ (old way) but we want /MotionAG (inclusive)
        if (scope.includes('MotionAG') && scope !== regScope && scope !== regScope + '/') {
          console.log('[main.tsx] 🗑️ Unregistering old/wrong scope:', scope);
          await registration.unregister();
        }
      }

      // Now register the CORRECT one always (updateViaCache: 'none' ensures we get fresh SW)
      console.log('[main.tsx] Registering SW:', swPath, 'Scope:', regScope);
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: regScope,
        updateViaCache: 'none'
      });
      console.log('[main.tsx] ✅ SW registered:', registration.scope);

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
