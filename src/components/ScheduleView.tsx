import { useState, useMemo, useEffect, useRef } from "react";
import { Calendar, Clock, Loader2, Bus, Star, X, MapPin, Route as RouteIcon, Navigation } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStaticRoutes, useRouteSchedule, useRouteShape } from "@/hooks/useGtfsData";
import { useFavoriteRouteIds } from "@/hooks/useFavoriteRouteIds";
import { toast } from "@/hooks/use-toast";
import { OPERATORS, type RouteInfo } from "@/types/gtfs";

interface ScheduleViewProps {
  selectedOperator: string;
  onOperatorChange: (operator: string) => void;
}

// Filter out 'all' option for schedule view - user must pick a specific operator
const scheduleOperators = OPERATORS.filter(op => op.id !== 'all');

// Calculate total route distance in kilometers using Haversine formula
const calculateRouteDistance = (shape: Array<{ lat: number; lng: number }>): number => {
  try {
    if (!shape || !Array.isArray(shape) || shape.length < 2) return 0;
    
    let totalDistance = 0; // in meters
    const R = 6371000; // Earth's radius in meters
    
    for (let i = 0; i < shape.length - 1; i++) {
      const p1 = shape[i];
      const p2 = shape[i + 1];
      
      // Safety check for valid coordinates
      if (!p1 || !p2 || typeof p1.lat !== 'number' || typeof p1.lng !== 'number' || 
          typeof p2.lat !== 'number' || typeof p2.lng !== 'number') {
        continue; // Skip invalid points
      }
      
      const dLat = (p2.lat - p1.lat) * Math.PI / 180;
      const dLon = (p2.lng - p1.lng) * Math.PI / 180;
      
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalDistance += R * c;
    }
    
    return totalDistance / 1000; // Convert to kilometers
  } catch (error) {
    console.error('[calculateRouteDistance] Error:', error);
    return 0;
  }
};

