import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const base = process.env.GITHUB_PAGES === 'true' ? '/MotionBus_AI/' : '/';
  
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
        strategies: 'injectManifest',
        srcDir: 'public',
        filename: 'sw.js',
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        },
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "robots.txt", "pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "Motion Bus - Ζωντανή Παρακολούθηση",
          short_name: "Motion Bus",
          description: "Παρακολούθηση θέσεων λεωφορείων και δρομολογίων σε πραγματικό χρόνο",
          theme_color: "#0ea5e9",
          background_color: "#0a0a0b",
          display: "standalone",
          orientation: "portrait",
          scope: base,
          start_url: base,
          categories: ["transportation", "travel", "utilities"],
          shortcuts: [
            {
              name: "Κοντινές Στάσεις",
              short_name: "Στάσεις",
              url: `${base}?view=nearby`,
              icons: [{ src: `${base}pwa-192x192.png`, sizes: "192x192" }]
            },
            {
              name: "Αποθηκευμένες Διαδρομές",
              short_name: "Διαδρομές",
              url: `${base}?view=saved`,
              icons: [{ src: `${base}pwa-192x192.png`, sizes: "192x192" }]
            }
          ],
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        screenshots: [
          {
            src: `${base}pwa-512x512.png`,
            sizes: "512x512",
            type: "image/png",
            form_factor: "narrow"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/^\/api/],
        additionalManifestEntries: [
          { url: `${base}sw.js`, revision: null },
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              networkTimeoutSeconds: 10,
            },
          },
          {
            urlPattern: /^https:\/\/.*tile.*\.openstreetmap\.org\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "map-tiles-cache",
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
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
