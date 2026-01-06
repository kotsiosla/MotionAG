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
let audioUnlocked = false;

// iOS Audio unlock - must be called from user interaction
export const unlockAudio = () => {
  if (audioUnlocked) return;
  
  try {
    // Create silent audio context to unlock
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume if suspended (iOS requirement)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    // Play a silent buffer to unlock
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);
    
    audioUnlocked = true;
    console.log('[Audio] iOS audio unlocked');
  } catch (e) {
    console.log('[Audio] Could not unlock audio:', e);
  }
};

// Speak text using Web Speech API
export const speak = (text: string) => {
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
export const playSound = (urgency: 'low' | 'medium' | 'high' = 'medium') => {
  try {
    // Try Web Audio API first
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume audio context if suspended (iOS)
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[Audio] AudioContext resumed');
        playSoundWithContext(audioContext!, urgency);
      });
    } else {
      playSoundWithContext(audioContext, urgency);
    }
  } catch (error) {
    console.error('[Audio] Error playing sound:', error);
    // Fallback: try HTML5 Audio with a simple beep URL
    playFallbackSound(urgency);
  }
};

const playSoundWithContext = (ctx: AudioContext, urgency: 'low' | 'medium' | 'high') => {
  const baseFreq = urgency === 'high' ? 1000 : urgency === 'medium' ? 800 : 600;
  const beepCount = urgency === 'high' ? 3 : urgency === 'medium' ? 2 : 1;
  
  for (let i = 0; i < beepCount; i++) {
    setTimeout(() => {
      try {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        oscillator.frequency.value = baseFreq + (i * 100);
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      } catch (e) {
        console.error('[Audio] Error creating oscillator:', e);
      }
    }, i * 200);
  }
};

// Fallback audio for iOS when AudioContext doesn't work
const playFallbackSound = (urgency: 'low' | 'medium' | 'high') => {
  // Generate a data URI for a short beep (WAV format)
  const beepCount = urgency === 'high' ? 3 : urgency === 'medium' ? 2 : 1;
  
  for (let i = 0; i < beepCount; i++) {
    setTimeout(() => {
      try {
        // Use a simple audio element with base64 encoded beep
        const audio = new Audio();
        // Short sine wave beep as data URI
        audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQg6l9PCqYhMOq+7l4xiLm7Sw8FnHQMqpd3wgiwCJYjj9rVRAnXL/dZJBQBzyv7UUAdtt/vPXAsqfOb61FgGOobx/M1PDFqR7/20SBR1mvP9rj0Yb5/49qQrHHem+/qXIx51r/76jBYle7789IANMorr+e1nAkqU5/rmWwBUl+f74lMEXZnq/tlKCWmb7P/TPhBxoPL/yjMVeqf1/8YmGH6v+P/BHxyFtvr/uhYhir78/7IPJo/A/v+pCyuUxv//nAYwmcv//44CNp7Q//+BATuh1f//cwE+ptv/+2MARKvg//dTAkqw5f/ySgNPs+n/7UEEVLbt/+g4BVq58P/jMAZfvPP/3ygHZL/2/9kgCWnC+P/VGApuwfr/0RAMcr/8/8wJDnW9/f/IARN3uv7/xAEWebr//78BF3q5//+8AB56uf//uQAhfLn//7UAJH65//+yACd/uv//sAApgLr//68ALIC5//+uAC6Auf//rQAwgbn//6wAMoG5//+rADSBuf//qgA2gbr//6kAOIK6//+oADqCuv//qAA8grr//6cAPYO6//+mAD+Du///pgBBg7v//6UAQ4S7//+kAESEu///pABGhLv//6MASISbm5ubm5trbW9vcHBva2pqampnZWRiYF5cWldVU1BOTEM/Ozk3NDIwLSwpJyQhHx0aGBUSEA4MCggGBAIAAQMFBwkLDQ8RExUXGRsdHyEkJiopLC4wMjQ2ODo8P0FFR0tOUFRXWV1gYmRmZ2lrbG1ub29wcG9ubWxqaGVhXVhTTkdAOTIrJB0XEQsGAQD/';
        audio.volume = 0.7;
        audio.play().catch(e => console.log('[Audio] Fallback play failed:', e));
      } catch (e) {
        console.log('[Audio] Fallback audio failed:', e);
      }
    }, i * 300);
  }
};

// Vibrate device - pattern based on urgency
// Note: NOT supported on iOS Safari - there is no workaround for this
export const vibrate = (urgency: 'low' | 'medium' | 'high' = 'medium') => {
  // Check if vibration is actually supported
  if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') {
    console.log('[Vibration] Not supported on this device (iOS does not support vibration API)');
    return false;
  }
  
  try {
    const patterns = {
      low: [200],
      medium: [200, 100, 200],
      high: [200, 100, 200, 100, 300, 100, 300],
    };
    const result = navigator.vibrate(patterns[urgency]);
    console.log('[Vibration] Triggered:', result);
    return result;
  } catch (error) {
    console.log('[Vibration] Error:', error);
    return false;
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

  // Send push notification for a stop - uses browser Notification API for foreground
  // Push notifications for background require server-side triggering
  const sendPushNotification = useCallback(async (arrival: ArrivalInfo, settings: StopNotificationSettings) => {
    if (!settings.push) return;
    
    try {
      // Use browser Notification API if permission granted and app is in foreground
      if ('Notification' in window && Notification.permission === 'granted') {
        const urgencyEmoji = arrival.minutesUntil <= 1 ? '🚨' : arrival.minutesUntil <= 2 ? '⚠️' : '🚌';
        
        new Notification(`${urgencyEmoji} ${arrival.routeShortName || arrival.routeId} - ${arrival.minutesUntil}'`, {
          body: `Φτάνει στη στάση "${arrival.stopName}"${arrival.confidence === 'high' ? ' (ακριβής πρόβλεψη)' : ''}`,
          icon: '/pwa-192x192.png',
          tag: `arrival-${arrival.stopId}-${arrival.routeId}`,
          requireInteraction: arrival.minutesUntil <= 2,
        });
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