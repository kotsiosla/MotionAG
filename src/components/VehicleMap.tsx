import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { X, Navigation, MapPin, Clock, LocateFixed, Search, Loader2, Home, ZoomIn, ZoomOut, Route, GripVertical } from "lucide-react";
import { DraggablePanel } from "@/components/DraggablePanel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RouteStopsPanel } from "@/components/RouteStopsPanel";
import { RoutePlannerPanel } from "@/components/RoutePlannerPanel";
import { useRouteShape } from "@/hooks/useGtfsData";
import type { Vehicle, StaticStop, Trip, RouteInfo } from "@/types/gtfs";

interface VehicleMapProps {
  vehicles: Vehicle[];
  trips?: Trip[];
  stops?: StaticStop[];
  routeNamesMap?: Map<string, RouteInfo>;
  selectedRoute?: string;
  selectedOperator?: string;
  onRouteClose?: () => void;
  isLoading: boolean;
}

const createVehicleIcon = (bearing?: number, isFollowed?: boolean, routeColor?: string, isOnSelectedRoute?: boolean) => {
  const rotation = bearing || 0;
  const bgColor = routeColor ? `#${routeColor}` : 'hsl(var(--primary))';
  
  // Special larger animated icon for vehicles on selected route
  if (isOnSelectedRoute) {
    return L.divIcon({
      className: 'route-vehicle-marker',
      html: `
        <div class="relative bus-icon" style="transform: rotate(${rotation}deg)">
          <div class="absolute -inset-2 rounded-full opacity-30" style="background: ${bgColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
          <div class="absolute -inset-1 rounded-full opacity-50" style="background: ${bgColor}; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
          <div class="relative flex flex-col items-center">
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-bottom: 8px solid ${bgColor}; margin-bottom: -2px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));"></div>
            <div class="w-8 h-6 rounded-sm flex items-center justify-center shadow-lg border-2 border-white" style="background: ${bgColor};">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="14" rx="2"/>
                <circle cx="7" cy="18" r="1.5" fill="white"/>
                <circle cx="17" cy="18" r="1.5" fill="white"/>
                <path d="M3 10h18"/>
              </svg>
            </div>
          </div>
        </div>
      `,
      iconSize: [32, 38],
      iconAnchor: [16, 19],
    });
  }
  
  const ringClass = isFollowed ? 'animate-ping' : 'animate-pulse-ring';
  const glowStyle = isFollowed ? 'box-shadow: 0 0 0 2px #facc15;' : '';
  
  return L.divIcon({
    className: 'vehicle-marker',
    html: `
      <div class="relative" style="transform: rotate(${rotation}deg)">
        <div class="absolute inset-0 rounded ${ringClass} opacity-50" style="background: ${bgColor}"></div>
        <div class="relative flex flex-col items-center">
          <div style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-bottom: 5px solid ${bgColor}; margin-bottom: -1px;"></div>
          <div class="w-5 h-4 rounded-sm flex items-center justify-center shadow-md" style="background: ${bgColor}; ${glowStyle}">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="14" rx="2"/>
              <circle cx="7" cy="18" r="1.5" fill="white"/>
              <circle cx="17" cy="18" r="1.5" fill="white"/>
              <path d="M3 10h18"/>
            </svg>
          </div>
        </div>
      </div>
    `,
    iconSize: [20, 26],
    iconAnchor: [10, 13],
  });
};

