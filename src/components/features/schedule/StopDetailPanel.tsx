
import { useState, useCallback, useRef, useEffect } from "react";
import { X, Bell, BellOff, Bus, Eye, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StopNotificationModal } from "@/components/features/user/StopNotificationModal";
import { toast } from "@/hooks/use-toast";

import type { StopNotificationSettings } from "@/hooks/useStopNotifications";

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
  if (minutes > 0) return `+ ${minutes}'`;
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
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  // Helper for route-specific notifications
  const toggleRouteNotification = (routeId: string) => {
    const isWatched = currentSettings?.watchedRoutes?.includes(routeId);
    let newWatchedRoutes = currentSettings?.watchedRoutes || [];

    if (isWatched) {
      newWatchedRoutes = newWatchedRoutes.filter(id => id !== routeId);
    } else {
      newWatchedRoutes = [...newWatchedRoutes, routeId];
    }

    const newSettings: StopNotificationSettings = currentSettings || {
      stopId,
      stopName,
      enabled: true,
      sound: true,
      vibration: true,
      voice: false,
      push: true,
      beforeMinutes: 5,
      notifyType: 'selected',
      watchedTrips: [],
      watchedRoutes: []
    };

    onSave({
      ...newSettings,
      watchedRoutes: newWatchedRoutes,
      // If we have watched routes, switch to 'selected' mode automatically
      notifyType: newWatchedRoutes.length > 0 ? 'selected' : 'all'
    });

    toast({
      title: isWatched ? "Ειδοποίηση αφαιρερέθηκε" : "Ειδοποίηση προστέθηκε",
      description: `Για τη γραμμή ${routeId} στη στάση ${stopName}`,
    });
  };

  const [position, setPosition] = useState({ x: 60, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

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
    <>
      <div
        ref={panelRef}
        className="absolute z-[2000] bg-white border border-border rounded-xl shadow-2xl w-[300px] max-h-[70vh] overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'auto',
        }}
      >
        {/* Header - draggable */}
        <div
          className="stop-panel-header"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-white/20 text-white flex items-center justify-center flex-shrink-0">
              <Bus className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm text-white truncate">{stopName}</h3>
              <p className="text-xs text-white/90">
                {arrivals.length > 0 ? `${arrivals.length} αφίξεις` : 'Δεν υπάρχουν αφίξεις'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 text-white hover:bg-white/20 ${currentSettings?.enabled ? 'bg-white/20' : ''}`}
              onClick={() => setShowNotificationModal(true)}
              title="Ρυθμίσεις ειδοποίησης"
            >
              {currentSettings?.enabled ? (
                <Bell className="h-3.5 w-3.5 text-white" />
              ) : (
                <BellOff className="h-3.5 w-3.5 text-white/80" />
              )}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content - White background */}
        <ScrollArea className="max-h-[calc(70vh-56px)] bg-white">
          <div className="p-4 space-y-2">
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
                  {/* Route Header */}
                  <div className="w-full flex items-center p-1 bg-muted/30">
                    <button
                      className="flex-1 flex items-center gap-2 p-1.5 hover:bg-muted/50 rounded-md transition-colors text-left"
                      onClick={() => onFollowRoute(group.routeId)}
                    >
                      <Badge
                        className="route-badge route-badge-sm"
                        style={{ "--route-color": group.routeColor ? `#${group.routeColor}` : undefined } as React.CSSProperties}
                      >
                        {group.routeShortName || group.routeId}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground truncate">
                        Παρακολούθηση
                      </span>
                      <Eye className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    </button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 flex-shrink-0 ml-1 ${currentSettings?.watchedRoutes?.includes(group.routeId) ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:bg-muted/50'}`}
                      onClick={() => toggleRouteNotification(group.routeId)}
                      title={currentSettings?.watchedRoutes?.includes(group.routeId) ? "Απενεργοποίηση ειδοποίησης γραμμής" : "Ενεργοποίηση ειδοποίησης γραμμής"}
                    >
                      <Bell className={`h-3.5 w-3.5 ${currentSettings?.watchedRoutes?.includes(group.routeId) ? 'fill-current' : ''}`} />
                    </Button>
                  </div>

                  {/* Arrivals list */}
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

      {showNotificationModal && (
        <StopNotificationModal
          stopId={stopId}
          stopName={stopName}
          arrivals={arrivals}
          currentSettings={currentSettings}
          onSave={(settings) => {
            onSave(settings);
            setShowNotificationModal(false);
          }}
          onRemove={(id) => {
            onRemove(id);
            setShowNotificationModal(false);
          }}
          onClose={() => setShowNotificationModal(false)}
        />
      )}
    </>
  );
}
