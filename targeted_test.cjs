const webpush = require('web-push');
const fs = require('fs');
const https = require('https');

// Hardcoded matching keys from server
const VAPID_PUBLIC_KEY = 'BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw';
const VAPID_PRIVATE_KEY = 'ynT-wYr9bdzGYOVDHiqIEbvXua5WynRuS9vNAXg62pk';

// The verified Android Subscription ID
const ANDROID_SUB_ID = '20396925-83db-4ba3-8f9e-5cb557912a69'; // Actually targeting iPhone now

webpush.setVapidDetails(
    'mailto:info@motionbus.cy',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const key = fs.readFileSync('key.txt', 'utf8').trim();

// 1. Fetch Sub Details
const opt = {
    hostname: 'jftthfniwfarxyisszjh.supabase.co',
    path: `/rest/v1/stop_notification_subscriptions?select=*&id=eq.${ANDROID_SUB_ID}&limit=1`,
    headers: { 'Authorization': 'Bearer ' + key, 'apikey': key }
};

console.log('Fetching subscription details for:', ANDROID_SUB_ID);
https.request(opt, res => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        let subs;
        try {
            subs = JSON.parse(data);
        } catch (e) {
            console.error('Failed to parse DB response:', data);
            return;
        }

        if (!subs || subs.length === 0) {
            console.error('Subscription not found in DB!');
            return;
        }
        const sub = subs[0];
        console.log('Found Sub Endpoint:', sub.endpoint);

        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        };

        const payload = JSON.stringify({
            title: 'SIMPLE TEST',
            body: 'Text only. No icons.',
            icon: '',
            badge: ''
        });

        console.log('Sending Web Push...');
        webpush.sendNotification(pushSubscription, payload)
            .then(response => {
                console.log('SUCCESS! ✅');
                console.log('Status Code:', response.statusCode);
            })
            .catch(error => {
                console.error('FAILED! ❌');
                console.error('Status Code:', error.statusCode);
                console.error('Message:', error.message);
                console.error('Body:', error.body);
            });
    });
}).end();
