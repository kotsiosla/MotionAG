const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function run() {
    const serviceKey = fs.readFileSync('key.txt', 'utf8').trim();
    const supabase = createClient('https://jftthfniwfarxyisszjh.supabase.co', serviceKey);

    const endpoint = "https://web.push.apple.com/QCxXpwW2PvYlVrDq7qXT9mw0gGY5h1i1vlwvHW7byc1Of4OniOn2Ac9WEKkQOXis8vLfudkHZm3T22jpdvQpLe9c_CkZGDNJ8fdZO5a4talMUCwAO6rFdEdf3aSPsGmhiU7gxikv1tHV6xIpmGF-x0IOZsm6gOu0za5MwhP4ZoU";
    const p256dh = "BFx/ZWI/LD8P3Uq66AB+cJmYryXtpm3kDOFd4DFhThmL22yQktDDOJZBxvWk3mVjviyNyx/GuhyW9IzeO3yrT50=";
    const auth = "/i1O8kU5De+9g/01ny57ig==";

    const stopNotifs = [
        {
            "push": true,
            "sound": true,
            "voice": true,
            "stopId": "2811",
            "enabled": true,
            "stopName": "Lakatameia Health Centre 2",
            "vibration": true,
            "beforeMinutes": 10
        }
    ];

    const { data, error } = await supabase
        .from('stop_notification_subscriptions')
        .insert([{
            endpoint,
            p256dh,
            auth,
            stop_notifications: stopNotifs
        }]);

    if (error) {
        console.error('Error inserting sub:', error);
    } else {
        console.log('Successfully inserted manual sub for iPhone!');
    }
}

run();
