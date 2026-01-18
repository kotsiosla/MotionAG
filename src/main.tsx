import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";
import "./index.css";

const APP_VERSION = "v1.7.8";

// Force trailing slash for MotionAG to ensure Service Worker scope is always valid
if (typeof window !== 'undefined' && window.location.pathname === '/MotionAG') {
  console.log(`[main.tsx] 🔄 Force redirecting to trailing slash for SW scope...`);
  window.location.replace(window.location.href + '/');
}

// GLOBAL ERROR LOGGING to Supabase
if (typeof window !== 'undefined') {
  window.onerror = async function (message, source, lineno, colno, error) {
    try {
      await (supabase as any).from('notifications_log').insert({
        stop_id: 'RUNTIME_ERROR',
        route_id: 'RUNTIME_CRASH',
        alert_level: 0,
        metadata: {
          message,
          source,
          lineno,
          colno,
          error: String(error),
          version: APP_VERSION,
          timestamp: new Date().toISOString(),
          href: window.location.href
        }
      });
    } catch { }
  };

  // Immediate BOOTSTRAP log
  (async () => {
    try {
      let swSupport = false;
      let regCount = 0;
      if ('serviceWorker' in navigator) {
        swSupport = true;
        try {
          const regs = await navigator.serviceWorker.getRegistrations();
          regCount = regs.length;
        } catch (e) { }
      }

      await (supabase as any).from('notifications_log').insert({
        stop_id: 'BOOTSTRAP',
        route_id: 'APP_BOOT',
        alert_level: 0,
        metadata: {
          step: 'BOOTSTRAP',
          version: APP_VERSION,
          href: window.location.href,
          sw_supported: swSupport,
          reg_count: regCount,
          timestamp: new Date().toISOString()
        }
      });
      console.log(`%c Motion Bus ${APP_VERSION} %c Bootstrap %c`, "color: white; background: #0ea5e9; padding: 2px 5px; border-radius: 4px; font-weight: bold;", "color: #0ea5e9; font-weight: bold;", "");
    } catch { }
  })();
}

// Register service worker
if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  const isMotionAG = window.location.pathname.includes('MotionAG');
  const basePath = isMotionAG ? '/MotionAG/' : '/';
  const regScope = isMotionAG ? '/MotionAG/' : '/';
  const swPath = `${basePath}sw.js`.replace(/\/\/+/g, '/');

  const registerSW = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();

      // Cleanup OLD or WRONG registrations
      for (const registration of registrations) {
        const scope = new URL(registration.scope).pathname;
        if (scope.includes('MotionAG') && scope !== regScope && scope !== regScope + '/') {
          console.log('[main.tsx] 🗑️ Unregistering old/wrong scope:', scope);
          await registration.unregister();
        }
      }

      // Now register the CORRECT one
      console.log('[main.tsx] Registering SW:', swPath, 'Scope:', regScope);
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: regScope,
        updateViaCache: 'none'
      });
      console.log('[main.tsx] ✅ SW registered:', registration.scope);

      // Log success to DB
      try {
        await (supabase as any).from('notifications_log').insert({
          stop_id: 'BOOTSTRAP',
          route_id: 'SW_REG_OK',
          alert_level: 0,
          metadata: {
            step: 'SW_REGISTERED_MAIN',
            scope: registration.scope,
            version: APP_VERSION,
            timestamp: new Date().toISOString()
          }
        });
      } catch { }

    } catch (error) {
      console.error('[main.tsx] ❌ Service worker registration failed:', error);
      // Log failure to DB
      try {
        await (supabase as any).from('notifications_log').insert({
          stop_id: 'BOOTSTRAP',
          route_id: 'SW_REG_FAIL',
          alert_level: 0,
          metadata: {
            step: 'SW_REGISTER_FAILED',
            error: String(error),
            version: APP_VERSION,
            timestamp: new Date().toISOString()
          }
        });
      } catch { }
    }
  };

  if (document.readyState === 'complete') {
    registerSW();
  } else {
    window.addEventListener('load', registerSW);
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  const errorMsg = "Critical Error: Root element not found.";
  console.error(errorMsg);
  if (typeof document !== 'undefined') {
    document.body.innerHTML = `<div style="padding: 20px; color: red;">${errorMsg}</div>`;
  }
} else {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
