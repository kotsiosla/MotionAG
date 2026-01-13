// Custom Push Notification Worker (v1.7.0 - iOS Ultimate Hardening)

const SW_VERSION = 'v1.7.0';
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const DEFAULT_ICON = 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png';
const FALLBACK_URL = '/MotionAG/';

// Push notification handler
self.addEventListener('push', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Push Received.`);

    event.waitUntil((async () => {
        let title = 'Motion Bus Live';
        let options = {
            body: 'Νέα ενημέρωση δρομολογίου 🚌',
            icon: DEFAULT_ICON,
            badge: DEFAULT_ICON,
            vibrate: [100, 50, 100],
            data: { url: FALLBACK_URL },
            tag: 'motion-bus-push',
            renotify: true
        };

        try {
            if (event.data) {
                // Try to parse the payload safely
                let payload = {};
                try {
                    payload = event.data.json();
                } catch (e) {
                    // If JSON fails, it might be a flat string
                    const text = event.data.text();
                    payload = { body: text };
                }

                console.log('[Service Worker] Payload received:', JSON.stringify(payload));

                // Support both nested and flat structures
                const data = payload.notification || payload;

                if (data.title) title = data.title;
                if (data.body) options.body = data.body;
                if (data.icon) options.icon = data.icon;
                if (data.badge) options.badge = data.badge;

                // Merge deep data
                if (data.data) {
                    options.data = { ...options.data, ...data.data };
                }
            }
        } catch (e) {
            console.error('[Service Worker] Massive failure in push handler:', e);
        }

        // Final URL validation (must be absolute for iOS clicks)
        const finalUrl = options.data.url || FALLBACK_URL;
        if (!finalUrl.startsWith('http')) {
            options.data.url = BASE_URL + (finalUrl.startsWith('/') ? '' : '/') + finalUrl;
        }

        console.log(`[Service Worker] Final Title: ${title}`);
        console.log(`[Service Worker] Final Options: ${JSON.stringify(options)}`);

        return self.registration.showNotification(title, options);
    })());
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || (BASE_URL + FALLBACK_URL);

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('/MotionAG') && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('Push subscription changed:', event);
});
