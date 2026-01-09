import { useState, useMemo } from "react";
import { Search, ChevronDown, ChevronUp, Clock, ArrowUpDown, ArrowDown, ArrowUp, MapPin, Star, X, Bus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFavoriteRouteIds } from "@/hooks/useFavoriteRouteIds";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Trip, RouteInfo, StaticStop } from "@/types/gtfs";

type SortOption = 'none' | 'delay-desc' | 'delay-asc' | 'time-desc' | 'time-asc' | 'route-asc';

interface TripsTableProps {
  trips: Trip[];
  isLoading: boolean;
  routeNames?: Map<string, RouteInfo>;
  stops?: StaticStop[];
  onTripSelect?: (trip: Trip) => void;
}

const formatDelay = (seconds?: number) => {
  if (seconds === undefined || seconds === null) return null;
  const mins = Math.round(seconds / 60);
  if (mins === 0) return { text: 'Στην ώρα', className: 'status-ontime' };
  if (mins > 0) return { text: `+${mins} λεπ.`, className: 'status-delay' };
  return { text: `${mins} λεπ.`, className: 'status-early' };
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return '-';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

export function TripsTable({ trips, isLoading, routeNames, stops = [], onTripSelect }: TripsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTrips, setExpandedTrips] = useState<Set<string>>(new Set());
  const [sortOption, setSortOption] = useState<SortOption>('delay-desc');
  const [selectedFavoriteRouteId, setSelectedFavoriteRouteId] = useState<string | null>(null);
  const { favoriteRouteIds, toggleFavorite, isFavorite } = useFavoriteRouteIds();

  // Create a map for quick stop name lookup
  const stopsMap = useMemo(() => {
    const map = new Map<string, string>();
    stops.forEach(stop => {
      map.set(stop.stop_id, stop.stop_name);
    });
    return map;
  }, [stops]);

  const getStopName = (stopId?: string) => {
    if (!stopId) return '-';
    return stopsMap.get(stopId) || stopId;
  };

  const getRouteDisplay = (routeId?: string) => {
    if (!routeId) return { shortName: 'N/A', longName: '', color: undefined, textColor: undefined };
    const info = routeNames?.get(routeId);
    if (info) {
      return {
        shortName: info.route_short_name || routeId,
        longName: info.route_long_name || '',
        color: info.route_color ? `#${info.route_color}` : undefined,
        textColor: info.route_text_color ? `#${info.route_text_color}` : '#FFFFFF',
        routeType: info.route_type,
      };
    }
    return { shortName: routeId, longName: '', color: undefined, textColor: undefined, routeType: undefined };
  };

  const getDirectionLabel = (directionId?: number) => {
    if (directionId === undefined) return null;
    return directionId === 0 ? 'Πορεία Α' : 'Πορεία Β';
  };

  const getScheduleRelationshipLabel = (rel?: string) => {
    if (!rel) return null;
    const labels: Record<string, string> = {
      '0': 'Προγραμματισμένο',
      '1': 'Προστέθηκε',
      '2': 'Ακυρώθηκε',
      '3': 'Χωρίς πρόγραμμα',
      'SCHEDULED': 'Προγραμματισμένο',
      'ADDED': 'Προστέθηκε',
      'CANCELED': 'Ακυρώθηκε',
      'UNSCHEDULED': 'Χωρίς πρόγραμμα',
    };
    return labels[rel] || rel;
  };

  const filteredTrips = useMemo(() => {
    let filtered = trips;
    
    // Filter by selected favorite route
    if (selectedFavoriteRouteId) {
      filtered = filtered.filter(trip => trip.routeId === selectedFavoriteRouteId);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((trip) => {
        const route = getRouteDisplay(trip.routeId);
        return (
          route.shortName.toLowerCase().includes(term) ||
          route.longName.toLowerCase().includes(term) ||
          trip.routeId?.toLowerCase().includes(term)
        );
      });
    }
    
    return filtered;
  }, [trips, searchTerm, selectedFavoriteRouteId, routeNames]);
  
  // Get unique routes from trips for favorite buttons - maintain order from favoriteRouteIds
  const uniqueRoutes = useMemo(() => {
    const routesMap = new Map<string, RouteInfo>();
    trips.forEach(trip => {
      if (trip.routeId && routeNames?.has(trip.routeId)) {
        routesMap.set(trip.routeId, routeNames.get(trip.routeId)!);
      }
    });
    // Maintain order from favoriteRouteIds array
    return favoriteRouteIds
      .filter(routeId => routesMap.has(routeId))
      .slice(0, 4)
      .map(routeId => ({ routeId, info: routesMap.get(routeId)! }));
  }, [trips, routeNames, favoriteRouteIds]);

  const getMaxDelay = (trip: Trip) => {
    if (!trip.stopTimeUpdates.length) return 0;
    const delays = trip.stopTimeUpdates
      .map((stu) => stu.arrivalDelay || stu.departureDelay || 0)
      .filter((d) => d !== undefined);
    return delays.length ? Math.max(...delays) : 0;
  };

  const parseStartTime = (startTime?: string): number => {
    if (!startTime) return 0;
    const parts = startTime.split(':');
    if (parts.length >= 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  };

  const sortedTrips = useMemo(() => {
    const tripsToSort = [...filteredTrips];
    
    switch (sortOption) {
      case 'delay-desc':
        return tripsToSort.sort((a, b) => getMaxDelay(b) - getMaxDelay(a));
      case 'delay-asc':
        return tripsToSort.sort((a, b) => getMaxDelay(a) - getMaxDelay(b));
      case 'time-desc':
        return tripsToSort.sort((a, b) => parseStartTime(b.startTime) - parseStartTime(a.startTime));
      case 'time-asc':
        return tripsToSort.sort((a, b) => parseStartTime(a.startTime) - parseStartTime(b.startTime));
      case 'route-asc':
        return tripsToSort.sort((a, b) => {
          const routeA = getRouteDisplay(a.routeId).shortName;
          const routeB = getRouteDisplay(b.routeId).shortName;
          return routeA.localeCompare(routeB, 'el', { numeric: true });
        });
      default:
        return tripsToSort;
    }
  }, [filteredTrips, sortOption]);

  const getSortLabel = () => {
    switch (sortOption) {
      case 'delay-desc': return 'Καθυστέρηση ↓';
      case 'delay-asc': return 'Καθυστέρηση ↑';
      case 'time-desc': return 'Ώρα ↓';
      case 'time-asc': return 'Ώρα ↑';
      case 'route-asc': return 'Γραμμή';
      default: return 'Ταξινόμηση';
    }
  };

  const toggleExpanded = (id: string) => {
    const newSet = new Set(expandedTrips);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedTrips(newSet);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border space-y-3">
        {/* Favorite Routes - Big buttons like distance selector */}
        {uniqueRoutes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Αγαπημένα δρομολόγια:</span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {uniqueRoutes.map(({ routeId, info }) => {
                const routeColor = info.route_color ? `#${info.route_color}` : '#6B8E23';
                const textColor = info.route_text_color ? `#${info.route_text_color}` : '#FFFFFF';
                const isSelected = selectedFavoriteRouteId === routeId;
                return (
                  <Button
                    key={routeId}
                    variant={isSelected ? 'default' : 'outline'}
                    size="lg"
                    className={cn(
                      "h-16 flex flex-col items-center justify-center gap-1 font-bold text-base transition-all",
                      isSelected && "ring-2 ring-offset-2"
                    )}
                    style={isSelected ? { 
                      backgroundColor: routeColor, 
                      color: textColor,
                      borderColor: routeColor 
                    } : { borderColor: routeColor }}
                    onClick={() => setSelectedFavoriteRouteId(isSelected ? null : routeId)}
                  >
                    <Bus className="h-5 w-5" style={{ color: isSelected ? textColor : routeColor }} />
                    <span>{info.route_short_name || routeId}</span>
                  </Button>
                );
              })}
              {/* Add favorite button if less than 4 */}
              {favoriteRouteIds.length < 4 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-16 flex flex-col items-center justify-center gap-1 border-dashed"
                  onClick={() => {
                    // Find a route to add - show modal/picker
                    // For now, just log
                    console.log('Add favorite route - implement picker');
                  }}
                  title="Προσθήκη αγαπημένου"
                >
                  <Star className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">+</span>
                </Button>
              )}
            </div>
            {selectedFavoriteRouteId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setSelectedFavoriteRouteId(null)}
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
            placeholder="Αναζήτηση γραμμής (π.χ. 25, Nicosia)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>{sortedTrips.length} δρομολόγια</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="text-xs">{getSortLabel()}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortOption('delay-desc')} className={sortOption === 'delay-desc' ? 'bg-accent' : ''}>
                <ArrowDown className="h-3.5 w-3.5 mr-2" />
                Καθυστέρηση (μεγ. → μικ.)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('delay-asc')} className={sortOption === 'delay-asc' ? 'bg-accent' : ''}>
                <ArrowUp className="h-3.5 w-3.5 mr-2" />
                Καθυστέρηση (μικ. → μεγ.)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('time-asc')} className={sortOption === 'time-asc' ? 'bg-accent' : ''}>
                <ArrowUp className="h-3.5 w-3.5 mr-2" />
                Ώρα αναχώρησης (πρώτα)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('time-desc')} className={sortOption === 'time-desc' ? 'bg-accent' : ''}>
                <ArrowDown className="h-3.5 w-3.5 mr-2" />
                Ώρα αναχώρησης (τελευταία)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOption('route-asc')} className={sortOption === 'route-asc' ? 'bg-accent' : ''}>
                <ArrowUpDown className="h-3.5 w-3.5 mr-2" />
                Αριθμός γραμμής
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {isLoading && trips.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sortedTrips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <Clock className="h-12 w-12 mb-2 opacity-50" />
            <p>Δεν βρέθηκαν δρομολόγια</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sortedTrips.map((trip) => {
              const maxDelay = getMaxDelay(trip);
              const delayInfo = formatDelay(maxDelay || undefined);
              const isExpanded = expandedTrips.has(trip.id);

              return (
                <Collapsible
                  key={trip.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(trip.id)}
                >
                  <CollapsibleTrigger className="w-full p-4 hover:bg-muted/50 transition-colors text-left">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {(() => {
                          const route = getRouteDisplay(trip.routeId);
                          return (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                {route.color ? (
                                  <div 
                                    className="px-2 py-0.5 rounded text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: route.color, color: route.textColor }}
                                  >
                                    {route.shortName}
                                  </div>
                                ) : (
                                  <span className="font-mono text-sm font-medium">
                                    {route.shortName}
                                  </span>
                                )}
                                {trip.routeId && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 p-0 hover:bg-transparent"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const wasFavorite = isFavorite(trip.routeId!);
                                      toggleFavorite(trip.routeId!);
                                      if (!wasFavorite) {
                                        // Show notification when route is added to favorites
                                        const route = getRouteDisplay(trip.routeId);
                                        const routeName = route.shortName || trip.routeId;
                                        toast({
                                          title: "✅ Δρομολόγιο προστέθηκε",
                                          description: `Το δρομολόγιο "${routeName}" προστέθηκε στα αγαπημένα`,
                                        });
                                        // Also send browser notification if permission granted
                                        if ('Notification' in window && Notification.permission === 'granted') {
                                          new Notification('🚌 Δρομολόγιο προστέθηκε', {
                                            body: `Το δρομολόγιο "${routeName}" προστέθηκε στα αγαπημένα`,
                                            icon: '/pwa-192x192.png',
                                            tag: 'favorite-route-added',
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <Star className={cn("h-3.5 w-3.5", isFavorite(trip.routeId) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                                  </Button>
                                )}
                                                {delayInfo && (
                                                  <span className={`status-badge ${delayInfo.className}`}>
                                                    {delayInfo.text}
                                                  </span>
                                                )}
                                                {getDirectionLabel(trip.directionId) && (
                                                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                    {getDirectionLabel(trip.directionId)}
                                                  </span>
                                                )}
                                              </div>
                                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mb-1">
                                                <span>Trip: {trip.tripId || '-'}</span>
                                                {trip.vehicleId && (
                                                  <span>
                                                    Όχημα: {trip.vehicleId}
                                                    {trip.vehicleLabel && ` (${trip.vehicleLabel})`}
                                                  </span>
                                                )}
                                                {trip.startTime && (
                                                  <span>Αναχώρηση: {trip.startTime}</span>
                                                )}
                                                {trip.startDate && (
                                                  <span>Ημερ/νία: {trip.startDate.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}</span>
                                                )}
                                              </div>
                                              {route.longName && (
                                                <div className="text-xs text-muted-foreground mb-1">
                                                  {route.longName}
                                                </div>
                                              )}
                                              {getScheduleRelationshipLabel(trip.scheduleRelationship) && (
                                                <div className="text-xs text-muted-foreground/70">
                                                  Κατάσταση: {getScheduleRelationshipLabel(trip.scheduleRelationship)}
                                                </div>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {formatTimestamp(trip.timestamp)}
                                        </span>
                                        {isExpanded ? (
                                          <ChevronUp className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </div>
                                    </div>
                                  </CollapsibleTrigger>

                                  <CollapsibleContent>
                                    <div className="px-4 pb-4">
                                      {/* View on Map Button */}
                                      {trip.vehicleId && onTripSelect && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full mb-3 gap-2"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onTripSelect(trip);
                                          }}
                                        >
                                          <MapPin className="h-4 w-4" />
                                          Δες στον Χάρτη
                                        </Button>
                                      )}
                                      <div className="bg-muted/30 rounded-lg p-3">
                                        <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                                          Ενημερώσεις Στάσεων ({trip.stopTimeUpdates.length})
                                        </h4>
                                        {trip.stopTimeUpdates.length === 0 ? (
                                          <p className="text-sm text-muted-foreground">
                                            Δεν υπάρχουν ενημερώσεις στάσεων
                                          </p>
                                        ) : (
                                          <div className="space-y-2 max-h-48 overflow-auto scrollbar-thin">
                                            {trip.stopTimeUpdates.map((stu, idx) => {
                                              const arrDelay = formatDelay(stu.arrivalDelay);
                                              const depDelay = formatDelay(stu.departureDelay);

                                              return (
                                                <div
                                                  key={idx}
                                                  className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                                                >
                                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="w-6 h-6 bg-primary/20 text-primary rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                                                      {stu.stopSequence || idx + 1}
                                                    </span>
                                                    <span className="text-xs truncate">
                                                      {getStopName(stu.stopId)}
                                                    </span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    {arrDelay && (
                                                      <span className={`text-xs ${arrDelay.className.replace('status-', 'text-transit-')}`}>
                                                        Άφ: {arrDelay.text}
                                                      </span>
                                                    )}
                                                    {depDelay && (
                                                      <span className={`text-xs ${depDelay.className.replace('status-', 'text-transit-')}`}>
                                                        Αν: {depDelay.text}
                                                      </span>
                                                    )}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}