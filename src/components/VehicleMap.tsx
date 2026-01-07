import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { X, Navigation, MapPin, Clock, LocateFixed, Search, Loader2, Home, ZoomIn, ZoomOut, Route, Maximize2, Focus, Share2, Layers, Sun, Moon, Satellite } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { SchedulePanel } from "@/components/SchedulePanel";
import { ResizableDraggablePanel } from "@/components/ResizableDraggablePanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RouteStopsPanel } from "@/components/RouteStopsPanel";
import { RoutePlannerPanel } from "@/components/RoutePlannerPanel";
import { StopDetailPanel } from "@/components/StopDetailPanel";
import { NearestStopPanel } from "@/components/NearestStopPanel";
import { VehicleFollowPanel } from "@/components/VehicleFollowPanel";
import { DataSourceHealthIndicator } from "@/components/DataSourceHealthIndicator";
import { useRouteShape } from "@/hooks/useGtfsData";
import { useStopNotifications } from "@/hooks/useStopNotifications";
import { useStopArrivalNotifications } from "@/hooks/useStopArrivalNotifications";
import type { Vehicle, StaticStop, Trip, RouteInfo } from "@/types/gtfs";

export type MapStyleType = 'light' | 'dark' | 'satellite';

interface VehicleMapProps {
  vehicles: Vehicle[];
  trips?: Trip[];
  stops?: StaticStop[];
  routeNamesMap?: Map<string, RouteInfo>;
  selectedRoute?: string;
  selectedOperator?: string;
  onRouteClose?: () => void;
  isLoading: boolean;
  highlightedStop?: StaticStop | null;
  followVehicleId?: string | null;
  onFollowVehicle?: (vehicleId: string | null) => void;
  refreshInterval?: number;
  lastUpdate?: number | null;
  deepLinkStopId?: string | null;
  onStopPanelChange?: (stopId: string | null) => void;
  mapStyle?: MapStyleType;
  onMapStyleChange?: (style: MapStyleType) => void;
}

const createVehicleIcon = (bearing?: number, isFollowed?: boolean, routeColor?: string, isOnSelectedRoute?: boolean, routeShortName?: string) => {
  const bgColor = routeColor ? `#${routeColor}` : '#0ea5e9'; // Sky blue default
  
  // Get base path for GitHub Pages compatibility
  const basePath = import.meta.env.BASE_URL || (window.location.pathname.startsWith('/MotionBus_AI') ? '/MotionBus_AI/' : '/');
  const busIconPath = `${basePath}images/bus-icon.png`.replace('//', '/');
  
  // Use the uploaded bus icon image
  const iconSize = isFollowed ? 48 : (isOnSelectedRoute ? 40 : 32);
  
  // Professional bus marker with image
  if (isOnSelectedRoute || isFollowed) {
    return L.divIcon({
      className: 'route-vehicle-marker',
      html: `
        <div style="
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
        ">
          ${routeShortName ? `
            <div style="
              background: ${bgColor};
              color: white;
              font-size: ${isFollowed ? '12px' : '10px'};
              font-weight: 700;
              padding: 3px 6px;
              border-radius: 4px;
              margin-bottom: 2px;
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.4);
              border: 2px solid white;
              z-index: 10;
            ">${routeShortName}</div>
          ` : ''}
          <div style="
            width: ${iconSize}px;
            height: ${iconSize}px;
            filter: drop-shadow(0 3px 6px rgba(0,0,0,0.4));
          ">
            <img src="${busIconPath}" 
              style="width: 100%; height: 100%; object-fit: contain;"
              alt="Bus"
            />
          </div>
        </div>
      `,
      iconSize: [iconSize, routeShortName ? iconSize + 28 : iconSize],
      iconAnchor: [iconSize / 2, routeShortName ? iconSize + 28 : iconSize / 2],
    });
  }
  
  // Standard marker for all other vehicles - also use the bus icon but smaller
  return L.divIcon({
    className: 'vehicle-marker',
    html: `
      <div style="
        width: ${iconSize}px;
        height: ${iconSize}px;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
      ">
        <img src="${busIconPath}" 
          style="width: 100%; height: 100%; object-fit: contain;"
          alt="Bus"
        />
      </div>
    `,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
  });
};

// Calculate bearing between two points (in degrees, 0 = North, 90 = East)
const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;
  
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - 
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  
  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360; // Normalize to 0-360
};

const createStopIcon = (hasVehicleStopped?: boolean, sequenceNumber?: number, routeColor?: string, hasImminent?: boolean) => {
  const bgColor = hasVehicleStopped ? '#22c55e' : (sequenceNumber !== undefined ? (routeColor ? `#${routeColor}` : '#0ea5e9') : '#f97316');
  const size = sequenceNumber !== undefined ? 'w-6 h-6' : 'w-5 h-5';
  const fontSize = sequenceNumber !== undefined ? 'text-[10px]' : '';
  const pulseClass = hasVehicleStopped ? 'stop-vehicle-present' : (hasImminent ? 'stop-imminent-arrival' : '');
  
  return L.divIcon({
    className: 'stop-marker',
    html: `
      <div class="${size} rounded-full flex items-center justify-center shadow-md border-2 border-white ${pulseClass}" style="background: ${bgColor}">
        ${sequenceNumber !== undefined 
          ? `<span class="${fontSize} font-bold text-white">${sequenceNumber}</span>`
          : `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              ${hasVehicleStopped 
                ? '<rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="7" cy="18" r="1.5" fill="white"/><circle cx="17" cy="18" r="1.5" fill="white"/>' 
                : '<circle cx="12" cy="12" r="3"/>'}
            </svg>`
        }
      </div>
    `,
    iconSize: sequenceNumber !== undefined ? [24, 24] : [20, 20],
    iconAnchor: sequenceNumber !== undefined ? [12, 12] : [10, 10],
  });
};

// Find the closest point index on a route shape to a given lat/lng
const findClosestPointOnRoute = (
  lat: number, 
  lng: number, 
  shape: Array<{ lat: number; lng: number }>
): number => {
  let closestIndex = 0;
  let minDistance = Infinity;
  
  for (let i = 0; i < shape.length; i++) {
    const dx = shape[i].lng - lng;
    const dy = shape[i].lat - lat;
    const distance = dx * dx + dy * dy;
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = i;
    }
  }
  
  return closestIndex;
};

// Find exact point on route line (interpolated between shape points)
const snapToRouteLine = (
  lat: number,
  lng: number,
  shape: Array<{ lat: number; lng: number }>
): { lat: number; lng: number; bearing: number; index: number } | null => {
  if (shape.length < 2) return null;
  
  let closestPoint = { lat, lng };
  let minDistance = Infinity;
  let closestIndex = 0;
  let bearing = 0;
  
  for (let i = 0; i < shape.length - 1; i++) {
    const p1 = shape[i];
    const p2 = shape[i + 1];
    
    // Project point onto line segment
    const dx = p2.lng - p1.lng;
    const dy = p2.lat - p1.lat;
    const segmentLengthSq = dx * dx + dy * dy;
    
    if (segmentLengthSq === 0) continue;
    
    // Parameter t indicates where on the segment the projection falls
    let t = ((lng - p1.lng) * dx + (lat - p1.lat) * dy) / segmentLengthSq;
    t = Math.max(0, Math.min(1, t)); // Clamp to segment
    
    const projectedLng = p1.lng + t * dx;
    const projectedLat = p1.lat + t * dy;
    
    const distSq = Math.pow(lng - projectedLng, 2) + Math.pow(lat - projectedLat, 2);
    
    if (distSq < minDistance) {
      minDistance = distSq;
      closestPoint = { lat: projectedLat, lng: projectedLng };
      closestIndex = i;
      // Calculate bearing along the segment
      bearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
    }
  }
  
  // Only snap if within ~200 meters of the route (increased for GPS inaccuracy)
  const thresholdSq = Math.pow(0.002, 2); // ~200m
  if (minDistance > thresholdSq) return null;
  
  return { ...closestPoint, bearing, index: closestIndex };
};

const formatTimestamp = (timestamp?: number) => {
  if (!timestamp) return 'Άγνωστο';
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('el-GR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getRelativeTime = (timestamp?: number): { text: string; color: string; isLive: boolean } => {
  if (!timestamp) return { text: 'Άγνωστο', color: '#888', isLive: false };
  
  const now = Date.now() / 1000;
  const diff = now - timestamp;
  
  if (diff < 30) {
    return { text: 'Τώρα', color: '#22c55e', isLive: true }; // green
  } else if (diff < 60) {
    return { text: `πριν ${Math.floor(diff)} δευτ.`, color: '#22c55e', isLive: true }; // green
  } else if (diff < 120) {
    return { text: 'πριν 1 λεπτό', color: '#eab308', isLive: true }; // yellow
  } else if (diff < 300) {
    return { text: `πριν ${Math.floor(diff / 60)} λεπτά`, color: '#eab308', isLive: true }; // yellow
  } else if (diff < 600) {
    return { text: `πριν ${Math.floor(diff / 60)} λεπτά`, color: '#f97316', isLive: false }; // orange
  } else {
    return { text: `πριν ${Math.floor(diff / 60)} λεπτά`, color: '#ef4444', isLive: false }; // red
  }
};

const formatSpeed = (speed?: number) => {
  if (speed === undefined || speed === null) return 'Άγνωστο';
  return `${(speed * 3.6).toFixed(1)} km/h`;
};

const formatETA = (arrivalTime?: number) => {
  if (!arrivalTime) return null;
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
  if (minutes === 0) return '(στην ώρα)';
  if (minutes > 0) return `(+${minutes} λεπτά)`;
  return `(${minutes} λεπτά)`;
};

// Auto-refresh indicator component
const RefreshIndicator = ({ 
  refreshInterval, 
  lastUpdate, 
  isLoading 
}: { 
  refreshInterval: number; 
  lastUpdate?: number | null; 
  isLoading: boolean; 
}) => {
  const [countdown, setCountdown] = useState(refreshInterval);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!lastUpdate) return;
    
    const updateCountdown = () => {
      const now = Date.now();
      const lastUpdateMs = lastUpdate * 1000;
      const elapsed = (now - lastUpdateMs) / 1000;
      const remaining = Math.max(0, refreshInterval - elapsed);
      const progressPct = (remaining / refreshInterval) * 100;
      
      setCountdown(Math.ceil(remaining));
      setProgress(progressPct);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 100);
    return () => clearInterval(interval);
  }, [lastUpdate, refreshInterval]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span>Ανανέωση...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground" title={`Επόμενη ανανέωση σε ${countdown} δευτ.`}>
      <div className="relative w-4 h-4">
        <svg className="w-4 h-4 -rotate-90" viewBox="0 0 20 20">
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.2"
          />
          <circle
            cx="10"
            cy="10"
            r="8"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray={`${(progress / 100) * 50.265} 50.265`}
            strokeLinecap="round"
            className="transition-all duration-100"
          />
        </svg>
      </div>
      <span>{countdown}δ</span>
    </div>
  );
};

