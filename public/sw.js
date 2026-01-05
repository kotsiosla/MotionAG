// Service Worker for Push Notifications

self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let data = {
    title: 'Motion Bus Cyprus',
    body: 'Νέα ειδοποίηση',
    icon: '/pwa-192x192.png',
    url: '/',
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
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url,
    },
    actions: [
      { action: 'open', title: 'Άνοιγμα' },
      { action: 'close', title: 'Κλείσιμο' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

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
    // Allow relative paths starting with /
    if (urlToOpen.startsWith('/') && !urlToOpen.startsWith('//')) {
      validatedUrl = urlToOpen;
    } else {
      // Parse absolute URLs and verify they match our origin
      const parsed = new URL(urlToOpen, self.location.origin);
      if (parsed.origin === self.location.origin) {
        validatedUrl = urlToOpen;
      } else {
        console.warn('External URL rejected in notification:', urlToOpen);
        // Default to home for external URLs (prevents phishing)
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

self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('Push subscription changed:', event);
  // Re-subscribe logic would go here
});
