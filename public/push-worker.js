// Custom Push Notification Worker (v1.4.1 - Robust)
// Included via importScripts in the main service worker

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Push event received');

  let data = {
    title: 'Motion Bus Cyprus',
    body: 'Νέα ειδοποίηση',
    icon: '/MotionAG/pwa-192x192.png'
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

  // iOS Robustness: Minimal options to prevent crashes
  // We strip icon/badge for now to rule out 404/format errors causing failures
  const options = {
    body: data.body,
    tag: data.tag || 'motion-bus-default', // Tag is safe and useful for grouping
    renotify: true, // Required if tag is used
    data: {
      url: data.url || '/MotionAG/',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .catch(err => {
        console.error('ShowNotification failed:', err);
        // Last ditch attempt with ZERO options
        return self.registration.showNotification(data.title, { body: data.body });
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

  // Validate URL
  let validatedUrl = '/MotionAG/';
  try {
    if (urlToOpen.startsWith('/') && !urlToOpen.startsWith('//')) {
      validatedUrl = urlToOpen;
    } else {
      const parsed = new URL(urlToOpen, self.location.origin);
      if (parsed.origin === self.location.origin) {
        validatedUrl = urlToOpen;
      }
    }
  } catch (e) {
    console.error('Invalid URL in notification:', urlToOpen, e);
  }

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
