// Manual subscription creation with NEW VAPID key
// Run this in browser console

(async () => {
  console.log('=== MANUALLY CREATING SUBSCRIPTION ===\n');
  
  try {
    // Convert base64url VAPID key to Uint8Array
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
    
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ Service worker ready');
    
    // Check if subscription already exists
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      console.log('⚠️ Subscription already exists');
      console.log('Endpoint:', subscription.endpoint);
      alert('⚠️ Subscription already exists!');
      return;
    }
    
    console.log('Creating subscription with NEW VAPID key...');
    const vapidKeyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyArray
    });
    
    console.log('✅✅✅ SUBSCRIPTION CREATED! ✅✅✅');
    console.log('Endpoint:', subscription.endpoint);
    alert('✅✅✅ SUBSCRIPTION CREATED! Now run the SAVE script to save it to the database!');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    alert('❌ Error: ' + error.message);
  }
})();

