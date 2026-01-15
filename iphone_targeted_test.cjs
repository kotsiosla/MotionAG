const webpush = require('web-push');

// VAPID keys from Supabase Edge Function
const VAPID_PUBLIC = 'BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw';
const VAPID_PRIVATE = 'ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk';

// Subscription data for the user's iPhone
const subscription = {
    endpoint: 'https://web.push.apple.com/QGZgAzI87FMOkErE9tNfAr-OfEJdMPiA1wKFT-9krAz3gXGidNdo076o2UwPYLs9C1uGXoDsaXG08_VVJNIlzum-f1PZEgIC3YaNJx6561pSXWaO0aRyudrWwHQV3IFiaSUC6eFTyfTkLVtRmcN4YZOxBgFe2_FSjhDzd1qrXVg',
    keys: {
        p256dh: 'BHhEsRYatSYmBR4Cua5En8BoDeVlMD6cxj8Ri7eU5peFcJGMZVc87oZVN_Od7Nd041nqBNBpZyKNKML29cpUoww',
        auth: '7iqvhQZ-7WV-Z6zaVdy6nw'
    }
};

webpush.setVapidDetails(
    'mailto:admin@motionbus.cy',
    VAPID_PUBLIC,
    VAPID_PRIVATE
);

const payload = JSON.stringify({
    notification: {
        title: '🚨 CLOUD TEST v2.1',
        body: 'If you see this, Cloud-to-Phone path is OPEN! 🛰️',
        icon: '/MotionAG/pwa-192x192.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
        data: {
            url: '/MotionAG/debug.html',
            logUrl: 'https://jftthfniwfarxyisszjh.supabase.co',
            logKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw',
            stopId: 'IPHONE_DEBUG',
            tripId: 'CLOUD_TEST'
        }
    }
});

// 🚀 TARGET: The new "Self-Healed" iPhone Subscription
const TARGET_SUB_ID = '9e3f5a62-021e-4dd5-81a0-538ba2b16c9b';

console.log('--- Sending PUSH to iPhone ---');
console.log('ID: 1ed8cefb-9f96-493e-ad5b-dcb4a1d16324');

webpush.sendNotification(subscription, payload, {
    TTL: 3600,
    urgency: 'high'
})
    .then(response => {
        console.log('✅ Status:', response.statusCode);
        console.log('Response:', response.headers);
        console.log('--- DONE ---');
    })
    .catch(error => {
        console.error('❌ Error:', error.statusCode, error.body);
        process.exit(1);
    });
