import { useMemo, useState } from "react";
import { Search, MapPin, Clock, Bus, ChevronDown, ChevronUp, AlertCircle, Home, Briefcase, Star, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useStopRoutes } from "@/hooks/useGtfsData";
import { useFavoriteStops, FavoriteStopType } from "@/hooks/useFavoriteStops";
import { useFavoriteStopIds } from "@/hooks/useFavoriteStopIds";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Trip, StaticStop, RouteInfo } from "@/types/gtfs";

interface StopsViewProps {
  trips: Trip[];
  stops: StaticStop[];
  routeNamesMap?: Map<string, RouteInfo>;
  isLoading: boolean;
  selectedOperator?: string;
  onTripSelect?: (trip: Trip) => void;
}

const formatETA = (timestamp?: number) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false });
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

export function StopsView({ trips, stops, routeNamesMap, isLoading, selectedOperator, onTripSelect }: StopsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [showFavoritePicker, setShowFavoritePicker] = useState<{ stopId: string; stop: StaticStop } | null>(null);
  const [selectedFavoriteStopId, setSelectedFavoriteStopId] = useState<string | null>(null);
  const { setFavorite, removeFavorite, isFavorite, homeStop, workStop } = useFavoriteStops();
  const { favoriteStopIds, toggleFavorite, isFavorite: isFavoriteStopId } = useFavoriteStopIds();

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

  // Get arrivals for a specific stop
  const getArrivalsForStop = (stopId: string) => {
    const stopData = stopsWithArrivals.find(s => s.stop.stop_id === stopId);
    return stopData?.arrivals || [];
  };

  const filteredStops = useMemo(() => {
    let filtered = stopsWithArrivals;

    // Filter by selected favorite stop
    if (selectedFavoriteStopId) {
      filtered = filtered.filter(data => data.stop.stop_id === selectedFavoriteStopId);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((data) =>
        data.stop.stop_id.toLowerCase().includes(term) ||
        data.stop.stop_name?.toLowerCase().includes(term) ||
        data.stop.stop_code?.toLowerCase().includes(term)
      );
    }

    return filtered.slice(0, 100); // Limit to 100 for performance
  }, [stopsWithArrivals, searchTerm, selectedFavoriteStopId]);

  // Get favorite stops for buttons - combine home/work with regular favorites
  const favoriteStopsForButtons = useMemo(() => {
    const result: Array<{ stop: StaticStop; type?: 'home' | 'work' }> = [];

    // Add home stop first if exists
    if (homeStop) {
      result.push({ stop: homeStop, type: 'home' });
    }

    // Add work stop second if exists
    if (workStop) {
      result.push({ stop: workStop, type: 'work' });
    }

    // Add regular favorites (up to 2 more to make total 4)
    const regularFavorites = stopsWithArrivals
      .filter(data => favoriteStopIds.includes(data.stop.stop_id))
      .slice(0, 4 - result.length)
      .map(data => ({ stop: data.stop }));

    result.push(...regularFavorites);

    return result;
  }, [stopsWithArrivals, favoriteStopIds, homeStop, workStop]);

  // Favorite stops with arrivals data
  const favoriteStopsData = useMemo(() => {
    const result: { type: FavoriteStopType; stop: StaticStop; arrivals: RouteArrival[] }[] = [];

    if (homeStop) {
      result.push({
        type: "home",
        stop: homeStop,
        arrivals: getArrivalsForStop(homeStop.stop_id),
      });
    }
    if (workStop) {
      result.push({
        type: "work",
        stop: workStop,
        arrivals: getArrivalsForStop(workStop.stop_id),
      });
    }

    return result;
  }, [homeStop, workStop, stopsWithArrivals]);

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
                  className="route-badge route-badge-md"
                  style={{ "--route-color": route.routeColor ? `#${route.routeColor}` : '#0ea5e9' } as React.CSSProperties}
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
                        {onTripSelect && arrival.vehicleId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-primary hover:text-primary hover:bg-primary/10 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              const trip = trips.find(t => t.tripId === arrival.tripId);
                              if (trip) {
                                onTripSelect(trip);
                              }
                            }}
                            title="Δες στον Χάρτη"
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </Button>
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
                    className="route-badge route-badge-sm opacity-60"
                    style={{ "--route-color": route.route_color ? `#${route.route_color}` : '#6b7280' } as React.CSSProperties}
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
      <div className="p-4 border-b border-border space-y-3">
        {/* Favorite Stops - Big buttons like distance selector */}
        {favoriteStopsForButtons.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Αγαπημένες στάσεις:</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {favoriteStopsForButtons.map((favStop) => {
                const isSelected = selectedFavoriteStopId === favStop.stop.stop_id;
                const stopName = favStop.stop.stop_name || favStop.stop.stop_id;
                const displayName = stopName.length > 15 ? stopName.substring(0, 12) + '...' : stopName;

                // Determine icon and color based on type
                const isHome = favStop.type === 'home';
                const isWork = favStop.type === 'work';
                const Icon = isHome ? Home : isWork ? Briefcase : MapPin;

                // Colors: home = blue, work = orange/brown, regular = olive-green
                const backgroundColor = isSelected
                  ? (isHome ? '#3B82F6' : isWork ? '#F97316' : '#6B8E23')
                  : undefined;
                const borderColor = !isSelected
                  ? (isHome ? '#3B82F6' : isWork ? '#F97316' : '#6B8E23')
                  : undefined;

                return (
                  <Button
                    key={favStop.stop.stop_id}
                    variant={isSelected ? 'default' : 'outline'}
                    size="lg"
                    className={cn(
                      "favorite-stop-btn",
                      isSelected ? "favorite-stop-btn-selected" : "favorite-stop-btn-outline"
                    )}
                    style={{ "--stop-theme-color": isSelected ? backgroundColor : borderColor } as React.CSSProperties}
                    onClick={() => setSelectedFavoriteStopId(isSelected ? null : favStop.stop.stop_id)}
                    title={stopName}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="line-clamp-2 text-center">{displayName}</span>
                  </Button>
                );
              })}
              {/* Add favorite button if less than 4 total (including home/work) */}
              {favoriteStopsForButtons.length < 4 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16 flex flex-col items-center justify-center gap-1 border-dashed"
                  onClick={() => {
                    // Find a stop to add - show modal/picker
                    // For now, just log
                    console.log('Add favorite stop - implement picker');
                  }}
                  title="Προσθήκη αγαπημένης στάσης"
                >
                  <Star className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">+</span>
                </Button>
              )}
            </div>
            {selectedFavoriteStopId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setSelectedFavoriteStopId(null)}
              >
                <X className="h-3 w-3" />
                Καθαρισμός φίλτρου
              </Button>
            )}
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση με όνομα ή ID στάσης..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredStops.length} στάσεις με αφίξεις
          </span>
        </div>
      </div>

      {/* Favorites Section */}
      {favoriteStopsData.length > 0 && !searchTerm && (
        <div className="border-b border-border">
          <div className="px-4 py-2 bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Star className="h-3 w-3" />
              Αγαπημένες Στάσεις
            </span>
          </div>
          <div className="divide-y divide-border">
            {favoriteStopsData.map((favData) => {
              const isExpanded = expandedStopId === favData.stop.stop_id;
              const uniqueRoutes = getUniqueRoutes(favData.arrivals);
              const nextArrival = favData.arrivals[0];
              const minutesUntil = nextArrival ? getMinutesUntil(nextArrival.arrivalTime) : null;
              const FavIcon = favData.type === "home" ? Home : Briefcase;

              return (
                <div
                  key={favData.stop.stop_id}
                  className="hover:bg-muted/30 transition-colors bg-primary/5"
                >
                  {/* Favorite Stop Header */}
                  <button
                    onClick={() => setExpandedStopId(isExpanded ? null : favData.stop.stop_id)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center flex-shrink-0">
                          <FavIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase tracking-wider text-primary font-medium">
                              {favData.type === "home" ? "Σπίτι" : "Δουλειά"}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFavorite(favData.type);
                              }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Αφαίρεση από τα αγαπημένα"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <div className="font-medium text-sm truncate">
                            {favData.stop.stop_name || favData.stop.stop_id}
                          </div>
                          {favData.arrivals.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-1.5">
                              <div className="flex items-center gap-1.5">
                                <Bus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">
                                  {uniqueRoutes.length} {uniqueRoutes.length === 1 ? 'γραμμή' : 'γραμμές'}
                                </span>
                              </div>

                              {/* Integrated route badges preview */}
                              {!isExpanded && (
                                <div className="flex flex-wrap gap-1.5">
                                  {uniqueRoutes.slice(0, 5).map((route, idx) => (
                                    <span
                                      key={idx}
                                      className="route-badge route-badge-sm"
                                      style={{ "--route-color": route.routeColor ? `#${route.routeColor}` : '#0ea5e9' } as React.CSSProperties}
                                    >
                                      {route.routeShortName || route.routeId}
                                    </span>
                                  ))}
                                  {uniqueRoutes.length > 5 && (
                                    <span className="inline-flex items-center px-1 py-0.5 text-[10px] text-muted-foreground">
                                      +{uniqueRoutes.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}
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
                  </button>

                  {/* Expanded: Show all arrivals by route + static routes */}
                  {isExpanded && (
                    <StopExpandedContent
                      stopId={favData.stop.stop_id}
                      arrivals={favData.arrivals}
                      selectedOperator={selectedOperator}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Favorite Picker Modal */}
      {showFavoritePicker && (
        <div className="absolute inset-0 bg-background/95 z-10 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-lg p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">Ορισμός Αγαπημένης Στάσης</h3>
            <p className="text-sm text-muted-foreground mb-4 truncate">
              {showFavoritePicker.stop.stop_name || showFavoritePicker.stopId}
            </p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  setFavorite("home", showFavoritePicker.stop);
                  setShowFavoritePicker(null);
                }}
              >
                <Home className="h-5 w-5 text-primary" />
                <span>Κοντινή στάση από το <strong>Σπίτι</strong></span>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start gap-3"
                onClick={() => {
                  setFavorite("work", showFavoritePicker.stop);
                  setShowFavoritePicker(null);
                }}
              >
                <Briefcase className="h-5 w-5 text-primary" />
                <span>Κοντινή στάση από τη <strong>Δουλειά</strong></span>
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={() => setShowFavoritePicker(null)}
            >
              Ακύρωση
            </Button>
          </div>
        </div>
      )}

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

              const favType = isFavorite(data.stop.stop_id);

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
                        <div className="relative">
                          <div className="w-10 h-10 bg-primary/20 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                            <MapPin className="h-5 w-5" />
                          </div>
                          {/* Favorite star button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (favType) {
                                removeFavorite(favType);
                              } else {
                                setShowFavoritePicker({ stopId: data.stop.stop_id, stop: data.stop });
                              }
                            }}
                            className={`absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center transition-colors ${favType
                              ? 'bg-yellow-500 text-white'
                              : 'bg-muted hover:bg-yellow-500/20 text-muted-foreground hover:text-yellow-500'
                              }`}
                            title={favType ? "Αφαίρεση από τα αγαπημένα" : "Προσθήκη στα αγαπημένα"}
                          >
                            <Star className={`h-3 w-3 ${favType ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate flex-1">
                              {data.stop.stop_name || data.stop.stop_id}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 p-0 hover:bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                const wasFavorite = isFavoriteStopId(data.stop.stop_id);
                                toggleFavorite(data.stop.stop_id);
                                if (!wasFavorite) {
                                  // Show notification when stop is added to favorites
                                  const stopName = data.stop.stop_name || data.stop.stop_id;
                                  toast({
                                    title: "✅ Στάση προστέθηκε",
                                    description: `Η στάση "${stopName}" προστέθηκε στα αγαπημένα`,
                                  });
                                  // Also send browser notification if permission granted
                                  if ('Notification' in window && Notification.permission === 'granted') {
                                    new Notification('📍 Στάση προστέθηκε', {
                                      body: `Η στάση "${stopName}" προστέθηκε στα αγαπημένα`,
                                      icon: '/pwa-192x192.png',
                                      tag: 'favorite-stop-added',
                                    });
                                  }
                                }
                              }}
                              title={isFavoriteStopId(data.stop.stop_id) ? "Αφαίρεση από τα αγαπημένα" : "Προσθήκη στα αγαπημένα"}
                            >
                              <Star className={cn("h-3.5 w-3.5", isFavoriteStopId(data.stop.stop_id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                            </Button>
                          </div>
                          {data.stop.stop_name && data.stop.stop_name !== data.stop.stop_id && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {data.stop.stop_id}
                            </div>
                          )}
                          {data.arrivals.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-1.5">
                              <div className="flex items-center gap-1.5">
                                <Bus className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground">
                                  {uniqueRoutes.length} {uniqueRoutes.length === 1 ? 'γραμμή' : 'γραμμές'}
                                </span>
                              </div>

                              {/* Integrated route badges preview */}
                              {!isExpanded && (
                                <div className="flex flex-wrap gap-1.5">
                                  {uniqueRoutes.slice(0, 5).map((route, idx) => (
                                    <span
                                      key={idx}
                                      className="route-badge route-badge-sm"
                                      style={{ "--route-color": route.routeColor ? `#${route.routeColor}` : '#0ea5e9' } as React.CSSProperties}
                                    >
                                      {route.routeShortName || route.routeId}
                                    </span>
                                  ))}
                                  {uniqueRoutes.length > 5 && (
                                    <span className="inline-flex items-center px-1 py-0.5 text-[10px] text-muted-foreground">
                                      +{uniqueRoutes.length - 5}
                                    </span>
                                  )}
                                </div>
                              )}
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
