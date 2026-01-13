import { useState } from "react";
import { Bell, BellOff, X, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { unlockAudio } from "@/hooks/useStopArrivalNotifications";
import type { StopNotificationSettings } from "@/hooks/useStopNotifications";

interface StopNotificationModalProps {
  stopId: string;
  stopName: string;
  currentSettings?: StopNotificationSettings;
  onSave: (settings: StopNotificationSettings) => void;
  onRemove: (stopId: string) => void;
  onClose: () => void;
}

// VAPID public key for push notifications - must match the one in secrets
const VAPID_PUBLIC_KEY = 'BG5VfDXkytFaecTL-oWSCnIRZHVg1p9fwPaRsmA1rsPS6U4EY6G-RGvt78VFVO0lb8CQJd0SrUmfwbz_vCMbmlw';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function StopNotificationModal({
  stopId,
  stopName,
  currentSettings,
  onSave,
  onRemove,
  onClose,
}: StopNotificationModalProps) {
  const [beforeMinutes, setBeforeMinutes] = useState(currentSettings?.beforeMinutes ?? 5);
  const [isSaving, setIsSaving] = useState(false);
  const isEnabled = currentSettings?.enabled ?? false;

  // Detect iOS
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  // Simple enable - request permission, subscribe, save to server
  const handleEnable = async () => {
    setIsSaving(true);
    try {
      // Unlock audio for notifications (required on iOS)
      unlockAudio();

      // Check iOS standalone mode (iOS only supports Web Push in PWA mode)
      const standalone = (window.matchMedia('(display-mode: standalone)').matches) ||
        ('standalone' in window.navigator && (window.navigator as any).standalone === true);

      if (isIOS() && !standalone) {
        toast({
          title: "Safari Limitation",
          description: "Για να λαμβάνετε ειδοποιήσεις στο iPhone, προσθέστε την εφαρμογή στην Οθόνη Αφετηρίας (Add to Home Screen).",
          variant: "default",
        });
        // Continue with client-side only for non-PWA iOS
        const settings: StopNotificationSettings = {
          stopId,
          stopName,
          enabled: true,
          sound: true,
          vibration: true,
          voice: false,
          push: false,
          beforeMinutes,
        };
        // ... (rest of local storage logic)
        const stored = localStorage.getItem('stop_notifications');
        let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
        const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
        if (existingIndex >= 0) {
          allNotifications[existingIndex] = settings;
        } else {
          allNotifications.push(settings);
        }
        localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));
        onSave(settings);
        toast({ title: "✅ Ειδοποίηση ενεργοποιήθηκε", description: `Θα λάβετε ειδοποιήσεις όταν το app είναι ανοιχτό` });
        onClose();
        setIsSaving(false);
        return;
      }

      console.log('[StopNotificationModal] Requesting permission...');

      // Timeout wrapper for permission
      const permissionPromise = Notification.requestPermission();
      const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Permission request timed out')), 8000));

      const permission = await Promise.race([permissionPromise, timeoutPromise]) as NotificationPermission;

      console.log('[StopNotificationModal] Notification permission:', permission);

      // LOG to notifications_log without foreign key constraints
      try {
        await (supabase as any).from('notifications_log').insert({
          stop_id: stopId || 'UNKNOWN',
          route_id: 'DIAGNOSTIC_V2',
          alert_level: 0,
          metadata: { step: 'PERMISSION_RESULT', permission, platform: 'Web', timestamp: new Date().toISOString() }
        });
      } catch (e) {
        console.error('Logging failed:', e);
      }

      if (permission !== 'granted') {
        toast({
          title: "Απαιτείται άδεια",
          description: "Παρακαλώ επιτρέψτε τις ειδοποιήσεις για να λαμβάνετε ειδοποιήσεις στάσης.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // Check if service worker is valid
      let registration: ServiceWorkerRegistration | undefined;
      try {
        if ('serviceWorker' in navigator) {
          console.log('[StopNotificationModal] Waiting for service worker ready...');

          // Timeout wrapper for SW readiness
          const readyPromise = navigator.serviceWorker.ready;
          const swTimeoutPromise = new Promise<ServiceWorkerRegistration>((_, reject) => setTimeout(() => reject(new Error('Service Worker ready timed out')), 5000));

          registration = await Promise.race([readyPromise, swTimeoutPromise]);

          console.log('[StopNotificationModal] Service worker ready:', registration.scope);
        }
      } catch (swError) {
        console.error('[StopNotificationModal] Service worker failed:', swError);
        try {
          await (supabase as any).from('notifications_log').insert({
            stop_id: stopId || 'UNKNOWN',
            route_id: 'DIAGNOSTIC_V2',
            alert_level: 0,
            metadata: { step: 'SW_FAILED', error: String(swError), timestamp: new Date().toISOString() }
          });
        } catch (e) {
          console.error('Logging failed:', e);
        }
      }

      // If no active service worker, use client-side only (like iOS)
      if (!registration) {
        console.log('[StopNotificationModal] Using client-side notifications only');
        const settings: StopNotificationSettings = {
          stopId,
          stopName,
          enabled: true,
          sound: true,
          vibration: true,
          voice: false,
          push: false, // No push - client-side only
          beforeMinutes,
        };
        const stored = localStorage.getItem('stop_notifications');
        let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
        const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
        if (existingIndex >= 0) {
          allNotifications[existingIndex] = settings;
        } else {
          allNotifications.push(settings);
        }
        localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));
        onSave(settings);
        toast({
          title: "✅ Ειδοποίηση ενεργοποιήθηκε",
          description: `Θα λάβετε ειδοποιήσεις όταν το app είναι ανοιχτό`
        });
        onClose();
        setIsSaving(false);
        return;
      }

      // Get or create push subscription (for Android)
      console.log('[StopNotificationModal] Setting up push notifications for Android...');
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        console.log('[StopNotificationModal] Creating new push subscription...');
        try {
          const vapidKeyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKeyArray as any, // Use Uint8Array directly for iOS
          });

          try {
            await (supabase as any).from('notifications_log').insert({
              stop_id: stopId || 'UNKNOWN',
              route_id: 'DIAGNOSTIC_V2',
              alert_level: 0,
              metadata: { step: 'SUB_CREATED', endpoint: subscription.endpoint, timestamp: new Date().toISOString() }
            });
          } catch (e) {
            console.error('Logging failed:', e);
          }
          console.log('[StopNotificationModal] ✅ Push subscription created');
        } catch (subError) {
          console.error('[StopNotificationModal] ❌ Push subscription failed:', subError);
          try {
            await (supabase as any).from('notifications_log').insert({
              stop_id: stopId || 'UNKNOWN',
              route_id: 'DIAGNOSTIC_V2',
              alert_level: 0,
              metadata: { step: 'SUB_FAILED', error: String(subError), timestamp: new Date().toISOString() }
            });
          } catch (e) {
            console.error('Logging failed:', e);
          }
          // Fallback to client-side only
          const settings: StopNotificationSettings = {
            stopId,
            stopName,
            enabled: true,
            sound: true,
            vibration: true,
            voice: false,
            push: false,
            beforeMinutes,
          };
          const stored = localStorage.getItem('stop_notifications');
          let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
          const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
          if (existingIndex >= 0) {
            allNotifications[existingIndex] = settings;
          } else {
            allNotifications.push(settings);
          }
          localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));
          onSave(settings);
          toast({
            title: "✅ Ειδοποίηση ενεργοποιήθηκε",
            description: `Θα λάβετε ειδοποιήσεις όταν το app είναι ανοιχτό`
          });
          onClose();
          setIsSaving(false);
          return;
        }
      }

      // Extract keys and save to server
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      if (!p256dhKey || !authKey) {
        throw new Error('Failed to get subscription keys');
      }

      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

      const settings: StopNotificationSettings = {
        stopId,
        stopName,
        enabled: true,
        sound: true,
        vibration: true,
        voice: false,
        push: true, // Push enabled for Android
        beforeMinutes,
      };

      const stored = localStorage.getItem('stop_notifications');
      let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
      const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
      if (existingIndex >= 0) {
        allNotifications[existingIndex] = settings;
      } else {
        allNotifications.push(settings);
      }
      localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));

      // Save to server
      const pushNotifications = allNotifications.filter(n => n.enabled && n.push);
      const pushNotificationsJson = JSON.parse(JSON.stringify(pushNotifications));

      console.log('[StopNotificationModal] Saving to stop_notification_subscriptions...');
      console.log('[StopNotificationModal] Endpoint:', subscription.endpoint);
      console.log('[StopNotificationModal] Stop notifications to save:', pushNotificationsJson);

      const { data: upsertData, error: upsertError } = await supabase
        .from('stop_notification_subscriptions')
        .upsert({
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          stop_notifications: pushNotificationsJson,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })
        .select();

      if (upsertError) {
        console.error('[StopNotificationModal] ❌ Upsert error:', upsertError);
        toast({
          title: "Σφάλμα Συγχρονισμού",
          description: "Δεν ήταν δυνατή η αποθήκευση της ειδοποίησης στο διακομιστή.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      } else {
        console.log('[StopNotificationModal] ✅ Push subscription saved to server');
        console.log('[StopNotificationModal] Saved data:', upsertData);
      }

      onSave(settings);

      toast({
        title: "🔔 Ειδοποίηση ενεργοποιήθηκε",
        description: `${beforeMinutes} λεπτά πριν τη στάση "${stopName}"`,
      });

      onClose();
    } catch (error: any) {
      console.error('[StopNotificationModal] FATAL ERROR:', error);
      toast({
        title: "⛔ Κρίσιμο Σφάλμα",
        description: error.message || String(error),
        variant: "destructive",
        duration: 8000
      });
      // Also attempt to log this fatal error
      try {
        await (supabase as any).from('notifications_log').insert({
          stop_id: stopId || 'UNKNOWN',
          route_id: 'FATAL_ERROR',
          alert_level: 0,
          metadata: { error: String(error), stack: error?.stack, timestamp: new Date().toISOString() }
        });
      } catch { }
    } finally {
      setIsSaving(false);
    }
  };

  // Simple disable - remove from localStorage and server
  const handleDisable = async () => {
    setIsSaving(true);
    try {
      // Remove from localStorage
      const stored = localStorage.getItem('stop_notifications');
      let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
      allNotifications = allNotifications.filter(n => n.stopId !== stopId);
      localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));

      // Update server
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          const remaining = allNotifications.filter(n => n.enabled && n.push);

          if (remaining.length > 0) {
            // Ensure stop_notifications is properly formatted as JSONB
            const remainingJson = JSON.parse(JSON.stringify(remaining));
            await supabase
              .from('stop_notification_subscriptions')
              .update({ stop_notifications: remainingJson })
              .eq('endpoint', subscription.endpoint);
          } else {
            await supabase
              .from('stop_notification_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint);
          }
        }
      }

      // Call parent callback
      onRemove(stopId);

      toast({
        title: "🔕 Ειδοποίηση απενεργοποιήθηκε",
        description: stopName,
      });

      onClose();
    } catch (error) {
      console.error('Error disabling notification:', error);
      toast({
        title: "Σφάλμα",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[90%] max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
              {isEnabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm">Ειδοποίηση Στάσης</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[180px]">{stopName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={isSaving}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Before minutes slider */}
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">Ειδοποίηση πριν</Label>
              </div>
              <span className="font-mono font-bold text-primary text-lg">{beforeMinutes}'</span>
            </div>
            <Slider
              value={[beforeMinutes]}
              onValueChange={(v) => setBeforeMinutes(v[0])}
              min={1}
              max={15}
              step={1}
              className="w-full"
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground text-center">
              Θα λάβετε push notification {beforeMinutes} λεπτά πριν φτάσει το λεωφορείο
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {isEnabled ? (
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDisable}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <BellOff className="h-4 w-4 mr-2" />
                )}
                Απενεργοποίηση
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={handleEnable}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Bell className="h-4 w-4 mr-2" />
                )}
                Ενεργοποίηση
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
