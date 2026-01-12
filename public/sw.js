// Custom Service Worker for MotionAG
// Import the push handling worker
importScripts('push-worker.js');

// Workbox precache manifest (will be injected at build time)
if (self.__WB_MANIFEST) {
    import { precacheAndRoute } from 'workbox-precaching';
    precacheAndRoute(self.__WB_MANIFEST);
}
