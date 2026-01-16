import { useEffect, useRef, useCallback, useState } from 'react';
import { toast } from '@/hooks/use-toast';

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
  delaySeconds?: number;
}



// Track notifications we've already sent to avoid spam
const notifiedArrivals = new Map<string, { timestamp: number; arrivalTime: number }>();

// Audio context for notification sounds
let audioContext: AudioContext | null = null;

// Pre-loaded audio element for iOS fallback
let fallbackAudio: HTMLAudioElement | null = null;

// Track if audio is already unlocked to prevent spamming
let isAudioUnlocked = false;

// iOS Audio unlock - must be called from user interaction
export const unlockAudio = async (): Promise<boolean> => {
  if (isAudioUnlocked && audioContext?.state === 'running') {
    return true;
  }

  // Prevent multiple parallel unlock attempts (e.g. from rapid touch events)
  if ((window as any)._isUnlockingAudio) {
    return false;
  }
  (window as any)._isUnlockingAudio = true;

  // Reset unlock lock after 1s in case of failure/stuck
  setTimeout(() => { (window as any)._isUnlockingAudio = false; }, 1000);

  try {
    // Create and unlock audio context
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume if suspended (iOS requirement)
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    // Play a silent buffer to unlock - this is required on iOS
    const buffer = audioContext.createBuffer(1, 1, 22050);
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContext.destination);
    source.start(0);

    // Pre-load and unlock HTML5 Audio for iOS fallback
    if (!fallbackAudio) {
      fallbackAudio = new Audio();
      // Short beep as data URI
      fallbackAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQg6l9PCqYhMOq+7l4xiLm7Sw8FnHQMqpd3wgiwCJYjj9rVRAnXL/dZJBQBzyv7UUAdtt/vPXAsqfOb61FgGOobx/M1PDFqR7/20SBR1mvP9rj0Yb5/49qQrHHem+/qXIx51r/76jBYle7789IANMorr+e1nAkqU5/rmWwBUl+f74lMEXZnq/tlKCWmb7P/TPhBxoPL/yjMVeqf1/8YmGH6v+P/BHxyFtvr/uhYhir78/7IPJo/A/v+pCyuUxv//nAYwmcv//44CNp7Q//+BATuh1f//cwE+ptv/+2MARKvg//dTAkqw5f/ySgNPs+n/7UEEVLbt/+g4BVq58P/jMAZfvPP/3ygHZL/2/9kgCWnC+P/VGApuwfr/0RAMcr/8/8wJDnW9/f/IARN3uv7/xAEWebr//78BF3q5//+8AB56uf//uQAhfLn//7UAJH65//+yACd/uv//sAApgLr//68ALIC5//+uAC6Auf//rQAwgbn//6wAMoG5//+rADSBuf//qgA2gbr//6kAOIK6//+oADqCuv//qAA8grr//6cAPYO6//+mAD+Du///pgBBg7v//6UAQ4S7//+kAESEu///pABGhLv//6MASISbm5ubm5trbW9vcHBva2pqampnZWRiYF5cWldVU1BOTEM/Ozk3NDIwLSwpJyQhHx0aGBUSEA4MCggGBAIAAQMFBwkLDQ8RExUXGRsdHyEkJiopLC4wMjQ2ODo8P0FFR0tOUFRXWV1gYmRmZ2lrbG1ub29wcG9ubWxqaGVhXVhTTkdAOTIrJB0XEQsGAQD/';
      fallbackAudio.load();
      // Play and immediately pause to unlock
      fallbackAudio.volume = 0.01;

      try {
        await fallbackAudio.play();
        fallbackAudio.pause();
        fallbackAudio.currentTime = 0;
        fallbackAudio.volume = 0.7;
        isAudioUnlocked = true;
      } catch (e) {
        // Ignore play error
      }
    } else {
      isAudioUnlocked = true;
    }

    if (!isAudioUnlocked) {
      // We set it to true here, assuming Web Audio worked even if HTML5 is still pending
      isAudioUnlocked = true;
    }

    // Prime Speech Synthesis engine for iOS
    if ('speechSynthesis' in window) {
      try {
        const utterance = new SpeechSynthesisUtterance(' ');
        utterance.volume = 0;
        utterance.rate = 2; // Fast silent utterance
        window.speechSynthesis.speak(utterance);
        console.log('[Audio] SpeechSynthesis primed');
      } catch (e) {
        console.error('[Audio] SpeechSynthesis prime failed:', e);
      }
    }

    return true;
  } catch (e) {
    // console.log('[Audio] Could not unlock audio:', e);
    return false;
  }
};

// Keep audio context alive - call this periodically when monitoring
export const keepAudioAlive = () => {
  if (audioContext && audioContext.state === 'suspended') {
    // Cannot resume without user interaction, but we can try
    audioContext.resume().catch(() => { });
  }
};

