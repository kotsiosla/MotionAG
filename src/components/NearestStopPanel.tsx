import { useState, useCallback, useRef, useEffect } from "react";
import { X, MapPin, Navigation, Footprints, Clock, Loader2, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StopNotificationModal } from "@/components/StopNotificationModal";
import type { StaticStop } from "@/types/gtfs";
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

interface NearestStopPanelProps {
  stop: StaticStop;
  distance: number;
  arrivals: ArrivalInfo[];
  userLocation: { lat: number; lng: number };
  walkingRoute?: { distance: number; duration: number; geometry: Array<[number, number]> } | null;
  isLoadingRoute?: boolean;
  currentNotificationSettings?: StopNotificationSettings;
  onClose: () => void;
  onOpenDetails: () => void;
  onNavigate: () => void;
  onSaveNotification?: (settings: StopNotificationSettings) => void;
  onRemoveNotification?: (stopId: string) => void;
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

const formatDelay = (delay?: number) => {
  if (delay === undefined || delay === null) return '';
  const minutes = Math.round(delay / 60);
  if (minutes === 0) return '';
  if (minutes > 0) return `+${minutes}'`;
  return `${minutes}'`;
};

const formatWalkingTime = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '< 1 λεπτό';
  if (minutes === 1) return '1 λεπτό';
  return `${minutes} λεπτά`;
};

const formatWalkingDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} μ.`;
  return `${(meters / 1000).toFixed(1)} χλμ`;
};

export function NearestStopPanel({
  stop,
  distance,
  arrivals,
  userLocation,
  walkingRoute,
  isLoadingRoute,
  currentNotificationSettings,
  onClose,
  onOpenDetails,
  onNavigate,
  onSaveNotification,
  onRemoveNotification,
}: NearestStopPanelProps) {
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  
  // Dragging state
  const [position, setPosition] = useState({ x: window.innerWidth - 310, y: window.innerHeight - 280 });
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
      
      const newX = Math.max(0, Math.min(window.innerWidth - 290, dragStartRef.current.posX + deltaX));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, dragStartRef.current.posY + deltaY));
      
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

  const stopName = stop.stop_name || stop.stop_id;
  const stopId = stop.stop_id;

  const headerColor = '#6B8E23'; // Dark olive-green

  return (
    <>
      <div
        ref={panelRef}
        className="absolute z-[2000] bg-white border border-border rounded-xl shadow-2xl w-[280px] overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'auto',
        }}
      >
        {/* Header - draggable with dark olive-green */}
        <div
          className="flex items-center justify-between p-3 cursor-grab active:cursor-grabbing"
          style={{ backgroundColor: headerColor }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-lg bg-white/20 text-white flex items-center justify-center flex-shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-sm text-white truncate">{stopName}</h3>
              <p className="text-xs text-white/90 flex items-center gap-1">
                <Footprints className="h-3 w-3" />
                {isLoadingRoute ? (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Υπολογισμός...
                  </span>
                ) : walkingRoute ? (
                  <span>{formatWalkingDistance(walkingRoute.distance)} • {formatWalkingTime(walkingRoute.duration)}</span>
                ) : (
                  <span>{distance < 1000 ? `${Math.round(distance)} μ.` : `${(distance / 1000).toFixed(1)} χλμ`}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onSaveNotification && (
              <Button
                variant="ghost"
                size="icon"
                className={`h-6 w-6 text-white hover:bg-white/20 ${currentNotificationSettings?.enabled ? 'bg-white/20' : ''}`}
                onClick={() => setShowNotificationModal(true)}
                title="Ρυθμίσεις ειδοποίησης"
              >
                {currentNotificationSettings?.enabled ? (
                  <Bell className="h-3.5 w-3.5 text-white" />
                ) : (
                  <BellOff className="h-3.5 w-3.5 text-white/80" />
                )}
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white hover:bg-white/20" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Content - White background */}
        <ScrollArea className="max-h-[200px] bg-white">
          {/* Walking info */}
          {walkingRoute && (
            <div className="p-2 bg-blue-500/10 border-b border-border">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-blue-500">
                  <Footprints className="h-3.5 w-3.5" />
                  <span className="font-medium">Διαδρομή περπατήματος</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{formatWalkingDistance(walkingRoute.distance)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatWalkingTime(walkingRoute.duration)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Arrivals */}
          <div className="p-3 space-y-2">
            {arrivals.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted-foreground">
                Δεν υπάρχουν προγραμματισμένες αφίξεις
              </div>
            ) : (
              arrivals.slice(0, 4).map((arr, idx) => (
                <div
                  key={`${arr.tripId}-${idx}`}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <ConfidenceIndicator confidence={arr.confidence} source={arr.source} />
                    <Badge
                      className="text-white font-bold text-[10px] px-1.5"
                      style={{ backgroundColor: arr.routeColor ? `#${arr.routeColor}` : '#0ea5e9' }}
                    >
                      {arr.routeShortName || arr.routeId || '?'}
                    </Badge>
                    <span className="font-mono text-primary">{formatETA(arr.arrivalTime)}</span>
                    {arr.arrivalDelay !== undefined && arr.arrivalDelay !== 0 && (
                      <span className={`text-[10px] ${arr.arrivalDelay > 0 ? 'text-destructive' : 'text-green-500'}`}>
                        {formatDelay(arr.arrivalDelay)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className="p-2 border-t border-border bg-muted/30 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={onNavigate}
          >
            <Navigation className="h-3 w-3 mr-1" />
            Πλοήγηση
          </Button>
          <Button
            size="sm"
            className="flex-1 text-xs h-8"
            onClick={onOpenDetails}
          >
            Λεπτομέρειες
          </Button>
        </div>
      </div>

      {/* Notification Modal */}
      {showNotificationModal && onSaveNotification && onRemoveNotification && (
        <StopNotificationModal
          stopId={stopId}
          stopName={stopName}
          currentSettings={currentNotificationSettings}
          onSave={(settings) => {
            onSaveNotification(settings);
            setShowNotificationModal(false);
          }}
          onRemove={(id) => {
            onRemoveNotification(id);
            setShowNotificationModal(false);
          }}
          onClose={() => setShowNotificationModal(false)}
        />
      )}
    </>
  );
}
