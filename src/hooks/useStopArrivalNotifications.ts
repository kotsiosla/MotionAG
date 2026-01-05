import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Trip, RouteInfo } from '@/types/gtfs';
import type { StopNotificationSettings } from './useStopNotifications';

interface ArrivalInfo {
  stopId: string;
  stopName: string;
  routeId: string;
  routeShortName?: string;
  arrivalTime: number;
  minutesUntil: number;
  confidence?: 'high' | 'medium' | 'low';
  source?: string;
}

interface HighAccuracyArrival {
  stopId: string;
  routeId: string;
  tripId?: string;
  vehicleId?: string;
  bestArrivalTime: number;
  confidence: 'high' | 'medium' | 'low';
  source: 'gtfs' | 'siri' | 'merged';
  gtfsArrivalTime?: number;
  siriExpectedArrivalTime?: number;
}

// Track notifications we've already sent to avoid spam
const notifiedArrivals = new Map<string, { timestamp: number; arrivalTime: number }>();

// Audio context for notification sounds
let audioContext: AudioContext | null = null;

// Speak text using Web Speech API
const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'el-GR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }
};

// Play notification sound - more urgent as time approaches
const playSound = (urgency: 'low' | 'medium' | 'high' = 'medium') => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const baseFreq = urgency === 'high' ? 1000 : urgency === 'medium' ? 800 : 600;
    const beepCount = urgency === 'high' ? 3 : urgency === 'medium' ? 2 : 1;
    
    for (let i = 0; i < beepCount; i++) {
      setTimeout(() => {
        const oscillator = audioContext!.createOscillator();
        const gainNode = audioContext!.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext!.destination);
        
        oscillator.frequency.value = baseFreq + (i * 100);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.4, audioContext!.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext!.currentTime + 0.3);
        
        oscillator.start(audioContext!.currentTime);
        oscillator.stop(audioContext!.currentTime + 0.3);
      }, i * 200);
    }
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

// Vibrate device - pattern based on urgency
const vibrate = (urgency: 'low' | 'medium' | 'high' = 'medium') => {
  if ('vibrate' in navigator) {
    const patterns = {
      low: [200],
      medium: [200, 100, 200],
      high: [200, 100, 200, 100, 300, 100, 300],
    };
    navigator.vibrate(patterns[urgency]);
  }
};

export function useStopArrivalNotifications(
  trips: Trip[],
  routeNamesMap: Map<string, RouteInfo> | undefined,
  stopNotifications: StopNotificationSettings[],
  enabled: boolean = true
) {
  const lastCheckRef = useRef<number>(0);
  const [checkInterval, setCheckInterval] = useState(10000); // Default 10 seconds
  const highAccuracyModeRef = useRef<Set<string>>(new Set()); // Stops in high-accuracy mode

  // Fetch high-accuracy arrivals from the server
  const fetchHighAccuracyArrivals = useCallback(async (stopId: string): Promise<HighAccuracyArrival[]> => {
    try {
      const { data, error } = await supabase.functions.invoke('gtfs-proxy', {
        body: null,
        method: 'GET',
      });
      
      // Since we can't pass query params directly, we'll use the standard trips endpoint
      // and the merged data logic is already in the edge function
      // For now, fall back to local processing
      return [];
    } catch (error) {
      console.error('Error fetching high-accuracy arrivals:', error);
      return [];
    }
  }, []);

  // Send push notification for a stop
  const sendPushNotification = useCallback(async (arrival: ArrivalInfo, settings: StopNotificationSettings) => {
    if (!settings.push) return;
    
    try {
      const urgencyEmoji = arrival.minutesUntil <= 1 ? '🚨' : arrival.minutesUntil <= 2 ? '⚠️' : '🚌';
      
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title: `${urgencyEmoji} ${arrival.routeShortName || arrival.routeId} - ${arrival.minutesUntil}'`,
          body: `Φτάνει στη στάση "${arrival.stopName}"${arrival.confidence === 'high' ? ' (ακριβής πρόβλεψη)' : ''}`,
          url: '/',
        },
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
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
    
    // Progressive notifications: notify at key intervals
    // At beforeMinutes, at 2 minutes, at 1 minute
    const intervals = [settings.beforeMinutes, 2, 1];
    
    for (const interval of intervals) {
      if (minutesUntil <= interval) {
        const intervalKey = `${notificationKey}-${interval}`;
        if (!notifiedArrivals.has(intervalKey)) {
          notifiedArrivals.set(intervalKey, { timestamp: now, arrivalTime });
          return true;
        }
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
    const urgencyText = urgency === 'high' ? 'ΤΩΡΑ! ' : urgency === 'medium' ? 'Σύντομα: ' : '';
    
    let message = `${urgencyText}Γραμμή ${routeName} φτάνει στη στάση ${arrival.stopName}`;
    if (arrival.minutesUntil <= 1) {
      message += ' τώρα!';
    } else {
      message += ` σε ${arrival.minutesUntil} λεπτά`;
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
      speak(message);
    }
    
    // Push notification (for when app is in background)
    if (settings.push) {
      sendPushNotification(arrival, settings);
    }
    
    // Always show toast when app is visible
    const toastVariant = urgency === 'high' ? 'destructive' : 'default';
    toast({
      title: `${urgency === 'high' ? '🚨' : '🚌'} ${routeName} σε ${arrival.minutesUntil <= 0 ? 'τώρα' : `${arrival.minutesUntil}'`}`,
      description: `Φτάνει στη στάση "${arrival.stopName}"${arrival.confidence === 'high' ? ' ✓' : ''}`,
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
    
    // Adjust check interval based on nearest arrival
    let newInterval: number;
    if (nearestMinutes <= 2) {
      newInterval = 3000; // Check every 3 seconds when very close
    } else if (nearestMinutes <= 5) {
      newInterval = 5000; // Check every 5 seconds when approaching
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
        
        // Check if arrival is within the notification window
        if (minutesUntil > 0 && minutesUntil <= settings.beforeMinutes) {
          triggerNotification({
            stopId: stu.stopId,
            stopName: settings.stopName,
            routeId: trip.routeId!,
            routeShortName: routeInfo?.route_short_name,
            arrivalTime: stu.arrivalTime,
            minutesUntil,
            confidence: 'medium',
            source: 'gtfs',
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