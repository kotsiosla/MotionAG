const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);
    const endpoint = "https://web.push.apple.com/QCxXpwW2PvYlVrDq7qXT9mw0gGY5h1i1vlwvHW7byc1Of4OniOn2Ac9WEKkQOXis8vLfudkHZm3T22jpdvQpLe9c_CkZGDNJ8fdZO5a4talMUCwAO6rFdEdf3aSPsGmhiU7gxikv1tHV6xIpmGF-x0IOZsm6gOu0za5MwhP4ZoU";

    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .select('*')
        .eq('endpoint', endpoint)
        .maybeSingle();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log(`STOP NOTIFS FOR f6c06200:`);
    console.log(JSON.stringify(data, null, 2));
}

run();
