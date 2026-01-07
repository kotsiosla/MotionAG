// Service Worker for Push Notifications and Offline Support
// This file is processed by VitePWA injectManifest strategy
// The __WB_MANIFEST array is injected by VitePWA during build

// Precache assets (injected by VitePWA during build)
const precacheManifest = self.__WB_MANIFEST || [];
const precacheCacheName = 'motion-bus-precache-v1';

// Install event - precache assets
self.addEventListener('install', (event) => {
  console.log('Service Worker installing, precaching', precacheManifest.length, 'assets');
  
  // Skip waiting immediately to avoid refresh loops
  self.skipWaiting();
  
  // Try to precache, but don't block installation if it fails
  event.waitUntil(
    caches.open(precacheCacheName).then((cache) => {
      // Filter and map manifest entries to valid URLs
      const urlsToCache = precacheManifest
        .map((entry) => {
          if (typeof entry === 'string') return entry;
          return entry.url;
        })
        .filter((url) => {
          // Only cache same-origin URLs or valid absolute URLs
          try {
            const urlObj = new URL(url, self.location.origin);
            return urlObj.origin === self.location.origin || url.startsWith('http');
          } catch {
            return false;
          }
        })
        .slice(0, 20); // Limit to first 20 to avoid issues
      
      console.log('Caching', urlsToCache.length, 'assets');
      if (urlsToCache.length === 0) {
        return Promise.resolve();
      }
      
      return Promise.allSettled(
        urlsToCache.map((url) => 
          cache.add(url).catch((err) => {
            console.warn('Failed to cache:', url, err);
            return null;
          })
        )
      ).then(() => {
        console.log('Precaching completed');
      });
    }).catch((err) => {
      console.error('Error opening cache:', err);
      // Don't fail installation if caching fails
      return Promise.resolve();
    })
  );
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

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip cross-origin requests except for tiles and fonts
  const url = new URL(event.request.url);
  const isMapTile = url.hostname.includes('tile') || url.hostname.includes('openstreetmap');
  const isFont = url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic');
  
  if (url.origin !== self.location.origin && !isMapTile && !isFont) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response and update cache in background
        event.waitUntil(
          fetch(event.request).then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, response);
              });
            }
          }).catch(() => {})
        );
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Cache successful responses
        if (response.ok && (isMapTile || isFont || url.origin === self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      }).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
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
