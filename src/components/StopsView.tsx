import { useMemo, useState } from "react";
import { Search, MapPin, Clock, Bus, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useStopRoutes } from "@/hooks/useGtfsData";
import type { Trip, StaticStop, RouteInfo } from "@/types/gtfs";

interface StopsViewProps {
  trips: Trip[];
  stops: StaticStop[];
  routeNamesMap?: Map<string, RouteInfo>;
  isLoading: boolean;
  selectedOperator?: string;
}

const formatETA = (timestamp?: number) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
};

const formatDelay = (seconds?: number) => {
  if (seconds === undefined || seconds === null || Math.abs(seconds) < 30) return null;
  const mins = Math.round(seconds / 60);
  if (mins === 0) return { text: 'Στην ώρα', className: 'text-green-500' };
  if (mins > 0) return { text: `+${mins}'`, className: 'text-red-500' };
  return { text: `${mins}'`, className: 'text-green-500' };
};

const getMinutesUntil = (timestamp: number) => {
  const now = Math.floor(Date.now() / 1000);
  return Math.round((timestamp - now) / 60);
};

interface RouteArrival {
  routeId: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  tripId: string;
  vehicleId?: string;
  vehicleLabel?: string;
  arrivalTime: number;
  arrivalDelay?: number;
}

export function StopsView({ trips, stops, routeNamesMap, isLoading, selectedOperator }: StopsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);

  // Create a map of stopId -> stop info with arrivals
  const stopsWithArrivals = useMemo(() => {
    const stopsMap = new Map<string, {
      stop: StaticStop;
      arrivals: RouteArrival[];
    }>();

    // First, add all static stops
    stops.forEach(stop => {
      stopsMap.set(stop.stop_id, {
        stop,
        arrivals: [],
      });
    });

    // Then add realtime arrivals from trips
    const now = Math.floor(Date.now() / 1000);
    
    trips.forEach((trip) => {
      if (!trip.routeId) return;
      
      const routeInfo = routeNamesMap?.get(trip.routeId);
      
      trip.stopTimeUpdates.forEach((stu) => {
        if (!stu.stopId || !stu.arrivalTime) return;
        
        // Only show future arrivals
        if (stu.arrivalTime < now) return;

        const stopData = stopsMap.get(stu.stopId);
        if (stopData) {
          stopData.arrivals.push({
            routeId: trip.routeId!,
            routeShortName: routeInfo?.route_short_name,
            routeLongName: routeInfo?.route_long_name,
            routeColor: routeInfo?.route_color,
            tripId: trip.tripId || '',
            vehicleId: trip.vehicleId,
            vehicleLabel: trip.vehicleLabel,
            arrivalTime: stu.arrivalTime,
            arrivalDelay: stu.arrivalDelay,
          });
        } else {
          // Stop not in static data, add it anyway
          stopsMap.set(stu.stopId, {
            stop: {
              stop_id: stu.stopId,
              stop_name: stu.stopId, // Will only have ID
            },
            arrivals: [{
              routeId: trip.routeId!,
              routeShortName: routeInfo?.route_short_name,
              routeLongName: routeInfo?.route_long_name,
              routeColor: routeInfo?.route_color,
              tripId: trip.tripId || '',
              vehicleId: trip.vehicleId,
              vehicleLabel: trip.vehicleLabel,
              arrivalTime: stu.arrivalTime,
              arrivalDelay: stu.arrivalDelay,
            }],
          });
        }
      });
    });

    // Sort arrivals by time and convert to array
    return Array.from(stopsMap.values())
      .map(data => ({
        ...data,
        arrivals: data.arrivals.sort((a, b) => a.arrivalTime - b.arrivalTime),
      }))
      .filter(data => data.arrivals.length > 0 || searchTerm) // Show all when searching, otherwise only with arrivals
      .sort((a, b) => {
        // Sort by: has arrivals first, then by stop name/id
        if (a.arrivals.length > 0 && b.arrivals.length === 0) return -1;
        if (a.arrivals.length === 0 && b.arrivals.length > 0) return 1;
        return (a.stop.stop_name || a.stop.stop_id).localeCompare(b.stop.stop_name || b.stop.stop_id);
      });
  }, [trips, stops, routeNamesMap, searchTerm]);

  const filteredStops = useMemo(() => {
    if (!searchTerm) return stopsWithArrivals.slice(0, 100); // Limit to 100 for performance
    const term = searchTerm.toLowerCase();
    return stopsWithArrivals.filter((data) =>
      data.stop.stop_id.toLowerCase().includes(term) ||
      data.stop.stop_name?.toLowerCase().includes(term) ||
      data.stop.stop_code?.toLowerCase().includes(term)
    ).slice(0, 100);
  }, [stopsWithArrivals, searchTerm]);

  // Get unique routes for a stop
  const getUniqueRoutes = (arrivals: RouteArrival[]) => {
    const seen = new Set<string>();
    return arrivals.filter(arr => {
      if (seen.has(arr.routeId)) return false;
      seen.add(arr.routeId);
      return true;
    });
  };

  // Component for expanded stop content - fetches static routes
  const StopExpandedContent = ({ stopId, arrivals, selectedOperator }: { 
    stopId: string; 
    arrivals: RouteArrival[];
    selectedOperator?: string;
  }) => {
    const { data: stopRoutesData, isLoading: routesLoading } = useStopRoutes(stopId, selectedOperator);
    
    const uniqueRealtimeRoutes = getUniqueRoutes(arrivals);
    const realtimeRouteIds = new Set(uniqueRealtimeRoutes.map(r => r.routeId));
    
    // Static routes that don't have realtime arrivals
    const staticOnlyRoutes = stopRoutesData?.routes.filter(r => !realtimeRouteIds.has(r.route_id)) || [];
    
    return (
      <div className="px-4 pb-4 space-y-3">
        {/* Routes with realtime arrivals */}
        {uniqueRealtimeRoutes.map((route) => {
          const routeArrivals = arrivals.filter(a => a.routeId === route.routeId).slice(0, 3);
          
          return (
            <div key={route.routeId} className="bg-muted/50 rounded-lg p-3">
              {/* Route header */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded text-sm font-bold text-white"
                  style={{ backgroundColor: route.routeColor ? `#${route.routeColor}` : '#0ea5e9' }}
                >
                  {route.routeShortName || route.routeId}
                </span>
                <span className="text-xs text-muted-foreground truncate flex-1">
                  {route.routeLongName}
                </span>
              </div>
              
              {/* Arrivals list */}
              <div className="space-y-1.5">
                {routeArrivals.map((arrival, idx) => {
                  const mins = getMinutesUntil(arrival.arrivalTime);
                  const delayInfo = formatDelay(arrival.arrivalDelay);
                  
                  return (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono font-medium">
                          {formatETA(arrival.arrivalTime)}
                        </span>
                        {delayInfo && (
                          <span className={`text-xs ${delayInfo.className}`}>
                            {delayInfo.text}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${mins <= 5 ? 'text-green-500' : 'text-primary'}`}>
                          {mins <= 0 ? 'Τώρα' : `${mins} λεπτά`}
                        </span>
                        {arrival.vehicleLabel && (
                          <span className="text-xs text-muted-foreground">
                            ({arrival.vehicleLabel})
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {/* Static routes without realtime arrivals */}
        {routesLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Φόρτωση γραμμών...</span>
          </div>
        )}
        
        {staticOnlyRoutes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>Γραμμές χωρίς δρομολόγιο αυτή τη στιγμή:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {staticOnlyRoutes.map((route) => (
                <div key={route.route_id} className="flex items-center gap-1.5">
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white opacity-60"
                    style={{ backgroundColor: route.route_color ? `#${route.route_color}` : '#6b7280' }}
                  >
                    {route.route_short_name || route.route_id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {arrivals.length === 0 && !routesLoading && staticOnlyRoutes.length === 0 && (
          <div className="text-sm text-muted-foreground italic">
            Δεν βρέθηκαν γραμμές για αυτή τη στάση
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση με όνομα ή ID στάσης..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredStops.length} στάσεις με αφίξεις
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {isLoading && stopsWithArrivals.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredStops.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <MapPin className="h-12 w-12 mb-2 opacity-50" />
            <p>Δεν βρέθηκαν στάσεις</p>
            {searchTerm && <p className="text-xs mt-1">Δοκιμάστε διαφορετικό όρο αναζήτησης</p>}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredStops.map((data) => {
              const isExpanded = expandedStopId === data.stop.stop_id;
              const uniqueRoutes = getUniqueRoutes(data.arrivals);
              const nextArrival = data.arrivals[0];
              const minutesUntil = nextArrival ? getMinutesUntil(nextArrival.arrivalTime) : null;

              return (
                <div 
                  key={data.stop.stop_id} 
                  className="hover:bg-muted/30 transition-colors"
                >
                  {/* Stop Header */}
                  <button
                    onClick={() => setExpandedStopId(isExpanded ? null : data.stop.stop_id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-primary/20 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {data.stop.stop_name || data.stop.stop_id}
                          </div>
                          {data.stop.stop_name && data.stop.stop_name !== data.stop.stop_id && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {data.stop.stop_id}
                            </div>
                          )}
                          {data.arrivals.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <Bus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs text-muted-foreground">
                                {uniqueRoutes.length} {uniqueRoutes.length === 1 ? 'γραμμή' : 'γραμμές'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {minutesUntil !== null && (
                          <div className="text-right">
                            <div className={`text-lg font-bold ${minutesUntil <= 5 ? 'text-green-500' : 'text-primary'}`}>
                              {minutesUntil <= 0 ? 'Τώρα' : `${minutesUntil}'`}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              επόμενη
                            </div>
                          </div>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Route badges preview (when collapsed) */}
                    {!isExpanded && uniqueRoutes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 ml-13">
                        {uniqueRoutes.slice(0, 4).map((route, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold text-white"
                            style={{ backgroundColor: route.routeColor ? `#${route.routeColor}` : '#0ea5e9' }}
                          >
                            {route.routeShortName || route.routeId}
                          </span>
                        ))}
                        {uniqueRoutes.length > 4 && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground">
                            +{uniqueRoutes.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Expanded: Show all arrivals by route + static routes */}
                  {isExpanded && (
                    <StopExpandedContent
                      stopId={data.stop.stop_id}
                      arrivals={data.arrivals}
                      selectedOperator={selectedOperator}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
