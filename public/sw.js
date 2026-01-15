const SW_VERSION = 'v2.0.6';
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';

// Revert to split-file for iOS compatibility as single-file failed
importScripts(`push-worker.js?v=2.0.5`);

console.log(`[SW] MotionAG Service Worker ${SW_VERSION} Loaded`);

self.addEventListener('install', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Installing...`);
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Activating...`);
    event.waitUntil(clients.claim());
});
