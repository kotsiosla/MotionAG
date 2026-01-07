// CREATE AND SAVE SUBSCRIPTION IN ONE STEP
// Run this in browser console - it creates the subscription and saves it immediately

(async () => {
  console.log('=== CREATING AND SAVING SUBSCRIPTION ===\n');
  
  try {
    // Step 1: Register service worker
    const basePath = window.location.pathname.startsWith('/MotionBus_AI') ? '/MotionBus_AI/' : '/';
    const swPath = basePath + 'sw.js';
    console.log('Registering service worker:', swPath);
    
    const registration = await navigator.serviceWorker.register(swPath);
    await navigator.serviceWorker.ready;
    console.log('✅ Service worker ready');
    
    // Step 2: Create subscription
    const VAPID_PUBLIC_KEY = 'BANXTqf4fsrCfS_g0072vs4QupJYZpxOLcOjHfUtcQVufSBkX8fAkv54bIHCU4fdf4BLIKz00Q2x6o1QiFB5vtU';
    
    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }
    
    console.log('Creating subscription...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    console.log('✅ Subscription created!');
    console.log('Endpoint:', subscription.endpoint);
    
    // Step 3: IMMEDIATELY save to database
    console.log('Saving to database...');
    
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');
    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
    
    const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
    const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw';
    
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
      console.log('✅✅✅ SAVED TO DATABASE! ✅✅✅');
      console.log('Data:', data);
      alert('✅✅✅ SUCCESS! Subscription created and saved! Now test with: .\\test-push-simple.ps1');
    } else {
      const errorText = await response.text();
      console.error('❌ DATABASE ERROR:');
      console.error('   Status:', response.status);
      console.error('   Error:', errorText);
      alert(`❌ Error ${response.status}: ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
    alert(`❌ Error: ${error.message}`);
  }
})();

