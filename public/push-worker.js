// Custom Push Notification Worker (v1.9.0 - Production Ready)

const SW_VERSION = 'v1.9.0';
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const DEFAULT_ICON = 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png';
const FALLBACK_URL = '/MotionAG/';

self.addEventListener('push', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Push Received.`);

    event.waitUntil((async () => {
        let title = 'Motion Bus Live';
        let options = {
            body: 'Νέα ενημέρωση δρομολογίου 🚌',
            icon: DEFAULT_ICON,
            badge: DEFAULT_ICON,
            data: { url: FALLBACK_URL },
            tag: 'motion-bus-push',
            renotify: true
        };

        try {
            if (event.data) {
                const payload = event.data.json();
                console.log('[Service Worker] Payload:', JSON.stringify(payload));

                const data = payload.notification || payload;
                if (data.title) title = data.title;
                if (data.body) options.body = data.body;
                if (data.icon) options.icon = data.icon;
                if (data.badge) options.badge = data.badge;

                if (data.data) {
                    options.data = { ...options.data, ...data.data };
                }
            } else {
                console.log('[Service Worker] Zero-payload push received.');
                title = 'Motion Bus - Ping';
                options.body = 'Η σύνδεση είναι ενεργή! 🚌';
            }
        } catch (e) {
            console.error('[Service Worker] Error parsing payload:', e);
            title = 'Motion Bus';
            options.body = 'Πατήστε για να δείτε το δρομολόγιο';
        }

        // Final absolute URL check for iOS
        const finalUrl = options.data.url || FALLBACK_URL;
        if (!finalUrl.startsWith('http')) {
            options.data.url = BASE_URL + (finalUrl.startsWith('/') ? '' : '/') + finalUrl;
        }

        return self.registration.showNotification(title, options);
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || (BASE_URL + FALLBACK_URL);
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ls) => {
            for (const c of ls) {
                if (c.url.includes('/MotionAG') && 'focus' in c) return c.focus();
            }
            if (clients.openWindow) return clients.openWindow(url);
        })
    );
});
