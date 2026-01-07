// Run this in the browser console (F12 -> Console tab) to diagnose subscription issues

console.log('=== PUSH NOTIFICATION DIAGNOSTIC ===\n');

// 1. Check Service Worker
console.log('1. Checking Service Worker...');
navigator.serviceWorker.getRegistrations().then(registrations => {
  if (registrations.length === 0) {
    console.error('❌ No service worker registered!');
    console.log('   → The app needs to register a service worker first');
  } else {
    console.log(`✅ Service worker registered: ${registrations.length}`);
    registrations.forEach((reg, i) => {
      console.log(`   Worker ${i + 1}: ${reg.scope}`);
    });
  }
  
  // 2. Check Push Subscription
  console.log('\n2. Checking Push Subscription...');
  return navigator.serviceWorker.ready;
}).then(registration => {
  return registration.pushManager.getSubscription();
}).then(subscription => {
  if (!subscription) {
    console.error('❌ No push subscription found!');
    console.log('   → You need to enable notifications for a stop');
    console.log('   → Click the bell icon on a stop and click "Enable"');
  } else {
    console.log('✅ Push subscription exists!');
    console.log(`   Endpoint: ${subscription.endpoint.substring(0, 50)}...`);
    
    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');
    if (p256dh && auth) {
      console.log('✅ Subscription keys are present');
    } else {
      console.error('❌ Subscription keys are missing!');
    }
  }
  
  // 3. Check Notification Permission
  console.log('\n3. Checking Notification Permission...');
  if ('Notification' in window) {
    const permission = Notification.permission;
    console.log(`   Permission: ${permission}`);
    if (permission === 'granted') {
      console.log('✅ Notifications are allowed');
    } else if (permission === 'denied') {
      console.error('❌ Notifications are blocked!');
      console.log('   → Go to browser settings and allow notifications');
    } else {
      console.warn('⚠️ Permission not yet requested');
    }
  } else {
    console.error('❌ Browser does not support notifications');
  }
  
  // 4. Check VAPID Key
  console.log('\n4. Checking VAPID Key Configuration...');
  const expectedKey = 'BOKt_6W50S5Al74CyqJZ2pbXvDCCp966T5Ha8pDUrdBJjTxwAx6LSoxO1OeeS0kGRh0PJxK23upgWCDwNY9R2co';
  console.log(`   Expected key: ${expectedKey.substring(0, 20)}...`);
  console.log('   (Check if this matches the key in the code)');
  
  // 5. Check for Errors
  console.log('\n5. Checking for Recent Errors...');
  console.log('   Look above for any red error messages');
  console.log('   Common errors:');
  console.log('   - "Permission denied" → Allow notifications');
  console.log('   - "Service worker not registered" → Reload page');
  console.log('   - "Failed to save" → Check Supabase connection');
  
  console.log('\n=== DIAGNOSTIC COMPLETE ===');
  console.log('\nIf subscription exists but not in database:');
  console.log('1. Check browser console for "Database save result"');
  console.log('2. Look for any error messages');
  console.log('3. Check Network tab for failed requests to Supabase');
});

