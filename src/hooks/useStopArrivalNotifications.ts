import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';

import type { Trip, RouteInfo } from '@/types/gtfs';
import type { StopNotificationSettings } from './useStopNotifications';
import { speak, playSound, vibrate } from '@/lib/audio-engine';

interface ArrivalInfo {
  stopId: string;
  stopName: string;
  routeId: string;
  routeShortName?: string;
  arrivalTime: number;
  minutesUntil: number;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
  delaySeconds?: number;
}



// Track notifications we've already sent to avoid spam
const notifiedArrivals = new Map<string, { timestamp: number; arrivalTime: number }>();

export function useStopArrivalNotifications(
  trips: Trip[],
  routeNamesMap: Map<string, RouteInfo> | undefined,
  stopNotifications: StopNotificationSettings[],
  enabled: boolean = true
) {
  const lastCheckRef = useRef<number>(0);
  const [checkInterval, setCheckInterval] = useState(10000); // Default 10 seconds



  // Send browser notification - works for both push (Android) and client-side (iOS)
  // For iOS: push=false but we still send browser Notification when app is open
  // For Android: push=true, browser Notification works when app is open, server push works when app is closed
  const sendPushNotification = useCallback(async (arrival: ArrivalInfo, message: string) => {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const urgencyEmoji = arrival.minutesUntil <= 1 ? '🚨' : arrival.minutesUntil <= 2 ? '⚠️' : '🚌';

        new Notification(`${urgencyEmoji} ${arrival.routeShortName || arrival.routeId}`, {
          body: message,
          icon: '/pwa-192x192.png',
          tag: `arrival-${arrival.stopId}-${arrival.routeId}`,
          requireInteraction: arrival.minutesUntil <= 2,
        });

        console.log('[Notification] Browser notification sent (iOS client-side or Android foreground)');
      } else {
        console.log('[Notification] Browser notification permission not granted');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  }, []);

  // Determine notification urgency based on time remaining
  const getUrgency = (minutesUntil: number): 'low' | 'medium' | 'high' => {
    if (minutesUntil <= 1) return 'high';
    if (minutesUntil <= 2) return 'medium';
    return 'low';
  };

  // Check if we should notify again for an arrival (progressive notifications)
  const shouldNotifyAgain = (
    notificationKey: string,
    arrivalTime: number,
    minutesUntil: number,
    settings: StopNotificationSettings
  ): boolean => {
    const previous = notifiedArrivals.get(notificationKey);
    if (!previous) return true;

    const now = Date.now();

    // If arrival time has changed significantly, re-notify
    if (Math.abs(previous.arrivalTime - arrivalTime) > 60) {
      console.log('[Notification] Arrival time changed, re-notifying');
      return true;
    }

    // Progressive notifications: notify at key intervals (5, 3, 2, 1 minutes)
    // This ensures no bus is missed
    const maxBeforeMinutes = Math.max(settings.beforeMinutes, 5);
    const intervals = [5, 3, 2, 1].filter(i => i <= maxBeforeMinutes);

    // Check if we're at any notification interval
    for (const interval of intervals) {
      // Check if we're within this interval (with 10 second window for accuracy)
      if (minutesUntil <= interval && minutesUntil > interval - 0.17) {
        const intervalKey = `${notificationKey}-${interval}`;
        if (!notifiedArrivals.has(intervalKey)) {
          notifiedArrivals.set(intervalKey, { timestamp: now, arrivalTime });
          console.log(`[Notification] Progressive notification at ${interval} min interval`);
          return true;
        }
      }
    }

    // Fallback: if we haven't sent any notification yet and we're within the window
    const hasSentAny = intervals.some(interval => {
      const intervalKey = `${notificationKey}-${interval}`;
      return notifiedArrivals.has(intervalKey);
    });

    if (!hasSentAny && minutesUntil > 0 && minutesUntil <= maxBeforeMinutes) {
      // Send catch-up notification
      const catchUpInterval = Math.min(Math.ceil(minutesUntil), maxBeforeMinutes);
      const catchUpKey = `${notificationKey}-${catchUpInterval}`;
      if (!notifiedArrivals.has(catchUpKey)) {
        notifiedArrivals.set(catchUpKey, { timestamp: now, arrivalTime });
        console.log(`[Notification] Catch-up notification at ${catchUpInterval} min`);
        return true;
      }
    }

    return false;
  };

  // Trigger all notification types for an arrival
  const triggerNotification = useCallback((arrival: ArrivalInfo, settings: StopNotificationSettings) => {
    const notificationKey = `${arrival.stopId}-${arrival.routeId}-${Math.floor(arrival.arrivalTime / 60)}`;

    if (!shouldNotifyAgain(notificationKey, arrival.arrivalTime, arrival.minutesUntil, settings)) {
      return;
    }

    const now = Date.now();
    notifiedArrivals.set(notificationKey, { timestamp: now, arrivalTime: arrival.arrivalTime });

    const routeName = arrival.routeShortName || arrival.routeId;
    const urgency = getUrgency(arrival.minutesUntil);

    // Announcement message following "Announcement Engine" rules
    // - Short sentences, no technical terms, no abbreviations, Greek only.
    let voiceMessage = `Το λεωφορείο της γραμμής ${routeName} φτάνει στη στάση ${arrival.stopName}.`;
    if (arrival.minutesUntil <= 1) {
      voiceMessage = `Το λεωφορείο της γραμμής ${routeName} φτάνει τώρα στη στάση ${arrival.stopName}.`;
    } else {
      voiceMessage += ` Θα είναι εδώ σε ${arrival.minutesUntil} λεπτά.`;
    }

    // Add delay info in a friendly official way if significant (> 2 mins)
    if (arrival.delaySeconds && arrival.delaySeconds > 120) {
      const delayMins = Math.round(arrival.delaySeconds / 60);
      voiceMessage += ` Υπάρχει καθυστέρηση ${delayMins} λεπτών.`;
    }

    // Prepare toast/UI message separately (can keep emojis/abbreviations for visuals)
    const urgencyText = urgency === 'high' ? 'ΤΩΡΑ! ' : urgency === 'medium' ? 'Σύντομα: ' : '';
    let uiMessage = `${urgencyText}Γραμμή ${routeName} φτάνει στη στάση ${arrival.stopName}`;
    if (arrival.minutesUntil <= 1) {
      uiMessage += ' τώρα!';
    } else {
      uiMessage += ` σε ${arrival.minutesUntil} λεπτά`;
    }
    if (arrival.delaySeconds && arrival.delaySeconds > 120) {
      uiMessage += ` (Καθυστέρηση ${Math.round(arrival.delaySeconds / 60)}')`;
    }

    // Sound notification
    if (settings.sound) {
      playSound(urgency);
    }

    // Vibration
    if (settings.vibration) {
      vibrate(urgency);
    }

    // Voice announcement
    if (settings.voice) {
      speak(voiceMessage);
    }

    // Browser notification (works for both iOS client-side and Android foreground)
    sendPushNotification(arrival, uiMessage);

    // Always show toast when app is visible
    const toastVariant = urgency === 'high' ? 'destructive' : 'default';
    toast({
      title: `${urgency === 'high' ? '🚨' : '🚌'} ${routeName}`,
      description: `${uiMessage}${arrival.confidence === 'high' ? ' ✓' : ''}`,
      variant: toastVariant,
    });

    console.log('[StopNotification] Triggered:', { arrival, settings, urgency });
  }, [sendPushNotification]);

  // Dynamic check interval based on approaching arrivals
  useEffect(() => {
    if (!enabled || !stopNotifications.length) return;

    // Find the nearest arrival time for any monitored stop
    let nearestMinutes = Infinity;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const enabledNotifications = stopNotifications.filter(n => n.enabled);

    trips.forEach(trip => {
      if (!trip.stopTimeUpdates?.length || !trip.routeId) return;

      trip.stopTimeUpdates.forEach(stu => {
        if (!stu.stopId || !stu.arrivalTime) return;

        const settings = enabledNotifications.find(n => n.stopId === stu.stopId);
        if (!settings) return;

        const minutesUntil = (stu.arrivalTime - nowSeconds) / 60;
        if (minutesUntil > 0 && minutesUntil < nearestMinutes) {
          nearestMinutes = minutesUntil;
        }
      });
    });

    // Adjust check interval based on nearest arrival - more aggressive checking
    let newInterval: number;
    if (nearestMinutes <= 1) {
      newInterval = 2000; // Check every 2 seconds when very close (1 min or less)
    } else if (nearestMinutes <= 2) {
      newInterval = 3000; // Check every 3 seconds when close (2 min)
    } else if (nearestMinutes <= 3) {
      newInterval = 4000; // Check every 4 seconds when approaching (3 min)
    } else if (nearestMinutes <= 5) {
      newInterval = 5000; // Check every 5 seconds when approaching (5 min)
    } else if (nearestMinutes <= 10) {
      newInterval = 8000; // Check every 8 seconds
    } else {
      newInterval = 15000; // Check every 15 seconds when far
    }

    if (newInterval !== checkInterval) {
      setCheckInterval(newInterval);
      console.log(`[StopNotification] Adjusted check interval to ${newInterval}ms (nearest: ${nearestMinutes.toFixed(1)} min)`);
    }
  }, [trips, stopNotifications, enabled, checkInterval]);

  // Main check loop for approaching buses
  useEffect(() => {
    if (!enabled || !trips.length || !stopNotifications.length) return;

    const now = Date.now();

    // Throttle checks based on dynamic interval
    if (now - lastCheckRef.current < checkInterval) return;
    lastCheckRef.current = now;

    const nowSeconds = Math.floor(now / 1000);

    // Get all enabled stop notifications
    const enabledNotifications = stopNotifications.filter(n => n.enabled);
    if (enabledNotifications.length === 0) return;

    // Create a map for quick lookup
    const stopSettingsMap = new Map(enabledNotifications.map(n => [n.stopId, n]));

    // Track arrivals for each monitored stop
    const arrivalsByStop = new Map<string, ArrivalInfo[]>();

    // Check each trip for arrivals at our monitored stops
    trips.forEach(trip => {
      if (!trip.stopTimeUpdates?.length || !trip.routeId) return;

      const routeInfo = routeNamesMap?.get(trip.routeId);

      trip.stopTimeUpdates.forEach(stu => {
        if (!stu.stopId || !stu.arrivalTime) return;

        const settings = stopSettingsMap.get(stu.stopId);
        if (!settings) return;

        const secondsUntil = stu.arrivalTime - nowSeconds;
        const minutesUntil = Math.round(secondsUntil / 60);

        // Track all upcoming arrivals (up to 15 minutes ahead)
        if (minutesUntil > 0 && minutesUntil <= 15) {
          const existingArrivals = arrivalsByStop.get(stu.stopId) || [];
          existingArrivals.push({
            stopId: stu.stopId,
            stopName: settings.stopName,
            routeId: trip.routeId!,
            routeShortName: routeInfo?.route_short_name,
            arrivalTime: stu.arrivalTime,
            minutesUntil,
            confidence: 'medium',
            source: 'gtfs',
          });
          arrivalsByStop.set(stu.stopId, existingArrivals);
        }

        if (minutesUntil > 0 && minutesUntil <= settings.beforeMinutes) {
          // Check filtering mode
          const notifyType = settings.notifyType || 'selected'; // Default to selected to prevent spam

          if (notifyType === 'selected') {
            // Check if we are filtering by specific trips
            // If no trips are watched, we don't notify
            if (!settings.watchedTrips || settings.watchedTrips.length === 0) {
              return;
            }
            if (!settings.watchedTrips.includes(trip.tripId || '')) {
              return;
            }
          }
          // If notifyType === 'all', we proceed (notify for everything)

          triggerNotification({
            stopId: stu.stopId,
            stopName: settings.stopName,
            routeId: trip.routeId!,
            routeShortName: routeInfo?.route_short_name,
            arrivalTime: stu.arrivalTime,
            minutesUntil,
            confidence: 'medium',
            source: 'gtfs',
            delaySeconds: stu.arrivalDelay
          }, settings);
        }
      });
    });

    // Log monitoring status
    if (arrivalsByStop.size > 0) {
      console.log(`[StopNotification] Monitoring ${arrivalsByStop.size} stops with arrivals`);
    }
  }, [trips, routeNamesMap, stopNotifications, enabled, triggerNotification, checkInterval]);

  // Cleanup old notifications periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;

      notifiedArrivals.forEach((data, key) => {
        if (data.timestamp < fiveMinutesAgo) {
          notifiedArrivals.delete(key);
        }
      });
    }, 60000);

    return () => clearInterval(cleanup);
  }, []);

  return {
    playSound,
    vibrate,
    speak,
    checkInterval,
  };
}