// Run this in the browser console to check if subscription exists
(async () => {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('✅ Subscription exists!');
      console.log('Endpoint:', subscription.endpoint);
      console.log('Keys:', {
        p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')))),
        auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth'))))
      });
    } else {
      console.log('❌ No subscription found');
      console.log('Try enabling notifications again');
    }
  } catch (error) {
    console.error('Error:', error);
  }
})();

