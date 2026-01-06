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
const VAPID_PUBLIC_KEY = 'BMJiK9p5Az8RiAE7ymzLtNrSkzOV4hNGmIES8swYJb5hatqImuUsmGJTO5Ql1cldnbFaMfMwAhFthpeP3Trp8jg';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
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

  // Simple enable - request permission, subscribe, save to server
  const handleEnable = async () => {
    setIsSaving(true);
    try {
      // Unlock audio for notifications (required on iOS)
      unlockAudio();
      
      // Check support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        toast({
          title: "Δεν υποστηρίζεται",
          description: "Ο browser δεν υποστηρίζει push notifications",
          variant: "destructive",
        });
        return;
      }

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({
          title: "Άδεια απορρίφθηκε",
          description: "Επιτρέψτε τις ειδοποιήσεις από τις ρυθμίσεις του browser",
          variant: "destructive",
        });
        return;
      }

      // Register/get service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      // Get or create push subscription
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // Extract keys
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      if (!p256dhKey || !authKey) {
        throw new Error('Failed to get subscription keys');
      }
      
      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

      // Create settings
      const settings: StopNotificationSettings = {
        stopId,
        stopName,
        enabled: true,
        sound: true,
        vibration: true,
        voice: false,
        push: true,
        beforeMinutes,
      };

      // Get existing notifications from localStorage
      const stored = localStorage.getItem('stop_notifications');
      let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
      
      // Update or add
      const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
      if (existingIndex >= 0) {
        allNotifications[existingIndex] = settings;
      } else {
        allNotifications.push(settings);
      }

      // Save to localStorage
      localStorage.setItem('stop_notifications', JSON.stringify(allNotifications));

      // Save to server - upsert based on endpoint
      const supabaseUrl = (supabase as any).supabaseUrl || 'unknown';
      console.log('[StopNotificationModal] Supabase URL:', supabaseUrl);
      console.log('[StopNotificationModal] Checking for existing subscription...');
      const { data: existing, error: checkError } = await supabase
        .from('stop_notification_subscriptions')
        .select('id')
        .eq('endpoint', subscription.endpoint)
        .maybeSingle();

      if (checkError) {
        console.error('[StopNotificationModal] Error checking existing subscription:', checkError);
      } else {
        console.log('[StopNotificationModal] Existing subscription found:', !!existing);
      }

      const pushNotifications = allNotifications.filter(n => n.enabled && n.push);
      
      console.log('[StopNotificationModal] Attempting to save subscription:', {
        endpoint: subscription.endpoint,
        p256dh: p256dh.substring(0, 10) + '...',
        auth: auth.substring(0, 10) + '...',
        stop_notifications: pushNotifications,
        isUpdate: !!existing,
      });

      // Use upsert instead of update/insert to handle both cases
      const { data: upsertData, error: upsertError } = await supabase
        .from('stop_notification_subscriptions')
        .upsert({
          endpoint: subscription.endpoint,
          p256dh,
          auth,
          stop_notifications: pushNotifications as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'endpoint' })
        .select();

      if (upsertError) {
        console.error('[StopNotificationModal] ❌ Upsert error:', upsertError);
        console.error('[StopNotificationModal] Upsert error details:', JSON.stringify(upsertError, null, 2));
        console.error('[StopNotificationModal] Error code:', upsertError.code);
        console.error('[StopNotificationModal] Error message:', upsertError.message);
      } else {
        console.log('[StopNotificationModal] ✅ Upsert successful:', upsertData);
        console.log('[StopNotificationModal] Upsert result length:', upsertData?.length || 0);
      }

      // Call parent callback
      onSave(settings);

      toast({
        title: "🔔 Ειδοποίηση ενεργοποιήθηκε",
        description: `${beforeMinutes} λεπτά πριν τη στάση "${stopName}"`,
      });

      onClose();
    } catch (error) {
      console.error('Error enabling notification:', error);
      toast({
        title: "Σφάλμα",
        description: (error as Error).message,
        variant: "destructive",
      });
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
            await supabase
              .from('stop_notification_subscriptions')
              .update({ stop_notifications: remaining as any })
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
