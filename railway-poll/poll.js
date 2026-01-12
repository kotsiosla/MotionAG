// poll.js - 10-second polling service for Railway
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing environment variables!');
    console.error('Please set SUPABASE_URL and SERVICE_ROLE_KEY in Railway dashboard');
    process.exit(1);
}

async function ping() {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🔄 Calling check-stop-arrivals...`);

    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/check-stop-arrivals`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`[${timestamp}] ✅ Status: ${res.status}`);

        if (!res.ok) {
            const text = await res.text();
            console.error(`[${timestamp}] ⚠️  Response: ${text}`);
        }
    } catch (e) {
        console.error(`[${timestamp}] ❌ Error:`, e.message);
    }
}

// Fire immediately
console.log('🚀 Starting 10-second polling service...');
ping();

// Then every 10 seconds
setInterval(ping, 10_000);
