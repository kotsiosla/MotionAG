// Run this in the browser console on https://kotsiosla.github.io/MotionBus_AI
// After enabling notifications for a stop

console.log('=== CHECKING SUBSCRIPTION ON MAIN SITE ===\n');

// 1. Check if subscription exists
navigator.serviceWorker.ready.then(registration => {
  return registration.pushManager.getSubscription();
}).then(subscription => {
  if (subscription) {
    console.log('✅ SUBSCRIPTION EXISTS!');
    console.log('Endpoint:', subscription.endpoint);
    
    // Extract keys
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
    
    console.log('\n=== SUBSCRIPTION DATA ===');
    console.log('Endpoint:', subscription.endpoint);
    console.log('p256dh:', p256dh.substring(0, 20) + '...');
    console.log('auth:', auth.substring(0, 20) + '...');
    
    // Try to save to database
    console.log('\n=== SAVING TO DATABASE ===');
    const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw';
    
    fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: p256dh,
        auth: auth,
        route_ids: []
      })
    }).then(response => {
      if (response.ok) {
        return response.json();
      } else {
        return response.text().then(text => { throw new Error(`${response.status}: ${text}`); });
      }
    }).then(data => {
      console.log('✅ SAVED TO DATABASE!');
      console.log('Data:', data);
      console.log('\n✅ SUCCESS! Now I can send you a test notification!');
    }).catch(error => {
      console.error('❌ DATABASE ERROR:', error);
    });
  } else {
    console.log('❌ NO SUBSCRIPTION FOUND');
    console.log('→ Enable notifications for a stop first');
    console.log('→ Click the bell icon on a stop');
    console.log('→ Click "Enable"');
  }
}).catch(error => {
  console.error('❌ ERROR:', error);
});

