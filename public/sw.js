// Service Worker for Push Notifications
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
  console.log('Push event received:', event);
  
  let data = {
    title: 'Motion Bus Cyprus',
    body: 'Νέα ειδοποίηση',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    url: '/',
    tag: 'motion-bus-notification',
  };

  if (event.data) {
    try {
      const jsonData = event.data.json();
      data = { ...data, ...jsonData };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge || '/pwa-192x192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag,
    renotify: true,
    requireInteraction: true,
    data: {
      url: data.url,
      timestamp: Date.now(),
    },
    actions: [
      { action: 'open', title: '🚌 Άνοιγμα', icon: '/pwa-192x192.png' },
      { action: 'close', title: '✕ Κλείσιμο' },
    ],
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