// Initialize voices and handle dynamic loading
let availableVoices: SpeechSynthesisVoice[] = [];
let voicesLoaded = false;

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  const loadVoices = () => {
    availableVoices = window.speechSynthesis.getVoices();
    if (availableVoices.length > 0) {
      voicesLoaded = true;
      console.log('[Audio] Voices loaded:', availableVoices.length);
    }
  };

  loadVoices();
  // Chrome and some other browsers load voices asynchronously
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  // Backup: retry loading voices every second if they haven't loaded yet
  const voiceRetryInterval = setInterval(() => {
    if (voicesLoaded && availableVoices.length > 0) {
      clearInterval(voiceRetryInterval);
      return;
    }
    loadVoices();
  }, 1000);

  // Limit utility of the interval
  setTimeout(() => clearInterval(voiceRetryInterval), 10000);
}

// Speak text using Web Speech API
export const speak = (text: string) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  // On iOS, we need to ensure the synthesis state is clean
  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
  } catch (e) {
    console.warn('[Audio] Error cancelling speech:', e);
  }

  // Ensure we have voices loaded
  if (availableVoices.length === 0) {
    availableVoices = window.speechSynthesis.getVoices();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'el-GR';
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  // Prioritize Greek voices by platform
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isWindows = /Windows/.test(navigator.userAgent);

  let greekVoice: SpeechSynthesisVoice | undefined;

  if (isIOS) {
    // On iOS, "Melina" is the high quality voice
    greekVoice = availableVoices.find(v => v.lang.startsWith('el') && v.name.includes('Melina'));
  } else if (isAndroid) {
    greekVoice = availableVoices.find(v => v.lang.startsWith('el') && v.name.toLowerCase().includes('google'));
  } else if (isWindows) {
    greekVoice = availableVoices.find(v => v.lang.startsWith('el') && v.name.includes('Stefanos'));
  }

  // Fallback to any el-GR voice if platform-specific not found
  if (!greekVoice) greekVoice = availableVoices.find(v => v.lang === 'el-GR');
  if (!greekVoice) greekVoice = availableVoices.find(v => (v.lang.startsWith('el') || v.lang.startsWith('gr')));
  if (!greekVoice) greekVoice = availableVoices.find(v => v.name.toLowerCase().includes('greek'));

  if (greekVoice) {
    utterance.voice = greekVoice;
    console.log('[Audio] Using specific Greek voice:', greekVoice.name, `(${greekVoice.lang})`);
  } else {
    console.warn('[Audio] No Greek voice found! Fallback to default. Voices available:', availableVoices.length);
    // If no Greek voice, we still set lang to el-GR and hope the browser handles it better than English
    utterance.lang = 'el-GR';
  }

  // Error handling
  utterance.onerror = (event) => {
    console.error('[Audio] Speech synthesis error:', event.error);
    // Restarting synthesis on error can sometimes "unstuck" iOS
    if (event.error === 'interrupted' || event.error === 'not-allowed') {
      console.log('[Audio] Synthesis interrupted or not allowed, possible iOS restriction.');
    }
  };

  // Important: On iOS, calling speak after a slight delay can sometimes help
  setTimeout(() => {
    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('[Audio] window.speechSynthesis.speak failed:', e);
    }
  }, 50);
};

// Test speech function specifically for manual user triggering
export const speakTest = () => {
  speak("Δοκιμή φωνητικής αναγγελίας. Αν ακούτε αυτό το μήνυμα, οι ειδοποιήσεις λειτουργούν κανονικά.");
};

// Play notification sound - more urgent as time approaches
export const playSound = (urgency: 'low' | 'medium' | 'high' = 'medium') => {
  console.log('[Audio] Attempting to play sound, urgency:', urgency);

  // On iOS, if the audio context is suspended, we need user interaction
  // Try HTML5 Audio fallback first as it's more reliable on iOS
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  if (isIOS && fallbackAudio) {
    // Use pre-loaded HTML5 Audio for iOS
    playWithHTML5Audio(urgency);
    return;
  }

  try {
    // Try Web Audio API
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume audio context if suspended (iOS)
    if (audioContext.state === 'suspended') {
      console.log('[Audio] AudioContext suspended, trying to resume...');
      audioContext.resume().then(() => {
        console.log('[Audio] AudioContext resumed');
        playSoundWithContext(audioContext!, urgency);
      }).catch(() => {
        console.log('[Audio] Could not resume, using fallback');
        playFallbackSound(urgency);
      });
    } else {
      playSoundWithContext(audioContext, urgency);
    }
  } catch (error) {
    console.error('[Audio] Error playing sound:', error);
    playFallbackSound(urgency);
  }
};

// Play using pre-loaded HTML5 Audio (more reliable on iOS)
const playWithHTML5Audio = (urgency: 'low' | 'medium' | 'high') => {
  const beepCount = urgency === 'high' ? 3 : urgency === 'medium' ? 2 : 1;

  const playBeep = (index: number) => {
    if (index >= beepCount || !fallbackAudio) return;

    try {
      fallbackAudio.currentTime = 0;
      fallbackAudio.play().then(() => {
        setTimeout(() => playBeep(index + 1), 300);
      }).catch(e => {
        console.log('[Audio] HTML5 play failed:', e);
      });
    } catch (e) {
      console.log('[Audio] HTML5 Audio error:', e);
    }
  };

  playBeep(0);
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