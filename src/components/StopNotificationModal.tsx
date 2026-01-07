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
const VAPID_PUBLIC_KEY = 'BANXTqf4fsrCfS_g0072vs4QupJYZpxOLcOjHfUtcQVufSBkX8fAkv54bIHCU4fdf4BLIKz00Q2x6o1QiFB5vtU';

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
      
      // Check iOS - iOS Safari doesn't support Web Push Notifications
      if (isIOS()) {
        toast({
          title: "iOS Safari Limitation",
          description: "Το iOS Safari δεν υποστηρίζει Web Push Notifications. Οι ειδοποιήσεις θα λειτουργούν μόνο όταν το app είναι ανοιχτό.",
          variant: "default",
        });
        // Continue with client-side notifications only (no push subscription)
        const settings: StopNotificationSettings = {
          stopId,
          stopName,
          enabled: true,
          sound: true,
          vibration: true,
          voice: false,
          push: false, // No push on iOS
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
        toast({ title: "✅ Ειδοποίηση ενεργοποιήθηκε", description: `Θα λάβετε ειδοποιήσεις όταν το app είναι ανοιχτό` });
        onClose();
        setIsSaving(false);
        return;
      }
      
      // Request permission
      const permission = await Notification.requestPermission();
      console.log('[StopNotificationModal] Notification permission:', permission);
      if (permission !== 'granted') {
        toast({
          title: "Άδεια απορρίφθηκε",
          description: "Επιτρέψτε τις ειδοποιήσεις από τις ρυθμίσεις του browser",
          variant: "destructive",
        });
        setIsSaving(false);
        return;
      }

      // Try to get existing service worker registration (registered in main.tsx)
      // DON'T register again - just use existing one to avoid refresh loop
      // Wait for service worker to be stable (not updating) before using it
      let registration: ServiceWorkerRegistration | null = null;
      
      // Retry mechanism: wait for service worker to be stable
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const existingRegistrations = await navigator.serviceWorker.getRegistrations();
          if (existingRegistrations.length > 0) {
            registration = existingRegistrations[0];
            console.log(`[StopNotificationModal] Attempt ${attempt + 1}: Found registration, state:`, {
              active: !!registration.active,
              installing: !!registration.installing,
              waiting: !!registration.waiting,
            });
            
            // Only use if active and NOT updating (to prevent refresh loop)
            if (registration.active && !registration.installing && !registration.waiting) {
              console.log('[StopNotificationModal] ✅ Service worker is stable and ready');
              break; // Success - use this registration
            } else {
              // Wait a bit and retry
              if (attempt < 4) {
                console.log('[StopNotificationModal] ⏳ Service worker not stable yet, waiting...');
                await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
                registration = null; // Reset for next attempt
              } else {
                console.log('[StopNotificationModal] ⚠️ Service worker not stable after retries - using client-side only');
                registration = null; // Fallback to client-side
              }
            }
          } else {
            // No registration yet - wait and retry
            if (attempt < 4) {
              console.log('[StopNotificationModal] ⏳ No registration yet, waiting...');
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              console.log('[StopNotificationModal] ⚠️ No service worker found - using client-side only');
              registration = null;
            }
          }
        } catch (swError) {
          console.error('[StopNotificationModal] ⚠️ Service worker error:', swError);
          if (attempt < 4) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            registration = null; // Fallback to client-side
          }
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
            applicationServerKey: vapidKeyArray,
          });
          
          // Check if endpoint is WNS - WNS doesn't support Web Push/VAPID
          const endpointUrl = new URL(subscription.endpoint);
          if (endpointUrl.hostname.includes('wns.') || endpointUrl.hostname.includes('notify.windows.com')) {
            console.warn('[StopNotificationModal] ⚠️ WNS endpoint detected - WNS doesn\'t support Web Push. Unsubscribing...');
            await subscription.unsubscribe();
            throw new Error('WNS endpoint not supported - please use Chrome, Firefox, or Edge (Chromium)');
          }
          
          console.log('[StopNotificationModal] ✅ Push subscription created');
        } catch (subError) {
          console.error('[StopNotificationModal] ❌ Push subscription failed:', subError);
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
        console.error('[StopNotificationModal] Error details:', JSON.stringify(upsertError, null, 2));
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