export function ScheduleView({ selectedOperator, onOperatorChange }: ScheduleViewProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [selectedDirection, setSelectedDirection] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const { favoriteRouteIds, isFavorite, toggleFavorite } = useFavoriteRouteIds();
  const [mapReady, setMapReady] = useState(false);
  
  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);

  const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const today = new Date().getDay();

  // Fetch routes for selected operator
  const routesQuery = useStaticRoutes(selectedOperator !== 'all' ? selectedOperator : undefined);
  
  // Fetch schedule for selected route
  const scheduleQuery = useRouteSchedule(
    selectedRoute || null, 
    selectedOperator !== 'all' ? selectedOperator : undefined
  );

  // Fetch route shape data (includes stops and shape points)
  const routeShapeQuery = useRouteShape(
    selectedRoute || null,
    selectedOperator !== 'all' ? selectedOperator : undefined
  );

  // Sort routes by short name
  const sortedRoutes = useMemo(() => {
    const routes = routesQuery.data?.data || [];
    return [...routes].sort((a, b) => {
      const aNum = parseInt(a.route_short_name || '999');
      const bNum = parseInt(b.route_short_name || '999');
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return (a.route_short_name || '').localeCompare(b.route_short_name || '');
    });
  }, [routesQuery.data]);

  // Get favorite routes that are available in current operator - maintain order from favoriteRouteIds
  const favoriteRoutes = useMemo(() => {
    const routesMap = new Map(sortedRoutes.map(route => [route.route_id, route]));
    // Maintain order from favoriteRouteIds array
    return favoriteRouteIds
      .filter(routeId => routesMap.has(routeId))
      .slice(0, 4)
      .map(routeId => routesMap.get(routeId)!);
  }, [sortedRoutes, favoriteRouteIds]);

  // Get selected route info
  const selectedRouteInfo = useMemo(() => {
    return sortedRoutes.find(r => r.route_id === selectedRoute);
  }, [sortedRoutes, selectedRoute]);

  // Get service IDs for selected day
  const activeServiceIds = useMemo(() => {
    const scheduleData = scheduleQuery.data;
    if (!scheduleData) return new Set<string>();

    if (scheduleData.calendar && scheduleData.calendar.length > 0) {
      const dayKey = dayKeys[selectedDay];
      return new Set(
        scheduleData.calendar
          .filter(cal => cal[dayKey])
          .map(cal => cal.service_id)
      );
    }

    if (scheduleData.calendar_dates && scheduleData.calendar_dates.length > 0) {
      const today = new Date();
      const targetDate = new Date(today);
      const dayDiff = selectedDay - today.getDay();
      targetDate.setDate(today.getDate() + dayDiff);
      const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');

      return new Set(
        scheduleData.calendar_dates
          .filter(cd => cd.date === dateStr && cd.exception_type === 1)
          .map(cd => cd.service_id)
      );
    }

    return new Set<string>();
  }, [scheduleQuery.data, selectedDay, dayKeys]);

  // Get available directions
  const availableDirections = useMemo(() => {
    if (!scheduleQuery.data?.by_direction) return [];
    return Object.keys(scheduleQuery.data.by_direction).map(Number);
  }, [scheduleQuery.data]);

  // Get scheduled trips
  const scheduledTrips = useMemo(() => {
    const scheduleData = scheduleQuery.data;
    if (!scheduleData?.schedule) return [];

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const directionSchedule = scheduleData.by_direction[selectedDirection] || scheduleData.schedule;
    if (!directionSchedule || directionSchedule.length === 0) return [];

    let filtered = directionSchedule;
    if (activeServiceIds.size > 0) {
      filtered = directionSchedule.filter(entry => activeServiceIds.has(entry.service_id));
    }

    return [...filtered].sort((a, b) => a.departure_minutes - b.departure_minutes);
  }, [scheduleQuery.data, selectedDirection, activeServiceIds]);

  const bgColor = selectedRouteInfo?.route_color ? `#${selectedRouteInfo.route_color}` : 'hsl(var(--primary))';

  // Initialize map when route is selected and container is ready
  useEffect(() => {
    if (!selectedRoute) {
      // Clean up if route is deselected
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
      return;
    }

    if (mapRef.current) return; // Already initialized

    if (!mapContainerRef.current) {
      console.log('[ScheduleView] Map container ref not available');
      return;
    }

    const container = mapContainerRef.current;
    let resizeObserverRef: ResizeObserver | null = null;
    
    const initMap = () => {
      if (mapRef.current) return;
      
      const rect = container.getBoundingClientRect();
      
      if (rect.width === 0 || rect.height === 0) {
        return; // Not ready yet
      }

      console.log('[ScheduleView] Initializing map, container size:', rect.width, 'x', rect.height);
      
      try {
        const map = L.map(container, {
          zoomControl: true,
          scrollWheelZoom: true,
          center: [35.0, 33.0], // Default center (Cyprus)
          zoom: 10,
        });

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        mapRef.current = map;
        setMapReady(true);
        
        // Force resize after initialization
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
            const size = mapRef.current.getSize();
            console.log('[ScheduleView] Map initialized, size:', size);
            
            // Double check and retry if size is still 0
            if (size.x === 0 || size.y === 0) {
              setTimeout(() => {
                if (mapRef.current) {
                  mapRef.current.invalidateSize(true);
                  console.log('[ScheduleView] Map size forced update');
                }
              }, 500);
            }
          }
        }, 100);
        
        // Disconnect observer if it exists
        if (resizeObserverRef) {
          resizeObserverRef.disconnect();
          resizeObserverRef = null;
        }
      } catch (error) {
        console.error('[ScheduleView] Error initializing map:', error);
      }
    };
    
    // Check immediately
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      initMap();
    } else {
      // Container not ready, use ResizeObserver
      console.log('[ScheduleView] Container not ready, waiting for dimensions...');
      
      resizeObserverRef = new ResizeObserver(() => {
        if (!mapRef.current) {
          initMap();
        }
      });
      resizeObserverRef.observe(container);
    }

    // Listen for window resize
    const handleResize = () => {
      if (mapRef.current) {
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      if (resizeObserverRef) {
        resizeObserverRef.disconnect();
      }
      window.removeEventListener('resize', handleResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [selectedRoute]);

  // Ensure map is visible and resized when data changes
  useEffect(() => {
    if (!mapRef.current || !selectedRoute) return;
    
    // Always ensure map is properly sized
    setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize(true); // Force flag
        const size = mapRef.current.getSize();
        console.log('[ScheduleView] Map resized, size:', size);
      }
    }, 200);
  }, [selectedRoute, routeShapeQuery.data, mapReady]);

  // Draw route shape and stops on map
  useEffect(() => {
    if (!mapRef.current) {
      console.log('[ScheduleView] Map not ready yet');
      return;
    }

    if (!selectedRoute) {
      console.log('[ScheduleView] No route selected');
      return;
    }

    const map = mapRef.current;

    if (!routeShapeQuery.data || !routeShapeQuery.data.directions || routeShapeQuery.data.directions.length === 0) {
      console.log('[ScheduleView] No route shape data yet, map should still be visible');
      // Map should still be visible even without route data - just ensure it's resized
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize(true);
        }
      }, 200);
      return;
    }

    console.log('[ScheduleView] Drawing route shape, directions:', routeShapeQuery.data.directions.length);

    // Clear existing route and stops
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    stopMarkersRef.current.forEach(marker => map.removeLayer(marker));
    stopMarkersRef.current = [];

    // Get current direction
    const currentDirection = routeShapeQuery.data.directions.find(
      d => (d.direction_id ?? routeShapeQuery.data.directions.indexOf(d)) === selectedDirection
    ) || routeShapeQuery.data.directions[0];

    if (!currentDirection) {
      // Even if no direction, ensure map is visible
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 100);
      return;
    }

    // Draw route polyline
    if (currentDirection.shape && currentDirection.shape.length > 0) {
      const shapePoints: L.LatLngExpression[] = currentDirection.shape
        .filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number')
        .map(p => [p.lat, p.lng] as L.LatLngExpression);
      
      if (shapePoints.length > 0) {
        routePolylineRef.current = L.polyline(shapePoints, {
          color: bgColor,
          weight: 5,
          opacity: 0.8,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Fit map to route bounds
        try {
          const bounds = L.latLngBounds(shapePoints);
          map.fitBounds(bounds, { padding: [50, 50] });
        } catch (e) {
          console.error('[ScheduleView] Error fitting bounds:', e);
          // Fallback to default center if bounds fail
          map.setView([35.0, 33.0], 10);
        }

        // Ensure map renders after bounds change
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 200);
      }
    }

    // Add stop markers
    if (currentDirection.stops && currentDirection.stops.length > 0) {
      currentDirection.stops
        .filter(stop => stop && stop.lat && stop.lng && typeof stop.lat === 'number' && typeof stop.lng === 'number')
        .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0))
        .forEach((stop, idx) => {
          const stopIcon = L.divIcon({
            className: 'route-stop-marker',
            html: `
              <div style="
                width: 24px;
                height: 24px;
                background-color: ${bgColor};
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              ">
                ${stop.stop_sequence ?? idx + 1}
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });

          const marker = L.marker([stop.lat, stop.lng], {
            icon: stopIcon,
          }).addTo(map);

          if (stop.stop_name) {
            marker.bindPopup(`<strong>${stop.stop_name}</strong><br/>Σταθμός #${stop.stop_sequence ?? idx + 1}`);
          }

          stopMarkersRef.current.push(marker);
        });

      // Final invalidateSize to ensure markers are visible
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      }, 300);
    }
  }, [routeShapeQuery.data, selectedRoute, selectedDirection, bgColor]);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Πρόγραμμα Δρομολογίων</h2>
      </div>

      {/* Favorite Routes - Big buttons like distance selector */}
      {favoriteRoutes.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Αγαπημένα δρομολόγια:</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {favoriteRoutes.map((route) => {
              const isSelected = selectedRoute === route.route_id;
              const routeColor = route.route_color ? `#${route.route_color}` : '#6B8E23';
              const textColor = route.route_text_color ? `#${route.route_text_color}` : '#FFFFFF';
              return (
                <Button
                  key={route.route_id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="lg"
                  className={cn(
                    "h-16 flex flex-col items-center justify-center gap-1 font-bold text-base transition-all",
                    isSelected && "ring-2 ring-offset-2"
                  )}
                  style={isSelected ? { 
                    backgroundColor: routeColor, 
                    color: textColor,
                  } : { borderColor: routeColor }}
                  onClick={() => setSelectedRoute(isSelected ? '' : route.route_id)}
                  title={route.route_long_name || route.route_short_name}
                >
                  <Bus className="h-5 w-5" style={{ color: isSelected ? textColor : routeColor }} />
                  <span>{route.route_short_name || route.route_id}</span>
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
                  toast({
                    title: "ℹ️ Προσθήκη αγαπημένου",
                    description: "Επιλέξτε ένα δρομολόγιο από τη λίστα και πατήστε το ⭐ για να το προσθέσετε",
                  });
                }}
                title="Προσθήκη αγαπημένου δρομολογίου"
              >
                <Star className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">+</span>
              </Button>
            )}
          </div>
          {selectedRoute && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setSelectedRoute('')}
            >
              <X className="h-3 w-3" />
              Καθαρισμός επιλογής
            </Button>
          )}
        </div>
      )}

      {/* Operator & Route Selection */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Operator Select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Φορέας</label>
          <Select value={selectedOperator} onValueChange={(val) => {
            onOperatorChange(val);
            setSelectedRoute("");
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Επιλέξτε φορέα" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {scheduleOperators.map(op => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name} {op.city && `(${op.city})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Route Select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Γραμμή</label>
          <Select 
            value={selectedRoute} 
            onValueChange={setSelectedRoute}
            disabled={!selectedOperator || selectedOperator === 'all' || routesQuery.isLoading}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder={routesQuery.isLoading ? "Φόρτωση..." : "Επιλέξτε γραμμή"} />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-[300px]">
              {sortedRoutes.map(route => (
                <SelectItem key={route.route_id} value={route.route_id}>
                  <div className="flex items-center gap-2 w-full">
                    <span 
                      className="px-1.5 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: route.route_color ? `#${route.route_color}` : 'hsl(var(--primary))' }}
                    >
                      {route.route_short_name}
                    </span>
                    <span className="truncate flex-1">{route.route_long_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 hover:bg-transparent flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const wasFavorite = isFavorite(route.route_id);
                        toggleFavorite(route.route_id);
                        if (!wasFavorite) {
                          // Show notification when route is added to favorites
                          toast({
                            title: "✅ Δρομολόγιο προστέθηκε",
                            description: `Το δρομολόγιο "${route.route_short_name || route.route_id}" προστέθηκε στα αγαπημένα`,
                          });
                          // Also send browser notification if permission granted
                          if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('🚌 Δρομολόγιο προστέθηκε', {
                              body: `Το δρομολόγιο "${route.route_short_name || route.route_id}" προστέθηκε στα αγαπημένα`,
                              icon: '/pwa-192x192.png',
                              tag: 'favorite-route-added',
                            });
                          }
                        }
                      }}
                    >
                      <Star className={cn("h-3.5 w-3.5", isFavorite(route.route_id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                    </Button>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Schedule Content */}
      {!selectedRoute ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Bus className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Επιλέξτε φορέα και γραμμή για να δείτε το πρόγραμμα</p>
          </div>
        </div>
      ) : scheduleQuery.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Route Info Header */}
          {selectedRouteInfo && (
            <div 
              className="p-3 rounded-lg mb-3 flex items-center gap-3"
              style={{ backgroundColor: bgColor }}
            >
              <span className="bg-white/20 text-white text-lg font-bold px-3 py-1 rounded">
                {selectedRouteInfo.route_short_name}
              </span>
              <span className="text-white font-medium">
                {selectedRouteInfo.route_long_name}
              </span>
            </div>
          )}

          {/* Split Layout: Left = Map/Shape, Right = Schedule by Week */}
          {routeShapeQuery.isLoading ? (
            <div className="mb-4 p-4 rounded-lg border bg-muted/30 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary mr-2" />
              <span className="text-sm text-muted-foreground">Φόρτωση χάρτη διαδρομής...</span>
            </div>
          ) : routeShapeQuery.data && routeShapeQuery.data.directions && routeShapeQuery.data.directions.length > 0 ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden" style={{ height: 'calc(100% - 20px)', minHeight: '600px' }}>
              {/* Left: Map with Shape File and Distance in km */}
              <div className="flex flex-col overflow-hidden space-y-3 h-full">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RouteIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Χάρτης Διαδρομής</h3>
                </div>

                {/* Direction Tabs */}
                {routeShapeQuery.data.directions.length > 1 && (
                  <div className="flex gap-2 flex-shrink-0">
                    {routeShapeQuery.data.directions.map((dir, idx) => (
                      <Button
                        key={dir.direction_id || idx}
                        variant={selectedDirection === (dir.direction_id ?? idx) ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedDirection(dir.direction_id ?? idx)}
                      >
                        {dir.direction_id === 0 ? "Μετάβαση" : "Επιστροφή"} {dir.direction_name ? `(${dir.direction_name})` : ''}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Selected Direction Info */}
                {(() => {
                  const currentDirection = routeShapeQuery.data.directions.find(
                    d => (d.direction_id ?? routeShapeQuery.data.directions.indexOf(d)) === selectedDirection
                  ) || routeShapeQuery.data.directions[0];

                  if (!currentDirection) return null;

                  const distanceKm = calculateRouteDistance(currentDirection.shape || []);
                  const stopsCount = currentDirection.stops?.length || 0;

                  return (
                    <div className="flex-1 flex flex-col space-y-3 overflow-hidden" style={{ height: '100%', minHeight: 0 }}>
                      {/* Statistics */}
                      <div className="grid grid-cols-2 gap-3 flex-shrink-0">
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Navigation className="h-4 w-4 text-primary" />
                            <span className="text-xs text-muted-foreground">Συνολική Διαδρομή</span>
                          </div>
                          <div className="text-xl font-bold">{distanceKm.toFixed(2)} km</div>
                        </div>
                        <div className="p-3 rounded-lg bg-secondary/50 border">
                          <div className="flex items-center gap-2 mb-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Στάσεις</span>
                          </div>
                          <div className="text-xl font-bold">{stopsCount}</div>
                        </div>
                      </div>

                      {/* Map with Route Shape and Stops */}
                      <div className="flex-1 rounded-lg border overflow-hidden bg-muted/30 relative" style={{ minHeight: '400px', height: '100%' }}>
                        <div 
                          ref={mapContainerRef}
                          className="w-full h-full"
                          style={{ 
                            width: '100%', 
                            height: '100%',
                            minHeight: '400px',
                            display: mapReady ? 'block' : 'none'
                          }}
                        />
                        {!mapReady && (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-10 bg-background/90">
                            <div className="text-center">
                              <Loader2 className="h-12 w-12 mx-auto mb-2 opacity-30 animate-spin" />
                              <p className="text-sm">Προετοιμασία χάρτη...</p>
                            </div>
                          </div>
                        )}
                        {mapReady && routeShapeQuery.isLoading && (!currentDirection?.shape || currentDirection.shape.length === 0) ? (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-10 bg-background/70 pointer-events-none">
                            <div className="text-center">
                              <Loader2 className="h-12 w-12 mx-auto mb-2 opacity-30 animate-spin" />
                              <p className="text-sm">Φόρτωση διαδρομής...</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Right: Schedule by Week */}
              <div className="flex flex-col overflow-hidden space-y-3 h-full">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Calendar className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-semibold">Πρόγραμμα Εβδομάδας</h3>
                </div>

                {/* Direction Selector */}
                {availableDirections.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Κατεύθυνση:</span>
                    {availableDirections.map((dir) => (
                      <Button
                        key={dir}
                        variant={selectedDirection === dir ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedDirection(dir)}
                      >
                        {dir === 0 ? "Μετάβαση" : "Επιστροφή"}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Schedule for all days - compute trips for each day */}
                {(() => {
                  const scheduleData = scheduleQuery.data;
                  const directionSchedule = scheduleData?.by_direction[selectedDirection] || scheduleData?.schedule || [];
                  
                  // Calculate trips for each day
                  const tripsByDay = dayNames.map((_, dayIdx) => {
                    let dayServiceIds = new Set<string>();

                    if (scheduleData) {
                      if (scheduleData.calendar && scheduleData.calendar.length > 0) {
                        const dayKey = dayKeys[dayIdx];
                        dayServiceIds = new Set(
                          scheduleData.calendar
                            .filter(cal => cal[dayKey])
                            .map(cal => cal.service_id)
                        );
                      } else if (scheduleData.calendar_dates && scheduleData.calendar_dates.length > 0) {
                        const now = new Date();
                        const targetDate = new Date(now);
                        const dayDiff = dayIdx - now.getDay();
                        targetDate.setDate(now.getDate() + dayDiff);
                        const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');

                        dayServiceIds = new Set(
                          scheduleData.calendar_dates
                            .filter(cd => cd.date === dateStr && cd.exception_type === 1)
                            .map(cd => cd.service_id)
                        );
                      }
                    }

                    let filtered = directionSchedule;
                    if (dayServiceIds.size > 0 && filtered.length > 0) {
                      filtered = filtered.filter(entry => dayServiceIds.has(entry.service_id));
                    }

                    return [...filtered].sort((a, b) => a.departure_minutes - b.departure_minutes);
                  });

                  const now = new Date();
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();

                  // Reorder days to start from today
                  const reorderedDays = [];
                  for (let i = 0; i < dayNames.length; i++) {
                    const dayIdx = (today + i) % dayNames.length;
                    reorderedDays.push({ dayIdx, dayName: dayNames[dayIdx], dayTrips: tripsByDay[dayIdx] });
                  }

                  return (
                    <div className="flex-1 overflow-auto space-y-3 pr-2">
                      {reorderedDays.map(({ dayIdx, dayName, dayTrips }) => {
                        const isToday = dayIdx === today;

                        return (

                          <div 
                            key={dayIdx} 
                            className={cn(
                              "p-3 rounded-lg border bg-card",
                              isToday && "ring-2 ring-primary/50 bg-primary/5"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                "text-sm font-semibold",
                                isToday && "text-primary"
                              )}>
                                {dayName}
                                {isToday && <span className="ml-1 text-xs">(σήμερα)</span>}
                              </span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {dayTrips.length} δρομολόγια
                              </span>
                            </div>
                            {dayTrips.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-2">
                                Δεν υπάρχουν δρομολόγια
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {dayTrips.map((entry) => {
                                  const isPast = isToday && entry.departure_minutes < currentMinutes;
                                  const isNext = isToday && !isPast && 
                                    entry.departure_minutes >= currentMinutes &&
                                    (dayTrips.findIndex(t => t.trip_id === entry.trip_id) === 0 || 
                                     dayTrips[dayTrips.findIndex(t => t.trip_id === entry.trip_id) - 1]?.departure_minutes < currentMinutes);

                                  return (
                                    <span
                                      key={entry.trip_id}
                                      className={cn(
                                        "inline-block px-2 py-0.5 rounded text-xs font-mono transition-all",
                                        isPast && "bg-muted/50 text-muted-foreground/50",
                                        isNext && "bg-primary text-white shadow-md scale-105",
                                        !isPast && !isNext && "bg-primary/20",
                                      )}
                                      style={!isPast && !isNext ? { color: bgColor, borderColor: bgColor } : undefined}
                                    >
                                      {entry.departure_time}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}