import { useState } from "react";
import { Bell, BellOff, X, Clock, Loader2, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { unlockAudio } from "@/hooks/useStopArrivalNotifications";
import { type StopNotificationSettings } from "@/hooks/useStopNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";

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

  const { unsubscribe } = usePushSubscription();

  const handleReset = async () => {
    if (confirm("Reset Push Permissions? This will verify if the app has a broken key.")) {
      await unsubscribe();
      alert("Reset Complete. Please try enabling the alarm again.");
      onClose();
    }
  };

  // Detect iOS
  const isIOS = () => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  // Simple enable - request permission, subscribe, save to server
  const handleEnable = async () => {
    // alert('CLICKED'); // DEBUG REMOVED
    setIsSaving(true);
    try {
      // Immediate feedback
      toast({ title: "🔄 Εναρξη συγχρονισμού...", description: "Παρακαλώ περιμένετε...", duration: 2000 });

      // Unlock audio for notifications (required on iOS)
      unlockAudio();

      // Check iOS standalone mode (iOS only supports Web Push in PWA mode)
      const standalone = (window.matchMedia('(display-mode: standalone)').matches) ||
        ('standalone' in window.navigator && (window.navigator as any).standalone === true);

      // IMMEDIATE LOG for tracing
      try {
        await (supabase as any).from('notifications_log').insert({
          stop_id: stopId || 'UNKNOWN',
          route_id: 'DIAGNOSTIC_V2',
          alert_level: 0,
          metadata: {
            step: 'ATTEMPT_START',
            version: 'v1.5.16.2',
            standalone,
            ua: navigator.userAgent,
            timestamp: new Date().toISOString()
          }
        });
      } catch (e) { console.error('Early diagnostic log failed', e); }

      if (isIOS() && !standalone) {
        console.log('[StopNotificationModal] iOS detected but not in standalone mode');
        try {
          await (supabase as any).from('notifications_log').insert({
            stop_id: stopId || 'UNKNOWN',
            route_id: 'DIAGNOSTIC_V2',
            alert_level: 0,
            metadata: { step: 'FALLBACK_TRIGGERED', reason: 'iOS_NOT_STANDALONE', timestamp: new Date().toISOString() }
          });
        } catch (e) { }

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


      // Auto-login to ensure we can save to DB
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log('[StopNotificationModal] No session, signing in anonymously...');
        const { error: authError } = await supabase.auth.signInAnonymously();
        if (authError) {
          console.error('Auth failed:', authError);
          throw new Error('Could not sign in. Please reload.');
        }
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
          metadata: {
            step: 'PERMISSION_RESULT',
            permission,
            platform: 'Web',
            version: 'v1.5.16',
            href: window.location.href,
            timestamp: new Date().toISOString()
          }
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

      // Helper to ensure SW is registered
      const ensureServiceWorker = async () => {
        // Robust basePath: check if MotionAG is anywhere in path
        const basePath = window.location.pathname.includes('MotionAG') ? '/MotionAG/' : '/';
        const regScope = window.location.pathname.includes('MotionAG') ? '/MotionAG' : '/';
        const swUrl = `${basePath}push-worker.js`.replace(/\/\/+/g, '/');

        console.log('[StopNotificationModal] Registering SW with path:', swUrl, 'and scope:', regScope);
        await navigator.serviceWorker.register(swUrl, {
          scope: regScope,
          updateViaCache: 'none'
        });
        return navigator.serviceWorker.ready;
      };

      // Check if service worker is valid
      let registration: ServiceWorkerRegistration | undefined;
      try {
        if ('serviceWorker' in navigator) {
          console.log('[StopNotificationModal] Waiting for service worker ready...');

          // Timeout wrapper for SW readiness (Increased to 15s for v1.5.11)
          const readyPromise = ensureServiceWorker();
          const swTimeoutPromise = new Promise<ServiceWorkerRegistration>((_, reject) => setTimeout(() => reject(new Error('Service Worker ready timed out (v1.5.16)')), 15000));

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
            metadata: {
              step: 'SW_FAILED',
              error: String(swError),
              version: 'v1.5.16.2',
              href: window.location.href,
              controller: !!navigator.serviceWorker.controller,
              basePath: window.location.pathname.includes('MotionAG') ? '/MotionAG/' : '/',
              attemptedPath: window.location.pathname.includes('MotionAG') ? '/MotionAG/push-worker.js' : '/push-worker.js',
              timestamp: new Date().toISOString()
            }
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
          <div className="pt-2 border-t border-border mt-2">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground h-6" onClick={handleReset}>
              <Trash className="h-3 w-3 mr-1" /> Debug: Force Reset Push (v1.5.16)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
