import { useEffect, useRef, useCallback } from 'react';
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
}

// Track notifications we've already sent to avoid spam
const notifiedArrivals = new Map<string, number>();

// Audio context for notification sounds
let audioContext: AudioContext | null = null;

// Speak text using Web Speech API
const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'el-GR';
    utterance.rate = 0.9;
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
  }
};

// Play notification sound
const playSound = () => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
    
    // Second beep
    setTimeout(() => {
      const osc2 = audioContext!.createOscillator();
      const gain2 = audioContext!.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext!.destination);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, audioContext!.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext!.currentTime + 0.3);
      osc2.start(audioContext!.currentTime);
      osc2.stop(audioContext!.currentTime + 0.3);
    }, 200);
  } catch (error) {
    console.error('Error playing sound:', error);
  }
};

// Vibrate device
const vibrate = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200, 100, 300]);
  }
};

export function useStopArrivalNotifications(
  trips: Trip[],
  routeNamesMap: Map<string, RouteInfo> | undefined,
  stopNotifications: StopNotificationSettings[],
  enabled: boolean = true
) {
  const lastCheckRef = useRef<number>(0);

  // Send push notification for a stop
  const sendPushNotification = useCallback(async (arrival: ArrivalInfo, settings: StopNotificationSettings) => {
    if (!settings.push) return;
    
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title: `🚌 ${arrival.routeShortName || arrival.routeId}`,
          body: `Φτάνει στη στάση "${arrival.stopName}" σε ${arrival.minutesUntil} λεπτά`,
          url: '/',
        },
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }, []);

  // Trigger all notification types for an arrival
  const triggerNotification = useCallback((arrival: ArrivalInfo, settings: StopNotificationSettings) => {
    const notificationKey = `${arrival.stopId}-${arrival.routeId}-${arrival.arrivalTime}`;
    const now = Date.now();
    
    // Don't notify if we already notified about this arrival in the last 5 minutes
    const lastNotified = notifiedArrivals.get(notificationKey);
    if (lastNotified && (now - lastNotified) < 5 * 60 * 1000) {
      return;
    }
    
    notifiedArrivals.set(notificationKey, now);
    
    const routeName = arrival.routeShortName || arrival.routeId;
    const message = `Γραμμή ${routeName} φτάνει στη στάση ${arrival.stopName} σε ${arrival.minutesUntil} λεπτά`;
    
    // Sound notification
    if (settings.sound) {
      playSound();
    }
    
    // Vibration
    if (settings.vibration) {
      vibrate();
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
    toast({
      title: `🚌 ${routeName} σε ${arrival.minutesUntil}'`,
      description: `Φτάνει στη στάση "${arrival.stopName}"`,
    });
    
    console.log('[StopNotification] Triggered:', { arrival, settings });
  }, [sendPushNotification]);

  // Check for approaching buses
  useEffect(() => {
    if (!enabled || !trips.length || !stopNotifications.length) return;
    
    const now = Date.now();
    
    // Throttle checks to every 10 seconds
    if (now - lastCheckRef.current < 10000) return;
    lastCheckRef.current = now;
    
    const nowSeconds = Math.floor(now / 1000);
    
    // Get all enabled stop notifications
    const enabledNotifications = stopNotifications.filter(n => n.enabled);
    if (enabledNotifications.length === 0) return;
    
    // Create a map for quick lookup
    const stopSettingsMap = new Map(enabledNotifications.map(n => [n.stopId, n]));
    
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
        
        // Check if arrival is within the notification window
        if (minutesUntil > 0 && minutesUntil <= settings.beforeMinutes) {
          triggerNotification({
            stopId: stu.stopId,
            stopName: settings.stopName,
            routeId: trip.routeId!,
            routeShortName: routeInfo?.route_short_name,
            arrivalTime: stu.arrivalTime,
            minutesUntil,
          }, settings);
        }
      });
    });
  }, [trips, routeNamesMap, stopNotifications, enabled, triggerNotification]);

  // Cleanup old notifications periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      
      notifiedArrivals.forEach((timestamp, key) => {
        if (timestamp < fiveMinutesAgo) {
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
  };
}
