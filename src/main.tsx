// Force trailing slash for MotionAG to ensure Service Worker scope is always valid
if (window.location.pathname === '/MotionAG') {
  console.log('[main.tsx] 🔄 Force redirecting to trailing slash for SW scope...');
  window.location.replace(window.location.href + '/');
}

// GLOBAL ERROR LOGGING to Supabase
if (typeof window !== 'undefined') {
  window.onerror = async function (message, source, lineno, colno, error) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = 'https://jftthfniwfarxyisszjh.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.UvY6oT8U7GoymO-4rI5-P_1S23yI19iV6Lh8R8E9O0s';
      const sb = createClient(supabaseUrl, supabaseKey);
      await sb.from('notifications_log').insert({
        route_id: 'RUNTIME_CRASH',
        metadata: { message, source, lineno, colno, error: String(error), version: 'v1.5.16.2', timestamp: new Date().toISOString() }
      });
    } catch { }
  };
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
