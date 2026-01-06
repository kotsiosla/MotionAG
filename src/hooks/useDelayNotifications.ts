import { useEffect, useRef, useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import type { Trip, RouteInfo } from '@/types/gtfs';

interface DelayNotification {
  routeId: string;
  routeName: string;
  delayMinutes: number;
  timestamp: number;
}

// Track which delays we've already notified about
const notifiedDelays = new Map<string, number>();

// Minimum delay in minutes to trigger notification
const MIN_DELAY_MINUTES = 5;

// How often to re-notify about the same delay (30 minutes)
const RE_NOTIFY_INTERVAL_MS = 30 * 60 * 1000;

export function useDelayNotifications(
  trips: Trip[],
  routeNamesMap: Map<string, RouteInfo> | undefined,
  enabled: boolean = true
) {
  const permissionAsked = useRef(false);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied' && !permissionAsked.current) {
      permissionAsked.current = true;
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // Send browser notification with fallback
  const sendBrowserNotification = useCallback((delay: DelayNotification) => {
    // Try Service Worker notification first (works better on mobile)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification('🚌 Καθυστέρηση Λεωφορείου', {
          body: `${delay.routeName}: +${delay.delayMinutes} λεπτά καθυστέρηση`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `delay-${delay.routeId}`,
          requireInteraction: false,
        } as NotificationOptions);
      }).catch(() => {
        // Fallback to regular notification
        if (Notification.permission === 'granted') {
          new Notification('🚌 Καθυστέρηση Λεωφορείου', {
            body: `${delay.routeName}: +${delay.delayMinutes} λεπτά καθυστέρηση`,
            icon: '/pwa-192x192.png',
            tag: `delay-${delay.routeId}`,
          });
        }
      });
    } else if (Notification.permission === 'granted') {
      const notification = new Notification('🚌 Καθυστέρηση Λεωφορείου', {
        body: `${delay.routeName}: +${delay.delayMinutes} λεπτά καθυστέρηση`,
        icon: '/pwa-192x192.png',
        tag: `delay-${delay.routeId}`,
        requireInteraction: false,
      });
      setTimeout(() => notification.close(), 10000);
    }
  }, []);

  // Send toast notification
  const sendToastNotification = useCallback((delay: DelayNotification) => {
    toast({
      title: '🚌 Καθυστέρηση Λεωφορείου',
      description: `${delay.routeName}: +${delay.delayMinutes} λεπτά καθυστέρηση`,
      variant: 'destructive',
    });
  }, []);

  // Process trips and check for delays
  useEffect(() => {
    if (!enabled || !trips.length) return;

    const newDelays: DelayNotification[] = [];
    const now = Date.now();

    trips.forEach(trip => {
      if (!trip.stopTimeUpdates?.length) return;

      // Find the maximum delay for this trip
      let maxDelay = 0;
      trip.stopTimeUpdates.forEach(stu => {
        const delay = stu.arrivalDelay || stu.departureDelay || 0;
        const delayMinutes = Math.round(delay / 60);
        if (delayMinutes > maxDelay) {
          maxDelay = delayMinutes;
        }
      });

      if (maxDelay >= MIN_DELAY_MINUTES) {
        const routeId = trip.routeId || '';
        const lastNotified = notifiedDelays.get(routeId);
        
        // Only notify if we haven't notified recently about this route
        if (!lastNotified || (now - lastNotified) > RE_NOTIFY_INTERVAL_MS) {
          const routeInfo = routeNamesMap?.get(routeId);
          newDelays.push({
            routeId,
            routeName: routeInfo 
              ? `${routeInfo.route_short_name} - ${routeInfo.route_long_name}`
              : routeId || 'Άγνωστη γραμμή',
            delayMinutes: maxDelay,
            timestamp: now,
          });
          notifiedDelays.set(routeId, now);
        }
      }
    });

    // Send notifications for new delays
    if (newDelays.length > 0) {
      // Request permission first time
      requestPermission().then(granted => {
        newDelays.forEach(delay => {
          if (granted && document.hidden) {
            // Send browser notification if app is in background
            sendBrowserNotification(delay);
          } else {
            // Send toast if app is visible
            sendToastNotification(delay);
          }
        });
      });
    }
  }, [trips, routeNamesMap, enabled, requestPermission, sendBrowserNotification, sendToastNotification]);

  // Clean up old entries periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      notifiedDelays.forEach((timestamp, routeId) => {
        if (now - timestamp > RE_NOTIFY_INTERVAL_MS * 2) {
          notifiedDelays.delete(routeId);
        }
      });
    }, 60000); // Every minute

    return () => clearInterval(cleanup);
  }, []);

  return { requestPermission };
}
