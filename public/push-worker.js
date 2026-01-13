// Custom Push Notification Worker (v1.6.0 - iOS Stability Fixes)

const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const DEFAULT_ICON = `${BASE_URL}/pwa-192x192.png`;
const FALLBACK_URL = `${BASE_URL}/`;

// Push notification handler
self.addEventListener('push', (event) => {
    console.log('Push event received');

    let data = {};
    try {
        data = event.data ? event.data.json() : {};
        console.log('Push data parsed:', data);
    } catch (e) {
        console.error('Error parsing push data:', e);
        data = {};
    }

    // Default/Fallback notification values if payload is malformed or missing the 'notification' wrapper
    const notification = data.notification || {
        title: 'Motion Bus - MotionAG',
        body: data.body || 'Νέα ειδοποίηση από την εφαρμογή',
        icon: DEFAULT_ICON,
        badge: DEFAULT_ICON,
        data: { url: FALLBACK_URL }
    };

    const { title, ...options } = notification;

    // Ensure icon/badge are absolute if present
    if (options.icon && options.icon.startsWith('/')) {
        options.icon = BASE_URL + options.icon.replace('/MotionAG', '');
    }
    if (options.badge && options.badge.startsWith('/')) {
        options.badge = BASE_URL + options.badge.replace('/MotionAG', '');
    }

    // Safety check for absolute URLs if they don't have a protocol
    if (options.icon && !options.icon.startsWith('http')) options.icon = DEFAULT_ICON;
    if (options.badge && !options.badge.startsWith('http')) options.badge = DEFAULT_ICON;

    // Ensure data exists and has a url
    options.data = options.data || {};
    options.data.url = options.data.url || FALLBACK_URL;

    // Add tag to collapse notifications
    options.tag = options.tag || 'motion-bus-default';
    options.renotify = true;

    event.waitUntil(
        self.registration.showNotification(title, options)
            .catch(err => {
                console.error('ShowNotification failed:', err);
                // Last resort fallback
                return self.registration.showNotification('Motion Bus', {
                    body: 'Ενημέρωση δρομολογίου',
                    icon: DEFAULT_ICON,
                    data: { url: FALLBACK_URL }
                });
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

    // Use Absolute URLs for iOS robustness
    const urlToOpen = event.notification.data?.url || FALLBACK_URL;
    let absoluteUrl = urlToOpen;

    try {
        if (!urlToOpen.startsWith('http')) {
            absoluteUrl = new URL(urlToOpen, BASE_URL).href;
        }
    } catch (e) {
        absoluteUrl = FALLBACK_URL;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // 1. Try to find an existing tab
            for (const client of clientList) {
                if (client.url.startsWith(BASE_URL) && 'focus' in client) {
                    return client.focus();
                }
            }
            // 2. If no tab found, open a new one
            if (clients.openWindow) {
                return clients.openWindow(absoluteUrl);
            }
        })
    );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
    console.log('Push subscription changed:', event);
});
