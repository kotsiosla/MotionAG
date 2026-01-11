// Service Worker for Push Notifications (v1.3.8 - Debug)
// Simple service worker without precaching to avoid refresh loops
// This file is processed by VitePWA injectManifest strategy

// Precache manifest (injected by VitePWA during build)
const precacheManifest = self.__WB_MANIFEST || [];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing, manifest entries:', precacheManifest.length);
  // DON'T skip waiting - let it activate naturally to avoid refresh loops
  event.waitUntil(Promise.resolve());
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  // DON'T claim clients - this causes refresh loops
  // Just resolve immediately
  event.waitUntil(Promise.resolve());
});

// Push notification handler
self.addEventListener('push', (event) => {
  console.log('Push event received');

  let data = {
    title: 'Motion Bus Cyprus',
    body: 'Νέα ειδοποίηση',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  // iOS-compatible options only
  const options = {
    body: data.body,
    icon: '/MotionAG/pwa-192x192.png', // Fixed absolute path
    tag: data.tag || 'motion-bus-notification',
    data: {
      url: data.url || '/MotionAG/',
      timestamp: Date.now(),
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  // Validate URL
  let validatedUrl = '/';
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
      // Find existing client and focus it (don't navigate - causes refresh)
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Only open new window if no existing client
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
