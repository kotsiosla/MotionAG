import { useState, useMemo, useEffect, useRef } from "react";
import { Calendar, Clock, Loader2, Bus, Star, X, MapPin, Route as RouteIcon, Navigation, Maximize2 } from "lucide-react";
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
  const mapReadyRef = useRef(false); // Track map ready state in ref for closure access
  
  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.Marker[]>([]);
  const userInteractedRef = useRef(false); // Track if user has manually interacted with map
  const lastFittedRouteRef = useRef<string | null>(null); // Track last route we auto-fitted

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

  // Initialize map when route is selected - simple approach like VehicleMap
  useEffect(() => {
    if (!selectedRoute) {
      // Cleanup when no route selected
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
      return;
    }

    if (!mapContainerRef.current || mapRef.current) {
      return; // Container not ready or already initialized
    }

    const container = mapContainerRef.current;
    
    // Ensure container has proper dimensions before initialization
    container.style.display = 'block';
    container.style.width = '100%';
    // Use 100% height for responsive layout, with min-height for mobile
    container.style.height = '100%';
    container.style.minHeight = '300px';
    container.style.position = 'relative';
    container.style.overflow = 'hidden';
    
    // Initialize map immediately (like VehicleMap does)
    try {
      console.log('[ScheduleView] Initializing map...');
      const map = L.map(container, {
        zoomControl: true,
        scrollWheelZoom: true,
        center: [35.0, 33.0], // Default center (Cyprus)
        zoom: 10,
        maxZoom: 18,
        minZoom: 8,
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Track user interactions (zoom, pan, drag) to disable auto-fit
      map.on('zoomstart', () => {
        userInteractedRef.current = true;
        console.log('[ScheduleView] User zoom detected');
      });
      
      map.on('dragstart', () => {
        userInteractedRef.current = true;
        console.log('[ScheduleView] User drag detected');
      });
      
      // Track mouse wheel zoom
      map.on('wheel', () => {
        userInteractedRef.current = true;
      });

      mapRef.current = map;
      console.log('[ScheduleView] Map created');
      
      // Reset interaction flag and map ready state when route changes
      userInteractedRef.current = false;
      lastFittedRouteRef.current = null;
      mapReadyRef.current = false;
      
      // Listen for window resize - define BEFORE cleanup
      const handleResize = () => {
        if (mapRef.current) {
          setTimeout(() => {
            mapRef.current?.invalidateSize(true);
          }, 100);
        }
      };

      window.addEventListener('resize', handleResize);
      
      // Store handleResize in a way that's accessible to cleanup
      const cleanupHandleResize = handleResize;

      // Check if map is ready - similar to VehicleMap
      let checkCount = 0;
      const maxChecks = 20; // Max 4 seconds of retries
      let isCheckingReady = true; // Flag to stop checking once ready
      let checkReadyTimeout: NodeJS.Timeout | null = null;
      
      const checkReady = () => {
        // Stop checking if already marked as ready
        if (!isCheckingReady) {
          return;
        }
        
        checkCount++;
        if (checkCount > maxChecks) {
          console.warn('[ScheduleView] Map ready check timeout - forcing ready state');
          isCheckingReady = false;
          setMapReady(true);
          return;
        }
        
        if (!mapRef.current) {
          console.log(`[ScheduleView] Map ref is null (check ${checkCount}/${maxChecks}), retrying...`);
          if (isCheckingReady) {
            checkReadyTimeout = setTimeout(checkReady, 200);
          }
          return;
        }
        
        // Check container dimensions first
        const rect = container.getBoundingClientRect();
        console.log(`[ScheduleView] Check ${checkCount}/${maxChecks} - Container rect:`, rect.width, 'x', rect.height);
        
        if (rect.width === 0 || rect.height === 0) {
          console.log('[ScheduleView] Container has no dimensions yet, retrying...');
          if (isCheckingReady) {
            checkReadyTimeout = setTimeout(checkReady, 200);
          }
          return;
        }
        
        try {
          // Force invalidate size
          mapRef.current.invalidateSize(true);
          
          // Verify zoom is accessible
          const zoom = mapRef.current.getZoom();
          const size = mapRef.current.getSize();
          console.log('[ScheduleView] Map size:', size, 'zoom:', zoom);
          
          // Check if map is already marked as ready (to prevent re-checking after fitBounds)
          if (mapReadyRef.current) {
            // Map is already ready, don't check again
            isCheckingReady = false;
            if (checkReadyTimeout) {
              clearTimeout(checkReadyTimeout);
              checkReadyTimeout = null;
            }
            return;
          }
          
          if (typeof zoom === 'number' && size.x > 0 && size.y > 0) {
            // Map is ready - stop all checking
            isCheckingReady = false;
            mapReadyRef.current = true;
            if (checkReadyTimeout) {
              clearTimeout(checkReadyTimeout);
              checkReadyTimeout = null;
            }
            setMapReady(true);
            console.log('[ScheduleView] Map is ready!');
            return; // Exit early
          }
          
          // Size might be 0 temporarily during fitBounds animation - check container instead
          if (rect.width > 0 && rect.height > 0 && typeof zoom === 'number') {
            // Container has size and zoom is valid, map is likely ready but size is temporarily 0
            console.log('[ScheduleView] Map appears ready (container has size, zoom valid), but map size is 0 - likely during animation');
            isCheckingReady = false;
            mapReadyRef.current = true;
            if (checkReadyTimeout) {
              clearTimeout(checkReadyTimeout);
              checkReadyTimeout = null;
            }
            setMapReady(true);
            return; // Exit early
          }
          
          // Not ready yet, retry only if still checking
          if (isCheckingReady) {
            console.log('[ScheduleView] Map not fully ready (size or zoom invalid), retrying...');
            checkReadyTimeout = setTimeout(checkReady, 200);
          }
        } catch (e) {
          // Map not ready yet, retry
          console.log('[ScheduleView] Map getZoom/getSize failed, retrying...', e);
          if (isCheckingReady) {
            checkReadyTimeout = setTimeout(checkReady, 200);
          }
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      const readyTimeout = setTimeout(() => {
        requestAnimationFrame(checkReady);
      }, 150);
      
      // Also try after a delay in case container needs time to render
      const retryTimeout = setTimeout(() => {
        if (mapRef.current) {
          console.log('[ScheduleView] Retry checkReady - container size:', container.offsetWidth, 'x', container.offsetHeight);
          checkReady();
        }
      }, 500);
      
      return () => {
        // Stop all checking
        isCheckingReady = false;
        if (checkReadyTimeout) {
          clearTimeout(checkReadyTimeout);
          checkReadyTimeout = null;
        }
        clearTimeout(readyTimeout);
        clearTimeout(retryTimeout);
        window.removeEventListener('resize', cleanupHandleResize);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          setMapReady(false);
        }
        // Reset interaction tracking when route changes
        userInteractedRef.current = false;
        lastFittedRouteRef.current = null;
      };
      
    } catch (error) {
      console.error('[ScheduleView] Error initializing map:', error);
      
      // Cleanup on error - handleResize might not be defined if error occurred early
      return () => {
        try {
          // cleanupHandleResize might not exist if error occurred before it was defined
          if (typeof cleanupHandleResize !== 'undefined') {
            window.removeEventListener('resize', cleanupHandleResize);
          }
        } catch (e) {
          // Ignore if cleanupHandleResize doesn't exist
        }
        mapReadyRef.current = false;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
          setMapReady(false);
        }
        userInteractedRef.current = false;
        lastFittedRouteRef.current = null;
      };
    }
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
      console.warn('[ScheduleView] No route shape data available for route:', selectedRoute);
      if (routeShapeQuery.isError) {
        console.error('[ScheduleView] Route shape query error:', routeShapeQuery.error);
      }
      // Map should still be visible even without route data - just ensure it's resized
      setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize(true);
        }
      }, 200);
      return;
    }

    console.log('[ScheduleView] Drawing route shape, directions:', routeShapeQuery.data.directions.length);
    
    // Check if any direction has empty shape
    routeShapeQuery.data.directions.forEach((dir, idx) => {
      if (!dir.shape || dir.shape.length === 0) {
        console.warn(`[ScheduleView] Direction ${dir.direction_id ?? idx} has no shape data (${dir.stops?.length || 0} stops available)`);
      }
    });

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

        // Collect all points for bounds calculation (shape + stops)
        const allPoints: L.LatLngExpression[] = [...shapePoints];
        
        // Add stop positions to bounds calculation
        if (currentDirection.stops && currentDirection.stops.length > 0) {
          currentDirection.stops.forEach(stop => {
            if (stop.lat && stop.lng && typeof stop.lat === 'number' && typeof stop.lng === 'number') {
              allPoints.push([stop.lat, stop.lng]);
            }
          });
        }

        // Fit map to route bounds - include all stops too
        // Only auto-fit if:
        // 1. Route has changed (not just direction)
        // 2. User hasn't manually interacted with the map
        const routeKey = `${selectedRoute}-${selectedDirection}`;
        const shouldAutoFit = !userInteractedRef.current || lastFittedRouteRef.current !== routeKey;
        
        if (shouldAutoFit) {
          // Use requestAnimationFrame to ensure map is fully rendered before fitting
          requestAnimationFrame(() => {
            if (!mapRef.current || allPoints.length === 0) return;
            
            // Force invalidate size first to ensure map has correct dimensions
            mapRef.current.invalidateSize(true);
            
            try {
              const bounds = L.latLngBounds(allPoints);
              const boundsSize = bounds.getNorthEast().distanceTo(bounds.getSouthWest());
              console.log('[ScheduleView] Route bounds size:', boundsSize.toFixed(2), 'km');
              
              // Adjust padding based on route size
              // Smaller routes need less padding, larger routes need more
              let padding: [number, number] = [80, 80];
              if (boundsSize < 5) {
                padding = [60, 60]; // Small routes
              } else if (boundsSize > 50) {
                padding = [100, 100]; // Very large routes
              }
              
              // Temporarily disable interaction tracking during programmatic fit
              const wasInteracting = userInteractedRef.current;
              userInteractedRef.current = false;
              
              // Fit bounds with dynamic padding and max zoom
              mapRef.current.fitBounds(bounds, { 
                padding: padding,
                maxZoom: 14, // Prevent too much zoom in
                animate: true
              });
              
              // Restore interaction state after fit (but allow one auto-fit per route)
              lastFittedRouteRef.current = routeKey;
              userInteractedRef.current = wasInteracting;
              
              console.log('[ScheduleView] Fitted bounds to route, padding:', padding);
              
              // Double-check after animation completes (only if user hasn't interacted)
              setTimeout(() => {
                if (mapRef.current && !userInteractedRef.current) {
                  mapRef.current.invalidateSize(true);
                  const currentZoom = mapRef.current.getZoom();
                  const currentBounds = mapRef.current.getBounds();
                  
                  // Verify bounds include all points
                  let allInBounds = true;
                  for (const point of allPoints) {
                    if (Array.isArray(point) && !currentBounds.contains([point[0], point[1]])) {
                      allInBounds = false;
                      break;
                    }
                  }
                  
                  // Only auto-adjust if user hasn't interacted
                  if ((currentZoom > 15 || currentZoom < 8 || !allInBounds) && !userInteractedRef.current) {
                    console.log('[ScheduleView] Adjusting bounds - zoom:', currentZoom, 'allInBounds:', allInBounds);
                    try {
                      userInteractedRef.current = false; // Temporarily disable
                      const bounds = L.latLngBounds(allPoints);
                      mapRef.current.fitBounds(bounds, { 
                        padding: padding,
                        maxZoom: 14,
                        animate: false
                      });
                      userInteractedRef.current = false; // Keep disabled after programmatic adjust
                    } catch (e) {
                      console.error('[ScheduleView] Error adjusting bounds:', e);
                    }
                  }
                }
              }, 400);
            } catch (e) {
              console.error('[ScheduleView] Error fitting bounds:', e);
              // Fallback to default center if bounds fail (only if user hasn't interacted)
              if (mapRef.current && !userInteractedRef.current) {
                mapRef.current.setView([35.0, 33.0], 10);
              }
            }
          });
        } else {
          console.log('[ScheduleView] Skipping auto-fit - user has interacted with map');
        }
      }
    } else {
      // No shape data - use stops as fallback
      console.warn(`[ScheduleView] No shape data for direction ${selectedDirection}. Using stops as fallback.`);
      
      if (currentDirection.stops && currentDirection.stops.length > 0) {
        const stopPoints: L.LatLngExpression[] = currentDirection.stops
          .filter(stop => stop.lat && stop.lng && typeof stop.lat === 'number' && typeof stop.lng === 'number')
          .sort((a, b) => (a.stop_sequence || 0) - (b.stop_sequence || 0))
          .map(stop => [stop.lat!, stop.lng!] as L.LatLngExpression);
        
        if (stopPoints.length > 1) {
          console.log(`[ScheduleView] Drawing approximate route using ${stopPoints.length} stops`);
          routePolylineRef.current = L.polyline(stopPoints, {
            color: bgColor,
            weight: 4,
            opacity: 0.6,
            lineCap: 'round',
            lineJoin: 'round',
            dashArray: '10, 5', // Dashed line to indicate it's approximate
          }).addTo(map);
          
          // Fit bounds to stops
          try {
            const bounds = L.latLngBounds(stopPoints);
            map.fitBounds(bounds, { 
              padding: [80, 80],
              maxZoom: 14,
              animate: true
            });
          } catch (e) {
            console.error('[ScheduleView] Error fitting bounds to stops:', e);
          }
        }
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
    <div className="h-full flex flex-col p-2 lg:p-4 overflow-hidden">
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
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 overflow-hidden" style={{ height: 'calc(100% - 20px)', minHeight: '500px' }}>
              {/* Left: Map with Shape File and Distance in km */}
              <div className="flex flex-col overflow-hidden space-y-2 lg:space-y-3 h-full min-h-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <RouteIcon className="h-4 w-4 lg:h-5 lg:w-5 text-primary" />
                  <h3 className="text-sm lg:text-base font-semibold">Χάρτης Διαδρομής</h3>
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
                    <div className="flex-1 flex flex-col space-y-2 lg:space-y-3 overflow-hidden" style={{ height: '100%', minHeight: 0 }}>
                      {/* Statistics */}
                      <div className="grid grid-cols-2 gap-2 lg:gap-3 flex-shrink-0">
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
                      
                      {/* Fit to Route Button */}
                      {mapReady && currentDirection.shape && currentDirection.shape.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 w-full flex-shrink-0"
                          onClick={() => {
                            if (!mapRef.current) return;
                            
                            try {
                              const shapePoints: L.LatLngExpression[] = currentDirection.shape!
                                .filter(p => p && typeof p.lat === 'number' && typeof p.lng === 'number')
                                .map(p => [p.lat, p.lng] as L.LatLngExpression);
                              
                              const allPoints: L.LatLngExpression[] = [...shapePoints];
                              
                              // Add stop positions
                              if (currentDirection.stops && currentDirection.stops.length > 0) {
                                currentDirection.stops.forEach(stop => {
                                  if (stop.lat && stop.lng && typeof stop.lat === 'number' && typeof stop.lng === 'number') {
                                    allPoints.push([stop.lat, stop.lng]);
                                  }
                                });
                              }
                              
                              if (allPoints.length > 0) {
                                const bounds = L.latLngBounds(allPoints);
                                mapRef.current.fitBounds(bounds, { 
                                  padding: [80, 80],
                                  maxZoom: 14,
                                  animate: true
                                });
                                console.log('[ScheduleView] Fitted bounds to show all route and stops');
                              }
                            } catch (e) {
                              console.error('[ScheduleView] Error fitting bounds:', e);
                            }
                          }}
                        >
                          <Maximize2 className="h-3 w-3" />
                          Εμφάνιση όλης της διαδρομής
                        </Button>
                      )}

                      {/* Map with Route Shape and Stops */}
                      <div className="flex-1 rounded-lg border overflow-hidden bg-muted/30 relative" style={{ minHeight: '300px', height: '100%' }}>
                        <div 
                          ref={mapContainerRef}
                          className="w-full h-full"
                          style={{ 
                            width: '100%', 
                            height: '100%',
                            minHeight: '300px',
                            display: 'block',
                            position: 'relative',
                            zIndex: 1
                          }}
                        />
                        {!mapReady && (
                          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground z-50 bg-background/95 pointer-events-none">
                            <div className="text-center pointer-events-auto">
                              <Loader2 className="h-12 w-12 mx-auto mb-2 opacity-30 animate-spin" />
                              <p className="text-sm">Προετοιμασία χάρτη...</p>
                              <p className="text-xs mt-2 opacity-50">Container: {mapContainerRef.current ? `${mapContainerRef.current.offsetWidth}x${mapContainerRef.current.offsetHeight}` : 'null'}</p>
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
                    <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 lg:space-y-3 pr-1 lg:pr-2 scrollbar-thin">
                      {reorderedDays.map(({ dayIdx, dayName, dayTrips }) => {
                        const isToday = dayIdx === today;

                        return (
                          <div 
                            key={dayIdx} 
                            className={cn(
                              "p-2 lg:p-3 rounded-lg border bg-card flex-shrink-0",
                              isToday && "ring-2 ring-primary/50 bg-primary/5"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn(
                                "text-xs lg:text-sm font-semibold",
                                isToday && "text-primary"
                              )}>
                                {dayName}
                                {isToday && <span className="ml-1 text-[10px] lg:text-xs">(σήμερα)</span>}
                              </span>
                              <span className="text-[10px] lg:text-xs text-muted-foreground ml-auto">
                                {dayTrips.length} δρομολόγια
                              </span>
                            </div>
                            {dayTrips.length === 0 ? (
                              <div className="text-xs text-muted-foreground py-2">
                                Δεν υπάρχουν δρομολόγια
                              </div>
                            ) : (
                              <div 
                                className="flex gap-1.5 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1"
                                style={{
                                  scrollbarWidth: 'thin',
                                  WebkitOverflowScrolling: 'touch',
                                  scrollBehavior: 'smooth',
                                }}
                              >
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
                                        "inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-mono transition-all flex-shrink-0",
                                        "select-none touch-none", // Prevent text selection and touch callouts
                                        isPast && "bg-muted/50 text-muted-foreground/50",
                                        isNext && "bg-primary text-white shadow-md scale-105 ring-2 ring-primary/30",
                                        !isPast && !isNext && "bg-primary/20 border border-primary/30",
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