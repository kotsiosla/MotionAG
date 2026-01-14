import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const logDiagnostic = async (step: string, metadata: any) => {
  try {
    await (supabase as any).from('notifications_log').insert({
      stop_id: 'SYNC_DEBUG',
      route_id: 'STOP_NOTIFS',
      alert_level: 0,
      metadata: { ...metadata, step, version: 'v1.5.17.6', timestamp: new Date().toISOString() }
    });
  } catch (e) {
    console.error('Failed to log sync diagnostic:', e);
  }
};

export interface StopNotificationSettings {
  stopId: string;
  stopName: string;
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  voice: boolean;
  push: boolean;
  beforeMinutes: number;
  notifyType?: 'all' | 'selected'; // 'all' = notify for all buses, 'selected' = only watchedTrips
  watchedTrips?: string[]; // If set, only notify for these trip IDs
}

const STORAGE_KEY = 'stop_notifications';

// Get current push subscription endpoint
async function getPushEndpoint(): Promise<string | null> {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return null;
    }
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find(r => r.active) || registrations[0];

    if (!registration) {
      console.log('[StopNotifications] No SW registration found for endpoint');
      return null;
    }

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
    const registrations = await navigator.serviceWorker.getRegistrations();
    const registration = registrations.find(r => r.active) || registrations[0];

    if (!registration) return null;

    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) return null;

    const p256dhKey = subscription.getKey('p256dh');
    const authKey = subscription.getKey('auth');

    if (!p256dhKey || !authKey) return null;

    const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

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

    // DIAGNOSTIC: Start Sync
    await logDiagnostic('SYNC_START', { notifs: pushEnabledNotifs.length });

    const endpoint = await getPushEndpoint();
    if (!endpoint) {
      console.log('[StopNotifications] No push subscription, skipping sync');
      await logDiagnostic('SYNC_ABORT', { reason: 'NO_ENDPOINT' });
      // Toast only if we expected it to work (not silent background sync)
      return;
    }

    const keys = await getPushSubscriptionKeys();
    if (!keys) {
      console.warn('[StopNotifications] Could not get push keys');
      toast({
        title: "⚠️ Σφάλμα Συγχρονισμού",
        description: "Δεν βρέθηκαν κλειδιά κρυπτογράφησης push. Δοκιμάστε να απενεργοποιήσετε και να ενεργοποιήσετε ξανά τις ειδοποιήσεις από το κουμπί 'Καμπανάκι' στο μενού.",
        variant: "destructive"
      });
      return;
    }

    setIsSyncing(true);
    try {
      let { data: { user } } = await supabase.auth.getUser();

      // Auto-login if no user found (recovery after hard reset)
      if (!user) {
        console.log('[StopNotifications] No user found, attempting anonymous sign-in...');
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
        if (authError || !authData.user) {
          console.error('[StopNotifications] Anonymous sign-in failed:', authError);
          alert("Critical Error: Could not sign in. Please reload the app.");
          return;
        }
        user = authData.user;
        console.log('[StopNotifications] Signed in anonymously:', user.id);
      }

      // ATOMIC UPSERT LOGIC (Matching StopNotificationModal)
      console.log('[StopNotifications] Syncing to DB...', { endpoint: endpoint.slice(0, 20), notifs: pushEnabledNotifs.length });
      await logDiagnostic('SYNC_ATTEMPT', { count: pushEnabledNotifs.length, endpoint: endpoint.slice(-10), userId: user.id });

      // ATOMIC UPSERT
      // Fixes: 
      // 1. Race conditions (atomic in Postgres)
      // 2. Clear column name: stop_notifications
      const { data: upsertData, error: upsertError } = await supabase
        .from('stop_notification_subscriptions')
        .upsert({
          endpoint: endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          stop_notifications: pushEnabledNotifs as any,
          updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' })
        .select();

      if (upsertError) {
        console.error('[StopNotifications] Sync upsert error:', upsertError);
        await logDiagnostic('SYNC_FAILED', { error: upsertError });
        alert("DB Save Failed: " + upsertError.message);
        throw new Error("Update failed: " + upsertError.message);
      } else {
        console.log('[StopNotifications] Synced', pushEnabledNotifs.length, 'notifications to server');
        await logDiagnostic('SYNC_SUCCESS', { count: pushEnabledNotifs.length });
        if (pushEnabledNotifs.length > 0) {
          // Explicitly tell user it worked, to confirm the "repair"
          // toast({ title: "✅ Saved to Server", description: "Your alarm is active in the cloud." });
        }
      }
      // Only toast on manual action (heuristic: if notifs > 0) or rely on calling component to toast
      if (pushEnabledNotifs.length > 0) {
        // We typically rely on the component (toggleWatchArrival) to show the "Added" toast
        // But showing a "Saved to Cloud" confirmation might be nice, or too noisy.
        // I'll keep it silent for success to avoid double toasts, as toggleWatchArrival shows one.
        // actually, for the first sync it might be useful.
      }
    } catch (error: any) {
      console.error('[StopNotifications] Sync error:', error);
      toast({
        title: "❌ Σφάλμα Αποθήκευσης",
        description: `Η ειδοποίηση είναι ενεργή τοπικά, αλλά απέτυχε η αποθήκευση στο cloud: ${error.message || String(error)}`,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  }, []);

  // Event listener for syncing state across components and tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        setNotifications(JSON.parse(e.newValue));
      }
    };

    const handleCustomEvent = (e: CustomEvent) => {
      if (e.detail) {
        setNotifications(e.detail);
      }
    };

    // Listen for storage changes (other tabs)
    window.addEventListener('storage', handleStorageChange);

    // Listen for custom event (same tab, different components)
    window.addEventListener('stop-notifications-changed', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('stop-notifications-changed', handleCustomEvent as EventListener);
    };
  }, []);

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

      // Dispatch event to update other components
      window.dispatchEvent(new CustomEvent('stop-notifications-changed', { detail: updated }));

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

      // Dispatch event
      window.dispatchEvent(new CustomEvent('stop-notifications-changed', { detail: updated }));

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
    await logDiagnostic('BOOTSTRAP', { version: 'v1.5.17.3', href: window.location.href });
    await syncToServer(notifications);
  }, [notifications, syncToServer]);

  // Clear all notifications locally and on server
  const clearAllNotifications = useCallback(async () => {
    setNotifications([]);
    localStorage.removeItem(STORAGE_KEY);

    // Dispatch event
    window.dispatchEvent(new CustomEvent('stop-notifications-changed', { detail: [] }));

    try {
      const endpoint = await getPushEndpoint();
      if (endpoint) {
        // Clear server data
        const { error } = await supabase
          .from('stop_notification_subscriptions')
          .update({ stop_notifications: [] })
          .eq('endpoint', endpoint);

        if (error) {
          console.error('[StopNotifications] Clear server error:', error);
        } else {
          console.log('[StopNotifications] Server notifications cleared');
        }
      }
    } catch (e) {
      console.error('Error clearing notifications:', e);
    }
  }, []);

  return {
    notifications,
    setNotification,
    removeNotification,
    getNotification,
    hasNotification,
    isSyncing,
    forceSync,
    clearAllNotifications,
  };
}