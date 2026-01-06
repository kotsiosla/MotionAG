import { useState, useEffect } from "react";
import { Bell, BellOff, Volume2, Vibrate, Mic, Send, X, Clock, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { StopNotificationSettings } from "@/hooks/useStopNotifications";
import { unlockAudio, playSound, vibrate } from "@/hooks/useStopArrivalNotifications";

interface StopNotificationModalProps {
  stopId: string;
  stopName: string;
  currentSettings?: StopNotificationSettings;
  onSave: (settings: StopNotificationSettings) => void;
  onRemove: (stopId: string) => void;
  onClose: () => void;
}

// VAPID public key
const VAPID_PUBLIC_KEY = 'BOY7TtDjqW97iKphI_H198l6XVX5_JV2msRrSPs8yz7JsVyJmyTTQh1sX8D43CyUpEzEktYTfsiC238Vi2QGjJ0';

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

// Detect iOS
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || 
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// Check if vibration is supported
const vibrationSupported = 'vibrate' in navigator && typeof navigator.vibrate === 'function';

export function StopNotificationModal({
  stopId,
  stopName,
  currentSettings,
  onSave,
  onRemove,
  onClose,
}: StopNotificationModalProps) {
  const [enabled, setEnabled] = useState(currentSettings?.enabled ?? true);
  const [sound, setSound] = useState(currentSettings?.sound ?? true);
  const [vibration, setVibration] = useState(currentSettings?.vibration ?? vibrationSupported);
  const [voice, setVoice] = useState(currentSettings?.voice ?? false);
  const [push, setPush] = useState(currentSettings?.push ?? false);
  const [beforeMinutes, setBeforeMinutes] = useState(currentSettings?.beforeMinutes ?? 3);
  const [pushSupported, setPushSupported] = useState(true);
  const [isSubscribingPush, setIsSubscribingPush] = useState(false);
  const [showIOSWarning, setShowIOSWarning] = useState(false);
  const [hasExistingSubscription, setHasExistingSubscription] = useState(false);

  // Check push support and existing subscription on mount
  useEffect(() => {
    const checkPushSupport = async () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setPushSupported(supported);
      
      if (supported) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setHasExistingSubscription(!!subscription);
          console.log('[StopNotificationModal] Existing subscription:', !!subscription);
        } catch (e) {
          console.error('[StopNotificationModal] Error checking subscription:', e);
        }
      }
    };
    checkPushSupport();
    
    // Show iOS warning
    if (isIOS()) {
      setShowIOSWarning(true);
      if (!vibrationSupported) {
        setVibration(false);
      }
    }
    
    // Unlock audio on user interaction (for iOS)
    unlockAudio();
  }, []);

  // Create or get push subscription and save to database
  const createPushSubscription = async (): Promise<boolean> => {
    try {
      console.log('[StopNotificationModal] Creating push subscription...');
      
      // Request permission first
      const permission = await Notification.requestPermission();
      console.log('[StopNotificationModal] Permission:', permission);
      
      if (permission !== 'granted') {
        toast({
          title: "⚠️ Απαιτείται άδεια",
          description: "Παρακαλώ επιτρέψτε τις ειδοποιήσεις από τις ρυθμίσεις του browser",
          variant: "destructive",
        });
        return false;
      }

      // Register service worker
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      console.log('[StopNotificationModal] Service Worker ready');

      // Get or create subscription
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        console.log('[StopNotificationModal] Creating new subscription...');
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        console.log('[StopNotificationModal] Created new subscription:', subscription.endpoint);
      } else {
        console.log('[StopNotificationModal] Using existing subscription:', subscription.endpoint);
      }

      // Extract keys
      const p256dhKey = subscription.getKey('p256dh');
      const authKey = subscription.getKey('auth');
      
      if (!p256dhKey || !authKey) {
        throw new Error('Failed to get subscription keys');
      }
      
      const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
      const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

      console.log('[StopNotificationModal] Keys extracted, endpoint:', subscription.endpoint.substring(0, 50) + '...');

      return true;
    } catch (error) {
      console.error('[StopNotificationModal] Error creating subscription:', error);
      toast({
        title: "Σφάλμα",
        description: "Δεν ήταν δυνατή η ενεργοποίηση ειδοποιήσεων: " + (error as Error).message,
        variant: "destructive",
      });
      return false;
    }
  };

  // Handle push toggle
  const handlePushToggle = async (checked: boolean) => {
    if (checked && pushSupported) {
      setIsSubscribingPush(true);
      try {
        const success = await createPushSubscription();
        if (success) {
          setPush(true);
          toast({
            title: "✅ Push ειδοποιήσεις ενεργοποιήθηκαν",
            description: "Θα λαμβάνετε ειδοποιήσεις ακόμα και με κλειστή εφαρμογή",
          });
        }
      } finally {
        setIsSubscribingPush(false);
      }
    } else {
      setPush(checked);
    }
  };

  const handleSave = async () => {
    const settings: StopNotificationSettings = {
      stopId,
      stopName,
      enabled,
      sound,
      vibration,
      voice,
      push,
      beforeMinutes,
    };

    // If push is enabled, sync to server immediately
    if (push && enabled) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          const p256dhKey = subscription.getKey('p256dh');
          const authKey = subscription.getKey('auth');
          
          if (p256dhKey && authKey) {
            const p256dh = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(p256dhKey))));
            const auth = btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(authKey))));

            // Get all existing notifications from localStorage
            const stored = localStorage.getItem('stop_notifications');
            let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
            
            // Update or add the current notification
            const existingIndex = allNotifications.findIndex(n => n.stopId === stopId);
            if (existingIndex >= 0) {
              allNotifications[existingIndex] = settings;
            } else {
              allNotifications.push(settings);
            }

            // Filter only push-enabled notifications
            const pushNotifications = allNotifications.filter(n => n.enabled && n.push);

            console.log('[StopNotificationModal] Saving to server:', pushNotifications.length, 'notifications');
            console.log('[StopNotificationModal] Endpoint:', subscription.endpoint.substring(0, 50) + '...');

            // Check if subscription exists
            const { data: existing } = await supabase
              .from('stop_notification_subscriptions')
              .select('id')
              .eq('endpoint', subscription.endpoint)
              .maybeSingle();

            if (existing) {
              const { error } = await supabase
                .from('stop_notification_subscriptions')
                .update({
                  p256dh,
                  auth,
                  stop_notifications: pushNotifications as any,
                  updated_at: new Date().toISOString(),
                })
                .eq('endpoint', subscription.endpoint);

              if (error) {
                console.error('[StopNotificationModal] Update error:', error);
                throw error;
              }
              console.log('[StopNotificationModal] Updated subscription in database');
            } else {
              const { error } = await supabase
                .from('stop_notification_subscriptions')
                .insert([{
                  endpoint: subscription.endpoint,
                  p256dh,
                  auth,
                  stop_notifications: pushNotifications as any,
                }]);

              if (error) {
                console.error('[StopNotificationModal] Insert error:', error);
                throw error;
              }
              console.log('[StopNotificationModal] Inserted new subscription in database');
            }

            toast({
              title: "✅ Αποθηκεύτηκε",
              description: "Οι ρυθμίσεις ειδοποιήσεων αποθηκεύτηκαν στον server",
            });
          }
        }
      } catch (error) {
        console.error('[StopNotificationModal] Error saving to server:', error);
        toast({
          title: "⚠️ Προσοχή",
          description: "Οι ρυθμίσεις αποθηκεύτηκαν τοπικά αλλά όχι στον server",
          variant: "destructive",
        });
      }
    }

    onSave(settings);
    onClose();
  };

  const handleRemove = async () => {
    // Remove from server if push was enabled
    if (currentSettings?.push) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
          // Get remaining notifications
          const stored = localStorage.getItem('stop_notifications');
          let allNotifications: StopNotificationSettings[] = stored ? JSON.parse(stored) : [];
          const remaining = allNotifications.filter(n => n.stopId !== stopId && n.enabled && n.push);

          if (remaining.length > 0) {
            // Update with remaining notifications
            await supabase
              .from('stop_notification_subscriptions')
              .update({ stop_notifications: remaining as any })
              .eq('endpoint', subscription.endpoint);
          } else {
            // Delete subscription entirely
            await supabase
              .from('stop_notification_subscriptions')
              .delete()
              .eq('endpoint', subscription.endpoint);
          }
        }
      } catch (error) {
        console.error('[StopNotificationModal] Error removing from server:', error);
      }
    }

    onRemove(stopId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background border border-border rounded-xl shadow-2xl w-[90%] max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Ειδοποιήσεις Στάσης</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{stopName}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Master toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {enabled ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label className="font-medium">Ενεργοποίηση</Label>
                <p className="text-xs text-muted-foreground">Ειδοποίηση πριν τη στάση</p>
              </div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {enabled && (
            <>
              {/* Before minutes slider */}
              <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Label className="text-sm">Πριν από</Label>
                  </div>
                  <span className="font-mono font-bold text-primary">{beforeMinutes} λεπτά</span>
                </div>
                <Slider
                  value={[beforeMinutes]}
                  onValueChange={(v) => setBeforeMinutes(v[0])}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>

              {/* iOS Warning */}
              {showIOSWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <Smartphone className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    <strong>iOS:</strong> Η δόνηση δεν υποστηρίζεται. Ο ήχος και οι ειδοποιήσεις λειτουργούν μόνο με την εφαρμογή ανοιχτή ή εγκατεστημένη στην Αρχική Οθόνη.
                  </div>
                </div>
              )}

              {/* Notification types */}
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Τύποι ειδοποίησης
                </Label>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Volume2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Ήχος</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        unlockAudio();
                        playSound('medium');
                        toast({ title: "🔊 Δοκιμή ήχου" });
                      }}
                    >
                      Δοκιμή
                    </Button>
                    <Switch checked={sound} onCheckedChange={setSound} />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Vibrate className={`h-4 w-4 ${!vibrationSupported ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
                    <div>
                      <span className={`text-sm ${!vibrationSupported ? 'text-muted-foreground/50' : ''}`}>Δόνηση</span>
                      {!vibrationSupported && (
                        <p className="text-xs text-muted-foreground">Δεν υποστηρίζεται σε iOS</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {vibrationSupported && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          vibrate('medium');
                          toast({ title: "📳 Δοκιμή δόνησης" });
                        }}
                      >
                        Δοκιμή
                      </Button>
                    )}
                    <Switch 
                      checked={vibration} 
                      onCheckedChange={setVibration}
                      disabled={!vibrationSupported}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Φωνητική αναγγελία</span>
                  </div>
                  <Switch checked={voice} onCheckedChange={setVoice} />
                </div>

                {/* PUSH NOTIFICATION - HIGHLIGHTED */}
                <div className={`flex items-center justify-between py-3 px-3 rounded-lg border ${push ? 'bg-green-500/10 border-green-500/30' : 'bg-primary/5 border-primary/20'}`}>
                  <div className="flex items-center gap-3">
                    <Send className={`h-4 w-4 ${push ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <div>
                      <span className="text-sm font-medium">Push notification</span>
                      <p className="text-xs text-muted-foreground">
                        {!pushSupported 
                          ? "Μη διαθέσιμο σε αυτή τη συσκευή"
                          : push 
                            ? "✅ Ενεργό - θα λαμβάνετε ειδοποιήσεις"
                            : "Λαμβάνετε ειδοποιήσεις ακόμα και με κλειστή εφαρμογή"
                        }
                      </p>
                    </div>
                  </div>
                  {isSubscribingPush ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Switch 
                      checked={push} 
                      onCheckedChange={handlePushToggle}
                      disabled={!pushSupported}
                    />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border bg-muted/30">
          {currentSettings ? (
            <Button variant="ghost" size="sm" onClick={handleRemove} className="text-destructive hover:text-destructive">
              <BellOff className="h-4 w-4 mr-2" />
              Αφαίρεση
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Ακύρωση
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Bell className="h-4 w-4 mr-2" />
              Αποθήκευση
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
