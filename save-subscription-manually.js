// Run this in the browser console on https://kotsiosla.github.io/MotionBus_AI
// This will manually save your subscription to the database

(async () => {
  console.log('=== MANUAL SUBSCRIPTION SAVE ===\n');
  
  try {
    // 1. Get subscription
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('❌ NO SUBSCRIPTION FOUND');
      console.log('→ Enable notifications for a stop first');
      return;
    }
    
    console.log('✅ Subscription found!');
    console.log('Endpoint:', subscription.endpoint);
    
    // 2. Extract keys
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
    
    console.log('\n=== SAVING TO DATABASE ===');
    
    // 3. Save to stop_notification_subscriptions
    const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw';
    
    // Get stop notifications from localStorage
    const stored = localStorage.getItem('stop_notifications');
    const stopNotifications = stored ? JSON.parse(stored) : [];
    const pushEnabled = stopNotifications.filter(n => n.enabled && n.push);
    
    const response = await fetch(`${SUPABASE_URL}/rest/v1/stop_notification_subscriptions`, {
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
        stop_notifications: pushEnabled.length > 0 ? pushEnabled : [],
        updated_at: new Date().toISOString()
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ SAVED TO DATABASE!');
      console.log('Data:', data);
      console.log('\n✅ SUCCESS! Now I can send you a test notification!');
      alert('✅ Subscription saved! Now I can send you a test notification!');
    } else {
      const errorText = await response.text();
      console.error('❌ DATABASE ERROR:', response.status, errorText);
      alert(`❌ Error: ${response.status} - ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
    alert(`❌ Error: ${error.message}`);
  }
})();

