// Custom Push Notification Worker (v1.11.0 - Loud & Simple)

const SW_VERSION = 'v1.11.0';

self.addEventListener('push', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Event`);

    event.waitUntil((async () => {
        let title = 'PUSH SIGNAL';
        let body = 'Awoken by server.';

        if (event.data) {
            try {
                const payload = event.data.json();
                const notification = payload.notification || payload;
                title = notification.title || 'ENCRYPTED PUSH';
                body = notification.body || 'Content decrypted.';
            } catch (e) {
                title = 'DECRYPTION FAILED';
                body = 'Signal received but content unreadable.';
            }
        }

        return self.registration.showNotification(title, {
            body: body,
            icon: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
            tag: 'v110-debug',
            renotify: true
        });
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
});
