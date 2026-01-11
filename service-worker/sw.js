// Service Worker for Push Notifications (v1.4.0 - Robust)
// Simple service worker without precaching to avoid refresh loops
// This file is processed by VitePWA injectManifest strategy

// Precache manifest (injected by VitePWA during build)
const precacheManifest = self.__WB_MANIFEST || [];

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker installing v1.4.0');
  // Force new SW to enter waiting state immediately
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating v1.4.0');
  // Force new SW to take control of open pages immediately
  event.waitUntil(self.clients.claim());
});

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
      // Try text if JSON fails
      try {
        data.body = event.data.text();
      } catch (e2) { }
    }
  }

  // Use full URL if possible for better reliability
  const icon = data.icon || '/MotionAG/pwa-192x192.png';

  const options = {
    body: data.body,
    icon: icon,
    badge: '/MotionAG/pwa-192x192.png', // Small icon for notification bar
    tag: data.tag || 'motion-bus-notification',
    renotify: true, // Allow new notifications with same tag to vibrate
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