export function VehicleMap({ vehicles, trips = [], stops = [], routeNamesMap, selectedRoute = 'all', selectedOperator, onRouteClose, isLoading, highlightedStop, followVehicleId, onFollowVehicle, refreshInterval = 10, lastUpdate, deepLinkStopId, onStopPanelChange, mapStyle: externalMapStyle, onMapStyleChange }: VehicleMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const vehicleMarkersRef = useRef<L.MarkerClusterGroup | null>(null);
  const stopMarkersRef = useRef<L.MarkerClusterGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [followedVehicleId, setFollowedVehicleId] = useState<string | null>(null);
  const [showStops, setShowStops] = useState(false);
  const [showRoutePanel, setShowRoutePanel] = useState(true);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [selectedVehicleTrip, setSelectedVehicleTrip] = useState<{ vehicleId: string; tripId: string; routeId?: string } | null>(null);
  const [initialOriginStop, setInitialOriginStop] = useState<{ stopId: string; stopName: string; lat: number; lng: number } | null>(null);
  const [showLiveVehiclesPanel, setShowLiveVehiclesPanel] = useState(true);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const userLocationMarkerRef = useRef<L.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const searchMarkerRef = useRef<L.Marker | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const routeMarkersRef = useRef<L.Marker[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routeShapeLineRef = useRef<L.Polyline | null>(null);
  const routeArrowsRef = useRef<L.Marker[]>([]);
  const routeStopMarkersRef = useRef<L.Marker[]>([]);
  const lastDrawnRouteRef = useRef<string | null>(null);
  const [mapClickMode, setMapClickMode] = useState<'origin' | 'destination' | null>(null);
  const [mapClickLocation, setMapClickLocation] = useState<{ type: 'origin' | 'destination'; lat: number; lng: number } | null>(null);
  const [viewMode, setViewMode] = useState<'street' | 'overview'>('street');
  const [mapReady, setMapReady] = useState(false);
  
  // Use external map style if provided, otherwise use internal state
  const [internalMapStyle, setInternalMapStyle] = useState<MapStyleType>(() => {
    try {
      const saved = localStorage.getItem('motionbus_map_style');
      if (saved === 'light' || saved === 'dark' || saved === 'satellite') return saved;
    } catch {}
    return 'light';
  });
  
  const mapStyle = externalMapStyle ?? internalMapStyle;
  const setMapStyle = (style: MapStyleType) => {
    if (onMapStyleChange) {
      onMapStyleChange(style);
    } else {
      setInternalMapStyle(style);
    }
  };
  
  const highlightedStopMarkerRef = useRef<L.Marker | null>(null);
  
  // Persist map style to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('motionbus_map_style', mapStyle);
    } catch {}
  }, [mapStyle]);

  
  // Stop notification state
  const [notificationModalStop, setNotificationModalStop] = useState<{ stopId: string; stopName: string } | null>(null);
  const { notifications: stopNotifications, setNotification: setStopNotification, removeNotification: removeStopNotification, getNotification, hasNotification } = useStopNotifications();
  
  // Enable arrival notifications monitoring - this actually triggers the notifications when buses approach
  useStopArrivalNotifications(
    trips || [],
    routeNamesMap,
    stopNotifications,
    true // enabled
  );
  
  // Handle opening stop panel and notify parent for URL update
  const openStopPanel = useCallback((stopId: string, stopName: string) => {
    setNotificationModalStop({ stopId, stopName });
    onStopPanelChange?.(stopId);
  }, [onStopPanelChange]);
  
  // Handle closing stop panel and notify parent for URL update
  const closeStopPanel = useCallback(() => {
    setNotificationModalStop(null);
    onStopPanelChange?.(null);
  }, [onStopPanelChange]);
  
  // Handle deep link stop - open the stop panel when stopId from URL changes
  useEffect(() => {
    if (deepLinkStopId && stops.length > 0 && mapReady) {
      const stop = stops.find(s => s.stop_id === deepLinkStopId);
      if (stop) {
        openStopPanel(stop.stop_id, stop.stop_name || stop.stop_id);
        // Pan to the stop
        if (mapRef.current && stop.stop_lat && stop.stop_lon) {
          mapRef.current.flyTo([stop.stop_lat, stop.stop_lon], 16, { animate: true, duration: 1 });
        }
      }
    }
  }, [deepLinkStopId, stops, mapReady, openStopPanel]);
  
  // Walking route state
  const [walkingRoute, setWalkingRoute] = useState<{ distance: number; duration: number; geometry: Array<[number, number]> } | null>(null);
  const [isLoadingWalkingRoute, setIsLoadingWalkingRoute] = useState(false);
  const walkingRouteLineRef = useRef<L.Polyline | null>(null);
  
  // Trail effect: store position history for each vehicle
  const vehicleTrailsRef = useRef<Map<string, Array<{ lat: number; lng: number; timestamp: number }>>>(new Map());
  const trailPolylinesRef = useRef<Map<string, L.Polyline[]>>(new Map());
  const trailParticlesRef = useRef<Map<string, L.Marker[]>>(new Map());
  const particleAnimationRef = useRef<number | null>(null);
  
  // Store previous positions for bearing calculation
  const previousPositionsRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());

  // Fetch route shape data when a route is selected
  const { data: routeShapeData } = useRouteShape(
    selectedRoute !== 'all' ? selectedRoute : null,
    selectedOperator
  );
  
  // Get the routeId of the followed vehicle for fetching its shape
  const followedVehicleRouteId = useMemo(() => {
    if (!followedVehicleId) return null;
    const vehicle = vehicles.find(v => (v.vehicleId || v.id) === followedVehicleId);
    return vehicle?.routeId || null;
  }, [followedVehicleId, vehicles]);
  
  // Infer operator from route ID when selectedOperator is 'all'
  // NOTE: When operator is 'all', we pass undefined and let the edge function search all operators
  const followedVehicleOperatorId = useMemo(() => {
    if (selectedOperator !== 'all') return selectedOperator;
    // Let the edge function search for the correct operator
    return undefined;
  }, [selectedOperator]);
  
  // Fetch route shape for followed vehicle
  const { data: followedRouteShapeData } = useRouteShape(
    followedVehicleRouteId,
    followedVehicleOperatorId
  );
  
  // Use followed vehicle's route shape when following, otherwise selected route
  const effectiveRouteShapeData = followedVehicleId 
    ? followedRouteShapeData 
    : routeShapeData;

  // Get route info for coloring
  const selectedRouteInfo = selectedRoute !== 'all' && routeNamesMap 
    ? routeNamesMap.get(selectedRoute) 
    : undefined;

  // Show panels when route changes and clear trails
  useEffect(() => {
    if (selectedRoute !== 'all') {
      setShowRoutePanel(true);
      setShowLiveVehiclesPanel(true);
    }
    
    // Clear all trails and particles when route changes
    trailPolylinesRef.current.forEach((polylines) => {
      polylines.forEach(p => mapRef.current?.removeLayer(p));
    });
    trailPolylinesRef.current.clear();
    
    trailParticlesRef.current.forEach((particles) => {
      particles.forEach(p => mapRef.current?.removeLayer(p));
    });
    trailParticlesRef.current.clear();
    
    vehicleTrailsRef.current.clear();
  }, [selectedRoute]);

  // Sync external follow vehicle request with internal state
  useEffect(() => {
    if (followVehicleId && followVehicleId !== followedVehicleId) {
      setFollowedVehicleId(followVehicleId);
      setViewMode('street');
      
      // Initialize trail with current position when starting to follow
      const vehicle = vehicles.find(v => (v.vehicleId || v.id) === followVehicleId);
      if (vehicle?.latitude && vehicle?.longitude) {
        const now = Date.now();
        // Create initial trail points around current position for immediate visibility
        const initialTrail = [
          { lat: vehicle.latitude - 0.0003, lng: vehicle.longitude - 0.0003, timestamp: now - 2000 },
          { lat: vehicle.latitude - 0.0002, lng: vehicle.longitude - 0.0002, timestamp: now - 1500 },
          { lat: vehicle.latitude - 0.0001, lng: vehicle.longitude - 0.0001, timestamp: now - 1000 },
          { lat: vehicle.latitude, lng: vehicle.longitude, timestamp: now },
        ];
        vehicleTrailsRef.current.set(followVehicleId, initialTrail);
      }
      
      // Find the vehicle and fly to it smoothly
      // Delay slightly to allow state to settle after route change
      const timeoutId = setTimeout(() => {
        if (vehicle?.latitude && vehicle?.longitude && mapRef.current) {
          mapRef.current.flyTo([vehicle.latitude, vehicle.longitude], 17, {
            duration: 1.5,
            easeLinearity: 0.25,
          });
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [followVehicleId, followedVehicleId, vehicles]);

  // Listen for custom event to open notification modal from popup button
  useEffect(() => {
    const handleOpenNotification = (e: CustomEvent<{ stopId: string; stopName: string }>) => {
      openStopPanel(e.detail.stopId, e.detail.stopName);
      // Close any open popup
      mapRef.current?.closePopup();
    };
    
    window.addEventListener('openStopNotification', handleOpenNotification as EventListener);
    return () => {
      window.removeEventListener('openStopNotification', handleOpenNotification as EventListener);
    };
  }, [openStopPanel]);

  // Draw snail trail on route shape - updates when vehicle position changes
  useEffect(() => {
    if (!followedVehicleId || !mapRef.current || !routeShapeData) return;
    
    const vehicle = vehicles.find(v => (v.vehicleId || v.id) === followedVehicleId);
    if (!vehicle?.latitude || !vehicle?.longitude) return;
    
    const direction = routeShapeData.directions[0];
    if (!direction || !direction.shape || direction.shape.length < 2) return;
    
    const routeInfo = vehicle.routeId && routeNamesMap ? routeNamesMap.get(vehicle.routeId) : null;
    const trailColor = routeInfo?.route_color ? `#${routeInfo.route_color}` : '#f97316';
    
    // Find where the vehicle is on the route shape
    const closestIndex = findClosestPointOnRoute(vehicle.latitude, vehicle.longitude, direction.shape);
    
    // Remove old trail
    const oldPolylines = trailPolylinesRef.current.get(followedVehicleId) || [];
    oldPolylines.forEach(p => mapRef.current?.removeLayer(p));
    
    // Get trail portion - from start of route to current position
    // Take a segment behind the vehicle (the "snail trail")
    const trailStartIndex = Math.max(0, closestIndex - 80); // ~80 points behind
    const trailEndIndex = closestIndex;
    
    if (trailEndIndex <= trailStartIndex) return;
    
    const trailShape = direction.shape.slice(trailStartIndex, trailEndIndex + 1);
    const trailPoints: L.LatLngExpression[] = trailShape.map(p => [p.lat, p.lng]);
    
    const newPolylines: L.Polyline[] = [];
    
    // Create gradient segments for snail trail effect
    const segmentCount = trailPoints.length - 1;
    for (let i = 0; i < segmentCount; i++) {
      const progress = i / segmentCount; // 0 = oldest, 1 = newest
      const opacity = 0.2 + progress * 0.6; // Fade from 0.2 to 0.8
      const weight = 4 + progress * 6; // Width from 4 to 10
      
      const segment = L.polyline(
        [trailPoints[i], trailPoints[i + 1]],
        {
          color: trailColor,
          weight: weight,
          opacity: opacity,
          lineCap: 'round',
          lineJoin: 'round',
        }
      ).addTo(mapRef.current);
      newPolylines.push(segment);
    }
    
    // Add white glow on top for the recent part
    if (trailPoints.length > 10) {
      const glowPoints = trailPoints.slice(-15);
      const glowTrail = L.polyline(glowPoints, {
        color: 'white',
        weight: 3,
        opacity: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapRef.current);
      newPolylines.push(glowTrail);
    }
    
    trailPolylinesRef.current.set(followedVehicleId, newPolylines);
  }, [followedVehicleId, vehicles, routeNamesMap, routeShapeData]);

  // Geocoding search function
  const searchAddress = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cy&limit=5`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      const data = await response.json();
      setSearchResults(data);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Geocoding error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle search result selection
  const selectSearchResult = useCallback((result: { display_name: string; lat: string; lon: string }) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    if (mapRef.current) {
      // Remove existing search marker
      if (searchMarkerRef.current) {
        mapRef.current.removeLayer(searchMarkerRef.current);
      }

      // Create search result marker
      const searchIcon = L.divIcon({
        className: 'search-marker',
        html: `
          <div class="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      searchMarkerRef.current = L.marker([lat, lon], { icon: searchIcon })
        .addTo(mapRef.current)
        .bindPopup(`<div class="p-2 text-sm font-medium">${result.display_name}</div>`)
        .openPopup();

      mapRef.current.setView([lat, lon], 16, { animate: true });
    }

    setShowSearchResults(false);
    setSearchQuery(result.display_name.split(',')[0]);
  }, []);

  // Create a map of tripId -> Trip for quick lookup
  const tripMap = useMemo(() => {
    const map = new Map<string, Trip>();
    trips.forEach(trip => {
      if (trip.tripId) {
        map.set(trip.tripId, trip);
      }
    });
    return map;
  }, [trips]);

  // Create a map of stopId -> StaticStop for quick lookup
  const stopMap = useMemo(() => {
    const map = new Map<string, StaticStop>();
    stops.forEach(stop => {
      map.set(stop.stop_id, stop);
    });
    return map;
  }, [stops]);

  // Get next stop info for a vehicle
  const getNextStopInfo = (vehicle: Vehicle) => {
    if (!vehicle.tripId) return null;
    
    const trip = tripMap.get(vehicle.tripId);
    if (!trip?.stopTimeUpdates?.length) return null;

    // Find the next stop based on current stop sequence
    const currentSeq = vehicle.currentStopSequence || 0;
    const nextStopUpdate = trip.stopTimeUpdates.find(
      stu => (stu.stopSequence || 0) >= currentSeq
    );

    if (!nextStopUpdate) return null;

    const stopInfo = nextStopUpdate.stopId ? stopMap.get(nextStopUpdate.stopId) : null;
    
    return {
      stopName: stopInfo?.stop_name || nextStopUpdate.stopId || 'Επόμενη στάση',
      arrivalTime: nextStopUpdate.arrivalTime,
      arrivalDelay: nextStopUpdate.arrivalDelay,
    };
  };

  // Get arrivals for a specific stop
  const getArrivalsForStop = (stopId: string) => {
    const arrivals: Array<{
      tripId: string;
      routeId?: string;
      routeShortName?: string;
      routeLongName?: string;
      routeColor?: string;
      vehicleLabel?: string;
      vehicleId?: string;
      arrivalTime?: number;
      arrivalDelay?: number;
    }> = [];

    trips.forEach(trip => {
      const stopUpdate = trip.stopTimeUpdates?.find(stu => stu.stopId === stopId);
      if (stopUpdate && stopUpdate.arrivalTime) {
        const routeInfo = trip.routeId && routeNamesMap ? routeNamesMap.get(trip.routeId) : null;
        
        // Find associated vehicle
        const vehicle = vehicles.find(v => v.tripId === trip.tripId);
        
        arrivals.push({
          tripId: trip.tripId || trip.id,
          routeId: trip.routeId,
          routeShortName: routeInfo?.route_short_name,
          routeLongName: routeInfo?.route_long_name,
          routeColor: routeInfo?.route_color,
          vehicleLabel: vehicle?.label || trip.vehicleLabel,
          vehicleId: vehicle?.vehicleId || trip.vehicleId,
          arrivalTime: stopUpdate.arrivalTime,
          arrivalDelay: stopUpdate.arrivalDelay,
        });
      }
    });

    // Sort by arrival time
    arrivals.sort((a, b) => (a.arrivalTime || 0) - (b.arrivalTime || 0));
    
    // Return only next 5 arrivals
    return arrivals.slice(0, 5);
  };

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: [35.0, 33.0], // Center of Cyprus
      zoom: 9,
      maxZoom: 19,
      minZoom: 3,
      zoomControl: true,
    });


    vehicleMarkersRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      zoomToBoundsOnClick: true,
      animate: false, // Disable all cluster animations
      animateAddingMarkers: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';
        const sizeMap = { small: 36, medium: 44, large: 52 };
        const iconSize = sizeMap[size];
        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `vehicle-cluster vehicle-cluster-${size}`,
          iconSize: L.point(iconSize, iconSize),
        });
      },
    });

    stopMarkersRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: false,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 15,
      zoomToBoundsOnClick: true,
      animate: false, // Disable all cluster animations
      animateAddingMarkers: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 'small' : count < 50 ? 'medium' : 'large';
        const sizeMap = { small: 28, medium: 34, large: 40 };
        const iconSize = sizeMap[size];
        return L.divIcon({
          html: `<div><span>${count}</span></div>`,
          className: `stop-cluster stop-cluster-${size}`,
          iconSize: L.point(iconSize, iconSize),
        });
      },
    });

    mapRef.current.addLayer(vehicleMarkersRef.current);
    mapRef.current.addLayer(stopMarkersRef.current);

    // Mark map as ready after layers are fully initialized
    // Use requestAnimationFrame to ensure DOM is updated, then a short delay for cluster initialization
    const checkMapReady = () => {
      if (mapRef.current && vehicleMarkersRef.current && stopMarkersRef.current) {
        try {
          // Verify zoom is accessible
          const zoom = mapRef.current.getZoom();
          
          // Also verify cluster groups have map reference
          const vehicleCluster = vehicleMarkersRef.current as any;
          const stopCluster = stopMarkersRef.current as any;
          
          if (typeof zoom === 'number' && 
              vehicleCluster._map && 
              stopCluster._map &&
              typeof vehicleCluster._map._zoom === 'number') {
            console.log('[VehicleMap] Map fully ready with zoom:', zoom);
            setMapReady(true);
          } else {
            // Not ready yet, retry
            console.log('[VehicleMap] Map not fully ready, retrying...');
            setTimeout(checkMapReady, 100);
          }
        } catch (e) {
          // Map not ready yet, retry
          console.log('[VehicleMap] Map getZoom failed, retrying...', e);
          setTimeout(checkMapReady, 100);
        }
      }
    };
    
    const readyTimeout = setTimeout(() => {
      requestAnimationFrame(checkMapReady);
    }, 150);

    return () => {
      clearTimeout(readyTimeout);
      setMapReady(false);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle map clicks for route planner
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      if (mapClickMode) {
        setMapClickLocation({
          type: mapClickMode,
          lat: e.latlng.lat,
          lng: e.latlng.lng,
        });
        setMapClickMode(null);
      }
    };

    mapRef.current.on('click', handleMapClick);

    return () => {
      mapRef.current?.off('click', handleMapClick);
    };
  }, [mapClickMode]);

  // Add basemap layer (light, dark, or satellite)
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing tile layer
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }

    let tileLayer: L.TileLayer;
    
    if (mapStyle === 'satellite') {
      // ESRI World Imagery - satellite
      tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Map data © <a href="https://www.esri.com/">Esri</a>',
        maxZoom: 19,
      });
    } else if (mapStyle === 'dark') {
      // Carto Dark Matter - dark mode for night viewing
      tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      });
    } else {
      // Carto Positron - clean, minimal, high-contrast for transit
      tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      });
    }

    tileLayerRef.current = tileLayer;
    tileLayer.addTo(mapRef.current);

    return () => {
      if (mapRef.current && tileLayer) {
        mapRef.current.removeLayer(tileLayer);
      }
    };
  }, [mapStyle]);

  // Handle highlighted stop (temporary green marker)
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing highlighted marker
    if (highlightedStopMarkerRef.current) {
      mapRef.current.removeLayer(highlightedStopMarkerRef.current);
      highlightedStopMarkerRef.current = null;
    }

    // Add new highlighted marker if stop is provided
    if (highlightedStop && highlightedStop.stop_lat && highlightedStop.stop_lon) {
      const highlightIcon = L.divIcon({
        className: 'highlighted-stop-marker',
        html: `
          <style>
            @keyframes nearbyPing {
              0% { transform: scale(1); opacity: 0.8; }
              75%, 100% { transform: scale(2); opacity: 0; }
            }
            @keyframes nearbyPulse {
              0%, 100% { transform: scale(1); opacity: 0.6; }
              50% { transform: scale(1.3); opacity: 0.3; }
            }
            .nearby-ping {
              animation: nearbyPing 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            }
            .nearby-pulse {
              animation: nearbyPulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
            }
          </style>
          <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
            <div class="nearby-ping" style="position: absolute; inset: -8px; border-radius: 50%; background: #22c55e;"></div>
            <div class="nearby-pulse" style="position: absolute; inset: -4px; border-radius: 50%; background: #22c55e;"></div>
            <div style="width: 32px; height: 32px; border-radius: 50%; background: #22c55e; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(34, 197, 94, 0.5); border: 3px solid white;">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      highlightedStopMarkerRef.current = L.marker(
        [highlightedStop.stop_lat, highlightedStop.stop_lon],
        { icon: highlightIcon, zIndexOffset: 2000 }
      )
        .addTo(mapRef.current)
        .bindPopup(`
          <div class="p-2">
            <div class="font-bold text-green-600">📍 Κοντινότερη Στάση</div>
            <div class="text-sm font-medium">${highlightedStop.stop_name || highlightedStop.stop_id}</div>
          </div>
        `);

      // Pan to the highlighted stop
      mapRef.current.setView([highlightedStop.stop_lat, highlightedStop.stop_lon], 16, { animate: true });
    }

    return () => {
      if (mapRef.current && highlightedStopMarkerRef.current) {
        mapRef.current.removeLayer(highlightedStopMarkerRef.current);
        highlightedStopMarkerRef.current = null;
      }
    };
  }, [highlightedStop]);

  // Update vehicle markers when vehicles change - with smooth animation
  useEffect(() => {
    // Wait for map to be ready
    if (!mapReady) return;
    
    // Ensure map and cluster group are initialized and the cluster is added to the map
    if (!vehicleMarkersRef.current || !mapRef.current) return;
    
    // Check if the cluster group has a map reference (is added to a map)
    const clusterGroup = vehicleMarkersRef.current as any;
    if (!clusterGroup._map) {
      console.log('[VehicleMap] Cluster group not yet added to map, skipping vehicle update');
      return;
    }
    
    // Critical: Check if the map's internal _zoom is defined (map fully initialized)
    if (typeof clusterGroup._map._zoom === 'undefined') {
      console.log('[VehicleMap] Map _zoom not defined, skipping vehicle update');
      return;
    }
    
    // Additional safety check - ensure map has zoom level and is ready
    try {
      const zoom = mapRef.current.getZoom();
      if (zoom === undefined || zoom === null) {
        console.log('[VehicleMap] Map zoom undefined, skipping vehicle update');
        return;
      }
    } catch (e) {
      console.log('[VehicleMap] Error getting map zoom, skipping vehicle update:', e);
      return;
    }

    const validVehicles = vehicles.filter(
      (v) => v.latitude !== undefined && v.longitude !== undefined &&
             typeof v.latitude === 'number' && typeof v.longitude === 'number' &&
             !isNaN(v.latitude) && !isNaN(v.longitude)
    );

    // Track which vehicle IDs are currently in the data
    const currentVehicleIds = new Set<string>();

    validVehicles.forEach((vehicle) => {
      const vehicleId = vehicle.vehicleId || vehicle.id;
      currentVehicleIds.add(vehicleId);
      
      const isFollowed = followedVehicleId === vehicleId;
      const isOnSelectedRoute = selectedRoute !== 'all' && vehicle.routeId === selectedRoute;
      
      // Get route color
      const routeInfo = vehicle.routeId && routeNamesMap ? routeNamesMap.get(vehicle.routeId) : null;
      const routeColor = routeInfo?.route_color;
      const routeName = routeInfo ? `${routeInfo.route_short_name} - ${routeInfo.route_long_name}` : vehicle.routeId;
      
      // Get next stop info
      const nextStop = getNextStopInfo(vehicle);

      const existingMarker = markerMapRef.current.get(vehicleId);
      
      // For followed vehicles on a route, snap position to route line
      let targetLat = vehicle.latitude!;
      let targetLng = vehicle.longitude!;
      let effectiveBearing = vehicle.bearing;
      
      // Check if this vehicle should snap to route shape
      const vehicleRouteShape = isFollowed && effectiveRouteShapeData?.directions?.[0]?.shape;
      
      if (vehicleRouteShape) {
        const shape = effectiveRouteShapeData.directions[0].shape;
        const snapped = snapToRouteLine(vehicle.latitude!, vehicle.longitude!, shape);
        console.log('[VehicleMap] Snap to route:', { vehicleId, snapped, shapeLength: shape.length });
        if (snapped) {
          targetLat = snapped.lat;
          targetLng = snapped.lng;
          effectiveBearing = snapped.bearing;
        }
      } else if (isFollowed) {
        console.log('[VehicleMap] No route shape for followed vehicle:', { vehicleId, hasEffectiveShape: !!effectiveRouteShapeData, followedVehicleRouteId });
      }
      
      // Calculate bearing from previous position if not provided
      const prevPos = previousPositionsRef.current.get(vehicleId);
      if (effectiveBearing === undefined && prevPos) {
        const distanceMoved = Math.sqrt(
          Math.pow(targetLat - prevPos.lat, 2) + 
          Math.pow(targetLng - prevPos.lng, 2)
        );
        if (distanceMoved > 0.00005) { // ~5 meters threshold
          effectiveBearing = calculateBearing(prevPos.lat, prevPos.lng, targetLat, targetLng);
        }
      }
      
      // Store current position for next bearing calculation
      previousPositionsRef.current.set(vehicleId, { lat: targetLat, lng: targetLng });
      
      const newLatLng = L.latLng(targetLat, targetLng);
      
      if (existingMarker) {
        // Smooth animation: update position of existing marker
        const currentLatLng = existingMarker.getLatLng();
        
        // Only animate if position actually changed significantly
        const latDiff = Math.abs(currentLatLng.lat - newLatLng.lat);
        const lngDiff = Math.abs(currentLatLng.lng - newLatLng.lng);
        const hasMovedSignificantly = latDiff > 0.000001 || lngDiff > 0.000001;
        
        if (hasMovedSignificantly) {
          // Get the marker's DOM element and add transition for smooth movement
          const markerElement = existingMarker.getElement();
          if (markerElement) {
            // Use a smooth transition - 4s linear for fluid movement
            markerElement.style.transition = 'transform 4s linear';
            markerElement.style.willChange = 'transform';
          }
          existingMarker.setLatLng(newLatLng);
        }
        
        // Update icon if needed (for rotation/bearing changes)
        existingMarker.setIcon(createVehicleIcon(effectiveBearing, isFollowed, routeColor, isOnSelectedRoute, routeInfo?.route_short_name));
        existingMarker.setZIndexOffset(isOnSelectedRoute ? 2000 : (isFollowed ? 1000 : 0));
        
        // Update tooltip content for hover - compact for mobile
        // Truncate long route names
        const shortRouteName = routeName && routeName.length > 25 
          ? routeName.substring(0, 25) + '...' 
          : routeName;
        const shortNextStopName = nextStop?.stopName && nextStop.stopName.length > 20
          ? nextStop.stopName.substring(0, 20) + '...'
          : nextStop?.stopName;
          
        const tooltipContent = `
          <div class="p-1.5" style="max-width: 200px;">
            <div class="font-semibold text-xs mb-1 flex items-center gap-1.5">
              <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background: ${routeColor ? `#${routeColor}` : 'hsl(var(--primary))'}"></span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${shortRouteName || `#${vehicleId.substring(0, 6)}`}</span>
            </div>
            <div class="space-y-0.5 text-xs">
              <div><span class="text-muted-foreground">Ετικέτα:</span> ${vehicle.label || vehicleId.substring(0, 8)}</div>
              <div><span class="text-muted-foreground">Ταχύτητα:</span> ${formatSpeed(vehicle.speed)}</div>
              ${shortNextStopName ? `<div class="pt-0.5 border-t border-border mt-0.5"><span class="text-muted-foreground">Επόμ:</span> ${shortNextStopName}${nextStop?.arrivalTime ? ` (${formatETA(nextStop.arrivalTime)})` : ''}</div>` : ''}
            </div>
          </div>
        `;
        
        // Update or set tooltip
        if (existingMarker.getTooltip()) {
          existingMarker.setTooltipContent(tooltipContent);
        } else {
          existingMarker.bindTooltip(tooltipContent, {
            direction: 'top',
            offset: [0, -15],
            className: 'vehicle-tooltip',
            permanent: false,
          });
        }
        
        // Update popup content
        const etaHtml = nextStop ? `
          <div class="mt-2 pt-2 border-t border-border">
            <div class="flex items-center gap-1 text-primary font-medium mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Επόμενη στάση
            </div>
            <div class="text-sm">
              <div class="font-medium">${nextStop.stopName}</div>
              ${nextStop.arrivalTime ? `<div class="text-muted-foreground">Άφιξη: <span class="text-foreground font-mono">${formatETA(nextStop.arrivalTime)}</span> ${formatDelay(nextStop.arrivalDelay)}</div>` : ''}
            </div>
          </div>
        ` : '';

        existingMarker.setPopupContent(`
          <div class="p-3 min-w-[220px]">
            <div class="font-semibold text-base mb-2 flex items-center gap-2">
              <span class="inline-block w-3 h-3 rounded-full" style="background: ${routeColor ? `#${routeColor}` : 'hsl(var(--primary))'}"></span>
              Όχημα ${vehicleId}
            </div>
            <div class="space-y-1.5 text-sm">
              ${vehicle.label ? `<div class="flex justify-between"><span class="text-muted-foreground">Ετικέτα:</span><span class="font-mono">${vehicle.label}</span></div>` : ''}
              ${routeName ? `<div class="flex justify-between gap-2"><span class="text-muted-foreground">Γραμμή:</span><span class="text-right font-medium" style="color: ${routeColor ? `#${routeColor}` : 'inherit'}">${routeName}</span></div>` : ''}
              <div class="flex justify-between"><span class="text-muted-foreground">Ταχύτητα:</span><span>${formatSpeed(vehicle.speed)}</span></div>
              ${vehicle.bearing !== undefined ? `<div class="flex justify-between"><span class="text-muted-foreground">Κατεύθυνση:</span><span>${vehicle.bearing.toFixed(0)}°</span></div>` : ''}
              ${vehicle.currentStatus ? `<div class="flex justify-between"><span class="text-muted-foreground">Κατάσταση:</span><span>${vehicle.currentStatus}</span></div>` : ''}
              <div class="flex justify-between items-center pt-1 border-t border-border mt-2">
                <span class="text-muted-foreground">Ενημέρωση:</span>
                <span class="flex items-center gap-1.5">
                  ${(() => {
                    const relTime = getRelativeTime(vehicle.timestamp);
                    return `<span class="inline-block w-2 h-2 rounded-full ${relTime.isLive ? 'animate-pulse' : ''}" style="background: ${relTime.color}"></span>
                    <span class="text-xs" style="color: ${relTime.color}">${relTime.text}</span>`;
                  })()}
                </span>
              </div>
            </div>
            ${etaHtml}
          </div>
        `);
      } else {
        // Create new marker for new vehicles
        // Store initial position for future bearing calculation
        previousPositionsRef.current.set(vehicleId, { lat: vehicle.latitude!, lng: vehicle.longitude! });
        
        const marker = L.marker([vehicle.latitude!, vehicle.longitude!], {
          icon: createVehicleIcon(vehicle.bearing, isFollowed, routeColor, isOnSelectedRoute, routeInfo?.route_short_name),
          zIndexOffset: isOnSelectedRoute ? 2000 : (isFollowed ? 1000 : 0),
        });

        // Click handler - opens route planner panel
        marker.on('click', () => {
          // Close any existing popups
          if (mapRef.current) {
            mapRef.current.closePopup();
          }
          
          setFollowedVehicleId(vehicleId);
          // Open route planner with this vehicle's trip info
          if (vehicle.tripId) {
            setSelectedVehicleTrip({
              vehicleId,
              tripId: vehicle.tripId,
              routeId: vehicle.routeId,
            });
            
            // Find the current stop of the vehicle to set as origin
            if (vehicle.stopId) {
              const currentStop = stops.find(s => s.stop_id === vehicle.stopId);
              if (currentStop && currentStop.stop_lat && currentStop.stop_lon) {
                setInitialOriginStop({
                  stopId: currentStop.stop_id,
                  stopName: currentStop.stop_name || currentStop.stop_id,
                  lat: currentStop.stop_lat,
                  lng: currentStop.stop_lon,
                });
              }
            }
            
            setShowRoutePlanner(true);
          }
        });

        markerMapRef.current.set(vehicleId, marker);
        vehicleMarkersRef.current!.addLayer(marker);
      }
    });

    // Remove markers for vehicles that are no longer in the data
    markerMapRef.current.forEach((marker, vehicleId) => {
      if (!currentVehicleIds.has(vehicleId)) {
        vehicleMarkersRef.current?.removeLayer(marker);
        markerMapRef.current.delete(vehicleId);
      }
    });

    // If not following a vehicle, fit bounds to show all (only on first load)
    if (!followedVehicleId && validVehicles.length > 0 && mapRef.current && markerMapRef.current.size === validVehicles.length && markerMapRef.current.size <= validVehicles.length) {
      // Only fit bounds if this is the initial load (marker count matches vehicle count exactly)
      const isInitialLoad = Array.from(markerMapRef.current.keys()).every(id => currentVehicleIds.has(id));
      if (isInitialLoad && markerMapRef.current.size === validVehicles.length) {
        // Skip auto-fitting after initial load to prevent jarring movements
      }
    }
  }, [vehicles, followedVehicleId, routeNamesMap, tripMap, stopMap, selectedRoute, effectiveRouteShapeData, followedVehicleRouteId, mapReady]);

  // Get stops with vehicles currently stopped
  const stopsWithVehicles = useMemo(() => {
    const stoppedAtStops = new Set<string>();
    vehicles.forEach(v => {
      // Check for STOPPED_AT status OR if vehicle has stopId and speed is 0 (stopped)
      const status = String(v.currentStatus);
      const isStopped = status === 'STOPPED_AT' || status === '1' || 
        (v.stopId && v.speed !== undefined && v.speed < 1);
      if (v.stopId && isStopped) {
        stoppedAtStops.add(v.stopId);
      }
    });
    return stoppedAtStops;
  }, [vehicles]);

  // Handle user location
  const locateUser = () => {
    if (!mapRef.current) return;
    
    setIsLocating(true);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        
        // Create or update user location marker
        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.setLatLng([latitude, longitude]);
        } else {
          const userIcon = L.divIcon({
            className: 'user-location-marker',
            html: `
              <div class="relative">
                <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-50"></div>
                <div class="relative w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg"></div>
              </div>
            `,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          });
          
          userLocationMarkerRef.current = L.marker([latitude, longitude], { icon: userIcon })
            .bindPopup('<div class="p-2 text-sm font-medium">📍 Η τοποθεσία σας</div>')
            .addTo(mapRef.current!);
        }
        
        // Pan to user location
        mapRef.current?.setView([latitude, longitude], 15, { animate: true });
        setIsLocating(false);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsLocating(false);
        alert('Δεν ήταν δυνατή η εύρεση της τοποθεσίας σας. Βεβαιωθείτε ότι έχετε επιτρέψει την πρόσβαση στην τοποθεσία.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Find nearest stop to user location WITH arrivals (routes passing through)
  const nearestStopWithArrivals = useMemo(() => {
    if (!userLocation) return null;
    
    // Get all stops with arrivals first
    const stopsWithArrivalsData: Array<{ stop: StaticStop; distance: number; arrivals: typeof trips }> = [];
    
    stops.forEach(stop => {
      if (stop.stop_lat === undefined || stop.stop_lon === undefined) return;
      
      // Check if this stop has arrivals
      const stopArrivals = trips.filter(trip => 
        trip.stopTimeUpdates?.some(stu => stu.stopId === stop.stop_id && stu.arrivalTime)
      );
      
      if (stopArrivals.length === 0) return; // Skip stops without arrivals
      
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        stop.stop_lat, stop.stop_lon
      );
      
      stopsWithArrivalsData.push({ stop, distance, arrivals: stopArrivals });
    });
    
    // Sort by distance and return nearest
    stopsWithArrivalsData.sort((a, b) => a.distance - b.distance);
    
    if (stopsWithArrivalsData.length === 0) {
      // Fallback to any nearest stop if no stops have arrivals
      let nearest: { stop: StaticStop; distance: number } | null = null;
      stops.forEach(stop => {
        if (stop.stop_lat === undefined || stop.stop_lon === undefined) return;
        const distance = calculateDistance(userLocation.lat, userLocation.lng, stop.stop_lat, stop.stop_lon);
        if (!nearest || distance < nearest.distance) {
          nearest = { stop, distance };
        }
      });
      return nearest;
    }
    
    return stopsWithArrivalsData[0];
  }, [userLocation, stops, trips]);

  // Fetch walking route when user location and nearest stop change
  useEffect(() => {
    if (!userLocation || !nearestStopWithArrivals?.stop) {
      setWalkingRoute(null);
      // Clear walking route line
      if (walkingRouteLineRef.current && mapRef.current) {
        mapRef.current.removeLayer(walkingRouteLineRef.current);
        walkingRouteLineRef.current = null;
      }
      return;
    }

    const stop = nearestStopWithArrivals.stop;
    if (!stop.stop_lat || !stop.stop_lon) return;

    // Fetch walking route from OSRM
    const fetchWalkingRoute = async () => {
      setIsLoadingWalkingRoute(true);
      try {
        const response = await fetch(
          `https://router.project-osrm.org/route/v1/foot/${userLocation.lng},${userLocation.lat};${stop.stop_lon},${stop.stop_lat}?overview=full&geometries=geojson`
        );
        const data = await response.json();
        
        if (data.routes && data.routes[0]) {
          const route = data.routes[0];
          const geometry = route.geometry.coordinates as Array<[number, number]>;
          
          setWalkingRoute({
            distance: route.distance,
            duration: route.duration,
            geometry,
          });

          // Draw walking route on map
          if (mapRef.current) {
            // Clear previous line
            if (walkingRouteLineRef.current) {
              mapRef.current.removeLayer(walkingRouteLineRef.current);
            }
            
            // Convert [lng, lat] to [lat, lng] for Leaflet
            const latLngs: L.LatLngExpression[] = geometry.map(coord => [coord[1], coord[0]]);
            
            walkingRouteLineRef.current = L.polyline(latLngs, {
              color: '#3b82f6',
              weight: 4,
              opacity: 0.8,
              dashArray: '8, 12',
              lineCap: 'round',
            }).addTo(mapRef.current);
          }
        }
      } catch (error) {
        console.error('Error fetching walking route:', error);
      } finally {
        setIsLoadingWalkingRoute(false);
      }
    };

    fetchWalkingRoute();
  }, [userLocation, nearestStopWithArrivals?.stop?.stop_id]);

  // Update user location marker position
  useEffect(() => {
    if (!userLocation || !userLocationMarkerRef.current) return;
    userLocationMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
  }, [userLocation]);

  useEffect(() => {
    // Wait for map to be ready
    if (!mapReady) return;
    
    if (!stopMarkersRef.current || !mapRef.current) return;
    
    // Check if the cluster group has a map reference (is added to a map)
    const clusterGroup = stopMarkersRef.current as any;
    if (!clusterGroup._map) {
      console.log('[VehicleMap] Stop cluster group not yet added to map, skipping stop update');
      return;
    }
    
    // Critical: Check if the map's internal _zoom is defined (map fully initialized)
    if (typeof clusterGroup._map._zoom === 'undefined') {
      console.log('[VehicleMap] Map _zoom not defined for stops, skipping stop update');
      return;
    }

    // Additional safety check - ensure map is ready
    try {
      const zoom = mapRef.current.getZoom();
      if (zoom === undefined || zoom === null) {
        console.log('[VehicleMap] Map zoom undefined for stops, skipping stop update');
        return;
      }
    } catch (e) {
      console.log('[VehicleMap] Error getting map zoom for stops, skipping:', e);
      return;
    }

    stopMarkersRef.current.clearLayers();

    if (!showStops) return;

    const validStops = stops.filter(
      (s) => s.stop_lat !== undefined && s.stop_lon !== undefined &&
             typeof s.stop_lat === 'number' && typeof s.stop_lon === 'number' &&
             !isNaN(s.stop_lat) && !isNaN(s.stop_lon)
    );

    validStops.forEach((stop) => {
      const hasVehicleStopped = stopsWithVehicles.has(stop.stop_id);
      const arrivals = getArrivalsForStop(stop.stop_id);
      const hasStopNotification = hasNotification(stop.stop_id);
      
      // Check if any arrival is within 2 minutes
      const now = Math.floor(Date.now() / 1000);
      const hasImminentArrival = arrivals.some(arr => {
        const secondsUntilArrival = arr.arrivalTime - now;
        return secondsUntilArrival > 0 && secondsUntilArrival <= 120; // 2 minutes
      });
      
      const marker = L.marker([stop.stop_lat!, stop.stop_lon!], {
        icon: createStopIcon(hasVehicleStopped, undefined, undefined, hasImminentArrival),
      });

      // Add tooltip with stop name
      const stopName = stop.stop_name || stop.stop_id;
      const nextArrival = arrivals[0];
      const tooltipContent = nextArrival 
        ? `<div class="font-medium">${stopName}</div><div class="text-xs text-muted-foreground">Επόμενη: ${formatETA(nextArrival.arrivalTime)}</div>`
        : `<div class="font-medium">${stopName}</div>`;
      
      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -10],
        className: 'stop-tooltip',
        permanent: false,
      });

      // Click handler to open notification modal
      marker.on('click', () => {
        openStopPanel(stop.stop_id, stop.stop_name || stop.stop_id);
      });

      const statusColor = hasVehicleStopped ? '#22c55e' : '#f97316';
      const statusText = hasVehicleStopped ? '<div class="text-green-500 font-medium mt-2 pt-2 border-t border-border">🚌 Λεωφορείο στη στάση</div>' : '';
      const notificationBadge = hasStopNotification ? '<span class="inline-block ml-2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] rounded font-medium">🔔</span>' : '';

      // Build arrivals HTML
      let arrivalsHtml = '';
      if (arrivals.length > 0) {
        arrivalsHtml = `
          <div class="mt-3 pt-2 border-t border-border">
            <div class="font-medium text-sm mb-2 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Επόμενες αφίξεις
            </div>
            <div class="space-y-2">
              ${arrivals.map(arr => {
                const routeColor = arr.routeColor ? `#${arr.routeColor}` : '#0ea5e9';
                const delayText = arr.arrivalDelay !== undefined && arr.arrivalDelay !== 0 
                  ? `<span class="${arr.arrivalDelay > 0 ? 'text-red-500' : 'text-green-500'}">${formatDelay(arr.arrivalDelay)}</span>` 
                  : '';
                return `
                  <div class="flex items-center gap-2 text-sm">
                    <span class="font-bold px-1.5 py-0.5 rounded text-white text-xs" style="background: ${routeColor}">${arr.routeShortName || arr.routeId || '?'}</span>
                    <span class="font-mono text-primary">${formatETA(arr.arrivalTime)}</span>
                    ${delayText}
                    ${arr.vehicleLabel ? `<span class="text-muted-foreground text-xs">(${arr.vehicleLabel})</span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else {
        arrivalsHtml = '<div class="mt-2 pt-2 border-t border-border text-sm text-muted-foreground">Δεν υπάρχουν προγραμματισμένες αφίξεις</div>';
      }

      marker.bindPopup(`
        <div class="p-3 min-w-[220px] max-w-[300px]">
          <div class="font-semibold text-base mb-2 flex items-center gap-2">
            <span class="inline-block w-2 h-2 rounded-full" style="background: ${statusColor}"></span>
            ${stop.stop_name || 'Στάση'}${notificationBadge}
          </div>
          <div class="space-y-1.5 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">ID:</span><span class="font-mono">${stop.stop_id}</span></div>
            ${stop.stop_code ? `<div class="flex justify-between"><span class="text-muted-foreground">Κωδικός:</span><span class="font-mono">${stop.stop_code}</span></div>` : ''}
          </div>
          ${statusText}
          ${arrivalsHtml}
          <div class="mt-3 pt-2 border-t border-border">
            <button data-stop-id="${stop.stop_id}" data-stop-name="${(stop.stop_name || stop.stop_id).replace(/"/g, '&quot;')}" class="stop-notification-btn w-full py-2 px-3 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              Ρύθμιση ειδοποίησης
            </button>
          </div>
        </div>
      `, {
        className: 'stop-popup',
        maxWidth: 320,
      });

      stopMarkersRef.current!.addLayer(marker);
    });
  }, [stops, showStops, stopsWithVehicles, trips, vehicles, routeNamesMap, mapReady, hasNotification]);

  // Draw route shape when route changes or when following a vehicle
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear previous route shape line and arrows
    if (routeShapeLineRef.current) {
      mapRef.current.removeLayer(routeShapeLineRef.current);
      routeShapeLineRef.current = null;
    }
    routeArrowsRef.current.forEach(arrow => mapRef.current?.removeLayer(arrow));
    routeArrowsRef.current = [];

    // Determine which route shape to use: followed vehicle's route or selected route
    const shapeDataToUse = effectiveRouteShapeData || routeShapeData;
    const routeIdToUse = followedVehicleRouteId || selectedRoute;
    
    // Get route info for coloring
    const routeInfoToUse = routeIdToUse && routeIdToUse !== 'all' && routeNamesMap 
      ? routeNamesMap.get(routeIdToUse) 
      : selectedRouteInfo;

    // If no route selected AND not following a vehicle, or no shape data, exit
    if (!followedVehicleId && selectedRoute === 'all') {
      lastDrawnRouteRef.current = null;
      return;
    }
    
    if (!shapeDataToUse) {
      lastDrawnRouteRef.current = null;
      return;
    }

    const routeColor = routeInfoToUse?.route_color || '0ea5e9';
    
    // Use first direction for now
    const direction = shapeDataToUse.directions[0];
    if (!direction) return;

    // Draw the route polyline if we have shape data
    if (direction.shape.length > 0) {
      const shapePoints: L.LatLngExpression[] = direction.shape.map(p => [p.lat, p.lng]);
      routeShapeLineRef.current = L.polyline(shapePoints, {
        color: `#${routeColor}`,
        weight: 5,
        opacity: 0.8,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(mapRef.current);

      // Add direction arrows along the route
      const arrowInterval = Math.max(5, Math.floor(direction.shape.length / 15)); // ~15 arrows along route
      for (let i = arrowInterval; i < direction.shape.length - 1; i += arrowInterval) {
        const p1 = direction.shape[i - 1];
        const p2 = direction.shape[i];
        
        // Calculate bearing/angle
        const dx = p2.lng - p1.lng;
        const dy = p2.lat - p1.lat;
        const angle = Math.atan2(dx, dy) * (180 / Math.PI);
        
        const arrowIcon = L.divIcon({
          className: 'route-direction-arrow',
          html: `
            <div style="transform: rotate(${angle}deg); width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#${routeColor}" stroke="white" stroke-width="1.5">
                <path d="M12 2L6 12h4v10h4V12h4L12 2z"/>
              </svg>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const arrowMarker = L.marker([p2.lat, p2.lng], {
          icon: arrowIcon,
          interactive: false,
        }).addTo(mapRef.current);
        
        routeArrowsRef.current.push(arrowMarker);
      }

      // Only fit bounds when route changes (not when following vehicle - that's handled separately)
      const currentRouteId = followedVehicleRouteId || selectedRoute;
      if (!followedVehicleId && lastDrawnRouteRef.current !== currentRouteId) {
        const bounds = L.latLngBounds(shapePoints);
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        lastDrawnRouteRef.current = currentRouteId;
      }
    }
  }, [selectedRoute, routeShapeData, selectedRouteInfo, effectiveRouteShapeData, followedVehicleId, followedVehicleRouteId, routeNamesMap]);

  // Update route stop markers with ETA info (for selected route or followed vehicle's route)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear previous stop markers
    routeStopMarkersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    routeStopMarkersRef.current = [];

    // Determine which route shape to use: followed vehicle's route or selected route
    const shapeDataToUse = effectiveRouteShapeData || routeShapeData;
    const routeIdToUse = followedVehicleRouteId || selectedRoute;
    
    // Get route info for coloring
    const routeInfoToUse = routeIdToUse && routeIdToUse !== 'all' && routeNamesMap 
      ? routeNamesMap.get(routeIdToUse) 
      : selectedRouteInfo;

    // If no route selected AND not following a vehicle, or no shape data, exit
    if ((!followedVehicleId && selectedRoute === 'all') || !shapeDataToUse) return;

    const routeColor = routeInfoToUse?.route_color || '0ea5e9';
    const direction = shapeDataToUse.directions[0];
    if (!direction) return;

    // Add numbered stop markers with ETA info
    direction.stops.forEach((stop, index) => {
      if (!stop.lat || !stop.lng) return;

      const hasVehicleStopped = stopsWithVehicles.has(stop.stop_id);
      const sequenceNumber = index + 1;
      
      // Find ETA info from realtime trip updates for this stop on this route
      const stopEtaInfo = trips
        .filter(trip => trip.routeId === routeIdToUse && trip.stopTimeUpdates?.length)
        .map(trip => {
          const stopUpdate = trip.stopTimeUpdates?.find(stu => stu.stopId === stop.stop_id);
          if (!stopUpdate || !stopUpdate.arrivalTime) return null;
          const vehicle = vehicles.find(v => v.tripId === trip.tripId);
          return {
            tripId: trip.tripId,
            vehicleId: vehicle?.vehicleId || vehicle?.id || trip.vehicleId,
            vehicleLabel: vehicle?.label || trip.vehicleLabel,
            arrivalTime: stopUpdate.arrivalTime,
            arrivalDelay: stopUpdate.arrivalDelay,
          };
        })
        .filter((info): info is NonNullable<typeof info> => info !== null)
        .sort((a, b) => a.arrivalTime - b.arrivalTime);

      const marker = L.marker([stop.lat, stop.lng], {
        icon: createStopIcon(hasVehicleStopped, sequenceNumber, routeColor),
        zIndexOffset: 1000 - index,
      });

      // Add tooltip with stop name
      const nextEta = stopEtaInfo[0];
      const tooltipContent = nextEta 
        ? `<div class="font-medium">${stop.stop_name}</div><div class="text-xs text-muted-foreground">Επόμενη: ${formatETA(nextEta.arrivalTime)}</div>`
        : `<div class="font-medium">${stop.stop_name}</div>`;
      
      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -10],
        className: 'stop-tooltip',
        permanent: false,
      });

      // Build ETA HTML for popup
      let etaHtml = '';
      if (stopEtaInfo.length > 0) {
        const etaItems = stopEtaInfo.slice(0, 3).map(info => {
          const etaTime = formatETA(info.arrivalTime);
          const delay = formatDelay(info.arrivalDelay);
          const now = Math.floor(Date.now() / 1000);
          const minutesUntil = Math.round((info.arrivalTime - now) / 60);
          const timeUntilStr = minutesUntil <= 0 ? 'Τώρα' : `${minutesUntil} λεπτά`;
          const delayClass = (info.arrivalDelay || 0) > 60 ? 'color: #ef4444;' : ((info.arrivalDelay || 0) < -30 ? 'color: #22c55e;' : '');
          
          return `
            <div class="flex items-center justify-between py-1.5 border-b border-gray-200 last:border-0">
              <div class="flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary"><rect x="3" y="4" width="18" height="14" rx="2"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/></svg>
                <span class="text-xs">${info.vehicleLabel || info.vehicleId || 'Λεωφορείο'}</span>
              </div>
              <div class="text-right">
                <div class="text-xs font-semibold">${etaTime}</div>
                <div class="text-[10px]" style="${delayClass}">${timeUntilStr} ${delay}</div>
              </div>
            </div>
          `;
        }).join('');
        
        etaHtml = `
          <div class="mt-2 pt-2 border-t border-gray-300">
            <div class="flex items-center gap-1 text-xs font-medium mb-1.5" style="color: #0ea5e9;">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Επόμενες αφίξεις
            </div>
            ${etaItems}
          </div>
        `;
      } else {
        etaHtml = `
          <div class="mt-2 pt-2 border-t border-gray-300">
            <div class="text-xs text-gray-500 italic">Δεν υπάρχουν δεδομένα ETA</div>
          </div>
        `;
      }

      marker.bindPopup(`
        <div class="p-3 min-w-[220px]">
          <div class="font-semibold text-base mb-2 flex items-center gap-2">
            <span class="inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-sm font-bold" style="background: #${routeColor}">${sequenceNumber}</span>
            ${stop.stop_name}
          </div>
          <div class="text-sm text-gray-600">
            Στάση ${sequenceNumber} από ${direction.stops.length}
          </div>
          ${etaHtml}
          <div class="mt-3 pt-2 border-t border-gray-300">
            <button data-stop-id="${stop.stop_id}" data-stop-name="${(stop.stop_name || stop.stop_id).replace(/"/g, '&quot;')}" class="stop-notification-btn w-full py-2 px-3 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              Ρύθμιση ειδοποίησης
            </button>
          </div>
        </div>
      `, {
        className: 'stop-popup',
        maxWidth: 280,
      });

      marker.addTo(mapRef.current!);
      routeStopMarkersRef.current.push(marker);
    });

  }, [selectedRoute, routeShapeData, selectedRouteInfo, stopsWithVehicles, trips, vehicles, effectiveRouteShapeData, followedVehicleId, followedVehicleRouteId, routeNamesMap]);

  // Follow the selected vehicle in realtime - respects view mode
  // Use setView for instant response without jarring animations
  useEffect(() => {
    if (!followedVehicleId || !mapRef.current) return;

    const followedVehicle = vehicles.find(
      (v) => (v.vehicleId || v.id) === followedVehicleId
    );

    if (followedVehicle?.latitude && followedVehicle?.longitude) {
      if (viewMode === 'street') {
        const currentZoom = mapRef.current.getZoom();
        
        // Always use setView without animation for smooth tracking
        mapRef.current.setView(
          [followedVehicle.latitude, followedVehicle.longitude],
          currentZoom < 15 ? 17 : currentZoom,
          { animate: false }
        );
      }
      // In overview mode, don't auto-pan - user controls the view
    }
  }, [vehicles, followedVehicleId, viewMode]);

  // Switch to overview mode - show entire route
  const switchToOverview = useCallback(() => {
    setViewMode('overview');
    if (mapRef.current && routeShapeData?.directions[0]?.shape.length) {
      const shapePoints: L.LatLngExpression[] = routeShapeData.directions[0].shape.map(p => [p.lat, p.lng]);
      const bounds = L.latLngBounds(shapePoints);
      mapRef.current.flyToBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true, duration: 1 });
    }
  }, [routeShapeData]);

  // Switch to street view - zoom to followed vehicle
  const switchToStreetView = useCallback(() => {
    setViewMode('street');
    const followedVehicle = vehicles.find((v) => (v.vehicleId || v.id) === followedVehicleId);
    if (followedVehicle?.latitude && followedVehicle?.longitude && mapRef.current) {
      mapRef.current.flyTo([followedVehicle.latitude, followedVehicle.longitude], 18, { 
        animate: true, 
        duration: 1,
        easeLinearity: 0.25 
      });
    }
  }, [vehicles, followedVehicleId]);

  // Get followed vehicle info
  const followedVehicle = followedVehicleId
    ? vehicles.find((v) => (v.vehicleId || v.id) === followedVehicleId)
    : null;

  const followedRouteInfo = followedVehicle?.routeId && routeNamesMap 
    ? routeNamesMap.get(followedVehicle.routeId) 
    : null;

  const followedNextStop = followedVehicle ? getNextStopInfo(followedVehicle) : null;

  // Get vehicles on the selected route for the live tracking panel
  const vehiclesOnSelectedRoute = useMemo(() => {
    if (selectedRoute === 'all') return [];
    return vehicles.filter(v => v.routeId === selectedRoute && v.latitude && v.longitude);
  }, [vehicles, selectedRoute]);

  // selectedRouteInfo is already defined at the top of the component

  // Handle clicking a stop in the panel - pan to it on the map
  const handleStopClick = useCallback((stopId: string) => {
    const stop = stops.find(s => s.stop_id === stopId);
    if (stop && stop.stop_lat && stop.stop_lon && mapRef.current) {
      mapRef.current.setView([stop.stop_lat, stop.stop_lon], 17, { animate: true });
    }
  }, [stops]);

  // Handle route selection from planner - draw route on map
  const handleRouteSelect = useCallback((route: { steps: Array<{ type: string; from: { lat: number; lng: number; name: string }; to: { lat: number; lng: number; name: string }; routeColor?: string }> }) => {
    if (!mapRef.current) return;

    // Clear previous route
    routeMarkersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    routeMarkersRef.current = [];
    if (routeLineRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    const allPoints: L.LatLngExpression[] = [];
    const lineSegments: Array<{ points: L.LatLngExpression[]; color: string; dashed: boolean }> = [];

    route.steps.forEach((step, idx) => {
      const fromPoint: L.LatLngExpression = [step.from.lat, step.from.lng];
      const toPoint: L.LatLngExpression = [step.to.lat, step.to.lng];

      allPoints.push(fromPoint);
      if (idx === route.steps.length - 1) {
        allPoints.push(toPoint);
      }

      // Create line segment
      const color = step.type === 'walk' ? '#6b7280' : step.routeColor ? `#${step.routeColor}` : '#0ea5e9';
      lineSegments.push({
        points: [fromPoint, toPoint],
        color,
        dashed: step.type === 'walk',
      });

      // Add markers for first and last points
      if (idx === 0) {
        const originIcon = L.divIcon({
          className: 'route-origin-marker',
          html: `<div class="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker(fromPoint, { icon: originIcon }).addTo(mapRef.current!);
        marker.bindPopup(`<div class="p-2 text-sm font-medium">${step.from.name}</div>`);
        routeMarkersRef.current.push(marker);
      }

      if (idx === route.steps.length - 1) {
        const destIcon = L.divIcon({
          className: 'route-dest-marker',
          html: `<div class="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 24],
        });
        const marker = L.marker(toPoint, { icon: destIcon }).addTo(mapRef.current!);
        marker.bindPopup(`<div class="p-2 text-sm font-medium">${step.to.name}</div>`);
        routeMarkersRef.current.push(marker);
      }
    });

    // Draw line segments
    lineSegments.forEach(segment => {
      const line = L.polyline(segment.points, {
        color: segment.color,
        weight: 5,
        opacity: 0.8,
        dashArray: segment.dashed ? '10, 10' : undefined,
      }).addTo(mapRef.current!);
      
      if (!routeLineRef.current) {
        routeLineRef.current = line;
      }
    });

    // Fit bounds to show entire route
    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 15 });
    }
  }, []);

  // Handle location selection from planner - add marker
  const handleLocationSelect = useCallback((type: 'origin' | 'destination', location: { lat: number; lng: number; name: string }) => {
    if (!mapRef.current) return;
    
    const icon = L.divIcon({
      className: `route-${type}-marker`,
      html: `<div class="w-6 h-6 ${type === 'origin' ? 'bg-blue-500' : 'bg-red-500'} rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${type === 'origin' 
            ? '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="white"/>'
            : '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>'
          }
        </svg>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, type === 'origin' ? 12 : 24],
    });

    const marker = L.marker([location.lat, location.lng], { icon }).addTo(mapRef.current);
    marker.bindPopup(`<div class="p-2 text-sm font-medium">${location.name}</div>`);
    routeMarkersRef.current.push(marker);

    mapRef.current.setView([location.lat, location.lng], 15, { animate: true });
  }, []);

  // Clear route markers when planner closes
  useEffect(() => {
    if (!showRoutePlanner && mapRef.current) {
      routeMarkersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
      routeMarkersRef.current = [];
      if (routeLineRef.current) {
        mapRef.current.removeLayer(routeLineRef.current);
        routeLineRef.current = null;
      }
    }
  }, [showRoutePlanner]);

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      
      {/* Route Planner Panel */}
      <RoutePlannerPanel
        isOpen={showRoutePlanner}
        onClose={() => {
          setShowRoutePlanner(false);
          setMapClickMode(null);
          setInitialOriginStop(null);
        }}
        stops={stops}
        trips={trips}
        vehicles={vehicles}
        routeNamesMap={routeNamesMap}
        userLocation={userLocation}
        onRouteSelect={handleRouteSelect}
        onLocationSelect={handleLocationSelect}
        onRequestMapClick={(type) => setMapClickMode(type)}
        mapClickLocation={mapClickLocation}
        selectedVehicleTrip={selectedVehicleTrip}
        initialOriginStop={initialOriginStop}
        onClearVehicleTrip={() => {
          setSelectedVehicleTrip(null);
          setInitialOriginStop(null);
          setShowRoutePlanner(false);
        }}
        onTripStopClick={(stopId, lat, lng) => {
          if (mapRef.current) {
            mapRef.current.setView([lat, lng], 17, { animate: true });
          }
        }}
      />
      
      {/* Route Stops Panel - hide when following a vehicle */}
      {showRoutePanel && selectedRoute !== 'all' && !showRoutePlanner && !followedVehicleId && (
        <RouteStopsPanel
          selectedRoute={selectedRoute}
          trips={trips}
          vehicles={vehicles}
          stops={stops}
          routeInfo={selectedRouteInfo}
          selectedOperator={selectedOperator}
          onClose={() => setShowRoutePanel(false)}
          onStopClick={handleStopClick}
        />
      )}
      
      {/* Schedule Panel - Live & Scheduled trips - positioned to the right of route panel */}
      {selectedRoute !== 'all' && showLiveVehiclesPanel && !showRoutePlanner && !followedVehicleId && (
        <SchedulePanel
          selectedRoute={selectedRoute}
          trips={trips}
          vehicles={vehicles}
          stops={stops}
          routeInfo={selectedRouteInfo}
          selectedOperator={selectedOperator}
          initialPosition={{ x: showRoutePanel ? 410 : 16, y: 60 }}
          onClose={() => setShowLiveVehiclesPanel(false)}
          onVehicleFollow={(vehicleId) => {
            setFollowedVehicleId(vehicleId);
            setShowLiveVehiclesPanel(false);
          }}
          onVehicleFocus={(vehicle) => {
            if (vehicle.latitude && vehicle.longitude && mapRef.current) {
              // Smooth zoom to street level
              mapRef.current.flyTo([vehicle.latitude, vehicle.longitude], 18, { 
                animate: true, 
                duration: 1.5,
                easeLinearity: 0.25
              });
            }
          }}
        />
      )}
      
      {/* Vehicle Follow Panel - shows when following a vehicle */}
      {followedVehicleId && followedVehicle && (
        <VehicleFollowPanel
          vehicle={followedVehicle}
          routeInfo={followedRouteInfo || undefined}
          nextStop={followedNextStop}
          viewMode={viewMode}
          onClose={() => {
            setFollowedVehicleId(null);
            onFollowVehicle?.(null);
            // Clear the trail when unfollowing
            trailPolylinesRef.current.forEach(polylines => {
              polylines.forEach(p => mapRef.current?.removeLayer(p));
            });
            trailPolylinesRef.current.clear();
          }}
          onSwitchToStreet={switchToStreetView}
          onSwitchToOverview={switchToOverview}
        />
      )}
      
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Φόρτωση...</span>
          </div>
        </div>
      )}
      

      {/* Right side controls toolbar - moves up when panel is visible */}
      <div className={`absolute right-2 z-[1000] flex flex-col gap-1 transition-all duration-300 ${nearestStopWithArrivals && userLocation && !notificationModalStop ? 'bottom-[280px]' : 'top-2'}`}>

        {/* Stop Following Button - show only when following a vehicle */}
        {followedVehicleId && (
          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8 rounded-full shadow-md transition-all duration-150 active:scale-90 animate-pulse"
            onClick={() => {
              setFollowedVehicleId(null);
              onFollowVehicle?.(null);
              // Clear the trail when unfollowing
              trailPolylinesRef.current.forEach(polylines => {
                polylines.forEach(p => mapRef.current?.removeLayer(p));
              });
              trailPolylinesRef.current.clear();
            }}
            title="Σταμάτα παρακολούθηση"
          >
            <X className="h-4 w-4" />
          </Button>
        )}

        {/* Control buttons - smaller circular */}
        <Button
          variant="secondary"
          size="icon"
          className={`h-8 w-8 rounded-full shadow-md transition-all duration-150 active:scale-90 ${showRoutePlanner ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card/90 backdrop-blur-sm hover:bg-card hover:scale-105'}`}
          onClick={() => setShowRoutePlanner(!showRoutePlanner)}
          title="Σχεδιασμός διαδρομής"
        >
          <Route className="h-3.5 w-3.5" />
        </Button>

        {/* Stops toggle button */}
        <Button
          variant="secondary"
          size="icon"
          className={`h-8 w-8 rounded-full shadow-md transition-all duration-150 active:scale-90 ${showStops ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-card/90 backdrop-blur-sm hover:bg-card hover:scale-105'}`}
          onClick={() => setShowStops(!showStops)}
          title={showStops ? `Απόκρυψη στάσεων (${stops.length})` : `Εμφάνιση στάσεων (${stops.length})`}
        >
          <MapPin className="h-3.5 w-3.5" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-md bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          onClick={locateUser}
          disabled={isLocating}
          title="Εντοπισμός τοποθεσίας"
        >
          <LocateFixed className={`h-3.5 w-3.5 ${isLocating ? 'animate-pulse' : ''} ${userLocation ? 'text-blue-500' : ''}`} />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-md bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          title="Αρχική θέση"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.setView([35.0, 33.0], 9, { animate: true });
            }
          }}
        >
          <Home className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          className={`h-8 w-8 rounded-full shadow-md backdrop-blur-sm transition-all duration-150 hover:scale-105 active:scale-90 ${
            mapStyle !== 'light' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card/90 hover:bg-card'
          }`}
          title={mapStyle === 'light' ? 'Νυχτερινός χάρτης' : mapStyle === 'dark' ? 'Δορυφορικός χάρτης' : 'Κανονικός χάρτης'}
          onClick={() => setMapStyle(mapStyle === 'light' ? 'dark' : mapStyle === 'dark' ? 'satellite' : 'light')}
        >
          <Layers className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-md bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          title="Μεγέθυνση"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-md bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          title="Σμίκρυνση"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full shadow-md bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          title="Κοινοποίηση"
          onClick={async () => {
            const shareData = {
              title: 'Motion - Cyprus Public Transport',
              text: 'Παρακολούθηση λεωφορείων σε πραγματικό χρόνο στην Κύπρο',
              url: window.location.href,
            };
            
            if (navigator.share) {
              try {
                await navigator.share(shareData);
              } catch (err) {
                if ((err as Error).name !== 'AbortError') {
                  console.error('Share failed:', err);
                }
              }
            } else {
              try {
                await navigator.clipboard.writeText(window.location.href);
                toast({
                  title: "Link αντιγράφηκε",
                  description: "Το link αντιγράφηκε στο clipboard",
                });
              } catch {
                toast({
                  title: "Σφάλμα",
                  description: "Δεν ήταν δυνατή η αντιγραφή του link",
                  variant: "destructive",
                });
              }
            }
          }}
        >
          <Share2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Nearest stop panel - draggable with walking route */}
      {nearestStopWithArrivals && userLocation && !notificationModalStop && (
        <NearestStopPanel
          stop={nearestStopWithArrivals.stop}
          distance={nearestStopWithArrivals.distance}
          arrivals={getArrivalsForStop(nearestStopWithArrivals.stop.stop_id)}
          userLocation={userLocation}
          walkingRoute={walkingRoute}
          isLoadingRoute={isLoadingWalkingRoute}
          currentNotificationSettings={getNotification(nearestStopWithArrivals.stop.stop_id)}
          onClose={() => {
            setUserLocation(null);
            setWalkingRoute(null);
            if (walkingRouteLineRef.current && mapRef.current) {
              mapRef.current.removeLayer(walkingRouteLineRef.current);
              walkingRouteLineRef.current = null;
            }
          }}
          onOpenDetails={() => {
            openStopPanel(
              nearestStopWithArrivals.stop.stop_id,
              nearestStopWithArrivals.stop.stop_name || nearestStopWithArrivals.stop.stop_id
            );
          }}
          onNavigate={() => {
            if (nearestStopWithArrivals.stop.stop_lat && nearestStopWithArrivals.stop.stop_lon) {
              mapRef.current?.setView([nearestStopWithArrivals.stop.stop_lat, nearestStopWithArrivals.stop.stop_lon], 17, { animate: true });
            }
          }}
          onSaveNotification={setStopNotification}
          onRemoveNotification={removeStopNotification}
        />
      )}
      
      <div className="absolute bottom-4 left-4 glass-card rounded-lg px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <div>
            <span className="font-medium">{vehicles.filter(v => v.latitude && v.longitude).length}</span>
            <span className="text-muted-foreground ml-1">οχήματα</span>
          </div>
          <div className="border-l border-border pl-3">
            <DataSourceHealthIndicator />
          </div>
          <RefreshIndicator 
            refreshInterval={refreshInterval} 
            lastUpdate={lastUpdate} 
            isLoading={isLoading} 
          />
        </div>
      </div>
      
      {/* Stop Detail Panel - Draggable with routes */}
      {notificationModalStop && (
        <StopDetailPanel
          stopId={notificationModalStop.stopId}
          stopName={notificationModalStop.stopName}
          arrivals={getArrivalsForStop(notificationModalStop.stopId)}
          currentSettings={getNotification(notificationModalStop.stopId)}
          onSave={setStopNotification}
          onRemove={removeStopNotification}
          onClose={closeStopPanel}
          onFollowRoute={(routeId) => {
            // Close the panel and set the selected route
            closeStopPanel();
            if (onRouteClose) {
              // First close any existing route
              onRouteClose();
            }
            // Dispatch event to change route in parent
            window.dispatchEvent(new CustomEvent('selectRoute', { detail: { routeId } }));
          }}
          onTrackVehicle={(vehicleId) => {
            closeStopPanel();
            setFollowedVehicleId(vehicleId);
          }}
        />
      )}
    </div>
  );
}
