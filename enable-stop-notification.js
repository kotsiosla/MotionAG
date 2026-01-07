// Enable Stop Notification - Manual Setup
// Copy and paste this entire script into your browser console (F12)
// This will help you enable notifications for a bus stop

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  ENABLE STOP NOTIFICATION');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // 1. Check service worker and subscription
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) {
    console.error('❌ No service worker found');
    console.log('→ The app needs to register a service worker first');
    return;
  }
  
  const registration = registrations[0];
  let subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    console.log('⚠️ No push subscription found');
    console.log('→ Creating push subscription...');
    
    // Get VAPID public key
    const VAPID_PUBLIC_KEY = 'BM5pROt5d4ceUeGjvlpk4SmlEEBbe4lKQ0B2xVcyjU1VbObEex87ohRSlOCxMQJEF6zJYonkbLOIrH0k04xNEAc';
    const vapidKeyArray = new Uint8Array(
      atob(VAPID_PUBLIC_KEY)
        .split('')
        .map(c => c.charCodeAt(0))
    );
    
    try {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKeyArray,
      });
      
      // Check if endpoint is WNS - WNS doesn't support Web Push/VAPID
      const endpointUrl = new URL(subscription.endpoint);
      if (endpointUrl.hostname.includes('wns.') || endpointUrl.hostname.includes('notify.windows.com')) {
        console.warn('⚠️ WNS endpoint detected - WNS doesn\'t support Web Push. Unsubscribing...');
        await subscription.unsubscribe();
        throw new Error('WNS endpoint not supported - please use Chrome, Firefox, or Edge (Chromium)');
      }
      
      console.log('✅ Push subscription created');
    } catch (error) {
      console.error('❌ Failed to create push subscription:', error);
      return;
    }
  } else {
    console.log('✅ Push subscription found');
  }
  
  console.log('Endpoint:', subscription.endpoint.substring(0, 60) + '...');
  console.log('');
  
  // 2. Ask user for stop details
  const stopId = prompt('Enter Stop ID (e.g., "12345"):');
  if (!stopId) {
    console.log('❌ No stop ID provided');
    return;
  }
  
  const stopName = prompt('Enter Stop Name (e.g., "Central Station"):') || `Stop ${stopId}`;
  const beforeMinutes = parseInt(prompt('Notify before how many minutes? (default: 5):') || '5', 10);
  
  console.log(`Setting up notification for: ${stopName} (${stopId})`);
  console.log(`Notify ${beforeMinutes} minutes before arrival`);
  console.log('');
  
  // 3. Create stop notification settings
  const settings = {
    stopId,
    stopName,
    enabled: true,
    sound: true,
    vibration: true,
    voice: false,
    push: true,
    beforeMinutes,
  };
  
  // 4. Save to localStorage
  const stored = localStorage.getItem('stop_notifications');
  let allNotifications = stored ? JSON.parse(stored) : [];
  const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
  if (existingIndex >= 0) {
    allNotifications[existingIndex] = settings;
    console.log('✅ Updated existing notification');
  } else {
    allNotifications.push(settings);
    console.log('✅ Added new notification');
  }
  localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));
  
  console.log(`Total notifications in localStorage: ${allNotifications.length}`);
  console.log('');
  
  // 5. Extract keys and save to server
  const p256dhKey = subscription.getKey('p256dh');
  const authKey = subscription.getKey('auth');
  if (!p256dhKey || !authKey) {
    console.error('❌ Failed to get subscription keys');
    return;
  }
  
  const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
  const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
  
  // 6. Save to server
  const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw';
  
  const pushNotifications = allNotifications.filter(n => n.enabled && n.push);
  
  console.log('Saving to server...');
  console.log(`Stop notifications to save: ${pushNotifications.length}`);
  pushNotifications.forEach(n => {
    console.log(`  - ${n.stopName} (${n.stopId}), Before: ${n.beforeMinutes} min`);
  });
  console.log('');
  
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
      p256dh,
      auth,
      stop_notifications: pushNotifications,
      updated_at: new Date().toISOString()
    })
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log('✅ SUCCESS! Saved to server:');
    console.log(data);
    alert('✅ Stop notification enabled and saved to server!');
  } else {
    // Try upsert if POST fails (endpoint already exists)
    const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/stop_notification_subscriptions?endpoint=eq.${encodeURIComponent(subscription.endpoint)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        stop_notifications: pushNotifications,
        updated_at: new Date().toISOString()
      })
    });
    
    if (upsertResponse.ok) {
      const data = await upsertResponse.json();
      console.log('✅ SUCCESS! Updated on server:');
      console.log(data);
      alert('✅ Stop notification enabled and updated on server!');
    } else {
      const error = await upsertResponse.text();
      console.error('❌ ERROR:', response.status, error);
      alert('❌ Error: ' + response.status);
    }
  }
  
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  console.log('1. ✅ Stop notification enabled');
  console.log('2. ⚠️ Make sure cron job is running (check Supabase Dashboard)');
  console.log('3. ⚠️ Background notifications will work when app is closed');
  console.log('4. ⚠️ Client-side notifications work when app is open');
  console.log('');
})();


