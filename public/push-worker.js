// Custom Push Notification Worker (v1.9.1 - Split Diagnostics)

const SW_VERSION = 'v1.9.1';
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const DEFAULT_ICON = 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png';

self.addEventListener('push', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Push Received.`);

    event.waitUntil((async () => {
        // DIAGNOSTIC 1: Always show this immediately to confirm EVENT reached the device
        await self.registration.showNotification('SIGNAL REACHED PHONE', {
            body: 'Service worker is waking up...',
            tag: 'debug-stage-1',
            silent: true // Make it quiet so as not to annoy, but visible in center
        });

        let title = 'Motion Bus Live';
        let options = {
            body: 'Νέα ενημέρωση δρομολογίου 🚌',
            icon: DEFAULT_ICON,
            badge: DEFAULT_ICON,
            data: { url: '/MotionAG/' },
            tag: 'motion-bus-push',
            renotify: true
        };

        try {
            if (event.data) {
                // This is where it fails if encryption is wrong
                const payload = event.data.json();
                console.log('[Service Worker] Decrypted Payload:', JSON.stringify(payload));

                const data = payload.notification || payload;
                if (data.title) title = data.title;
                if (data.body) options.body = data.body;
                if (data.data) options.data = { ...options.data, ...data.data };
            } else {
                title = 'Empty Push';
                options.body = 'No payload data found.';
            }
        } catch (e) {
            console.error('[Service Worker] Decryption/Parse Error:', e);
            title = 'DECRYPTION FAILED';
            options.body = 'The message was reached but could not be read.';
        }

        // Final UI Notification
        return self.registration.showNotification(title, options);
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || (BASE_URL + '/MotionAG/');
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ls) => {
            for (const c of ls) {
                if (c.url.includes('/MotionAG') && 'focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
