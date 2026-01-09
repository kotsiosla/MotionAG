import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface StopNotificationSettings {
  stopId: string;
  stopName: string;
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  voice: boolean;
  push: boolean;
  beforeMinutes: number;
}

const STORAGE_KEY = 'stop_notifications';

// Get current push subscription endpoint
async function getPushEndpoint(): Promise<string | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription?.endpoint || null;
  } catch {
    return null;
  }
}

// Get push subscription keys
async function getPushSubscriptionKeys(): Promise<{ p256dh: string; auth: string } | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) return null;

    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');

    if (!p256dhKey || !authKey) return null;

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

    return { p256dh, auth };
  } catch {
    return null;
  }
}

export function useStopNotifications() {
  const [notifications, setNotifications] = useState<StopNotificationSettings[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setNotifications(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading stop notifications:', error);
    }
  }, []);

  // Sync to server when notifications with push enabled change
  const syncToServer = useCallback(async (notifs: StopNotificationSettings[]) => {
    const pushEnabledNotifs = notifs.filter(n => n.enabled && n.push);

    if (pushEnabledNotifs.length === 0) {
      console.log('[StopNotifications] No push-enabled notifications to sync');
      return;
    }

    const endpoint = await getPushEndpoint();
    if (!endpoint) {
      console.log('[StopNotifications] No push subscription, skipping sync');
      return;
    }

    const keys = await getPushSubscriptionKeys();
    if (!keys) {
      console.log('[StopNotifications] Could not get push keys');
      return;
    }

    setIsSyncing(true);
    try {
      // First try to update existing subscription
      const { data: existing } = await supabase
        .from('stop_notification_subscriptions')
        .select('id')
        .eq('endpoint', endpoint)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('stop_notification_subscriptions')
          .update({
            p256dh: keys.p256dh,
            auth: keys.auth,
            stop_notifications: JSON.parse(JSON.stringify(pushEnabledNotifs)),
          })
          .eq('endpoint', endpoint);

        if (error) {
          console.error('[StopNotifications] Update error:', error);
        } else {
          console.log('[StopNotifications] Updated', pushEnabledNotifs.length, 'notifications on server');
        }
      } else {
        // Insert new
        const { error } = await supabase
          .from('stop_notification_subscriptions')
          .insert([{
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            stop_notifications: JSON.parse(JSON.stringify(pushEnabledNotifs)),
          }]);

        if (error) {
          console.error('[StopNotifications] Insert error:', error);
        } else {
          console.log('[StopNotifications] Synced', pushEnabledNotifs.length, 'notifications to server');
        }
      }
    } catch (error) {
      console.error('[StopNotifications] Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Save to localStorage and sync to server


  // Add or update notification for a stop
  const setNotification = useCallback((settings: StopNotificationSettings) => {
    setNotifications(prev => {
      const existing = prev.findIndex(n => n.stopId === settings.stopId);
      let updated: StopNotificationSettings[];
      if (existing >= 0) {
        updated = [...prev];
        updated[existing] = settings;
      } else {
        updated = [...prev, settings];
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      // Sync to server for background push notifications
      syncToServer(updated);

      // Show confirmation if push is enabled
      if (settings.push && settings.enabled) {
        toast({
          title: "🔔 Ειδοποιήσεις ενεργοποιημένες",
          description: `Θα λαμβάνετε ειδοποιήσεις ${settings.beforeMinutes} λεπτά πριν φτάσει το λεωφορείο στη στάση "${settings.stopName}"`,
        });
      }

      return updated;
    });
  }, [syncToServer]);

  // Remove notification for a stop
  const removeNotification = useCallback((stopId: string) => {
    setNotifications(prev => {
      const updated = prev.filter(n => n.stopId !== stopId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      syncToServer(updated);
      return updated;
    });
  }, [syncToServer]);

  // Get notification settings for a stop
  const getNotification = useCallback((stopId: string) => {
    return notifications.find(n => n.stopId === stopId);
  }, [notifications]);

  // Check if a stop has notifications enabled
  const hasNotification = useCallback((stopId: string) => {
    const notif = notifications.find(n => n.stopId === stopId);
    return notif?.enabled ?? false;
  }, [notifications]);

  // Force sync all notifications to server
  const forceSync = useCallback(async () => {
    await syncToServer(notifications);
  }, [notifications, syncToServer]);

  return {
    notifications,
    setNotification,
    removeNotification,
    getNotification,
    hasNotification,
    isSyncing,
    forceSync,
  };
}