const createStopIcon = (hasVehicleStopped?: boolean, sequenceNumber?: number, routeColor?: string) => {
  const bgColor = hasVehicleStopped ? '#22c55e' : (sequenceNumber !== undefined ? (routeColor ? `#${routeColor}` : '#0ea5e9') : '#f97316');
  const size = sequenceNumber !== undefined ? 'w-6 h-6' : 'w-5 h-5';
  const fontSize = sequenceNumber !== undefined ? 'text-[10px]' : '';
  
  return L.divIcon({
    className: 'stop-marker',
    html: `
      <div class="${size} rounded-full flex items-center justify-center shadow-md border-2 border-white ${hasVehicleStopped ? 'animate-pulse' : ''}" style="background: ${bgColor}">
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

export function VehicleMap({ vehicles, trips = [], stops = [], routeNamesMap, selectedRoute = 'all', selectedOperator, onRouteClose, isLoading }: VehicleMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const vehicleMarkersRef = useRef<L.MarkerClusterGroup | null>(null);
  const stopMarkersRef = useRef<L.MarkerClusterGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [followedVehicleId, setFollowedVehicleId] = useState<string | null>(null);
  const [showStops, setShowStops] = useState(true);
  const [showRoutePanel, setShowRoutePanel] = useState(true);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
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
  const routeStopMarkersRef = useRef<L.Marker[]>([]);
  const lastDrawnRouteRef = useRef<string | null>(null);
  const [mapClickMode, setMapClickMode] = useState<'origin' | 'destination' | null>(null);
  const [mapClickLocation, setMapClickLocation] = useState<{ type: 'origin' | 'destination'; lat: number; lng: number } | null>(null);

  // Fetch route shape data when a route is selected
  const { data: routeShapeData } = useRouteShape(
    selectedRoute !== 'all' ? selectedRoute : null,
    selectedOperator
  );

  // Get route info for coloring
  const selectedRouteInfo = selectedRoute !== 'all' && routeNamesMap 
    ? routeNamesMap.get(selectedRoute) 
    : undefined;

  // Show panels when route changes
  useEffect(() => {
    if (selectedRoute !== 'all') {
      setShowRoutePanel(true);
      setShowLiveVehiclesPanel(true);
    }
  }, [selectedRoute]);

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
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="marker-cluster"><div>${count}</div></div>`,
          className: 'marker-cluster-container',
          iconSize: L.point(40, 40),
        });
      },
    });

    stopMarkersRef.current = L.markerClusterGroup({
      chunkedLoading: true,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      maxClusterRadius: 60,
      disableClusteringAtZoom: 15,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="stop-cluster"><div>${count}</div></div>`,
          className: 'stop-cluster-container',
          iconSize: L.point(30, 30),
        });
      },
    });

    mapRef.current.addLayer(vehicleMarkersRef.current);
    mapRef.current.addLayer(stopMarkersRef.current);

    return () => {
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

  // Add Esri satellite layer
  useEffect(() => {
    if (!mapRef.current) return;

    // Use Esri World Imagery (free, no API key required)
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Map data © <a href="https://www.esri.com/">Esri</a> | MapLibre',
      maxZoom: 19,
    });

    tileLayerRef.current = esriSatellite;
    esriSatellite.addTo(mapRef.current);

    return () => {
      if (mapRef.current && esriSatellite) {
        mapRef.current.removeLayer(esriSatellite);
      }
    };
  }, []);

  // Update vehicle markers when vehicles change - with smooth animation
  useEffect(() => {
    if (!vehicleMarkersRef.current || !mapRef.current) return;

    const validVehicles = vehicles.filter(
      (v) => v.latitude !== undefined && v.longitude !== undefined
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
      
      if (existingMarker) {
        // Smooth animation: update position of existing marker
        const currentLatLng = existingMarker.getLatLng();
        const newLatLng = L.latLng(vehicle.latitude!, vehicle.longitude!);
        
        // Only animate if position actually changed
        if (currentLatLng.lat !== newLatLng.lat || currentLatLng.lng !== newLatLng.lng) {
          // Get the marker's DOM element and add transition class
          const markerElement = existingMarker.getElement();
          if (markerElement) {
            markerElement.style.transition = 'transform 1s ease-out';
          }
          existingMarker.setLatLng(newLatLng);
        }
        
        // Update icon if needed (for rotation/bearing changes)
        existingMarker.setIcon(createVehicleIcon(vehicle.bearing, isFollowed, routeColor, isOnSelectedRoute));
        existingMarker.setZIndexOffset(isOnSelectedRoute ? 2000 : (isFollowed ? 1000 : 0));
        
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
              <div class="flex justify-between pt-1 border-t border-border mt-2"><span class="text-muted-foreground">Ενημ:</span><span class="text-xs">${formatTimestamp(vehicle.timestamp)}</span></div>
            </div>
            ${etaHtml}
          </div>
        `);
      } else {
        // Create new marker for new vehicles
        const marker = L.marker([vehicle.latitude!, vehicle.longitude!], {
          icon: createVehicleIcon(vehicle.bearing, isFollowed, routeColor, isOnSelectedRoute),
          zIndexOffset: isOnSelectedRoute ? 2000 : (isFollowed ? 1000 : 0),
        });

        marker.on('click', () => {
          setFollowedVehicleId(vehicleId);
        });

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

        marker.bindPopup(`
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
              <div class="flex justify-between pt-1 border-t border-border mt-2"><span class="text-muted-foreground">Ενημ:</span><span class="text-xs">${formatTimestamp(vehicle.timestamp)}</span></div>
            </div>
            ${etaHtml}
          </div>
        `, {
          className: 'vehicle-popup',
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
  }, [vehicles, followedVehicleId, routeNamesMap, tripMap, stopMap, selectedRoute]);

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

  // Find nearest stop to user location
  const nearestStop = useMemo(() => {
    if (!userLocation) return null;
    
    let nearest: { stop: StaticStop; distance: number } | null = null;
    
    stops.forEach(stop => {
      if (stop.stop_lat === undefined || stop.stop_lon === undefined) return;
      
      const distance = calculateDistance(
        userLocation.lat, userLocation.lng,
        stop.stop_lat, stop.stop_lon
      );
      
      if (!nearest || distance < nearest.distance) {
        nearest = { stop, distance };
      }
    });
    
    return nearest;
  }, [userLocation, stops]);

  // Update user location marker position
  useEffect(() => {
    if (!userLocation || !userLocationMarkerRef.current) return;
    userLocationMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
  }, [userLocation]);

  useEffect(() => {
    if (!stopMarkersRef.current || !mapRef.current) return;

    stopMarkersRef.current.clearLayers();

    if (!showStops) return;

    const validStops = stops.filter(
      (s) => s.stop_lat !== undefined && s.stop_lon !== undefined
    );

    validStops.forEach((stop) => {
      const hasVehicleStopped = stopsWithVehicles.has(stop.stop_id);
      const arrivals = getArrivalsForStop(stop.stop_id);
      
      const marker = L.marker([stop.stop_lat!, stop.stop_lon!], {
        icon: createStopIcon(hasVehicleStopped),
      });

      const statusColor = hasVehicleStopped ? '#22c55e' : '#f97316';
      const statusText = hasVehicleStopped ? '<div class="text-green-500 font-medium mt-2 pt-2 border-t border-border">🚌 Λεωφορείο στη στάση</div>' : '';

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
            ${stop.stop_name || 'Στάση'}
          </div>
          <div class="space-y-1.5 text-sm">
            <div class="flex justify-between"><span class="text-muted-foreground">ID:</span><span class="font-mono">${stop.stop_id}</span></div>
            ${stop.stop_code ? `<div class="flex justify-between"><span class="text-muted-foreground">Κωδικός:</span><span class="font-mono">${stop.stop_code}</span></div>` : ''}
          </div>
          ${statusText}
          ${arrivalsHtml}
        </div>
      `, {
        className: 'stop-popup',
        maxWidth: 320,
      });

      stopMarkersRef.current!.addLayer(marker);
    });
  }, [stops, showStops, stopsWithVehicles, trips, vehicles, routeNamesMap]);

  // Draw route shape when route changes (only fit bounds on route change)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear previous route shape line
    if (routeShapeLineRef.current) {
      mapRef.current.removeLayer(routeShapeLineRef.current);
      routeShapeLineRef.current = null;
    }

    // If no route selected or no data, reset ref and exit
    if (selectedRoute === 'all' || !routeShapeData) {
      lastDrawnRouteRef.current = null;
      return;
    }

    const routeColor = selectedRouteInfo?.route_color || '0ea5e9';
    
    // Use first direction for now
    const direction = routeShapeData.directions[0];
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

      // Only fit bounds when route changes, not on every update
      if (lastDrawnRouteRef.current !== selectedRoute) {
        const bounds = L.latLngBounds(shapePoints);
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
        lastDrawnRouteRef.current = selectedRoute;
      }
    }
  }, [selectedRoute, routeShapeData, selectedRouteInfo]);

  // Update route stop markers with ETA info (separate from shape drawing)
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear previous stop markers
    routeStopMarkersRef.current.forEach(marker => mapRef.current?.removeLayer(marker));
    routeStopMarkersRef.current = [];

    // If no route selected or no data, exit
    if (selectedRoute === 'all' || !routeShapeData) return;

    const routeColor = selectedRouteInfo?.route_color || '0ea5e9';
    const direction = routeShapeData.directions[0];
    if (!direction) return;

    // Add numbered stop markers with ETA info
    direction.stops.forEach((stop, index) => {
      if (!stop.lat || !stop.lng) return;

      const hasVehicleStopped = stopsWithVehicles.has(stop.stop_id);
      const sequenceNumber = index + 1;
      
      // Find ETA info from realtime trip updates for this stop on this route
      const stopEtaInfo = trips
        .filter(trip => trip.routeId === selectedRoute && trip.stopTimeUpdates?.length)
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
        </div>
      `, {
        className: 'stop-popup',
        maxWidth: 280,
      });

      marker.addTo(mapRef.current!);
      routeStopMarkersRef.current.push(marker);
    });

  }, [selectedRoute, routeShapeData, selectedRouteInfo, stopsWithVehicles, trips, vehicles]);

  // Follow the selected vehicle in realtime
  useEffect(() => {
    if (!followedVehicleId || !mapRef.current) return;

    const followedVehicle = vehicles.find(
      (v) => (v.vehicleId || v.id) === followedVehicleId
    );

    if (followedVehicle?.latitude && followedVehicle?.longitude) {
      mapRef.current.setView(
        [followedVehicle.latitude, followedVehicle.longitude],
        16,
        { animate: true, duration: 0.5 }
      );
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
      />
      
      {/* Route Stops Panel */}
      {showRoutePanel && selectedRoute !== 'all' && !showRoutePlanner && (
        <RouteStopsPanel
          selectedRoute={selectedRoute}
          trips={trips}
          vehicles={vehicles}
          stops={stops}
          routeInfo={selectedRouteInfo}
          onClose={() => setShowRoutePanel(false)}
          onStopClick={handleStopClick}
        />
      )}
      
      {/* Live vehicles on route panel - positioned smartly */}
      {selectedRoute !== 'all' && vehiclesOnSelectedRoute.length > 0 && showLiveVehiclesPanel && !showRoutePlanner && (
        <DraggablePanel
          initialPosition={{ x: showRoutePanel ? 400 : 16, y: 16 }}
          className="rounded-lg overflow-hidden border border-border"
          zIndex={1000}
        >
          <div className="w-[280px] max-w-[280px]">
            {/* Header with route color - draggable */}
            <div 
              className="p-3 flex items-center gap-2 cursor-grab active:cursor-grabbing"
              style={{ backgroundColor: selectedRouteInfo?.route_color ? `#${selectedRouteInfo.route_color}` : 'hsl(var(--primary))' }}
            >
              <GripVertical className="h-4 w-4 text-white/60" />
              <div className="w-3 h-3 rounded-full animate-pulse bg-white/80" />
              <span className="text-sm font-semibold text-white flex-1">
                {vehiclesOnSelectedRoute.length} λεωφορεί{vehiclesOnSelectedRoute.length === 1 ? 'ο' : 'α'} ενεργ{vehiclesOnSelectedRoute.length === 1 ? 'ό' : 'ά'}
              </span>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-white hover:bg-white/20 transition-all duration-150 active:scale-90"
                onClick={() => setShowLiveVehiclesPanel(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {/* Content */}
            <div className="bg-card/95 backdrop-blur-sm p-3">
              <div className="space-y-2 max-h-[180px] overflow-y-auto">
                {vehiclesOnSelectedRoute.slice(0, 5).map((vehicle) => {
                  const vehicleId = vehicle.vehicleId || vehicle.id;
                  const nextStop = getNextStopInfo(vehicle);
                  return (
                    <button
                      key={vehicleId}
                      onClick={() => {
                        setFollowedVehicleId(vehicleId);
                        if (vehicle.latitude && vehicle.longitude && mapRef.current) {
                          mapRef.current.setView([vehicle.latitude, vehicle.longitude], 16, { animate: true });
                        }
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary/50 transition-all duration-150 text-left active:scale-95"
                    >
                      <div className="relative">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: selectedRouteInfo?.route_color ? `#${selectedRouteInfo.route_color}20` : 'hsl(var(--primary) / 0.2)' }}
                        >
                          <Navigation 
                            className="h-4 w-4 animate-pulse" 
                            style={{ 
                              color: selectedRouteInfo?.route_color ? `#${selectedRouteInfo.route_color}` : 'hsl(var(--primary))',
                              transform: `rotate(${vehicle.bearing || 0}deg)` 
                            }}
                          />
                        </div>
                        <div 
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card animate-ping"
                          style={{ background: selectedRouteInfo?.route_color ? `#${selectedRouteInfo.route_color}` : 'hsl(var(--primary))' }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">
                          {vehicle.label || vehicleId}
                        </div>
                        {nextStop && (
                          <div className="text-[10px] text-muted-foreground truncate">
                            → {nextStop.stopName}
                          </div>
                        )}
                      </div>
                      {vehicle.speed !== undefined && (
                        <div className="text-xs font-mono text-primary">
                          {(vehicle.speed * 3.6).toFixed(0)}km/h
                        </div>
                      )}
                    </button>
                  );
                })}
                {vehiclesOnSelectedRoute.length > 5 && (
                  <div className="text-xs text-muted-foreground text-center pt-1">
                    +{vehiclesOnSelectedRoute.length - 5} ακόμα
                  </div>
                )}
              </div>
            </div>
          </div>
        </DraggablePanel>
      )}
      
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Φόρτωση...</span>
          </div>
        </div>
      )}
      
      {/* Vehicle tracking panel - draggable */}
      {followedVehicle && (
        <DraggablePanel
          initialPosition={{ x: 16, y: 400 }}
          className="rounded-lg overflow-hidden border border-border"
          zIndex={1001}
        >
          <div className="w-[300px] max-w-[300px]">
            {/* Header with route color - draggable */}
            <div 
              className="flex items-center gap-2 p-3 cursor-grab active:cursor-grabbing"
              style={{ backgroundColor: followedRouteInfo?.route_color ? `#${followedRouteInfo.route_color}` : 'hsl(var(--primary))' }}
            >
              <GripVertical className="h-4 w-4 text-white/60" />
              <Navigation className="h-4 w-4 animate-pulse text-white" />
              <span className="text-sm font-semibold flex-1 text-white">Παρακολούθηση</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-white hover:bg-white/20 transition-all duration-150 active:scale-90"
                onClick={() => setFollowedVehicleId(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Content */}
            <div className="bg-card/95 backdrop-blur-sm p-3 space-y-2">
              {/* Vehicle info */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Όχημα:</span>
                <span className="font-bold">{followedVehicle.label || followedVehicle.vehicleId || followedVehicle.id}</span>
                {followedVehicle.speed !== undefined && (
                  <span className="text-primary font-medium">{formatSpeed(followedVehicle.speed)}</span>
                )}
              </div>
              
              {/* Route info */}
              {followedRouteInfo && (
                <div 
                  className="text-sm font-medium"
                  style={{ color: followedRouteInfo.route_color ? `#${followedRouteInfo.route_color}` : 'inherit' }}
                >
                  {followedRouteInfo.route_short_name} - {followedRouteInfo.route_long_name}
                </div>
              )}
              
              {/* Next stop */}
              {followedNextStop && (
                <div className="flex items-center gap-2 pt-2 border-t border-border text-sm">
                  <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-muted-foreground">Επόμενη:</span>
                  <span className="font-medium">{followedNextStop.stopName}</span>
                  {followedNextStop.arrivalTime && (
                    <span className="font-mono text-primary">{formatETA(followedNextStop.arrivalTime)}</span>
                  )}
                  {followedNextStop.arrivalDelay !== undefined && (
                    <span className={`text-xs ${
                      followedNextStop.arrivalDelay > 0 ? 'text-destructive' : 
                      followedNextStop.arrivalDelay < 0 ? 'text-green-500' : 
                      'text-muted-foreground'
                    }`}>
                      {followedNextStop.arrivalDelay === 0 ? '(στην ώρα)' : formatDelay(followedNextStop.arrivalDelay)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </DraggablePanel>
      )}

      {/* Search box - smart positioning to avoid overlaps */}
      <div className={`absolute top-4 z-[999] w-72 transition-all duration-300 ease-out ${showRoutePlanner ? 'left-[360px]' : (selectedRoute !== 'all' && showRoutePanel ? 'left-[400px]' : 'left-4')}`}>
        <div className="glass-card rounded-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Αναζήτηση διεύθυνσης..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchAddress(searchQuery);
                }
              }}
              onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
              className="pl-9 pr-10 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {isSearching ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            ) : searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowSearchResults(false);
                  if (searchMarkerRef.current && mapRef.current) {
                    mapRef.current.removeLayer(searchMarkerRef.current);
                    searchMarkerRef.current = null;
                  }
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          {showSearchResults && searchResults.length > 0 && (
            <div className="border-t border-border max-h-48 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-start gap-2"
                  onClick={() => selectSearchResult(result)}
                >
                  <MapPin className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{result.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right side controls toolbar - bottom right */}
      <div className="absolute bottom-20 right-4 z-[1000] flex flex-col gap-2">
        {/* Stops toggle */}
        <div className="glass-card rounded-lg px-3 py-2 flex items-center gap-2">
          <Switch
            id="show-stops"
            checked={showStops}
            onCheckedChange={setShowStops}
          />
          <Label htmlFor="show-stops" className="text-xs cursor-pointer flex items-center gap-1">
            <MapPin className="h-3 w-3 text-orange-500" />
            Στάσεις ({stops.length})
          </Label>
        </div>

        {/* Control buttons - circular with press animation */}
        <Button
          variant="secondary"
          size="icon"
          className={`h-10 w-10 rounded-full shadow-lg transition-all duration-150 active:scale-90 ${showRoutePlanner ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card/90 backdrop-blur-sm hover:bg-card hover:scale-105'}`}
          onClick={() => setShowRoutePlanner(!showRoutePlanner)}
          title="Σχεδιασμός διαδρομής"
        >
          <Route className="h-4 w-4" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          onClick={locateUser}
          disabled={isLocating}
          title="Εντοπισμός τοποθεσίας"
        >
          <LocateFixed className={`h-4 w-4 ${isLocating ? 'animate-pulse' : ''} ${userLocation ? 'text-blue-500' : ''}`} />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          title="Αρχική θέση"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.setView([35.0, 33.0], 9, { animate: true });
            }
          }}
        >
          <Home className="h-4 w-4" />
        </Button>

        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          title="Μεγέθυνση"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        
        <Button
          variant="secondary"
          size="icon"
          className="h-10 w-10 rounded-full shadow-lg bg-card/90 backdrop-blur-sm hover:bg-card transition-all duration-150 hover:scale-105 active:scale-90"
          title="Σμίκρυνση"
          onClick={() => mapRef.current?.zoomOut()}
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
      </div>

      {/* Nearest stop info */}
      {nearestStop && userLocation && (
        <div className="absolute bottom-4 right-4 glass-card rounded-lg p-3 z-[1000] max-w-[280px]">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Κοντινότερη στάση</span>
          </div>
          <div className="font-medium text-sm mb-1">{nearestStop.stop.stop_name || nearestStop.stop.stop_id}</div>
          <div className="text-xs text-muted-foreground mb-2">
            {nearestStop.distance < 1000 
              ? `${Math.round(nearestStop.distance)} μέτρα` 
              : `${(nearestStop.distance / 1000).toFixed(1)} χλμ`}
          </div>
          {(() => {
            const arrivals = getArrivalsForStop(nearestStop.stop.stop_id);
            if (arrivals.length === 0) return <div className="text-xs text-muted-foreground">Δεν υπάρχουν αφίξεις</div>;
            return (
              <div className="space-y-1 border-t border-border pt-2">
                {arrivals.slice(0, 3).map((arr, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span 
                      className="font-bold px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: arr.routeColor ? `#${arr.routeColor}` : '#0ea5e9' }}
                    >
                      {arr.routeShortName || arr.routeId || '?'}
                    </span>
                    <span className="font-mono text-primary">{formatETA(arr.arrivalTime)}</span>
                    {arr.arrivalDelay !== undefined && arr.arrivalDelay !== 0 && (
                      <span className={arr.arrivalDelay > 0 ? 'text-destructive' : 'text-green-500'}>
                        {formatDelay(arr.arrivalDelay)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-xs h-7"
            onClick={() => {
              if (nearestStop.stop.stop_lat && nearestStop.stop.stop_lon) {
                mapRef.current?.setView([nearestStop.stop.stop_lat, nearestStop.stop.stop_lon], 17, { animate: true });
              }
            }}
          >
            <Navigation className="h-3 w-3 mr-1" />
            Πήγαινε στη στάση
          </Button>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 glass-card rounded-lg px-3 py-2 text-sm">
        <span className="font-medium">{vehicles.filter(v => v.latitude && v.longitude).length}</span>
        <span className="text-muted-foreground ml-1">οχήματα</span>
      </div>
    </div>
  );
}
