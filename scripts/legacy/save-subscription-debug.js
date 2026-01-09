// Debug version - shows what's happening at each step
(async () => {
  console.log('=== SAVING SUBSCRIPTION (DEBUG) ===\n');

  try {
    // Step 1: Check service worker
    console.log('Step 1: Checking service worker...');
    if (!('serviceWorker' in navigator)) {
      console.error('❌ Service workers not supported');
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    console.log('✅ Service worker ready');

    // Step 2: Get subscription
    console.log('\nStep 2: Getting push subscription...');
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      console.error('❌ NO SUBSCRIPTION FOUND');
      console.log('→ You need to enable notifications for a stop first');
      alert('❌ No subscription found. Enable notifications for a stop first!');
      return;
    }

    console.log('✅ Subscription found!');
    console.log('   Endpoint:', subscription.endpoint.substring(0, 60) + '...');

    // Step 3: Extract keys
    console.log('\nStep 3: Extracting keys...');
    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');

    if (!p256dhKey || !authKey) {
      console.error('❌ Failed to get subscription keys');
      return;
    }

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
    console.log('✅ Keys extracted');
    console.log('   p256dh:', p256dh.substring(0, 30) + '...');
    console.log('   auth:', auth.substring(0, 20) + '...');

    // Step 4: Get stop notifications
    console.log('\nStep 4: Getting stop notifications from localStorage...');
    const stored = localStorage.getItem('stop_notifications');
    const stopNotifications = stored ? JSON.parse(stored) : [];
    const pushEnabled = stopNotifications.filter(n => n.enabled && n.push);
    console.log(`✅ Found ${pushEnabled.length} enabled stop notification(s)`);

    // Step 5: Save to database
    console.log('\nStep 5: Saving to database...');
    const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
    const ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

    const payload = {
      endpoint: subscription.endpoint,
      p256dh: p256dh,
      auth: auth,
      stop_notifications: pushEnabled.length > 0 ? pushEnabled : [],
      updated_at: new Date().toISOString()
    };

    console.log('Sending payload:', {
      endpoint: payload.endpoint.substring(0, 50) + '...',
      p256dh: payload.p256dh.substring(0, 30) + '...',
      auth: payload.auth.substring(0, 20) + '...',
      stop_notifications_count: payload.stop_notifications.length
    });

    const response = await fetch(`${SUPABASE_URL}/rest/v1/stop_notification_subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    console.log('\nStep 6: Checking response...');
    console.log('   Status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('\n✅✅✅ SAVED TO DATABASE! ✅✅✅');
      console.log('Data:', data);
      alert('✅✅✅ SAVED! Subscription is now in the database!');
    } else {
      const errorText = await response.text();
      console.error('\n❌ DATABASE ERROR:');
      console.error('   Status:', response.status);
      console.error('   Error:', errorText);
      alert(`❌ Error ${response.status}: ${errorText.substring(0, 100)}`);
    }
  } catch (error) {
    console.error('\n❌ ERROR:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    alert(`❌ Error: ${error.message}`);
  }
})();

