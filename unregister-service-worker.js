// Run this in the browser console to unregister all service workers
(async () => {
  console.log('=== UNREGISTERING SERVICE WORKERS ===\n');
  
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      
      if (registrations.length === 0) {
        console.log('✅ No service workers found');
        return;
      }
      
      console.log(`Found ${registrations.length} service worker(s):`);
      
      for (let i = 0; i < registrations.length; i++) {
        const registration = registrations[i];
        console.log(`\n${i + 1}. Unregistering service worker...`);
        console.log(`   Scope: ${registration.scope}`);
        
        const unregistered = await registration.unregister();
        
        if (unregistered) {
          console.log(`   ✅ Successfully unregistered!`);
        } else {
          console.log(`   ⚠️ Failed to unregister`);
        }
      }
      
      console.log('\n✅ All service workers unregistered!');
      console.log('\nNext steps:');
      console.log('1. Hard refresh the page: Ctrl+Shift+R');
      console.log('2. Enable notifications for a stop');
      console.log('3. Run the save-subscription script');
      alert('✅ Service workers unregistered! Now hard refresh (Ctrl+Shift+R) and enable notifications again.');
    } else {
      console.log('❌ Service workers not supported in this browser');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert(`❌ Error: ${error.message}`);
  }
})();

