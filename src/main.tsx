import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  const basePath = import.meta.env.BASE_URL || (window.location.pathname.startsWith('/MotionBus_AI') ? '/MotionBus_AI/' : '/');
  const swPath = `${basePath}sw.js`.replace('//', '/');
  
  // Wait a bit for page to be fully loaded
  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
  
  function registerSW() {
    console.log('[main.tsx] Attempting to register service worker:', swPath);
    navigator.serviceWorker.register(swPath, { scope: basePath })
      .then((registration) => {
        console.log('[main.tsx] ✅ Service worker registered:', registration.scope);
        console.log('[main.tsx] Service worker state:', registration.active?.state || registration.installing?.state || 'pending');
        
        // DON'T listen for updates - this can cause refresh loops
        // Updates will happen naturally when the page reloads
      })
      .catch((error) => {
        console.error('[main.tsx] ❌ Service worker registration failed:', error);
        console.error('[main.tsx] Error details:', error.message, error.stack);
        
        // Try fallback
        console.log('[main.tsx] Trying fallback path: /sw.js');
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[main.tsx] ✅ Service worker registered with fallback:', reg.scope);
          })
          .catch((err) => {
            console.error('[main.tsx] ❌ Fallback registration failed:', err);
            console.error('[main.tsx] Make sure the service worker file exists and is accessible');
          });
      });
  }
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
