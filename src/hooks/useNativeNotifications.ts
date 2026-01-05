import { useEffect, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { toast } from '@/hooks/use-toast';

interface NativeNotificationState {
  isNative: boolean;
  isSupported: boolean;
  isRegistered: boolean;
  pushToken: string | null;
}

export function useNativeNotifications() {
  const [state, setState] = useState<NativeNotificationState>({
    isNative: false,
    isSupported: false,
    isRegistered: false,
    pushToken: null,
  });

  // Check if running in native app
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) {
      setState(prev => ({ ...prev, isNative: false, isSupported: false }));
      return;
    }

    setState(prev => ({ ...prev, isNative: true, isSupported: true }));
    
    // Request permissions for local notifications
    LocalNotifications.requestPermissions().then(result => {
      console.log('Local notification permissions:', result);
    });
  }, [isNative]);

  // Register for push notifications
  const registerPush = useCallback(async () => {
    if (!isNative) {
      console.log('Not running in native app, skipping push registration');
      return null;
    }

    try {
      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      
      if (permResult.receive !== 'granted') {
        toast({
          title: 'Άδεια απορρίφθηκε',
          description: 'Πρέπει να επιτρέψετε τις ειδοποιήσεις στις ρυθμίσεις',
          variant: 'destructive',
        });
        return null;
      }

      // Register with APNS/FCM
      await PushNotifications.register();

      // Listen for registration
      PushNotifications.addListener('registration', (token: Token) => {
        console.log('Push registration success, token:', token.value);
        setState(prev => ({ ...prev, isRegistered: true, pushToken: token.value }));
        
        // Store token for later use (send to server)
        localStorage.setItem('native_push_token', token.value);
      });

      // Listen for registration errors
      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
        toast({
          title: 'Σφάλμα εγγραφής',
          description: 'Αποτυχία εγγραφής για push notifications',
          variant: 'destructive',
        });
      });

      // Listen for push notifications received
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Push notification received:', notification);
        // Show as local notification if app is in foreground
        scheduleLocalNotification({
          title: notification.title || 'Motion Bus',
          body: notification.body || '',
          id: Date.now(),
        });
      });

      // Listen for push notification actions
      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Push notification action:', action);
        // Handle notification tap - could navigate to specific route
        const data = action.notification.data;
        if (data?.url) {
          window.location.href = data.url;
        }
      });

      return true;
    } catch (error) {
      console.error('Error registering push notifications:', error);
      return null;
    }
  }, [isNative]);

  // Schedule a local notification
  const scheduleLocalNotification = useCallback(async (options: {
    title: string;
    body: string;
    id?: number;
    scheduleAt?: Date;
    extra?: Record<string, unknown>;
  }) => {
    if (!isNative) {
      // Fallback to web notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(options.title, { body: options.body });
      }
      return;
    }

    try {
      const notificationOptions: ScheduleOptions = {
        notifications: [{
          id: options.id || Date.now(),
          title: options.title,
          body: options.body,
          schedule: options.scheduleAt ? { at: options.scheduleAt } : undefined,
          extra: options.extra,
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          iconColor: '#3b82f6',
        }],
      };

      await LocalNotifications.schedule(notificationOptions);
      console.log('Local notification scheduled:', options);
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }, [isNative]);

  // Schedule trip reminder notification
  const scheduleTripReminder = useCallback(async (trip: {
    id: string;
    departureTime: Date;
    origin: string;
    destination: string;
    routeNames: string[];
  }, minutesBefore: number = 15) => {
    const reminderTime = new Date(trip.departureTime.getTime() - minutesBefore * 60 * 1000);
    
    // Don't schedule if reminder time is in the past
    if (reminderTime <= new Date()) {
      console.log('Reminder time is in the past, skipping');
      return;
    }

    const routeText = trip.routeNames.join(' → ');
    
    await scheduleLocalNotification({
      id: parseInt(trip.id.replace(/\D/g, '').slice(0, 9)) || Date.now(),
      title: `🚌 Αναχώρηση σε ${minutesBefore} λεπτά!`,
      body: `${trip.origin} → ${trip.destination}\nΓραμμή: ${routeText}`,
      scheduleAt: reminderTime,
      extra: { tripId: trip.id, type: 'trip_reminder' },
    });

    toast({
      title: 'Υπενθύμιση ορίστηκε',
      description: `Θα ειδοποιηθείτε ${minutesBefore} λεπτά πριν την αναχώρηση`,
    });
  }, [scheduleLocalNotification]);

  // Cancel a scheduled notification
  const cancelNotification = useCallback(async (notificationId: number) => {
    if (!isNative) return;

    try {
      await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
      console.log('Notification cancelled:', notificationId);
    } catch (error) {
      console.error('Error cancelling notification:', error);
    }
  }, [isNative]);

  // Get all pending notifications
  const getPendingNotifications = useCallback(async () => {
    if (!isNative) return [];

    try {
      const result = await LocalNotifications.getPending();
      return result.notifications;
    } catch (error) {
      console.error('Error getting pending notifications:', error);
      return [];
    }
  }, [isNative]);

  // Play notification sound
  const playSound = useCallback((urgency: 'low' | 'medium' | 'high' = 'medium') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      const frequencies = { low: 440, medium: 660, high: 880 };
      oscillator.frequency.value = frequencies[urgency];
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  }, []);

  // Vibrate device
  const vibrate = useCallback((pattern: number[] = [200, 100, 200]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  return {
    ...state,
    registerPush,
    scheduleLocalNotification,
    scheduleTripReminder,
    cancelNotification,
    getPendingNotifications,
    playSound,
    vibrate,
  };
}
