// Custom Push Notification Worker (v1.5.0 - Absolute Paths & Fallback)

// ABSOLUTE PATH to icons is critical for iOS robustness
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const DEFAULT_ICON = `${BASE_URL}/pwa-192x192.png`;

// Push notification handler
// Push notification handler
self.addEventListener('push', (event) => {
    console.log('Push event received');

    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
            console.log('Push data parsed:', data);
        } catch (e) {
            console.error('Error parsing push data:', e);
            return;
        }
    }

    // iOS expects a `notification` wrapper
    if (!data.notification) {
        console.warn("Push payload missing `notification` field – ignored (or legacy payload)");
        // Fallback for flat payload if needed, but primarily targeting nested
        return;
    }

    const { title, ...options } = data.notification;

    // Ensure icon/badge are absolute if present
    if (options.icon && options.icon.startsWith('/')) {
        options.icon = BASE_URL + options.icon.replace('/MotionAG', '');
    }
    if (options.badge && options.badge.startsWith('/')) {
        options.badge = BASE_URL + options.badge.replace('/MotionAG', '');
    }

    // Add tag to collapse notifications
    options.tag = options.tag || 'motion-bus-default';
    options.renotify = true;

    event.waitUntil(
        self.registration.showNotification(title, options)
            .catch(err => {
                console.error('ShowNotification failed:', err);
                // Fallback: minimal notification
                return self.registration.showNotification(title, { body: options.body });
            })
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    event.notification.close();

    if (event.action === 'close') {
        return;
    }

    const urlToOpen = event.notification.data?.url || '/MotionAG/';

    // Validate URL logic...
    let validatedUrl = '/MotionAG/';
    try {
        if (urlToOpen.startsWith('http')) {
            validatedUrl = urlToOpen;
        } else {
            validatedUrl = urlToOpen;
        }
    } catch (e) { }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(validatedUrl);
            }
        })
    );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('Push subscription changed:', event);
});
