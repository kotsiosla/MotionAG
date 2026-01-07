import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { X, Bus, MapPin, Clock, ChevronDown, ChevronUp, Radio, Calendar, Eye, Focus, Maximize2, ArrowLeftRight, ChevronLeft, ChevronRight, Loader2, GripVertical, Bell, Route, BellOff, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableDraggablePanel } from "@/components/ResizableDraggablePanel";
import { StopNotificationModal } from "@/components/StopNotificationModal";
import { useRouteShape } from "@/hooks/useGtfsData";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStopNotifications } from "@/hooks/useStopNotifications";
import { cn } from "@/lib/utils";
import type { Vehicle, Trip, StaticStop, RouteInfo, StopTimeUpdate } from "@/types/gtfs";

interface UnifiedRoutePanelProps {
  routeId: string;
  routeInfo?: RouteInfo;
  trips: Trip[];
  vehicles: Vehicle[];
  stops: StaticStop[];
  selectedOperator?: string;
  followedVehicle?: Vehicle | null; // If following a specific vehicle
  nextStop?: { stopName: string; arrivalTime?: number; arrivalDelay?: number } | null;
  viewMode?: 'street' | 'overview';
  onClose: () => void;
  onStopClick?: (stopId: string) => void;
  onVehicleFollow?: (vehicleId: string) => void;
  onVehicleFocus?: (vehicle: Vehicle) => void;
  onSwitchToStreet?: () => void;
  onSwitchToOverview?: () => void;
}

const STOPS_PER_PAGE = 8;
const STOPS_PER_PAGE_MOBILE = 6;

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

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

const getTimeUntilArrival = (arrivalTime?: number) => {
  if (!arrivalTime) return null;
  const now = Math.floor(Date.now() / 1000);
  const minutes = Math.round((arrivalTime - now) / 60);
  if (minutes <= 0) return 'Τώρα';
  if (minutes === 1) return '1 λεπτό';
  return `${minutes} λεπτά`;
};

// Calculate total route distance in kilometers using Haversine formula
const calculateRouteDistance = (shape: Array<{ lat: number; lng: number }>): number => {
  if (!shape || shape.length < 2) return 0;
  
  let totalDistance = 0; // in meters
  const R = 6371000; // Earth's radius in meters
  
  for (let i = 0; i < shape.length - 1; i++) {
    const p1 = shape[i];
    const p2 = shape[i + 1];
    
    const φ1 = (p1.lat * Math.PI) / 180;
    const φ2 = (p2.lat * Math.PI) / 180;
    const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180;
    const Δλ = ((p2.lng - p1.lng) * Math.PI) / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    totalDistance += R * c;
  }
  
  // Convert to kilometers and round to 1 decimal
  return Math.round((totalDistance / 1000) * 10) / 10;
};

