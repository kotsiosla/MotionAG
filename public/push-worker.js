// Custom Push Notification Worker (v1.5.0 - Absolute Paths & Fallback)
// Included via importScripts in the main service worker

// ABSOLUTE PATH to icons is critical for iOS robustness
const BASE_URL = 'https://kotsiosla.github.io/MotionAG';
const DEFAULT_ICON = `${BASE_URL}/pwa-192x192.png`;

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Push event received');

  let data = {
    title: 'Motion Bus Cyprus',
    body: 'Νέα ειδοποίηση',
    icon: DEFAULT_ICON
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
      console.log('Push data parsed:', data);
    } catch (e) {
      console.error('Error parsing push data:', e);
      try {
        data.body = event.data.text();
      } catch (e2) { }
    }
  }

  // Ensure icon is absolute if it's relative
  let iconUrl = data.icon || DEFAULT_ICON;
  if (iconUrl.startsWith('/')) {
    iconUrl = BASE_URL + iconUrl.replace('/MotionAG', '');
  }

  const options = {
    body: data.body,
    icon: iconUrl,
    badge: iconUrl,
    tag: data.tag || 'motion-bus-default',
    renotify: true,
    data: {
      url: data.url || '/MotionAG/',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .catch(err => {
        console.error('ShowNotification failed (likely icon error):', err);
        // Fallback 1: Try default absolute icon
        return self.registration.showNotification(data.title, {
          body: data.body,
          icon: DEFAULT_ICON
        }).catch(err2 => {
          console.error('Fallback 1 failed, trying text-only:', err2);
          // Fallback 2: Text ONLY (No icon) - final resort
          return self.registration.showNotification(data.title, {
            body: data.body
          });
        });
      })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/MotionAG/';

  // Validate URL logic...
  let validatedUrl = '/MotionAG/';
  try {
    if (urlToOpen.startsWith('http')) {
      validatedUrl = urlToOpen;
    } else {
      validatedUrl = urlToOpen;
    }
  } catch (e) { }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(validatedUrl);
      }
    })
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed:', event);
});
