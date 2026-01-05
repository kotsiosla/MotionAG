import { useState, useCallback, useRef, useEffect } from "react";
import { X, Bell, BellOff, Volume2, Vibrate, Mic, Send, Clock, Bus, Eye, Navigation, Signal, SignalHigh, SignalMedium, SignalLow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { StopNotificationSettings } from "@/hooks/useStopNotifications";
import type { Trip, Vehicle, RouteInfo } from "@/types/gtfs";

interface ArrivalInfo {
  tripId: string;
  routeId?: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  arrivalTime?: number;
  arrivalDelay?: number;
  vehicleId?: string;
  vehicleLabel?: string;
  confidence?: 'high' | 'medium' | 'low';
  source?: 'gtfs' | 'siri' | 'merged';
}

// Confidence indicator component
const ConfidenceIndicator = ({ confidence, source }: { confidence?: 'high' | 'medium' | 'low'; source?: string }) => {
  if (!confidence) return null;
  
  const config = {
    high: { color: 'text-green-500', bg: 'bg-green-500/20', label: 'Υψηλή ακρίβεια', icon: '●●●' },
    medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/20', label: 'Μέτρια ακρίβεια', icon: '●●○' },
    low: { color: 'text-red-500', bg: 'bg-red-500/20', label: 'Χαμηλή ακρίβεια', icon: '●○○' },
  };
  
  const { color, bg, label, icon } = config[confidence];
  const sourceLabel = source === 'siri' ? ' (SIRI)' : source === 'merged' ? ' (Συνδυασμός)' : ' (GPS)';
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold ${color} ${bg}`}>
            {icon}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>{label}{sourceLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

interface StopDetailPanelProps {
  stopId: string;
  stopName: string;
  arrivals: ArrivalInfo[];
  currentSettings?: StopNotificationSettings;
  onSave: (settings: StopNotificationSettings) => void;
  onRemove: (stopId: string) => void;
  onClose: () => void;
  onFollowRoute: (routeId: string) => void;
  onTrackVehicle?: (vehicleId: string) => void;
}

const formatETA = (arrivalTime?: number) => {
  if (!arrivalTime) return '--:--';
  const date = new Date(arrivalTime * 1000);
  return date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatMinutesUntil = (arrivalTime?: number) => {
  if (!arrivalTime) return '--';
  const now = Math.floor(Date.now() / 1000);
  const minutes = Math.round((arrivalTime - now) / 60);
  if (minutes <= 0) return 'Τώρα';
  if (minutes === 1) return '1 λεπτό';
  return `${minutes} λεπτά`;
};

const formatDelay = (delay?: number) => {
  if (delay === undefined || delay === null) return '';
  const minutes = Math.round(delay / 60);
  if (minutes === 0) return '';
  if (minutes > 0) return `+${minutes}'`;
  return `${minutes}'`;
};

export function StopDetailPanel({
  stopId,
  stopName,
  arrivals,
  currentSettings,
  onSave,
  onRemove,
  onClose,
  onFollowRoute,
  onTrackVehicle,
}: StopDetailPanelProps) {
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [enabled, setEnabled] = useState(currentSettings?.enabled ?? true);
  const [sound, setSound] = useState(currentSettings?.sound ?? true);
  const [vibration, setVibration] = useState(currentSettings?.vibration ?? true);
  const [voice, setVoice] = useState(currentSettings?.voice ?? false);
  const [push, setPush] = useState(currentSettings?.push ?? false);
  const [beforeMinutes, setBeforeMinutes] = useState(currentSettings?.beforeMinutes ?? 3);
  
  // Dragging state
  const [position, setPosition] = useState({ x: 60, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

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
    setShowNotificationSettings(false);
  };

  const handleRemove = () => {
    onRemove(stopId);
    setShowNotificationSettings(false);
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      
      const newX = Math.max(0, Math.min(window.innerWidth - 320, dragStartRef.current.posX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 200, dragStartRef.current.posY + deltaY));
      
      setPosition({ x: newX, y: newY });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Filter and group arrivals by route
  const validArrivals = arrivals.filter(a => a.routeId && a.arrivalTime);
  const arrivalsByRoute = validArrivals.reduce((acc, arrival) => {
    const key = arrival.routeId!;
    if (!acc[key]) {
      acc[key] = {
        routeId: arrival.routeId!,
        routeShortName: arrival.routeShortName,
        routeColor: arrival.routeColor,
        arrivals: [],
      };
    }
    acc[key].arrivals.push(arrival);
    return acc;
  }, {} as Record<string, { routeId: string; routeShortName?: string; routeColor?: string; arrivals: ArrivalInfo[] }>);

  const routeGroups = Object.values(arrivalsByRoute);

  return (
    <div
      ref={panelRef}
      className="fixed z-[2000] bg-background border border-border rounded-xl shadow-2xl w-[300px] max-h-[70vh] overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'auto',
      }}
    >
      {/* Header - draggable */}
      <div
        className="flex items-center justify-between p-3 border-b border-border bg-muted/50 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center flex-shrink-0">
            <Bus className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{stopName}</h3>
            <p className="text-[10px] text-muted-foreground">
              {arrivals.length > 0 ? `${arrivals.length} αφίξεις` : 'Δεν υπάρχουν αφίξεις'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowNotificationSettings(!showNotificationSettings)}
            title="Ρυθμίσεις ειδοποίησης"
          >
            {currentSettings?.enabled ? (
              <Bell className="h-3.5 w-3.5 text-primary" />
            ) : (
              <BellOff className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[calc(70vh-56px)]">
        {/* Notification Settings Section */}
        {showNotificationSettings && (
          <div className="p-3 border-b border-border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Ειδοποίηση ενεργή</Label>
              <Switch checked={enabled} onCheckedChange={setEnabled} className="scale-90" />
            </div>

            {enabled && (
              <>
                <div className="space-y-2 p-2 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <Label className="text-xs">Πριν από</Label>
                    </div>
                    <span className="font-mono font-bold text-xs text-primary">{beforeMinutes}'</span>
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

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <Volume2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px]">Ήχος</span>
                    </div>
                    <Switch checked={sound} onCheckedChange={setSound} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <Vibrate className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px]">Δόνηση</span>
                    </div>
                    <Switch checked={vibration} onCheckedChange={setVibration} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <Mic className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px]">Φωνή</span>
                    </div>
                    <Switch checked={voice} onCheckedChange={setVoice} className="scale-75" />
                  </div>
                  <div className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <Send className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px]">Push</span>
                    </div>
                    <Switch checked={push} onCheckedChange={setPush} className="scale-75" />
                  </div>
                </div>

                <div className="flex gap-2">
                  {currentSettings && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemove}
                      className="text-destructive hover:text-destructive text-xs h-7 flex-1"
                    >
                      <BellOff className="h-3 w-3 mr-1" />
                      Αφαίρεση
                    </Button>
                  )}
                  <Button size="sm" onClick={handleSave} className="text-xs h-7 flex-1">
                    <Bell className="h-3 w-3 mr-1" />
                    Αποθήκευση
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Routes & Arrivals */}
        <div className="p-3 space-y-2">
          {routeGroups.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              Δεν υπάρχουν προγραμματισμένες αφίξεις
            </div>
          ) : (
            routeGroups.map((group) => (
              <div
                key={group.routeId}
                className="rounded-lg border border-border overflow-hidden"
              >
                {/* Route Header - clickable to follow */}
                <button
                  className="w-full flex items-center gap-2 p-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                  onClick={() => onFollowRoute(group.routeId)}
                >
                  <Badge
                    className="text-white font-bold text-[10px] px-1.5"
                    style={{ backgroundColor: group.routeColor ? `#${group.routeColor}` : '#0ea5e9' }}
                  >
                    {group.routeShortName || group.routeId}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex-1 text-left">
                    Πατήστε για παρακολούθηση
                  </span>
                  <Eye className="h-3 w-3 text-muted-foreground" />
                </button>

                {/* Arrivals for this route */}
                <div className="divide-y divide-border">
                  {group.arrivals.slice(0, 3).map((arrival, idx) => (
                    <div
                      key={`${arrival.tripId}-${idx}`}
                      className="flex items-center justify-between p-2 hover:bg-muted/20 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ConfidenceIndicator confidence={arrival.confidence} source={arrival.source} />
                        <div className="text-sm font-mono font-semibold text-primary">
                          {formatETA(arrival.arrivalTime)}
                        </div>
                        {arrival.arrivalDelay !== undefined && arrival.arrivalDelay !== 0 && (
                          <span className={`text-[10px] ${arrival.arrivalDelay > 0 ? 'text-destructive' : 'text-green-500'}`}>
                            {formatDelay(arrival.arrivalDelay)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {formatMinutesUntil(arrival.arrivalTime)}
                        </span>
                        {arrival.vehicleId && onTrackVehicle && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onTrackVehicle(arrival.vehicleId!)}
                            title="Παρακολούθηση οχήματος"
                          >
                            <Navigation className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
