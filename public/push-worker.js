// Custom Push Notification Worker (v1.8.0 - Extreme Debugging)

const SW_VERSION = 'v1.8.0';

self.addEventListener('push', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Push Received.`);

    // ATTEMPT TO LOG TO CONSOLE (Visible if remote debugging)
    // BUT MORE IMPORTANTLY: SHOW A NOTIFICATION IMMEDIATELY

    const promise = self.registration.showNotification('RECEIVED PUSH!', {
        body: 'The Service Worker event fired successfully.',
        tag: 'debug-ping',
        renotify: true
    });

    event.waitUntil(promise);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
});

// v1.8.0 is a "ping" worker to test if the event even fires.
