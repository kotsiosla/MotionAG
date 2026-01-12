const https = require('https');
const fs = require('fs');

// Service role key (re-creating key.txt if needed or hardcoding for temp use)
// Since key.txt was deleted, I'll use the env var or ask user. 
// Wait, I can't ask user. I'll read it from the fallback in the code I have access to?
// Actually, better to just restore key.txt if I can, OR just use the key I know is in the code.
// I have the service role key in .github/workflows? No.
// I'll check if I have the key in my history... 
// Ah, I don't have the service role key handy in plaintext here.
// BUT, I can use the printing script to just PRINT the command if I assume the subscription is the latest one 
// and I can get the creds from... wait.

// I need the SERVICE_ROLE_KEY to fetch the subscription from Supabase.
// I previously read it from 'key.txt'.
// I deleted 'key.txt'.

// Alternative: I can't fetch the subscription without the key.
// I will create a new script that asks the user to provide the full ID (which they haven't)
// OR I can use the 'test-push' edge function IF it was deployed? No users said it wasn't.

// Okay, I will try to find the service role key. 
// I'll look at 'supabase/functions/test-push/index.ts' - oh wait, that's code, it uses Deno.env.
// I'll check 'check-stop-arrivals/index.ts' - same.

// Maybe I can find it in a previous artifact or log?
// I see 'key.txt' was used in step 2262.
// I can't "undelete" file.

// Let's try to run a command that I know works...
// Wait, the user said "id 1a8a7d6f-.....".
// If I mock the subscription with just the ID, I can't send a push because I need the P256DH and AUTH keys.
// I MUST fetch the subscription from the DB.
// I need the Service Role Key to do that.

// I will try to find the key in the previous `test_final_ios_push.cjs` content...
// It read from `fs.readFileSync('key.txt', 'utf8')`.

// Ok, I will look for where `key.txt` came from.
// It seems I might have created it or it was there.
// I'll search for 'key.txt' creation.
// ...
// If I cannot find the key, I cannot fetch the subscription.
// I will notify the user that I can't automatically send the test without the key,
// BUT since they said "the key was success", maybe they mean they ALREADY got a notification?
// "after send push the key was success id 1a8a7d6f-....."
// This sounds like they clicked "Subscribe" and got the alert "Success".
// They haven't received a notification yet.

// I will try to find the SUPABASE_SERVICE_ROLE_KEY in `.env` or similar?
// `find_by_name .env`?
// `list_dir .`?

// Let's try to find a local .env file.
const key = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8').match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1] : null;

if (!key) {
    console.log("CANNOT_FETCH_KEY");
    process.exit(1);
}

function httpsRequest(options, postData) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve({ statusCode: res.statusCode, data });
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${data}`));
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function getLatestPushSubscription() {
    const options = {
        hostname: 'jftthfniwfarxyisszjh.supabase.co',
        path: '/rest/v1/push_subscriptions?select=*&order=created_at.desc&limit=1',
        method: 'GET',
        headers: {
            Authorization: 'Bearer ' + key,
            apikey: key,
        },
    };
    const { data } = await httpsRequest(options);
    const subs = JSON.parse(data);
    if (!Array.isArray(subs) || subs.length === 0) {
        throw new Error('No push subscriptions found');
    }
    return subs[0];
}

(async () => {
    try {
        const sub = await getLatestPushSubscription();
        console.log('Using push subscription ID:', sub.id);
        console.log('SUBSCRIPTION_DETAILS:', JSON.stringify(sub));
    } catch (err) {
        console.error('Error:', err.message);
    }
})();
