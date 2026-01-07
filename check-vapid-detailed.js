// Detailed VAPID key check - paste this in browser console
(async () => {
  console.log('=== CHECKING VAPID KEY ===\n');
  
  const EXPECTED_NEW_KEY = 'BANXTqf4fsrCfS_g0072vs4QupJYZpxOLcOjHfUtcQVufSBkX8fAkv54bIHCU4fdf4BLIKz00Q2x6o1QiFB5vtU';
  const OLD_KEY = 'BM5pROt5d4ceUeGjvlpk4SmlEEBbe4lKQ0B2xVcyjU1VbObEex87ohRSlOCxMQJEF6zJYonkbLOIrH0k04xNEAc';
  
  try {
    // Check page source
    const response = await fetch(window.location.href);
    const html = await response.text();
    
    let keyFound = false;
    
    if (html.includes(EXPECTED_NEW_KEY)) {
      console.log('✅ NEW VAPID key found in page source!');
      console.log('   Key: ' + EXPECTED_NEW_KEY.substring(0, 50) + '...');
      keyFound = true;
    } else if (html.includes(OLD_KEY)) {
      console.log('❌ OLD VAPID key found in page source!');
      console.log('   The frontend is NOT deployed with the new key yet.');
      console.log('   Wait for GitHub Pages deployment to complete.');
      keyFound = true;
    } else {
      console.log('⚠️ VAPID key not found in HTML');
      console.log('   (It might be in a bundled JavaScript file)');
      console.log('   Checking service worker...');
    }
    
    // Check service workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      console.log(`\nService Workers: ${registrations.length} registered`);
      
      if (registrations.length > 0) {
        console.log('⚠️ Service worker is registered - it might be using cached old code');
        for (let reg of registrations) {
          console.log(`   Scope: ${reg.scope}`);
        }
        console.log('   → Run the unregister script to clear it');
      } else {
        console.log('✅ No service workers registered');
      }
    }
    
    // Check current subscription
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        console.log('\n✅ Push subscription exists');
        console.log('   Endpoint: ' + subscription.endpoint.substring(0, 60) + '...');
        console.log('⚠️ If this was created with OLD key, it will fail.');
        console.log('   → Unregister service worker, hard refresh, then create new subscription');
      } else {
        console.log('\nℹ️ No push subscription found');
        console.log('   → Enable notifications for a stop to create one');
      }
    } catch (err) {
      console.log('\nℹ️ Could not check subscription (service worker not ready)');
    }
    
    // Summary
    console.log('\n=== SUMMARY ===');
    if (html.includes(EXPECTED_NEW_KEY)) {
      console.log('✅ Frontend has NEW VAPID key');
      console.log('   → Unregister service worker');
      console.log('   → Hard refresh (Ctrl+Shift+R)');
      console.log('   → Enable notifications');
      console.log('   → Save subscription');
    } else if (html.includes(OLD_KEY)) {
      console.log('❌ Frontend still has OLD VAPID key');
      console.log('   → Check GitHub Actions: https://github.com/kotsiosla/MotionBus_AI/actions');
      console.log('   → Wait for deployment to complete');
    } else {
      console.log('⚠️ Could not verify VAPID key in HTML');
      console.log('   → Check if deployment is complete');
      console.log('   → Try unregistering service worker and hard refresh');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
})();

