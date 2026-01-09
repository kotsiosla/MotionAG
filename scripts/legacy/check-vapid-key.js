// Run this in the browser console to check which VAPID key is being used
console.log('=== CHECKING VAPID KEY ===\n');

// Check the source code for VAPID key
const scripts = Array.from(document.querySelectorAll('script'));
let foundKey = null;
let keyLocation = null;

// Expected new key
const EXPECTED_NEW_KEY = 'BANXTqf4fsrCfS_g0072vs4QupJYZpxOLcOjHfUtcQVufSBkX8fAkv54bIHCU4fdf4BLIKz00Q2x6o1QiFB5vtU';
const OLD_KEY = 'BM5pROt5d4ceUeGjvlpk4SmlEEBbe4lKQ0B2xVcyjU1VbObEex87ohRSlOCxMQJEF6zJYonkbLOIrH0k04xNEAc';

// Try to find VAPID key in page source
fetch(window.location.href)
  .then(r => r.text())
  .then(html => {
    if (html.includes(EXPECTED_NEW_KEY)) {
      console.log('✅ NEW VAPID key found in page source!');
      console.log('   Key: ' + EXPECTED_NEW_KEY.substring(0, 50) + '...');
      foundKey = EXPECTED_NEW_KEY;
      keyLocation = 'page source';
    } else if (html.includes(OLD_KEY)) {
      console.log('❌ OLD VAPID key found in page source!');
      console.log('   The frontend is not deployed with the new key yet.');
      foundKey = OLD_KEY;
      keyLocation = 'page source (OLD)';
    } else {
      console.log('⚠️ Could not find VAPID key in page source');
      console.log('   (It might be in a bundled JavaScript file)');
    }
    
    // Check service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log(`\nService Workers: ${registrations.length} registered`);
        if (registrations.length > 0) {
          console.log('⚠️ Service worker is registered - it might be using cached old code');
          console.log('   Run the unregister script to clear it');
        }
      });
    }
    
    // Check current subscription
    navigator.serviceWorker.ready.then(registration => {
      return registration.pushManager.getSubscription();
    }).then(subscription => {
      if (subscription) {
        console.log('\n✅ Push subscription exists');
        console.log('   Endpoint: ' + subscription.endpoint.substring(0, 50) + '...');
        console.log('\n⚠️ If this subscription was created with the OLD key, it will fail.');
        console.log('   Delete it and create a new one after unregistering the service worker.');
      } else {
        console.log('\nℹ️ No push subscription found');
        console.log('   Enable notifications for a stop to create one');
      }
    }).catch(err => {
      console.log('\nℹ️ Could not check subscription:', err.message);
    });
    
    console.log('\n=== SUMMARY ===');
    if (foundKey === EXPECTED_NEW_KEY) {
      console.log('✅ Frontend has NEW VAPID key');
      console.log('   You can proceed to enable notifications');
    } else if (foundKey === OLD_KEY) {
      console.log('❌ Frontend still has OLD VAPID key');
      console.log('   Wait for GitHub Pages deployment to complete');
    } else {
      console.log('⚠️ Could not verify VAPID key');
      console.log('   Check GitHub Actions deployment status');
    }
  })
  .catch(err => {
    console.error('Error checking page:', err);
  });

