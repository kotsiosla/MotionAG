import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = '/MotionAG/';

  return {
    base,
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        strategies: 'generateSW',
        workbox: {
          importScripts: ['push-worker.js'],
          globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true
        },
        includeAssets: ["favicon.ico", "robots.txt", "pwa-192x192.png", "pwa-512x512.png", "images/bus-icon.png"],
        manifest: {
          name: "Motion Bus - Ζωντανή Παρακολούθηση",
          short_name: "Motion Bus",
          description: "Παρακολούθηση θέσεων λεωφορείων και δρομολογίων σε πραγματικό χρόνο",
          theme_color: "#0ea5e9",
          background_color: "#0a0a0b",
          display: "standalone",
          orientation: "any",
          scope: base,
          start_url: base,
          categories: ["transportation", "travel", "utilities"],
          shortcuts: [
            {
              name: "Κοντινές Στάσεις",
              short_name: "Στάσεις",
              url: `${base}?view=nearby`,
              icons: [{ src: `${base}images/bus-icon.png`, sizes: "192x192" }]
            },
            {
              name: "Αποθηκευμένες Διαδρομές",
              short_name: "Διαδρομές",
              url: `${base}?view=saved`,
              icons: [{ src: `${base}images/bus-icon.png`, sizes: "192x192" }]
            }
          ],
          icons: [
            {
              src: `${base}images/bus-icon.png`,
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: `${base}images/bus-icon.png`,
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: `${base}images/bus-icon.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
          screenshots: [
            {
              src: `${base}images/bus-icon.png`,
              sizes: "512x512",
              type: "image/png",
              form_factor: "narrow"
            }
          ]
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react-router-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },
    build: {
      chunkSizeWarningLimit: 1000,
    },
  };
});
