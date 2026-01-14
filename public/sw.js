// Custom Service Worker for MotionAG v2.0.3
// This file is used for both precaching and background push notifications

// Import the push handling logic
// We use a timestamp to bypass any intermediate caching
importScripts('push-worker.js?v=2.0.3');

console.log('[SW] MotionAG Service Worker v2.0.3 Loaded');

self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    event.waitUntil(clients.claim());
});
