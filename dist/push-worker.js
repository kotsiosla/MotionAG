const SW_VERSION = 'v2.0.6';
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const DEFAULT_ICON = 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png';
const FALLBACK_URL = '/MotionAG/';

self.addEventListener('install', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Installing...`);
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Activating...`);
    event.waitUntil(clients.claim());
});

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
            renotify: true,
            vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40, 500],
            requireInteraction: true,
            silent: false,
            actions: [
                { action: 'open', title: '🚌 View Arrival' }
            ]
        };

        let logUrl = 'https://jftthfniwfarxyisszjh.supabase.co';
        let logKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw';
        let stopId = 'UNKNOWN';
        let tripId = 'UNKNOWN';
        let payloadReceived = false;

        try {
            if (event.data) {
                payloadReceived = true;
                const payload = event.data.json();
                const data = payload.notification || payload;

                if (data.title) title = data.title;
                if (data.body) options.body = data.body;
                if (data.icon) options.icon = data.icon;
                if (data.data) {
                    options.data = { ...options.data, ...data.data };
                    if (data.data.logUrl) logUrl = data.data.logUrl;
                    if (data.data.logKey) logKey = (data.data.logKey.length > 50) ? data.data.logKey : logKey;
                    if (data.data.stopId) stopId = data.data.stopId;
                    if (data.data.tripId) tripId = data.data.tripId;
                }
                if (data.vibrate) options.vibrate = data.vibrate;
                if (data.requireInteraction !== undefined) options.requireInteraction = data.requireInteraction;
            }
        } catch (e) {
            console.error('[Service Worker] Payload parse error:', e);
            options.body = 'Ενημέρωση δρομολογίου (Σφάλμα αποκωδικοποίησης)';
        }

        // Ensure absolute URLs for iOS
        const targetUrl = options.data.url || FALLBACK_URL;
        if (!targetUrl.startsWith('http')) {
            options.data.url = BASE_URL + (targetUrl.startsWith('/') ? '' : '/') + targetUrl;
        }

        // Show notification first to comply with "show notification or be killed" rules
        let showPromise;
        try {
            showPromise = self.registration.showNotification(title, options);
        } catch (e) {
            console.error('[Service Worker] Critical showNotification failure:', e);
            showPromise = Promise.reject(e);
        }

        // REMOTE LOGGING (Diagnostic)
        try {
            const logPromise = fetch(`${logUrl}/rest/v1/notifications_log`, {
                method: 'POST',
                headers: {
                    'apikey': logKey,
                    'Authorization': `Bearer ${logKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    stop_id: stopId,
                    route_id: tripId,
                    alert_level: 1,
                    metadata: {
                        step: 'PUSH_RECEIVED',
                        version: SW_VERSION,
                        payload_ok: payloadReceived,
                        timestamp: new Date().toISOString()
                    }
                })
            });
            return Promise.allSettled([showPromise, logPromise]);
        } catch (e) {
            console.error('SW Logging failed', e);
            return showPromise;
        }
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || (BASE_URL + FALLBACK_URL);

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            // Check if there's already a tab open with this app
            for (const client of windowClients) {
                if (client.url.includes('/MotionAG') && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no window found, open a new one
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
