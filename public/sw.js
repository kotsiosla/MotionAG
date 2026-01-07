// Service Worker for Push Notifications and Offline Support
// This file is processed by VitePWA injectManifest strategy
// The __WB_MANIFEST array is injected by VitePWA during build

// Precache assets (injected by VitePWA during build)
const precacheManifest = self.__WB_MANIFEST || [];
const precacheCacheName = 'motion-bus-precache-v1';

// Install event - skip precaching to avoid refresh loops
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  
  // Skip waiting immediately to avoid refresh loops
  self.skipWaiting();
  
  // Don't precache - let workbox handle it or cache on demand
  event.waitUntil(Promise.resolve());
});

const CACHE_NAME = 'motion-bus-v1';
const OFFLINE_URL = '/';


// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  // Claim clients immediately
  self.clients.claim();
  
  // Clean up old caches, but don't block activation
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      console.log('Existing caches:', cacheNames);
      const deletePromises = cacheNames
        .filter((name) => name !== CACHE_NAME && name !== precacheCacheName)
        .map((name) => {
          console.log('Deleting old cache:', name);
          return caches.delete(name).catch((err) => {
            console.warn('Failed to delete cache:', name, err);
            return null;
          });
        });
      
      return Promise.allSettled(deletePromises).then(() => {
        console.log('Cache cleanup completed');
      });
    }).catch((err) => {
      console.error('Error during cache cleanup:', err);
      // Don't fail activation if cleanup fails
      return Promise.resolve();
    })
  );
});

// Fetch event - minimal caching to avoid issues
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests except for tiles and fonts
  const url = new URL(event.request.url);
  const isMapTile = url.hostname.includes('tile') || url.hostname.includes('openstreetmap');
  const isFont = url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic');
  
  // Only handle same-origin requests for now to avoid issues
  if (url.origin !== self.location.origin && !isMapTile && !isFont) {
    return;
  }

  // Simple network-first strategy
  event.respondWith(
    fetch(event.request).catch(() => {
      // Only use cache as fallback
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Return offline response for navigation
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL) || new Response('Offline', { status: 503 });
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
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
      data = { ...data, ...event.data.json() };
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
  
  // Validate URL to prevent open redirect attacks
  let validatedUrl = '/';
  try {
    if (urlToOpen.startsWith('/') && !urlToOpen.startsWith('//')) {
      validatedUrl = urlToOpen;
    } else {
      const parsed = new URL(urlToOpen, self.location.origin);
      if (parsed.origin === self.location.origin) {
        validatedUrl = urlToOpen;
      } else {
        console.warn('External URL rejected in notification:', urlToOpen);
        validatedUrl = '/';
      }
    }
  } catch (e) {
    console.error('Invalid URL in notification:', urlToOpen, e);
    validatedUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to focus an existing window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(validatedUrl);
          return client.focus();
        }
      }
      // Open a new window if none exists
      if (clients.openWindow) {
        return clients.openWindow(validatedUrl);
      }
    })
  );
});

// Handle push subscription changes
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed:', event);
  // Re-subscribe logic could go here
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('Background sync:', event.tag);
  
  if (event.tag === 'sync-saved-trips') {
    event.waitUntil(syncSavedTrips());
  }
});

async function syncSavedTrips() {
  // Sync saved trips when back online
  console.log('Syncing saved trips...');
  // Implementation would go here
}

// Periodic background sync for notifications
self.addEventListener('periodicsync', (event) => {
  console.log('Periodic sync:', event.tag);
  
  if (event.tag === 'check-arrivals') {
    event.waitUntil(checkUpcomingArrivals());
  }
});

async function checkUpcomingArrivals() {
  // Check for upcoming arrivals and notify
  console.log('Checking upcoming arrivals...');
  // Implementation would fetch saved trips and check times
}
