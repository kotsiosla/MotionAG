# Fix Stop Notifications - Save from localStorage to server
$SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw"

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  FIX STOP NOTIFICATIONS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will help you save stop notifications from" -ForegroundColor White
Write-Host "localStorage to the server." -ForegroundColor White
Write-Host ""
Write-Host "STEPS:" -ForegroundColor Green
Write-Host "1. Open your browser (Chrome/Firefox/Edge)" -ForegroundColor White
Write-Host "2. Go to: https://chargecyprus.github.io/motionbus/" -ForegroundColor White
Write-Host "3. Press F12 to open DevTools" -ForegroundColor White
Write-Host "4. Go to Console tab" -ForegroundColor White
Write-Host "5. Copy and paste this script:" -ForegroundColor White
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  BROWSER CONSOLE SCRIPT" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$script = @"
(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  FIX STOP NOTIFICATIONS');
  console.log('═══════════════════════════════════════════════════════');
  console.log('');
  
  // 1. Check service worker and subscription
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) {
    console.error('❌ No service worker found');
    return;
  }
  
  const registration = registrations[0];
  const subscription = await registration.pushManager.getSubscription();
  
  if (!subscription) {
    console.error('❌ No push subscription found');
    console.log('→ Enable notifications for a bus stop first');
    return;
  }
  
  console.log('✅ Push subscription found');
  console.log('Endpoint:', subscription.endpoint.substring(0, 60) + '...');
  console.log('');
  
  // 2. Get stop notifications from localStorage
  const stored = localStorage.getItem('stop_notifications');
  if (!stored) {
    console.error('❌ No stop notifications in localStorage');
    console.log('→ Enable notifications for a bus stop first');
    return;
  }
  
  const allNotifications = JSON.parse(stored);
  console.log('Found', allNotifications.length, 'stop notification(s) in localStorage');
  
  // 3. Filter enabled + push notifications
  const pushNotifications = allNotifications.filter(n => n.enabled && n.push);
  console.log('Enabled + push notifications:', pushNotifications.length);
  
  if (pushNotifications.length === 0) {
    console.error('❌ No enabled push notifications found');
    console.log('→ Enable notifications for a bus stop with push enabled');
    return;
  }
  
  pushNotifications.forEach(n => {
    console.log(`  - ${n.stopName} (${n.stopId}), Before: ${n.beforeMinutes} min`);
  });
  console.log('');
  
  // 4. Extract keys
  const p256dhKey = subscription.getKey('p256dh');
  const authKey = subscription.getKey('auth');
  if (!p256dhKey || !authKey) {
    console.error('❌ Failed to get subscription keys');
    return;
  }
  
  const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
  const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));
  
  // 5. Save to server
  const SUPABASE_URL = 'https://jftthfniwfarxyisszjh.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw';
  
  console.log('Saving to server...');
  const response = await fetch(\`\${SUPABASE_URL}/rest/v1/stop_notification_subscriptions\`, {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${ANON_KEY}\`,
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
    alert('✅ Stop notifications saved to server!');
  } else {
    // Try upsert if POST fails (endpoint already exists)
    const upsertResponse = await fetch(\`\${SUPABASE_URL}/rest/v1/stop_notification_subscriptions?endpoint=eq.\${encodeURIComponent(subscription.endpoint)}\`, {
      method: 'PATCH',
      headers: {
        'Authorization': \`Bearer \${ANON_KEY}\`,
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
      alert('✅ Stop notifications updated on server!');
    } else {
      const error = await upsertResponse.text();
      console.error('❌ ERROR:', response.status, error);
      alert('❌ Error: ' + response.status);
    }
  }
})();
"@

Write-Host $script -ForegroundColor Cyan
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "After running the script in the browser console:" -ForegroundColor Green
Write-Host "1. You should see '✅ SUCCESS!' message" -ForegroundColor White
Write-Host "2. Run: .\check-cron-status.ps1" -ForegroundColor White
Write-Host "3. Check if enabled stop notifications are found" -ForegroundColor White
Write-Host ""


