import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { X, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Vehicle } from "@/types/gtfs";

interface VehicleMapProps {
  vehicles: Vehicle[];
  isLoading: boolean;
}

const createVehicleIcon = (bearing?: number, isFollowed?: boolean) => {
  const rotation = bearing || 0;
  const ringClass = isFollowed ? 'animate-ping' : 'animate-pulse-ring';
  const glowClass = isFollowed ? 'transit-glow ring-2 ring-yellow-400' : 'transit-glow';
  return L.divIcon({
    className: 'vehicle-marker',
    html: `
      <div class="relative">
        <div class="absolute inset-0 bg-primary rounded-full ${ringClass} opacity-50"></div>
        <div class="relative w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg ${glowClass}" style="transform: rotate(${rotation}deg)">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-foreground">
            <path d="M8 6v6"/>
            <path d="M15 6v6"/>
            <path d="M2 12h19.6"/>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H6C4.9 6 3.9 6.8 3.6 7.8l-1.4 5c-.1.4-.2.8-.2 1.2 0 .4.1.8.2 1.2.3 1.1.8 2.8.8 2.8h3"/>
            <circle cx="7" cy="18" r="2"/>
            <circle cx="17" cy="18" r="2"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
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

export function VehicleMap({ vehicles, isLoading }: VehicleMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [followedVehicleId, setFollowedVehicleId] = useState<string | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: [38.5, 23.5], // Center of Greece
      zoom: 7,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(mapRef.current);

    markersRef.current = L.markerClusterGroup({
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

    mapRef.current.addLayer(markersRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when vehicles change
  useEffect(() => {
    if (!markersRef.current) return;

    markersRef.current.clearLayers();
    markerMapRef.current.clear();

    const validVehicles = vehicles.filter(
      (v) => v.latitude !== undefined && v.longitude !== undefined
    );

    validVehicles.forEach((vehicle) => {
      const vehicleId = vehicle.vehicleId || vehicle.id;
      const isFollowed = followedVehicleId === vehicleId;
      
      const marker = L.marker([vehicle.latitude!, vehicle.longitude!], {
        icon: createVehicleIcon(vehicle.bearing, isFollowed),
      });

      marker.on('click', () => {
        setFollowedVehicleId(vehicleId);
      });

      marker.bindPopup(`
        <div class="p-3 min-w-[200px]">
          <div class="font-semibold text-base mb-2 flex items-center gap-2">
            <span class="inline-block w-2 h-2 bg-primary rounded-full"></span>
            Όχημα ${vehicleId}
          </div>
          <div class="space-y-1.5 text-sm">
            ${vehicle.label ? `<div class="flex justify-between"><span class="text-muted-foreground">Ετικέτα:</span><span class="font-mono">${vehicle.label}</span></div>` : ''}
            ${vehicle.tripId ? `<div class="flex justify-between"><span class="text-muted-foreground">Trip ID:</span><span class="font-mono text-xs">${vehicle.tripId}</span></div>` : ''}
            ${vehicle.routeId ? `<div class="flex justify-between"><span class="text-muted-foreground">Route ID:</span><span class="font-mono">${vehicle.routeId}</span></div>` : ''}
            <div class="flex justify-between"><span class="text-muted-foreground">Ταχύτητα:</span><span>${formatSpeed(vehicle.speed)}</span></div>
            ${vehicle.bearing !== undefined ? `<div class="flex justify-between"><span class="text-muted-foreground">Κατεύθυνση:</span><span>${vehicle.bearing.toFixed(0)}°</span></div>` : ''}
            ${vehicle.currentStatus ? `<div class="flex justify-between"><span class="text-muted-foreground">Κατάσταση:</span><span>${vehicle.currentStatus}</span></div>` : ''}
            <div class="flex justify-between pt-1 border-t border-border mt-2"><span class="text-muted-foreground">Ενημ:</span><span class="text-xs">${formatTimestamp(vehicle.timestamp)}</span></div>
          </div>
        </div>
      `, {
        className: 'vehicle-popup',
      });

      markerMapRef.current.set(vehicleId, marker);
      markersRef.current!.addLayer(marker);
    });

    // If not following a vehicle, fit bounds to show all
    if (!followedVehicleId && validVehicles.length > 0 && mapRef.current) {
      const bounds = L.latLngBounds(
        validVehicles.map((v) => [v.latitude!, v.longitude!])
      );
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
    }
  }, [vehicles, followedVehicleId]);

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

  return (
    <div className="relative h-full w-full rounded-lg overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span>Φόρτωση...</span>
          </div>
        </div>
      )}
      
      {/* Following indicator */}
      {followedVehicle && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass-card rounded-lg px-4 py-2 flex items-center gap-3 z-[1000]">
          <Navigation className="h-4 w-4 text-primary animate-pulse" />
          <div className="text-sm">
            <span className="text-muted-foreground">Παρακολούθηση: </span>
            <span className="font-semibold">{followedVehicle.vehicleId || followedVehicle.id}</span>
            {followedVehicle.routeId && (
              <span className="text-muted-foreground ml-2">({followedVehicle.routeId})</span>
            )}
            {followedVehicle.speed !== undefined && (
              <span className="ml-2 text-primary">{formatSpeed(followedVehicle.speed)}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setFollowedVehicleId(null)}
          >
            <X className="h-4 w-4" />
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