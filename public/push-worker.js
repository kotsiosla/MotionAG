// Custom Push Notification Worker (v1.10.0 - Phone Home)

const SW_VERSION = 'v1.10.0';
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwOTMyMSwiZXhwIjoyMDgzMjg1MzIxfQ.1WOlUNRcE0WBqg8uY--mL0eSlIiMlB49Mg4byOkigGE";

async function logToSupabase(msg, data = {}) {
    try {
        await fetch(`${SUPABASE_URL}/rest/v1/notifications_log`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                metadata: { msg, version: SW_VERSION, ...data, timestamp: new Date().toISOString() }
            })
        });
    } catch (e) {
        console.error('Logging failed', e);
    }
}

self.addEventListener('push', (event) => {
    console.log(`[Service Worker] ${SW_VERSION} Event received`);

    event.waitUntil((async () => {
        // PHONE HOME: Notify the server we woke up
        await logToSupabase('PUSH_EVENT_FIRED', { hasData: !!event.data });

        let title = 'Motion Bus Live';
        let body = 'Νέα ενημέρωση δρομολογίου 🚌';

        if (event.data) {
            try {
                const payload = event.data.json();
                const notification = payload.notification || payload;
                if (notification.title) title = notification.title;
                if (notification.body) body = notification.body;

                await logToSupabase('DECRYPTION_SUCCESS', { title });
            } catch (e) {
                console.error('Decryption failed', e);
                title = 'ERROR: BROADCAST DISRUPTED';
                body = 'Unable to read the encrypted message.';
                await logToSupabase('DECRYPTION_ERROR', { error: e.message });
            }
        } else {
            title = 'PING RECEIVED';
            body = 'The connection is active.';
        }

        return self.registration.showNotification(title, {
            body: body,
            icon: `${BASE_URL}/pwa-192x192.png`,
            tag: 'motion-bus-push',
            renotify: true,
            data: { url: '/MotionAG/' }
        });
    })());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(clients.openWindow(`${BASE_URL}/MotionAG/`));
});
