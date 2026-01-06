import { useState, useEffect } from "react";
import { Bell, BellOff, Volume2, Vibrate, Mic, Send, X, Clock, AlertCircle, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
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

  // Check push support and iOS on mount
  useEffect(() => {
    const checkPushSupport = () => {
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setPushSupported(supported);
    };
    checkPushSupport();
    
    // Show iOS warning
    if (isIOS()) {
      setShowIOSWarning(true);
      // Disable vibration on iOS since it's not supported
      if (!vibrationSupported) {
        setVibration(false);
      }
    }
    
    // Unlock audio on user interaction (for iOS)
    unlockAudio();
  }, []);

  // Handle push toggle - request permission when enabled
  const handlePushToggle = async (checked: boolean) => {
    if (checked && pushSupported) {
      setIsSubscribingPush(true);
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setPush(true);
          toast({
            title: "✅ Ειδοποιήσεις ενεργοποιήθηκαν",
            description: "Θα λαμβάνετε push notifications όταν πλησιάζει το λεωφορείο",
          });
        } else {
          toast({
            title: "⚠️ Απαιτείται άδεια",
            description: "Παρακαλώ επιτρέψτε τις ειδοποιήσεις από τις ρυθμίσεις του browser",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
        toast({
          title: "Σφάλμα",
          description: "Δεν ήταν δυνατή η ενεργοποίηση ειδοποιήσεων",
          variant: "destructive",
        });
      } finally {
        setIsSubscribingPush(false);
      }
    } else {
      setPush(checked);
    }
  };

  const handleSave = () => {
    onSave({
      stopId,
      stopName,
      enabled,
      sound,
      vibration,
      voice,
      push,
      beforeMinutes,
    });
    onClose();
  };

  const handleRemove = () => {
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

                <div className="flex items-center justify-between py-2 bg-primary/5 -mx-1 px-3 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-3">
                    <Send className={`h-4 w-4 ${push ? 'text-primary' : 'text-muted-foreground'}`} />
                    <div>
                      <span className="text-sm font-medium">Push notification</span>
                      <p className="text-xs text-muted-foreground">
                        {pushSupported 
                          ? "Λαμβάνετε ειδοποιήσεις ακόμα και με κλειστή εφαρμογή" 
                          : "Μη διαθέσιμο σε αυτή τη συσκευή"
                        }
                      </p>
                    </div>
                  </div>
                  <Switch 
                    checked={push} 
                    onCheckedChange={handlePushToggle}
                    disabled={!pushSupported || isSubscribingPush}
                  />
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
