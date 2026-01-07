import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  const basePath = import.meta.env.BASE_URL || (window.location.pathname.startsWith('/MotionBus_AI') ? '/MotionBus_AI/' : '/');
  const swPath = `${basePath}sw.js`.replace('//', '/');
  
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(swPath, { scope: basePath })
      .then((registration) => {
        console.log('[main.tsx] ✅ Service worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('[main.tsx] ❌ Service worker registration failed:', error);
        // Try fallback
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => console.log('[main.tsx] ✅ Service worker registered with fallback'))
          .catch((err) => console.error('[main.tsx] ❌ Fallback registration failed:', err));
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
