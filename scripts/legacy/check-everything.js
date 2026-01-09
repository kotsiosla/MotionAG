// COMPREHENSIVE DIAGNOSTIC SCRIPT
// Run this in the browser console to check everything

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  COMPREHENSIVE PUSH NOTIFICATION DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // 1. Check browser support
  console.log('1. BROWSER SUPPORT:');
  const hasServiceWorker = 'serviceWorker' in navigator;
  const hasPushManager = 'PushManager' in window;
  const hasNotification = 'Notification' in window;
  
  console.log(`   Service Worker: ${hasServiceWorker ? '✅ Supported' : '❌ Not supported'}`);
  console.log(`   Push Manager: ${hasPushManager ? '✅ Supported' : '❌ Not supported'}`);
  console.log(`   Notifications: ${hasNotification ? '✅ Supported' : '❌ Not supported'}`);
  console.log('');
  
  if (!hasServiceWorker || !hasPushManager) {
    console.log('❌ Your browser does not support push notifications');
    return;
  }
  
  // 2. Check notification permission
  console.log('2. NOTIFICATION PERMISSION:');
  const permission = Notification.permission;
  console.log(`   Status: ${permission}`);
  if (permission === 'granted') {
    console.log('   ✅ Notifications are allowed');
  } else if (permission === 'denied') {
    console.log('   ❌ Notifications are blocked');
    console.log('   → Go to browser settings and allow notifications');
  } else {
    console.log('   ⚠️ Permission not yet requested');
    console.log('   → Enable notifications for a stop to request permission');
  }
  console.log('');
  
  // 3. Check service worker
  console.log('3. SERVICE WORKER:');
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log(`   Registered: ${registrations.length} service worker(s)`);
    
    if (registrations.length === 0) {
      console.log('   ⚠️ No service worker registered');
      console.log('   → The website needs to register a service worker first');
    } else {
      for (let i = 0; i < registrations.length; i++) {
        const reg = registrations[i];
        console.log(`   Service Worker ${i + 1}:`);
        console.log(`     Scope: ${reg.scope}`);
        console.log(`     Active: ${reg.active ? 'Yes' : 'No'}`);
      }
    }
    
    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;
    console.log('   ✅ Service worker is ready');
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');
  
  // 4. Check push subscription
  console.log('4. PUSH SUBSCRIPTION:');
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('   ❌ NO SUBSCRIPTION FOUND');
      console.log('');
      console.log('   TO CREATE A SUBSCRIPTION:');
      console.log('   1. Click on a bus stop on the map');
      console.log('   2. Look for a bell/notification icon');
      console.log('   3. Click it to enable notifications');
      console.log('   4. Allow notifications when browser asks');
      console.log('   5. Run this script again to check');
    } else {
      console.log('   ✅ SUBSCRIPTION EXISTS!');
      console.log(`   Endpoint: ${subscription.endpoint.substring(0, 60)}...`);
      
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      if (p256dhKey && authKey) {
        console.log('   ✅ Subscription has keys (p256dh and auth)');
        
        // Check which VAPID key was used (we can't directly check, but we can verify the subscription is valid)
        console.log('   ✅ Subscription appears valid');
      } else {
        console.log('   ❌ Subscription missing keys');
      }
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');
  
  // 5. Check localStorage for stop notifications
  console.log('5. STOP NOTIFICATIONS (localStorage):');
  try {
    const stored = localStorage.getItem('stop_notifications');
    if (stored) {
      const stopNotifications = JSON.parse(stored);
      const enabled = stopNotifications.filter(n => n.enabled);
      console.log(`   Found ${stopNotifications.length} stop notification(s)`);
      console.log(`   ${enabled.length} enabled`);
      
      if (enabled.length > 0) {
        console.log('   ✅ You have enabled notifications for stops');
      } else {
        console.log('   ⚠️ No stop notifications enabled');
      }
    } else {
      console.log('   ⚠️ No stop notifications in localStorage');
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  console.log('');
  
  // 6. Check VAPID key in frontend (try to find it)
  console.log('6. VAPID KEY CHECK:');
  const newKey = 'BANXTqf4fsrCfS_g0072vs4QupJYZpxOLcOjHfUtcQVufSBkX8fAkv54bIHCU4fdf4BLIKz00Q2x6o1QiFB5vtU';
  const oldKey = 'BM5pROt5d4ceUeGjvlpk4SmlEEBbe4lKQ0B2xVcyjU1VbObEex87ohRSlOCxMQJEF6zJYonkbLOIrH0k04xNEAc';
  
  try {
    const pageText = document.documentElement.outerHTML;
    if (pageText.includes(newKey)) {
      console.log('   ✅ NEW VAPID key found in page');
    } else if (pageText.includes(oldKey)) {
      console.log('   ❌ OLD VAPID key found in page');
    } else {
      console.log('   ⚠️ VAPID key not found in HTML (might be in JavaScript bundle)');
      console.log('   → Check JavaScript files for the key');
    }
  } catch (error) {
    console.log(`   ⚠️ Could not check: ${error.message}`);
  }
  console.log('');
  
  // 7. Summary and next steps
  console.log('═══════════════════════════════════════════════════════');
  console.log('  SUMMARY & NEXT STEPS');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      console.log('❌ NO SUBSCRIPTION - You need to:');
      console.log('   1. Click on a bus stop');
      console.log('   2. Enable notifications for that stop');
      console.log('   3. Allow notifications when prompted');
      console.log('   4. Run this script again');
    } else {
      console.log('✅ SUBSCRIPTION EXISTS!');
      console.log('');
      console.log('Next step: Save it to the database');
      console.log('Run the SAVE script to save it to Supabase');
      console.log('');
      console.log('After saving, run: .\\test-push-simple.ps1');
    }
  } catch (error) {
    console.log(`Error getting subscription: ${error.message}`);
  }
  
  console.log('');
})();

