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

const VERSION = 'v1.5.17.8';

const logDiagnostic = async (stopId: string, step: string, metadata: any) => {
  try {
    // We now use the shared client which has the hardcoded fallback
    await (supabase as any).from('notifications_log').insert({
      stop_id: stopId || 'DIAGNOSTIC',
      route_id: 'DIAGNOSTIC_V2',
      alert_level: 0,
      metadata: {
        ...metadata,
        step,
        version: VERSION,
        timestamp: new Date().toISOString()
      }
    });
  } catch (e) { console.error('[Diagnostic v1.5.17.7] Failed:', e); }
};

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

  const handleEnable = async () => {
    setIsSaving(true);
    try {
      // 0. Check for API existence
      if (!('Notification' in window)) {
        toast({ title: "❌ Μη υποστηριζόμενο", description: "Ο browser σας δεν υποστηρίζει ειδοποιήσεις." });
        setIsSaving(false);
        return;
      }

      // 1. IMMEDIATE PERMISSION REQUEST (CRITICAL FOR iOS USER GESTURE)
      // Must happen before ANY awaits to be valid
      console.log('[StopNotificationModal] Requesting permission immediately...');
      const permissionPromise = Notification.requestPermission();

      // 2. WHILE PERMISSION IS PENDING, DO BACKGROUND TASKS
      toast({ title: "🔄 Εναρξη συγχρονισμού...", description: "Παρακαλώ περιμένετε...", duration: 2000 });
      unlockAudio();

      const standalone = (window.matchMedia('(display-mode: standalone)').matches) ||
        ('standalone' in window.navigator && (window.navigator as any).standalone === true);

      // Log start (background)
      logDiagnostic(stopId || 'UNKNOWN', 'ATTEMPT_START', { standalone, ua: navigator.userAgent });

      if (isIOS() && !standalone) {
        toast({
          title: "Safari Limitation",
          description: "Για ειδοποιήσεις στο iPhone, κάντε 'Add to Home Screen'.",
          variant: "default",
        });
      }

      // 3. WAIT FOR PERMISSION RESULT
      const timeoutPromise = new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Permission request timed out')), 8000));
      const permission = await Promise.race([permissionPromise, timeoutPromise]) as NotificationPermission;

      await logDiagnostic(stopId || 'UNKNOWN', 'PERMISSION_RESULT', { permission, platform: 'Web', href: window.location.href });

      if (permission !== 'granted') {
        toast({
          title: "Απαιτείται άδεια",
          description: "Παρακαλώ επιτρέψτε τις ειδοποιήσεις για να λαμβάνετε ειδοποιήσεις στάσης.",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      const ensureServiceWorker = async () => {
        const basePath = window.location.pathname.includes('MotionAG') ? '/MotionAG/' : '/';
        const swUrl = `${basePath}push-worker.js`.replace(/\/\/+/g, '/');
        console.log('[StopNotificationModal] Registering SW:', swUrl);
        await navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' });
        return navigator.serviceWorker.ready;
      };

      let registration: ServiceWorkerRegistration | undefined;
      try {
        if ('serviceWorker' in navigator) {
          console.log('[StopNotificationModal] Waiting for service worker ready...');
          const readyPromise = ensureServiceWorker();
          const swTimeoutPromise = new Promise<ServiceWorkerRegistration>((_, reject) => setTimeout(() => reject(new Error('Service Worker ready timed out (v1.5.17)')), 15000));
          registration = await Promise.race([readyPromise, swTimeoutPromise]);
          console.log('[StopNotificationModal] Service worker ready:', registration.scope);
        }
      } catch (swError) {
        console.error('[StopNotificationModal] Service worker failed:', swError);
        await logDiagnostic(stopId || 'UNKNOWN', 'SW_FAILED', {
          error: String(swError),
          href: window.location.href,
          controller: !!navigator.serviceWorker.controller,
          basePath: window.location.pathname.includes('MotionAG') ? '/MotionAG/' : '/',
          attemptedPath: window.location.pathname.includes('MotionAG') ? '/MotionAG/push-worker.js' : '/push-worker.js'
        });
      }

      if (!registration) {
        console.log('[StopNotificationModal] Using client-side notifications only');
        const settings: StopNotificationSettings = {
          stopId, stopName, enabled: true, sound: true, vibration: true, voice: false, push: false, beforeMinutes,
        };
        const stored = localStorage.getItem('stop_notifications');
        let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
        const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
        if (existingIndex >= 0) allNotifications[existingIndex] = settings;
        else allNotifications.push(settings);
        localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));
        onSave(settings);
        toast({ title: "✅ Ειδοποίηση ενεργοποιήθηκε", description: `Θα λάβετε ειδοποιήσεις όταν το app είναι ανοιχτό` });
        onClose();
        setIsSaving(false);
        return;
      }

      console.log('[StopNotificationModal] Setting up push notifications...');
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        try {
          const vapidKeyArray = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKeyArray as any,
          });
          await logDiagnostic(stopId || 'UNKNOWN', 'SUB_CREATED', { endpoint: subscription.endpoint });
        } catch (subError) {
          console.error('[StopNotificationModal] Push subscription failed:', subError);
          await logDiagnostic(stopId || 'UNKNOWN', 'SUB_FAILED', { error: String(subError) });

          const settings: StopNotificationSettings = {
            stopId, stopName, enabled: true, sound: true, vibration: true, voice: false, push: false, beforeMinutes,
          };
          const stored = localStorage.getItem('stop_notifications');
          let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
          const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
          if (existingIndex >= 0) allNotifications[existingIndex] = settings;
          else allNotifications.push(settings);
          localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));
          onSave(settings);
          toast({ title: "✅ Ειδοποίηση ενεργοποιήθηκε", description: `Θα λάβετε ειδοποιήσεις όταν το app είναι ανοιχτό` });
          onClose();
          setIsSaving(false);
          return;
        }
      }

      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      if (!p256dhKey || !authKey) throw new Error('Failed to get subscription keys');

      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

      const settings: StopNotificationSettings = {
        stopId, stopName, enabled: true, sound: true, vibration: true, voice: false, push: true, beforeMinutes,
      };

      const stored = localStorage.getItem('stop_notifications');
      let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
      const existingKey = allNotifications.findIndex(n => n.stopId === stopId);
      if (existingKey >= 0) allNotifications[existingKey] = settings;
      else allNotifications.push(settings);
      localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));

      const pushNotifications = allNotifications.filter(n => n.enabled && n.push);
      const pushNotificationsJson = JSON.parse(JSON.stringify(pushNotifications));

      // ATOMIC UPSERT 
      // Prevents race conditions and ensures one set of settings per endpoint.
      const { error: upsertError } = await (supabase as any)
        .from('stop_notification_subscriptions')
        .upsert({
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          stop_notifications: pushNotificationsJson,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' });

      if (upsertError) {
        console.error('[StopNotificationModal] Upsert error:', upsertError);
        // If shared client fails, we try one last ditch log with robust client
        await logDiagnostic(stopId, 'UPSERT_FAILED', { error: upsertError });
        toast({ title: "Σφάλμα Συγχρονισμού", description: "Δεν ήταν δυνατή η αποθήκευση στο διακομιστή.", variant: "destructive" });
        setIsSaving(false);
        return;
      }

      onSave(settings);
      toast({ title: "🔔 Ειδοποίηση ενεργοποιήθηκε", description: `${beforeMinutes} λεπτά πριν τη στάση "${stopName}"` });
      onClose();
    } catch (error: any) {
      console.error('[StopNotificationModal] FATAL:', error);
      await logDiagnostic(stopId || 'UNKNOWN', 'FATAL_ERROR', { error: String(error), stack: error?.stack });
      toast({ title: "⛔ Κρίσιμο Σφάλμα", description: error.message || String(error), variant: "destructive", duration: 8000 });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisable = async () => {
    setIsSaving(true);
    try {
      const stored = localStorage.getItem('stop_notifications');
      let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
      allNotifications = allNotifications.filter(n => n.stopId !== stopId);
      localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const remaining = allNotifications.filter(n => n.enabled && n.push);
          if (remaining.length > 0) {
            await supabase.from('stop_notification_subscriptions').update({ stop_notifications: JSON.parse(JSON.stringify(remaining)) }).eq('endpoint', subscription.endpoint);
          } else {
            await supabase.from('stop_notification_subscriptions').delete().eq('endpoint', subscription.endpoint);
          }
        }
      }
      onRemove(stopId);
      toast({ title: "🔕 Ειδοποίηση απενεργοποιήθηκε", description: stopName });
      onClose();
    } catch (error) {
      console.error('Error disabling:', error);
      toast({ title: "Σφάλμα", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[90%] max-w-sm mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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

        <div className="p-4 space-y-4">
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

          <div className="flex gap-2">
            {isEnabled ? (
              <Button variant="destructive" className="flex-1" onClick={handleDisable} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BellOff className="h-4 w-4 mr-2" />}
                Απενεργοποίηση
              </Button>
            ) : (
              <Button className="flex-1" onClick={handleEnable} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
                Ενεργοποίηση
              </Button>
            )}
          </div>
          <div className="pt-2 border-t border-border mt-2">
            <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground h-6" onClick={handleReset}>
              <Trash className="h-3 w-3 mr-1" /> Debug: Force Reset Push (v1.5.17.7)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
