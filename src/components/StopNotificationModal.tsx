import { useState, useEffect } from "react";
import { Bell, BellOff, Volume2, Vibrate, Mic, Send, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { StopNotificationSettings } from "@/hooks/useStopNotifications";

interface StopNotificationModalProps {
  stopId: string;
  stopName: string;
  currentSettings?: StopNotificationSettings;
  onSave: (settings: StopNotificationSettings) => void;
  onRemove: (stopId: string) => void;
  onClose: () => void;
}

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
  const [vibration, setVibration] = useState(currentSettings?.vibration ?? true);
  const [voice, setVoice] = useState(currentSettings?.voice ?? false);
  const [push, setPush] = useState(currentSettings?.push ?? false);
  const [beforeMinutes, setBeforeMinutes] = useState(currentSettings?.beforeMinutes ?? 3);

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
                  <Switch checked={sound} onCheckedChange={setSound} />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Vibrate className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Δόνηση</span>
                  </div>
                  <Switch checked={vibration} onCheckedChange={setVibration} />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Mic className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Φωνητική αναγγελία</span>
                  </div>
                  <Switch checked={voice} onCheckedChange={setVoice} />
                </div>

                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Push notification</span>
                  </div>
                  <Switch checked={push} onCheckedChange={setPush} />
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
