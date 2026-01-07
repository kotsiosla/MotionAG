// Register service worker and create subscription
// Run this in browser console

(async () => {
  console.log('=== REGISTERING SERVICE WORKER & CREATING SUBSCRIPTION ===\n');
  
  try {
    // Step 1: Register service worker
    console.log('Step 1: Registering service worker...');
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service worker registered');
    console.log('Scope:', registration.scope);
    
    // Step 2: Wait for service worker to be ready
    console.log('\nStep 2: Waiting for service worker to be ready...');
    await navigator.serviceWorker.ready;
    console.log('✅ Service worker is ready');
    
    // Step 3: Check if subscription already exists
    console.log('\nStep 3: Checking for existing subscription...');
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log('⚠️ Subscription already exists');
      console.log('Endpoint:', subscription.endpoint);
      alert('⚠️ Subscription already exists!');
      return;
    }
    
    // Step 4: Create subscription with NEW VAPID key
    console.log('\nStep 4: Creating subscription with NEW VAPID key...');
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
    
    const vapidKeyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyArray
    });
    
    console.log('\n✅✅✅ SUBSCRIPTION CREATED! ✅✅✅');
    console.log('Endpoint:', subscription.endpoint);
    alert('✅✅✅ SUBSCRIPTION CREATED! Now run the SAVE script to save it to the database!');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    console.error('Error details:', error.message);
    alert('❌ Error: ' + error.message);
  }
})();