export function UnifiedRoutePanel({
  routeId,
  routeInfo,
  trips = [],
  vehicles = [],
  stops = [],
  selectedOperator,
  followedVehicle,
  nextStop,
  viewMode = 'overview',
  onClose,
  onStopClick,
  onVehicleFollow,
  onVehicleFocus,
  onSwitchToStreet,
  onSwitchToOverview,
}: UnifiedRoutePanelProps) {
  const isMobile = useIsMobile();
  const [activeTab, setActiveTab] = useState<'stops' | 'live' | 'planner'>('stops');
  
  // Safety check - don't render if no routeId
  if (!routeId || routeId === 'all') {
    return null;
  }
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedDirection, setSelectedDirection] = useState(0);
  const [selectedStopForNotification, setSelectedStopForNotification] = useState<{ stopId: string; stopName: string } | null>(null);
  const stopsScrollRef = useRef<HTMLDivElement>(null);
  const { getNotification: getStopNotification, setNotification: saveStopNotification, removeNotification: removeStopNotification } = useStopNotifications();

  // Always use dark olive-green header color (consistent across all panels)
  const headerColor = '#6B8E23';
  const routeColor = routeInfo?.route_color ? `#${routeInfo.route_color}` : '#0ea5e9';

  // Fetch static route shape data
  const { data: routeShapeData, isLoading: isLoadingShape } = useRouteShape(routeId, selectedOperator);

  // Find trips for this route
  const routeTrips = useMemo(() => {
    return trips.filter(t => t.routeId === routeId);
  }, [trips, routeId]);

  // Get vehicles on this route
  const routeVehicles = useMemo(() => {
    return vehicles.filter(v => v.routeId === routeId && v.latitude && v.longitude);
  }, [vehicles, routeId]);

  // Find active trip (prioritize followed vehicle's trip)
  const activeTrip = useMemo(() => {
    if (followedVehicle?.tripId) {
      const trip = trips.find(t => t.tripId === followedVehicle.tripId);
      if (trip) return trip;
    }
    // Otherwise find trip with stop time updates
    return routeTrips.find(t => 
      t.stopTimeUpdates && t.stopTimeUpdates.length > 0
    ) || routeTrips[0];
  }, [followedVehicle, trips, routeTrips]);

  // Create stop map
  const stopMap = useMemo(() => {
    const map = new Map<string, StaticStop>();
    stops.forEach(stop => map.set(stop.stop_id, stop));
    return map;
  }, [stops]);

  // Get route stops with realtime data
  const routeStops = useMemo(() => {
    if (routeShapeData?.directions?.length > 0) {
      const direction = routeShapeData.directions[selectedDirection] || routeShapeData.directions[0];
      if (direction?.stops?.length > 0) {
        const realtimeInfo = new Map<string, { arrivalTime?: number; arrivalDelay?: number }>();
        if (activeTrip?.stopTimeUpdates) {
          activeTrip.stopTimeUpdates.forEach(stu => {
            if (stu.stopId) {
              realtimeInfo.set(stu.stopId, {
                arrivalTime: stu.arrivalTime,
                arrivalDelay: stu.arrivalDelay,
              });
            }
          });
        }

        return direction.stops
          .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0))
          .map((stop, index) => {
            const realtime = realtimeInfo.get(stop.stop_id);
            const staticStop = stopMap.get(stop.stop_id);
            return {
              stopId: stop.stop_id,
              stopName: stop.stop_name || staticStop?.stop_name || stop.stop_id,
              stopSequence: stop.stop_sequence || index,
              arrivalTime: realtime?.arrivalTime,
              arrivalDelay: realtime?.arrivalDelay,
              isFirst: index === 0,
              isLast: index === direction.stops.length - 1,
            };
          });
      }
    }
    return [];
  }, [routeShapeData, selectedDirection, activeTrip, stopMap]);

  // Pagination for stops
  const stopsPerPage = isMobile ? STOPS_PER_PAGE_MOBILE : STOPS_PER_PAGE;
  const totalPages = Math.ceil(routeStops.length / stopsPerPage);
  const paginatedStops = useMemo(() => {
    const start = currentPage * stopsPerPage;
    return routeStops.slice(start, start + stopsPerPage);
  }, [routeStops, currentPage, stopsPerPage]);

  // Live trips with vehicles
  const liveTripsWithVehicles = useMemo(() => {
    return routeTrips
      .map(trip => {
        const vehicle = routeVehicles.find(v => v.tripId === trip.tripId);
        if (!vehicle) return null;
        
        // Get next stop
        const now = Math.floor(Date.now() / 1000);
        const nextUpdate = trip.stopTimeUpdates?.find(stu => (stu.arrivalTime || 0) > now);
        const nextStopName = nextUpdate?.stopId 
          ? (stopMap.get(nextUpdate.stopId)?.stop_name || nextUpdate.stopId)
          : null;

        return {
          trip,
          vehicle,
          nextStop: nextStopName,
          nextArrivalTime: nextUpdate?.arrivalTime,
        };
      })
      .filter(Boolean) as Array<{ trip: Trip; vehicle: Vehicle; nextStop: string | null; nextArrivalTime?: number }>;
  }, [routeTrips, routeVehicles, stopMap]);

  // Vehicle info for header
  const vehicleId = followedVehicle?.vehicleId || followedVehicle?.id;
  const vehicleLabel = followedVehicle?.label || vehicleId || null;

  // Available directions
  const availableDirections = routeShapeData?.directions?.length > 0 
    ? Array.from({ length: routeShapeData.directions.length }, (_, i) => i)
    : [];

  // Get route stats
  const vehicleCount = routeVehicles.length;
  const liveCount = liveTripsWithVehicles.length;

  // Calculate total route distance for current direction
  const routeDistance = useMemo(() => {
    if (!routeShapeData?.directions?.length) return null;
    const direction = routeShapeData.directions[selectedDirection] || routeShapeData.directions[0];
    if (!direction?.shape || direction.shape.length < 2) return null;
    return calculateRouteDistance(direction.shape);
  }, [routeShapeData, selectedDirection]);

  // Find current stop (where vehicle is now)
  const currentStopId = useMemo(() => {
    if (!followedVehicle?.stopId) return null;
    return followedVehicle.stopId;
  }, [followedVehicle?.stopId]);

  // Get upcoming stops starting from current stop (for Route Planner tab)
  const upcomingStops = useMemo(() => {
    if (!currentStopId || routeStops.length === 0) return [];
    
    const currentIndex = routeStops.findIndex(s => s.stopId === currentStopId);
    if (currentIndex < 0) return [];
    
    // Return all stops after current one
    return routeStops.slice(currentIndex + 1);
  }, [currentStopId, routeStops]);

  // Get realtime info for upcoming stops from active trip
  const upcomingRealtimeMap = useMemo(() => {
    const map = new Map<string, { arrivalTime?: number; arrivalDelay?: number; isLive: boolean }>();
    
    if (activeTrip?.stopTimeUpdates) {
      const now = Math.floor(Date.now() / 1000);
      activeTrip.stopTimeUpdates.forEach(stu => {
        if (stu.stopId && stu.arrivalTime && stu.arrivalTime > now) {
          map.set(stu.stopId, {
            arrivalTime: stu.arrivalTime,
            arrivalDelay: stu.arrivalDelay,
            isLive: true, // This is from realtime trip data
          });
        }
      });
    }
    
    return map;
  }, [activeTrip]);

  // Auto-scroll to current stop when stops tab opens
  useEffect(() => {
    if (activeTab === 'stops' && currentStopId && routeStops.length > 0) {
      const currentStopIndex = routeStops.findIndex(s => s.stopId === currentStopId);
      if (currentStopIndex >= 0) {
        const targetPage = Math.floor(currentStopIndex / stopsPerPage);
        setCurrentPage(targetPage);
        // Scroll to stop after a brief delay to allow render
        setTimeout(() => {
          const stopElement = document.querySelector(`[data-stop-id="${currentStopId}"]`);
          if (stopElement) {
            stopElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [activeTab, currentStopId, routeStops, stopsPerPage]);

  // Auto-select tab based on context
  useEffect(() => {
    if (followedVehicle) {
      // When following vehicle, default to "Live" tab
      setActiveTab('live');
    }
  }, [followedVehicle]);

  // Panel content
  const panelContent = (
    <div className="h-full flex flex-col bg-white">
      {/* Header - dark olive-green */}
      <div 
        className="flex items-center gap-2 p-3 flex-shrink-0"
        style={{ backgroundColor: headerColor }}
      >
        {/* Route badge */}
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/20 text-white font-bold text-sm">
          {routeInfo?.route_short_name || routeId}
        </div>
        
        {/* Route name */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-white truncate">
            {routeInfo?.route_long_name || `Γραμμή ${routeId}`}
          </div>
          {isCollapsed ? (
            // Collapsed state - show route info: shape distance, stops count
            <div className="flex items-center gap-2 text-xs text-white/90 mt-0.5">
              {routeShapeData && (
                <>
                  <Map className="h-3 w-3" />
                  <span>Χάρτης Διαδρομής</span>
                  {routeDistance !== null && (
                    <>
                      <span className="mx-0.5 text-white/60">•</span>
                      <span>{routeDistance} km</span>
                    </>
                  )}
                  {routeStops.length > 0 && (
                    <>
                      <span className="mx-0.5 text-white/60">•</span>
                      <MapPin className="h-3 w-3" />
                      <span>{routeStops.length} στάσεις</span>
                    </>
                  )}
                </>
              )}
            </div>
          ) : (
            // Expanded state - show vehicle info
            <div className="flex items-center gap-1.5 text-xs text-white/90">
              {followedVehicle?.timestamp ? (
                <>
                  <Clock className="h-3 w-3" />
                  <span>
                    {new Date(followedVehicle.timestamp * 1000).toLocaleTimeString('el-GR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false,
                    })}
                  </span>
                  <span className="mx-1 text-white/60">•</span>
                  <Bus className="h-3 w-3" />
                  <span>{vehicleLabel}</span>
                </>
              ) : (
                <>
                  <Clock className="h-3 w-3" />
                  <span>—</span>
                  <span className="mx-1 text-white/60">•</span>
                  <Bus className="h-3 w-3" />
                  <span>{vehicleCount}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Collapse/Expand - Desktop only */}
        {!isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-white hover:bg-white/20"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
            data-no-drag
          >
            {isCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </Button>
        )}
        
        {/* Close */}
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-white hover:bg-white/20"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          data-no-drag
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Next stop info - if following vehicle */}
      {!isCollapsed && followedVehicle && nextStop && (
        <div className="bg-white p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: headerColor }}>
              <MapPin className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground mb-0.5">Επόμενη στάση</div>
              <div className="font-medium text-sm truncate">{nextStop.stopName}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-bold text-base" style={{ color: headerColor }}>
                {formatETA(nextStop.arrivalTime)}
              </div>
              {formatMinutesUntil(nextStop.arrivalTime) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {formatMinutesUntil(nextStop.arrivalTime)}
                  {nextStop.arrivalDelay !== undefined && nextStop.arrivalDelay !== 0 && (
                    <span className={`ml-1 ${nextStop.arrivalDelay > 0 ? 'text-destructive' : 'text-green-500'}`}>
                      {formatDelay(nextStop.arrivalDelay)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* View mode toggle - if following vehicle */}
      {!isCollapsed && followedVehicle && onSwitchToStreet && onSwitchToOverview && (
        <div className="flex gap-2 p-4 pt-2 border-b border-border bg-white">
          <Button
            variant={viewMode === 'street' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 h-9 text-xs gap-1.5"
            onClick={onSwitchToStreet}
            style={viewMode === 'street' ? { backgroundColor: headerColor } : {}}
          >
            <Focus className="h-3.5 w-3.5" />
            Κοντινή
          </Button>
          <Button
            variant={viewMode === 'overview' ? 'default' : 'outline'}
            size="sm"
            className="flex-1 h-9 text-xs gap-1.5"
            onClick={onSwitchToOverview}
            style={viewMode === 'overview' ? { backgroundColor: headerColor } : {}}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Επισκόπηση
          </Button>
        </div>
      )}

      {/* Tabs */}
      {!isCollapsed && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col min-h-0 bg-white">
          <TabsList className="grid w-full grid-cols-3 h-9 mx-4 mt-2 shrink-0">
            <TabsTrigger value="stops" className="text-xs gap-1.5">
              <MapPin className="h-3 w-3 text-green-600" />
              Live Στάσεις
              {routeStops.length > 0 && (
                <Badge variant="default" className="h-4 px-1 text-[10px] bg-green-500">
                  {routeStops.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="live" className="text-xs gap-1.5">
              <Radio className="h-3 w-3 text-green-600" />
              Live Χάρτης
              {liveCount > 0 && (
                <Badge variant="default" className="h-4 px-1 text-[10px] bg-green-500">
                  {liveCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="planner" className="text-xs gap-1.5">
              <Route className="h-3 w-3 text-green-600" />
              Live Δρομολόγιο
            </TabsTrigger>
          </TabsList>

          {/* Stops Tab */}
          <TabsContent value="stops" className="flex-1 min-h-0 mt-0">
            <div className="flex flex-col h-full">
              {/* Direction selector */}
              {availableDirections.length > 1 && (
                <div className="flex items-center justify-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setSelectedDirection(prev => prev === 0 ? 1 : 0)}
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    Κατεύθυνση {selectedDirection + 1}/{availableDirections.length}
                  </Button>
                </div>
              )}

              {/* Stops count and pagination */}
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground border-b border-border">
                <span className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/20">
                    <span className="text-[10px]">⊙</span>
                  </span>
                  {routeStops.length} στάσεις
                </span>
                {totalPages > 1 && (
                  <span>Σελ. {currentPage + 1}/{totalPages}</span>
                )}
              </div>

              {/* Stops list */}
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {isLoadingShape ? (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                      <p className="text-sm">Φόρτωση στάσεων...</p>
                    </div>
                  ) : routeStops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                      <Bus className="h-6 w-6 mb-2 opacity-50" />
                      <p className="text-sm">Δεν βρέθηκαν στάσεις</p>
                    </div>
                  ) : (
                    paginatedStops.map((stop, index) => {
                      const timeUntil = getTimeUntilArrival(stop.arrivalTime);
                      const formattedTime = formatTime(stop.arrivalTime);
                      const delay = formatDelay(stop.arrivalDelay);
                      const isNow = timeUntil === "Τώρα";
                      const isCurrentStop = stop.stopId === currentStopId;
                      const notificationSettings = getStopNotification(stop.stopId);
                      
                      return (
                        <div 
                          key={stop.stopId}
                          data-stop-id={stop.stopId}
                          className={cn(
                            "flex items-start gap-2 p-1.5 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors",
                            isCurrentStop && "bg-primary/10 border border-primary/30",
                            !isCurrentStop && "cursor-pointer"
                          )}
                          onClick={() => {
                            if (!isCurrentStop) {
                              onStopClick?.(stop.stopId);
                            }
                          }}
                        >
                          {/* Timeline indicator */}
                          <div className="flex flex-col items-center pt-0.5">
                            <div 
                              className={`w-2.5 h-2.5 rounded-full border-2 ${
                                isNow 
                                  ? 'bg-green-500 border-green-500' 
                                  : stop.isFirst 
                                    ? 'bg-primary border-primary'
                                    : 'bg-background border-muted-foreground'
                              }`}
                            />
                            {index < paginatedStops.length - 1 && (
                              <div className="w-0.5 h-8 bg-muted-foreground/30 mt-0.5" />
                            )}
                          </div>

                          {/* Stop info */}
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-xs truncate flex-1">
                                {stop.stopName}
                              </span>
                              {stop.isFirst && (
                                <Badge variant="default" className="text-[9px] px-1 py-0 h-4 bg-red-500 hover:bg-red-600 shrink-0">
                                  ΑΦΕΤ.
                                </Badge>
                              )}
                              {stop.isLast && (
                                <Badge variant="default" className="text-[9px] px-1 py-0 h-4 bg-blue-500 hover:bg-blue-600 shrink-0">
                                  ΤΕΡΜ.
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Clock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                              {timeUntil && (
                                <Badge 
                                  variant={isNow ? "default" : "secondary"}
                                  className={`text-[10px] px-1 py-0 h-4 font-mono ${isNow ? 'bg-green-500 hover:bg-green-600' : ''}`}
                                >
                                  {timeUntil}
                                </Badge>
                              )}
                              {formattedTime && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({formattedTime})
                                </span>
                              )}
                              {delay && (
                                <span className={`text-[10px] font-medium ${
                                  delay.startsWith('+') ? 'text-orange-500' : 
                                  delay.startsWith('-') ? 'text-green-500' : 
                                  'text-muted-foreground'
                                }`}>
                                  {delay}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Notification button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStopForNotification({ stopId: stop.stopId, stopName: stop.stopName });
                            }}
                            title={notificationSettings?.enabled ? "Ειδοποίηση ενεργή" : "Ενεργοποίηση ειδοποίησης"}
                          >
                            <Bell className={cn(
                              "h-3.5 w-3.5",
                              notificationSettings?.enabled ? "text-primary fill-primary" : "text-muted-foreground"
                            )} />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-2 border-t border-border">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    className="h-8 text-xs px-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Προηγ.
                  </Button>
                  
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                      const pageIndex = totalPages <= 5 ? i : 
                        currentPage < 2 ? i :
                        currentPage > totalPages - 3 ? totalPages - 5 + i :
                        currentPage - 2 + i;
                      return (
                        <button
                          key={pageIndex}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            pageIndex === currentPage ? 'bg-primary' : 'bg-muted-foreground/30'
                          }`}
                          onClick={() => setCurrentPage(pageIndex)}
                        />
                      );
                    })}
                  </div>
                  
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                    className="h-8 text-xs px-2"
                  >
                    Επόμ.
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Live Tab */}
          <TabsContent value="live" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1.5">
                {liveTripsWithVehicles.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs py-8">
                    <Radio className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Δεν υπάρχουν live οχήματα</p>
                  </div>
                ) : (
                  liveTripsWithVehicles.map(({ trip, vehicle, nextStop, nextArrivalTime }) => {
                    const vehicleId = vehicle.vehicleId || vehicle.id;
                    return (
                      <div
                        key={vehicleId}
                        className="rounded-lg border p-2 bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Badge variant="default" className="bg-green-500 text-[10px]">
                              LIVE
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <div className="font-mono font-bold text-sm">
                                {vehicle.timestamp 
                                  ? new Date(vehicle.timestamp * 1000).toLocaleTimeString('el-GR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: false,
                                    })
                                  : '--:--:--'
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {vehicle.label || vehicleId}
                              </div>
                            </div>
                          </div>
                          {onVehicleFollow && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => onVehicleFollow(vehicleId)}
                            >
                              <Eye className="h-3 w-3" />
                              Παρακολούθηση
                            </Button>
                          )}
                        </div>
                        {nextStop && (
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            Επόμενη στάση σε {formatMinutesUntil(nextArrivalTime) || '—'}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Route Planner Tab */}
          <TabsContent value="planner" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              {!currentStopId ? (
                <div className="p-2 text-center text-muted-foreground text-xs py-8">
                  <Route className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Πατήστε σε ένα λεωφορείο για να δείτε το δρομολόγιο</p>
                </div>
              ) : upcomingStops.length === 0 ? (
                <div className="p-2 text-center text-muted-foreground text-xs py-8">
                  <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Δεν υπάρχουν επόμενες στάσεις</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {/* Current stop header */}
                  {(() => {
                    const currentStop = routeStops.find(s => s.stopId === currentStopId);
                    if (!currentStop) return null;
                    return (
                      <div className="p-3 mb-2 rounded-lg border-2 border-primary/30 bg-primary/10">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-xs font-semibold text-muted-foreground">Τρέχουσα στάση</span>
                        </div>
                        <div className="font-medium text-sm">{currentStop.stopName}</div>
                      </div>
                    );
                  })()}

                  {/* Upcoming stops */}
                  {upcomingStops.map((stop, index) => {
                    const realtime = upcomingRealtimeMap.get(stop.stopId);
                    const isLive = realtime?.isLive || false;
                    const timeUntil = getTimeUntilArrival(realtime?.arrivalTime);
                    const formattedTime = formatTime(realtime?.arrivalTime);
                    const delay = formatDelay(realtime?.arrivalDelay);
                    
                    return (
                      <div
                        key={stop.stopId}
                        className={cn(
                          "flex items-start gap-2 p-2.5 rounded-lg border transition-colors",
                          isLive ? "bg-green-50 border-green-200" : "bg-muted/30 border-border hover:bg-muted/50"
                        )}
                        onClick={() => onStopClick?.(stop.stopId)}
                      >
                        {/* Timeline */}
                        <div className="flex flex-col items-center pt-0.5">
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full border-2",
                            isLive ? "bg-green-500 border-green-500" : "bg-muted-foreground border-muted-foreground"
                          )} />
                          {index < upcomingStops.length - 1 && (
                            <div className={cn(
                              "w-0.5 flex-1 mt-0.5",
                              isLive ? "bg-green-300" : "bg-muted-foreground/30"
                            )} style={{ minHeight: '20px' }} />
                          )}
                        </div>

                        {/* Stop info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{stop.stopName}</span>
                            {isLive ? (
                              <Badge variant="default" className="h-4 px-1.5 text-[10px] bg-green-500 shrink-0">
                                Live
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] shrink-0">
                                Προγραμματισμένο
                              </Badge>
                            )}
                          </div>
                          {isLive && realtime?.arrivalTime ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="font-mono">{formattedTime}</span>
                              {timeUntil && (
                                <span>({timeUntil})</span>
                              )}
                              {delay && (
                                <span className={cn(
                                  delay.startsWith('+') ? 'text-destructive' : 'text-green-500'
                                )}>
                                  {delay}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">
                              Επόμενο προγραμματισμένο δρομολόγιο της ημέρας
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

        </Tabs>
      )}
    </div>
  );

  // Mobile layout - draggable
  if (isMobile) {
    // Calculate initial position and size based on screen dimensions
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 375;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 667;
    
    return (
      <>
        <ResizableDraggablePanel
          initialPosition={{ x: 0, y: screenHeight * 0.3 }} // Start at 30% from top
          initialSize={{ width: screenWidth, height: screenHeight * 0.7 }} // 70% of screen height
          minSize={{ width: 320, height: 400 }}
          maxSize={{ width: screenWidth, height: screenHeight * 0.9 }}
          className="rounded-t-xl overflow-hidden border border-border shadow-xl"
          zIndex={2500}
        >
          {panelContent}
        </ResizableDraggablePanel>
        
        {selectedStopForNotification && (
          <StopNotificationModal
            stopId={selectedStopForNotification.stopId}
            stopName={selectedStopForNotification.stopName}
            currentSettings={getStopNotification(selectedStopForNotification.stopId)}
            onSave={(settings) => {
              saveStopNotification(settings);
              setSelectedStopForNotification(null);
            }}
            onRemove={(stopId) => {
              removeStopNotification(stopId);
              setSelectedStopForNotification(null);
            }}
            onClose={() => setSelectedStopForNotification(null)}
          />
        )}
      </>
    );
  }

  // Desktop layout
  return (
    <>
      <ResizableDraggablePanel
        initialPosition={{ x: 16, y: 60 }}
        initialSize={{ width: 380, height: 600 }}
        minSize={{ width: 320, height: 400 }}
        maxSize={{ width: 500, height: 800 }}
        className="rounded-lg overflow-hidden border border-border shadow-xl"
        zIndex={2500}
      >
        {panelContent}
      </ResizableDraggablePanel>
      
      {selectedStopForNotification && (
        <StopNotificationModal
          stopId={selectedStopForNotification.stopId}
          stopName={selectedStopForNotification.stopName}
          currentSettings={getStopNotification(selectedStopForNotification.stopId)}
          onSave={(settings) => {
            saveStopNotification(settings);
            setSelectedStopForNotification(null);
          }}
          onRemove={(stopId) => {
            removeStopNotification(stopId);
            setSelectedStopForNotification(null);
          }}
          onClose={() => setSelectedStopForNotification(null)}
        />
      )}
    </>
  );
}

