import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, X, Clock, Bus, ChevronLeft, ChevronRight, GripVertical, ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableDraggablePanel } from "@/components/common/ResizableDraggablePanel";
import { useRouteShape } from "@/hooks/useGtfsData";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Trip, Vehicle, StaticStop, RouteInfo } from "@/types/gtfs";

interface RouteStopsPanelProps {
  selectedRoute: string;
  trips: Trip[];
  vehicles: Vehicle[];
  stops: StaticStop[];
  routeInfo?: RouteInfo;
  selectedOperator?: string;
  onClose: () => void;
  onStopClick?: (stopId: string) => void;
}

const STOPS_PER_PAGE = 8;
const STOPS_PER_PAGE_MOBILE = 6;

const formatTime = (timestamp?: number) => {
  if (!timestamp) return null;
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatDelay = (delay?: number) => {
  if (delay === undefined || delay === null) return null;
  const minutes = Math.round(delay / 60);
  if (minutes === 0) return "0'";
  if (minutes > 0) return `+${minutes}'`;
  return `${minutes}'`;
};

const getTimeUntilArrival = (arrivalTime?: number) => {
  if (!arrivalTime) return null;
  const now = Math.floor(Date.now() / 1000);
  const diff = arrivalTime - now;
  const minutes = Math.floor(diff / 60);

  if (minutes <= 0) return "Τώρα";
  if (minutes < 60) return `${minutes}:${String(diff % 60).padStart(2, '0')}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
};

export function RouteStopsPanel({
  selectedRoute,
  trips,
  vehicles,
  stops,
  routeInfo,
  selectedOperator,
  onClose,
  onStopClick,
}: RouteStopsPanelProps) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [selectedDirection, setSelectedDirection] = useState(0);

  // Fetch static route shape data (includes stops for the route)
  const { data: routeShapeData, isLoading: isLoadingShape } = useRouteShape(selectedRoute, selectedOperator);

  // Find trips for this route - prioritize ones with stop time updates
  const activeTrip = useMemo(() => {
    // First try to find a trip with stop time updates
    const tripWithUpdates = trips.find(t =>
      t.routeId === selectedRoute &&
      t.stopTimeUpdates &&
      t.stopTimeUpdates.length > 0
    );
    if (tripWithUpdates) return tripWithUpdates;

    // Otherwise, just find any trip for this route
    return trips.find(t => t.routeId === selectedRoute);
  }, [trips, selectedRoute]);

  // Get vehicle info for this trip - removed unused tripVehicle logic

  // Create stop map for quick lookup
  const stopMap = useMemo(() => {
    const map = new Map<string, StaticStop>();
    stops.forEach(stop => map.set(stop.stop_id, stop));
    return map;
  }, [stops]);

  // Create a map of stopId -> arrival info from realtime data
  const realtimeStopInfo = useMemo(() => {
    const map = new Map<string, { arrivalTime?: number; arrivalDelay?: number; departureTime?: number }>();
    if (activeTrip?.stopTimeUpdates) {
      activeTrip.stopTimeUpdates.forEach(stu => {
        if (stu.stopId) {
          map.set(stu.stopId, {
            arrivalTime: stu.arrivalTime,
            arrivalDelay: stu.arrivalDelay,
            departureTime: stu.departureTime,
          });
        }
      });
    }
    return map;
  }, [activeTrip]);

  // Get all stops - use static data from route shape, enrich with realtime if available
  const routeStops = useMemo(() => {
    // If we have route shape data with stops, use those
    if (routeShapeData?.directions && routeShapeData.directions.length > 0) {
      const direction = routeShapeData.directions[selectedDirection] || routeShapeData.directions[0];
      if (direction?.stops && direction.stops.length > 0) {
        return direction.stops
          .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0))
          .map((stop, index) => {
            const realtimeInfo = realtimeStopInfo.get(stop.stop_id);
            const staticStop = stopMap.get(stop.stop_id);
            return {
              stopId: stop.stop_id,
              stopName: stop.stop_name || staticStop?.stop_name || stop.stop_id,
              stopSequence: stop.stop_sequence || index,
              arrivalTime: realtimeInfo?.arrivalTime,
              arrivalDelay: realtimeInfo?.arrivalDelay,
              departureTime: realtimeInfo?.departureTime,
              isFirst: index === 0,
              isLast: index === direction.stops.length - 1,
              hasRealtime: !!realtimeInfo,
            };
          });
      }
    }

    // Fallback to realtime data if no static shape data
    if (activeTrip?.stopTimeUpdates?.length) {
      return activeTrip.stopTimeUpdates
        .filter(stu => stu.stopId)
        .sort((a, b) => (a.stopSequence || 0) - (b.stopSequence || 0))
        .map((stu, index) => {
          const stopInfo = stu.stopId ? stopMap.get(stu.stopId) : null;
          return {
            stopId: stu.stopId!,
            stopName: stopInfo?.stop_name || stu.stopId || 'Άγνωστη στάση',
            stopSequence: stu.stopSequence || index,
            arrivalTime: stu.arrivalTime,
            arrivalDelay: stu.arrivalDelay,
            departureTime: stu.departureTime,
            isFirst: index === 0,
            isLast: index === activeTrip.stopTimeUpdates!.length - 1,
            hasRealtime: true,
          };
        });
    }

    return [];
  }, [routeShapeData, selectedDirection, activeTrip, stopMap, realtimeStopInfo]);

  // Get available directions
  const availableDirections = routeShapeData?.directions || [];

  // Pagination - use fewer stops per page on mobile
  const stopsPerPage = isMobile ? STOPS_PER_PAGE_MOBILE : STOPS_PER_PAGE;
  const totalPages = Math.ceil(routeStops.length / stopsPerPage);
  const paginatedStops = routeStops.slice(
    currentPage * stopsPerPage,
    (currentPage + 1) * stopsPerPage
  );

  // Calculate estimated trip duration
  const tripDuration = useMemo(() => {
    if (routeStops.length < 2) return null;
    const firstStop = routeStops[0];
    const lastStop = routeStops[routeStops.length - 1];
    if (!firstStop.arrivalTime || !lastStop.arrivalTime) return null;
    const diffMinutes = Math.round((lastStop.arrivalTime - firstStop.arrivalTime) / 60);
    return diffMinutes;
  }, [routeStops]);

  // Count active vehicles on this route
  const vehicleCount = vehicles.filter(v => v.routeId === selectedRoute).length;

  // Use dark olive-green as default header color (like bus panels)
  const headerColor = routeInfo?.route_color ? `#${routeInfo.route_color}` : '#6B8E23';

  if (selectedRoute === 'all') return null;

  // Mobile layout - full-width bottom panel
  if (isMobile) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[1200] bg-card border-t border-border shadow-lg rounded-t-xl max-h-[60vh] flex flex-col">
        {/* Header with dark olive-green */}
        <div
          className="flex items-center gap-2 p-3 cursor-pointer transition-colors rounded-t-xl"
          style={{ backgroundColor: headerColor }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {/* Drag indicator for mobile */}
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/40" />

          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/20 text-white font-bold text-base"
          >
            {routeInfo?.route_short_name || selectedRoute}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate text-white">
              {routeInfo?.route_long_name || 'Γραμμή ' + selectedRoute}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/80">
              {tripDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {tripDuration}'
                </span>
              )}
              <span className="flex items-center gap-1">
                <Bus className="h-3 w-3" />
                {vehicleCount}
              </span>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}>
            {isCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content - White background */}
        {!isCollapsed && (
          <div className="flex-1 overflow-hidden flex flex-col bg-white">
            {/* Direction selector - only show if multiple directions */}
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

                    return (
                      <div
                        key={stop.stopId}
                        className="flex items-start gap-2 p-1.5 rounded-lg hover:bg-muted/50 active:bg-muted cursor-pointer transition-colors"
                        onClick={() => onStopClick?.(stop.stopId)}
                      >
                        {/* Timeline indicator */}
                        <div className="flex flex-col items-center pt-0.5">
                          <div
                            className={`w-2.5 h-2.5 rounded-full border-2 ${isNow
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
                              <span className={`text-[10px] font-medium ${delay.startsWith('+') ? 'text-orange-500' :
                                delay.startsWith('-') ? 'text-green-500' :
                                  'text-muted-foreground'
                                }`}>
                                {delay}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between p-2 border-t border-border bg-card">
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
                        className={`w-2 h-2 rounded-full transition-colors ${pageIndex === currentPage ? 'bg-primary' : 'bg-muted-foreground/30'
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
        )}
      </div>
    );
  }

  // Desktop layout - draggable panel
  return (
    <ResizableDraggablePanel
      initialPosition={{ x: 16, y: 60 }}
      initialSize={{ width: 380, height: 450 }}
      minSize={{ width: 300, height: 200 }}
      maxSize={{ width: 500, height: 700 }}
      className="rounded-lg overflow-hidden border border-border bg-card/95 backdrop-blur-sm"
      zIndex={1200}
      title={routeInfo?.route_short_name || selectedRoute}
    >
      <div className="h-full flex flex-col bg-white">
        {/* Header with dark olive-green */}
        <div
          className="flex items-center gap-2 p-3 cursor-pointer transition-colors"
          style={{ backgroundColor: headerColor }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          {/* Drag handle */}
          <GripVertical className="h-5 w-5 text-white/70 cursor-grab" />

          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-white/20 text-white font-bold text-lg"
          >
            {routeInfo?.route_short_name || selectedRoute}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate text-white">
              {routeInfo?.route_long_name || 'Γραμμή ' + selectedRoute}
            </div>
            <div className="flex items-center gap-2 text-xs text-white/80">
              {tripDuration && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {tripDuration}'
                </span>
              )}
              <span className="flex items-center gap-1">
                <Bus className="h-3 w-3" />
                {vehicleCount}
              </span>
            </div>
          </div>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}>
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>

          <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20" onClick={(e) => { e.stopPropagation(); onClose(); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        {!isCollapsed && (
          <>
            {/* Direction selector - only show if multiple directions */}
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
            <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b border-border">
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
            <ScrollArea className="h-[320px]">
              <div className="p-2">
                {isLoadingShape ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 mb-2 animate-spin" />
                    <p className="text-sm">Φόρτωση στάσεων...</p>
                  </div>
                ) : routeStops.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Bus className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">Δεν βρέθηκαν στάσεις</p>
                    <p className="text-xs">Η διαδρομή δεν έχει καταχωρημένες στάσεις</p>
                  </div>
                ) : (
                  paginatedStops.map((stop, index) => {
                    const timeUntil = getTimeUntilArrival(stop.arrivalTime);
                    const formattedTime = formatTime(stop.arrivalTime);
                    const delay = formatDelay(stop.arrivalDelay);
                    const isNow = timeUntil === "Τώρα";

                    return (
                      <div
                        key={stop.stopId}
                        className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors group"
                        onClick={() => onStopClick?.(stop.stopId)}
                      >
                        {/* Timeline indicator */}
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-3 h-3 rounded-full border-2 ${isNow
                              ? 'bg-green-500 border-green-500'
                              : stop.isFirst
                                ? 'bg-primary border-primary'
                                : 'bg-background border-muted-foreground'
                              }`}
                          />
                          {index < paginatedStops.length - 1 && (
                            <div className="w-0.5 h-12 bg-muted-foreground/30 mt-1" />
                          )}
                        </div>

                        {/* Stop info */}
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate flex-1">
                              {stop.stopName}
                            </span>
                            {stop.isFirst && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-red-500 hover:bg-red-600">
                                ΑΦΕΤ.
                              </Badge>
                            )}
                            {stop.isLast && (
                              <Badge variant="default" className="text-[10px] px-1.5 py-0 h-5 bg-blue-500 hover:bg-blue-600">
                                ΤΕΡΜ.
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {timeUntil && (
                                <Badge
                                  variant={isNow ? "default" : "secondary"}
                                  className={`text-xs px-1.5 py-0 h-5 font-mono ${isNow ? 'bg-green-500 hover:bg-green-600' : ''}`}
                                >
                                  {timeUntil}
                                </Badge>
                              )}
                              {formattedTime && (
                                <span className="text-xs text-muted-foreground">
                                  ({formattedTime})
                                </span>
                              )}
                            </div>
                            {delay && (
                              <span className={`text-xs font-medium ${delay.startsWith('+') ? 'text-orange-500' :
                                delay.startsWith('-') ? 'text-green-500' :
                                  'text-muted-foreground'
                                }`}>
                                {delay}
                              </span>
                            )}
                          </div>
                        </div>
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
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Προηγ.
                </Button>

                {/* Page dots */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <button
                      key={i}
                      className={`w-2 h-2 rounded-full transition-colors ${i === currentPage ? 'bg-primary' : 'bg-muted-foreground/30'
                        }`}
                      onClick={() => setCurrentPage(i)}
                    />
                  ))}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage === totalPages - 1}
                  className="flex items-center gap-1"
                >
                  Επόμ.
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </ResizableDraggablePanel>
  );
}
