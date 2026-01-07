import { useState, useCallback, useRef, useEffect } from "react";
import { X, Bus, MapPin, Clock, Route, ChevronDown, ChevronUp, Navigation, Eye, Maximize2, Focus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Vehicle, Trip, StaticStop, RouteInfo } from "@/types/gtfs";

interface VehicleFollowPanelProps {
  vehicle: Vehicle;
  routeInfo?: RouteInfo;
  nextStop?: {
    stopName: string;
    arrivalTime?: number;
    arrivalDelay?: number;
  } | null;
  viewMode: 'street' | 'overview';
  onClose: () => void;
  onSwitchToStreet: () => void;
  onSwitchToOverview: () => void;
}

const formatETA = (arrivalTime?: number) => {
  if (!arrivalTime) return '--:--';
  const date = new Date(arrivalTime * 1000);
  return date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hour12: false,
  });
};

const formatMinutesUntil = (arrivalTime?: number) => {
  if (!arrivalTime) return null;
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

export function VehicleFollowPanel({
  vehicle,
  routeInfo,
  nextStop,
  viewMode,
  onClose,
  onSwitchToStreet,
  onSwitchToOverview,
}: VehicleFollowPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Dragging state
  const [position, setPosition] = useState({ x: 16, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    
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
      
      const newX = Math.max(8, Math.min(window.innerWidth - 320, dragStartRef.current.posX + deltaX));
      const newY = Math.max(8, Math.min(window.innerHeight - 150, dragStartRef.current.posY + deltaY));
      
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

  const vehicleId = vehicle.vehicleId || vehicle.id;
  const routeColor = routeInfo?.route_color ? `#${routeInfo.route_color}` : '#0ea5e9';
  const minutesUntil = formatMinutesUntil(nextStop?.arrivalTime);

  return (
    <div
      ref={panelRef}
      className="absolute z-[1200] bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-2xl w-[300px] overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'auto',
      }}
    >
      {/* Header - draggable */}
      <div
        className="flex items-center gap-2 p-2 cursor-grab active:cursor-grabbing"
        style={{ backgroundColor: routeColor }}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
      >
        {/* Route badge */}
        <div className="flex items-center justify-center min-w-[32px] h-8 rounded-lg bg-white/20 text-white font-bold text-sm px-2">
          {routeInfo?.route_short_name || vehicle.routeId || '?'}
        </div>
        
        {/* Route name */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-xs text-white truncate">
            {routeInfo?.route_long_name || `Γραμμή ${vehicle.routeId || ''}`}
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-white/80">
            <Clock className="h-3 w-3" />
            {vehicle.timestamp ? (
              <span>
                {new Date(vehicle.timestamp * 1000).toLocaleTimeString('el-GR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
                })}
              </span>
            ) : (
              <span>--:--:--</span>
            )}
            <span className="mx-1">•</span>
            <Bus className="h-3 w-3" />
            <span>{vehicle.label || vehicleId}</span>
          </div>
        </div>

        {/* Collapse/Expand */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </Button>
        
        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3 space-y-3">
          {/* Next stop info */}
          {nextStop && (
            <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: routeColor }}>
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-muted-foreground">Επόμενη στάση</div>
                <div className="font-medium text-sm truncate">{nextStop.stopName}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-sm" style={{ color: routeColor }}>
                  {formatETA(nextStop.arrivalTime)}
                </div>
                {minutesUntil && (
                  <div className="text-[10px] text-muted-foreground flex items-center justify-end gap-1">
                    {minutesUntil}
                    {nextStop.arrivalDelay !== undefined && nextStop.arrivalDelay !== 0 && (
                      <span className={nextStop.arrivalDelay > 0 ? 'text-destructive' : 'text-green-500'}>
                        {formatDelay(nextStop.arrivalDelay)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* View mode toggle */}
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'street' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={onSwitchToStreet}
            >
              <Focus className="h-3.5 w-3.5" />
              Κοντινή
            </Button>
            <Button
              variant={viewMode === 'overview' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 h-8 text-xs gap-1.5"
              onClick={onSwitchToOverview}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Επισκόπηση
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
