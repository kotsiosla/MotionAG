import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { X, MapPin, Navigation, Clock, Footprints, Bus, ChevronDown, ChevronUp, Search, Loader2, LocateFixed, ArrowRight, MousePointer2, Target, Bell, BellOff, Volume2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StaticStop, Trip, Vehicle, RouteInfo } from "@/types/gtfs";

interface Location {
  lat: number;
  lng: number;
  name: string;
  type: 'user' | 'search' | 'stop';
  stopId?: string;
}

interface RouteStep {
  type: 'walk' | 'bus';
  from: {
    name: string;
    lat: number;
    lng: number;
    stopId?: string;
  };
  to: {
    name: string;
    lat: number;
    lng: number;
    stopId?: string;
  };
  distance?: number; // in meters for walking
  duration?: number; // in minutes
  routeId?: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  departureTime?: number;
  arrivalTime?: number;
  intermediateStops?: Array<{
    stopId: string;
    stopName: string;
    arrivalTime?: number;
  }>;
}

interface PlannedRoute {
  steps: RouteStep[];
  totalDuration: number; // in minutes
  totalWalkingDistance: number; // in meters
  departureTime?: number;
  arrivalTime?: number;
}

interface RoutePlannerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  stops: StaticStop[];
  trips: Trip[];
  vehicles: Vehicle[];
  routeNamesMap?: Map<string, RouteInfo>;
  userLocation?: { lat: number; lng: number } | null;
  onRouteSelect?: (route: PlannedRoute) => void;
  onLocationSelect?: (type: 'origin' | 'destination', location: Location) => void;
  onRequestMapClick?: (type: 'origin' | 'destination') => void;
  mapClickLocation?: { type: 'origin' | 'destination'; lat: number; lng: number } | null;
  selectedVehicleTrip?: { vehicleId: string; tripId: string; routeId?: string } | null;
  onClearVehicleTrip?: () => void;
  onTripStopClick?: (stopId: string, lat: number, lng: number) => void;
}

// Haversine distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

// Walking speed in m/min (average 5 km/h = ~83 m/min)
const WALKING_SPEED = 83;

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '--:--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${Math.round(minutes)} λεπτά`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours} ώρ${hours > 1 ? 'ες' : 'α'}${mins > 0 ? ` ${mins} λ.` : ''}`;
};

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} μ.`;
  return `${(meters / 1000).toFixed(1)} χλμ`;
};

export function RoutePlannerPanel({
  isOpen,
  onClose,
  stops,
  trips,
  vehicles,
  routeNamesMap,
  userLocation,
  onRouteSelect,
  onLocationSelect,
  onRequestMapClick,
  mapClickLocation,
  selectedVehicleTrip,
  onClearVehicleTrip,
  onTripStopClick,
}: RoutePlannerPanelProps) {
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [originQuery, setOriginQuery] = useState("");
  const [destinationQuery, setDestinationQuery] = useState("");
  const [originResults, setOriginResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [destinationResults, setDestinationResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
  const [isSearchingDestination, setIsSearchingDestination] = useState(false);
  const [showOriginResults, setShowOriginResults] = useState(false);
  const [showDestinationResults, setShowDestinationResults] = useState(false);
  const [showOriginStops, setShowOriginStops] = useState(false);
  const [showDestinationStops, setShowDestinationStops] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [selectingOnMap, setSelectingOnMap] = useState<'origin' | 'destination' | null>(null);
  const [alternativeRoutes, setAlternativeRoutes] = useState<PlannedRoute[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const stopsListRef = useRef<HTMLDivElement>(null);
  const currentStopRef = useRef<HTMLButtonElement>(null);
  const [lastCurrentStopId, setLastCurrentStopId] = useState<string | null>(null);
  const [watchedStopId, setWatchedStopId] = useState<string | null>(null);
  const [notifiedStops, setNotifiedStops] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [notificationDistance, setNotificationDistance] = useState(() => {
    const saved = localStorage.getItem('notificationDistance');
    return saved ? parseInt(saved, 10) : 500;
  });
  const [notificationSound, setNotificationSound] = useState(() => {
    return localStorage.getItem('notificationSound') || 'chime';
  });
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const distanceOptions = [200, 300, 500, 750, 1000];
  const soundOptions = [
    { id: 'chime', name: 'Κουδούνι', icon: '🔔' },
    { id: 'alert', name: 'Ειδοποίηση', icon: '🚨' },
    { id: 'bell', name: 'Καμπάνα', icon: '🔊' },
    { id: 'soft', name: 'Απαλός', icon: '🎵' },
  ];

  // Save notification settings to localStorage
  useEffect(() => {
    localStorage.setItem('notificationDistance', notificationDistance.toString());
  }, [notificationDistance]);

  useEffect(() => {
    localStorage.setItem('notificationSound', notificationSound);
  }, [notificationSound]);

  // Handle map click location
  useEffect(() => {
    if (mapClickLocation) {
      const location: Location = {
        lat: mapClickLocation.lat,
        lng: mapClickLocation.lng,
        name: `${mapClickLocation.lat.toFixed(5)}, ${mapClickLocation.lng.toFixed(5)}`,
        type: 'search',
      };
      
      // Reverse geocode to get actual name
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${mapClickLocation.lat}&lon=${mapClickLocation.lng}`)
        .then(res => res.json())
        .then(data => {
          if (data.display_name) {
            location.name = data.display_name.split(',')[0];
          }
          if (mapClickLocation.type === 'origin') {
            setOrigin(location);
            setOriginQuery(location.name);
            onLocationSelect?.('origin', location);
          } else {
            setDestination(location);
            setDestinationQuery(location.name);
            onLocationSelect?.('destination', location);
          }
        })
        .catch(() => {
          if (mapClickLocation.type === 'origin') {
            setOrigin(location);
            setOriginQuery(location.name);
          } else {
            setDestination(location);
            setDestinationQuery(location.name);
          }
        });
      
      setSelectingOnMap(null);
    }
  }, [mapClickLocation, onLocationSelect]);

  // Filter stops for dropdown
  const filteredOriginStops = useMemo(() => {
    if (!originQuery.trim()) return stops.slice(0, 10);
    const query = originQuery.toLowerCase();
    return stops.filter(s => 
      s.stop_name?.toLowerCase().includes(query) || 
      s.stop_id.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [stops, originQuery]);

  const filteredDestinationStops = useMemo(() => {
    if (!destinationQuery.trim()) return stops.slice(0, 10);
    const query = destinationQuery.toLowerCase();
    return stops.filter(s => 
      s.stop_name?.toLowerCase().includes(query) || 
      s.stop_id.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [stops, destinationQuery]);

  // Select a bus stop
  const selectStop = useCallback((stop: StaticStop, type: 'origin' | 'destination') => {
    if (!stop.stop_lat || !stop.stop_lon) return;
    
    const location: Location = {
      lat: stop.stop_lat,
      lng: stop.stop_lon,
      name: stop.stop_name || stop.stop_id,
      type: 'stop',
      stopId: stop.stop_id,
    };
    
    if (type === 'origin') {
      setOrigin(location);
      setOriginQuery(location.name);
      setShowOriginStops(false);
      setShowOriginResults(false);
    } else {
      setDestination(location);
      setDestinationQuery(location.name);
      setShowDestinationStops(false);
      setShowDestinationResults(false);
    }
    
    onLocationSelect?.(type, location);
  }, [onLocationSelect]);

  // Request map click
  const requestMapClick = useCallback((type: 'origin' | 'destination') => {
    setSelectingOnMap(type);
    onRequestMapClick?.(type);
    setShowOriginResults(false);
    setShowDestinationResults(false);
    setShowOriginStops(false);
    setShowDestinationStops(false);
  }, [onRequestMapClick]);

  // Create stop map for quick lookup
  const stopMap = useMemo(() => {
    const map = new Map<string, StaticStop>();
    stops.forEach(stop => map.set(stop.stop_id, stop));
    return map;
  }, [stops]);

  // Get the selected vehicle's trip route information
  const selectedVehicleTripInfo = useMemo(() => {
    if (!selectedVehicleTrip) return null;
    
    const trip = trips.find(t => t.tripId === selectedVehicleTrip.tripId || t.id === selectedVehicleTrip.tripId);
    if (!trip) return null;

    const vehicle = vehicles.find(v => v.vehicleId === selectedVehicleTrip.vehicleId);
    const routeInfo = trip.routeId && routeNamesMap ? routeNamesMap.get(trip.routeId) : null;
    
    // Get vehicle current position and speed
    const vehicleLat = vehicle?.latitude;
    const vehicleLon = vehicle?.longitude;
    const vehicleSpeed = vehicle?.speed; // in m/s
    
    // Calculate cumulative distance for ETA calculation
    let cumulativeDistance = 0;
    let lastLat = vehicleLat;
    let lastLon = vehicleLon;
    let passedCurrentStop = false;

    // Get all stops on this trip
    const tripStops = trip.stopTimeUpdates?.map((stu, index) => {
      const stop = stu.stopId ? stopMap.get(stu.stopId) : null;
      const stopLat = stop?.stop_lat;
      const stopLon = stop?.stop_lon;
      const isPassed = vehicle?.currentStopSequence ? (stu.stopSequence || index) < vehicle.currentStopSequence : false;
      const isCurrent = vehicle?.stopId === stu.stopId;
      
      // Calculate ETA based on distance and speed
      let estimatedArrival: number | undefined;
      let distanceFromVehicle: number | undefined;
      
      if (!isPassed && stopLat !== undefined && stopLon !== undefined && vehicleLat !== undefined && vehicleLon !== undefined) {
        if (isCurrent) {
          passedCurrentStop = true;
          cumulativeDistance = 0;
          lastLat = stopLat;
          lastLon = stopLon;
        } else if (passedCurrentStop || !vehicle?.currentStopSequence) {
          // Calculate distance from last point (vehicle or previous stop)
          if (lastLat !== undefined && lastLon !== undefined) {
            const segmentDistance = calculateDistance(lastLat, lastLon, stopLat, stopLon);
            cumulativeDistance += segmentDistance;
            lastLat = stopLat;
            lastLon = stopLon;
          }
          
          distanceFromVehicle = cumulativeDistance;
          
          // Calculate ETA if we have speed
          if (vehicleSpeed && vehicleSpeed > 0) {
            // Speed is in m/s, distance is in meters
            const travelTimeSeconds = cumulativeDistance / vehicleSpeed;
            // Add buffer for stops (30 seconds per stop)
            const stopBuffer = index * 30;
            estimatedArrival = Math.floor(Date.now() / 1000) + travelTimeSeconds + stopBuffer;
          }
        }
      }
      
      return {
        stopId: stu.stopId || '',
        stopName: stop?.stop_name || stu.stopId || `Στάση ${index + 1}`,
        stopLat,
        stopLon,
        arrivalTime: stu.arrivalTime,
        departureTime: stu.departureTime,
        stopSequence: stu.stopSequence || index,
        isPassed,
        isCurrent,
        estimatedArrival,
        distanceFromVehicle,
      };
    }) || [];

    return {
      tripId: trip.tripId || trip.id,
      routeId: trip.routeId,
      routeShortName: routeInfo?.route_short_name,
      routeLongName: routeInfo?.route_long_name,
      routeColor: routeInfo?.route_color,
      vehicleLabel: vehicle?.label || trip.vehicleLabel,
      vehicleId: selectedVehicleTrip.vehicleId,
      stops: tripStops,
      vehicle,
      vehicleSpeed,
    };
  }, [selectedVehicleTrip, trips, vehicles, routeNamesMap, stopMap]);

  // Auto-scroll to current stop when it changes
  useEffect(() => {
    if (selectedVehicleTripInfo) {
      const currentStop = selectedVehicleTripInfo.stops.find(s => s.isCurrent);
      if (currentStop && currentStop.stopId !== lastCurrentStopId) {
        setLastCurrentStopId(currentStop.stopId);
        // Scroll to current stop with animation
        setTimeout(() => {
          currentStopRef.current?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
        }, 100);
      }
    }
  }, [selectedVehicleTripInfo, lastCurrentStopId]);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Trigger vibration
  const triggerVibration = useCallback(() => {
    if ('vibrate' in navigator) {
      // Vibrate pattern: vibrate 200ms, pause 100ms, vibrate 200ms
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, []);

  // Send push notification
  const sendPushNotification = useCallback((stopName: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('🚌 Πλησιάζει η στάση σας!', {
        body: `Το λεωφορείο πλησιάζει στη στάση: ${stopName}`,
        icon: '/favicon.ico',
        tag: 'bus-approaching',
        requireInteraction: true,
      });
      
      // Auto close after 10 seconds
      setTimeout(() => notification.close(), 10000);
      
      // Focus window when notification is clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, []);

  // Play notification sound based on selected type
  const playNotificationSound = useCallback((soundType?: string) => {
    const sound = soundType || notificationSound;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      switch (sound) {
        case 'chime':
          // Pleasant chime - ascending tones
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
          break;
          
        case 'alert':
          // Urgent alert - rapid beeps
          oscillator.type = 'square';
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.25);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime + 0.3);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
          break;
          
        case 'bell':
          // Bell sound - single deep tone with decay
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
          oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.8);
          gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.8);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.8);
          break;
          
        case 'soft':
          // Soft notification - gentle wave
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.15); // E5
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.3); // G5
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.2);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.6);
          break;
          
        default:
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
      }
      
      setTimeout(() => {
        audioContext.close();
      }, 1000);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
  }, [notificationSound]);

  // Speak announcement using Text-to-Speech
  const speakAnnouncement = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'el-GR'; // Greek language
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Try to find a Greek voice
      const voices = window.speechSynthesis.getVoices();
      const greekVoice = voices.find(v => v.lang.startsWith('el'));
      if (greekVoice) {
        utterance.voice = greekVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Full notification with sound, vibration, push and voice
  const triggerFullNotification = useCallback((stopName: string, routeShortName?: string, routeLongName?: string) => {
    playNotificationSound();
    triggerVibration();
    
    // Build announcement with route info for accessibility
    const routeInfo = routeShortName 
      ? `Γραμμή ${routeShortName}${routeLongName ? `, ${routeLongName}` : ''}`
      : 'Το λεωφορείο';
    
    sendPushNotification(stopName);
    // Voice announcement with route info for blind passengers
    speakAnnouncement(`Προσοχή! ${routeInfo} πλησιάζει στη στάση ${stopName}`);
  }, [playNotificationSound, triggerVibration, sendPushNotification, speakAnnouncement]);

  // Check if bus is approaching watched stop
  useEffect(() => {
    if (!watchedStopId || !selectedVehicleTripInfo) return;
    
    const watchedStop = selectedVehicleTripInfo.stops.find(s => s.stopId === watchedStopId);
    if (!watchedStop || watchedStop.isPassed) {
      // Stop was passed, clear watch
      if (watchedStop?.isPassed) {
        setWatchedStopId(null);
        setNotifiedStops(new Set());
      }
      return;
    }
    
    // Check if bus is within notification distance
    if (watchedStop.distanceFromVehicle !== undefined && 
        watchedStop.distanceFromVehicle <= notificationDistance &&
        !notifiedStops.has(watchedStopId)) {
      // Bus is approaching! Trigger full notification with route info
      triggerFullNotification(
        watchedStop.stopName,
        selectedVehicleTripInfo.routeShortName,
        selectedVehicleTripInfo.routeLongName
      );
      setNotifiedStops(prev => new Set([...prev, watchedStopId]));
    }
  }, [selectedVehicleTripInfo, watchedStopId, notifiedStops, triggerFullNotification, notificationDistance]);

  // Clear watched stop when vehicle trip changes
  useEffect(() => {
    if (!selectedVehicleTrip) {
      setWatchedStopId(null);
      setNotifiedStops(new Set());
    }
  }, [selectedVehicleTrip]);

  // Find nearest stops to a location
  const findNearestStops = useCallback((lat: number, lng: number, maxDistance = 1000, limit = 5): Array<{ stop: StaticStop; distance: number }> => {
    const nearbyStops: Array<{ stop: StaticStop; distance: number }> = [];
    
    stops.forEach(stop => {
      if (stop.stop_lat === undefined || stop.stop_lon === undefined) return;
      const distance = calculateDistance(lat, lng, stop.stop_lat, stop.stop_lon);
      if (distance <= maxDistance) {
        nearbyStops.push({ stop, distance });
      }
    });
    
    nearbyStops.sort((a, b) => a.distance - b.distance);
    return nearbyStops.slice(0, limit);
  }, [stops]);

  // Get trips passing through a stop
  const getTripsForStop = useCallback((stopId: string) => {
    return trips.filter(trip => 
      trip.stopTimeUpdates?.some(stu => stu.stopId === stopId)
    );
  }, [trips]);

  // Find routes between two stops
  const findRoutesBetweenStops = useCallback((originStopId: string, destStopId: string) => {
    const routes: Array<{
      trip: Trip;
      originStopUpdate: NonNullable<Trip['stopTimeUpdates']>[0];
      destStopUpdate: NonNullable<Trip['stopTimeUpdates']>[0];
      intermediateStops: Array<{ stopId: string; stopName: string; arrivalTime?: number }>;
    }> = [];

    trips.forEach(trip => {
      if (!trip.stopTimeUpdates?.length) return;

      const originIdx = trip.stopTimeUpdates.findIndex(stu => stu.stopId === originStopId);
      const destIdx = trip.stopTimeUpdates.findIndex(stu => stu.stopId === destStopId);

      // Check if both stops are on this trip and destination comes after origin
      if (originIdx !== -1 && destIdx !== -1 && destIdx > originIdx) {
        const intermediateStops = trip.stopTimeUpdates
          .slice(originIdx + 1, destIdx)
          .map(stu => ({
            stopId: stu.stopId || '',
            stopName: stopMap.get(stu.stopId || '')?.stop_name || stu.stopId || '',
            arrivalTime: stu.arrivalTime,
          }));

        routes.push({
          trip,
          originStopUpdate: trip.stopTimeUpdates[originIdx],
          destStopUpdate: trip.stopTimeUpdates[destIdx],
          intermediateStops,
        });
      }
    });

    // Sort by departure time
    routes.sort((a, b) => (a.originStopUpdate.departureTime || a.originStopUpdate.arrivalTime || 0) - 
                          (b.originStopUpdate.departureTime || b.originStopUpdate.arrivalTime || 0));

    return routes;
  }, [trips, stopMap]);

  // Calculate route
  const calculateRoute = useCallback(async () => {
    if (!origin || !destination) return;

    setIsCalculating(true);
    setPlannedRoute(null);

    try {
      // Find nearest stops to origin and destination
      const originStops = findNearestStops(origin.lat, origin.lng, 2000, 3);
      const destStops = findNearestStops(destination.lat, destination.lng, 2000, 3);

      if (originStops.length === 0 || destStops.length === 0) {
        // No nearby stops found
        setPlannedRoute(null);
        setIsCalculating(false);
        return;
      }

      // Find the best route considering walking distance and transit time
      let bestRoute: PlannedRoute | null = null;

      for (const originStop of originStops) {
        for (const destStop of destStops) {
          // Find direct routes between these stops
          const directRoutes = findRoutesBetweenStops(originStop.stop.stop_id, destStop.stop.stop_id);

          if (directRoutes.length > 0) {
            const route = directRoutes[0]; // Take the next available
            const routeInfo = route.trip.routeId && routeNamesMap 
              ? routeNamesMap.get(route.trip.routeId) 
              : null;

            const walkToStop = originStop.distance;
            const walkFromStop = destStop.distance;
            const walkToStopTime = walkToStop / WALKING_SPEED;
            const walkFromStopTime = walkFromStop / WALKING_SPEED;

            const departureTime = route.originStopUpdate.departureTime || route.originStopUpdate.arrivalTime;
            const arrivalTime = route.destStopUpdate.arrivalTime;
            const transitTime = departureTime && arrivalTime 
              ? (arrivalTime - departureTime) / 60 
              : 15; // Default 15 min if no time info

            const totalDuration = walkToStopTime + transitTime + walkFromStopTime;
            const totalWalkingDistance = walkToStop + walkFromStop;

            const steps: RouteStep[] = [];

            // Walking to origin stop
            if (walkToStop > 50) {
              steps.push({
                type: 'walk',
                from: { name: origin.name, lat: origin.lat, lng: origin.lng },
                to: { 
                  name: originStop.stop.stop_name || originStop.stop.stop_id, 
                  lat: originStop.stop.stop_lat!, 
                  lng: originStop.stop.stop_lon!,
                  stopId: originStop.stop.stop_id 
                },
                distance: walkToStop,
                duration: walkToStopTime,
              });
            }

            // Bus trip
            steps.push({
              type: 'bus',
              from: { 
                name: originStop.stop.stop_name || originStop.stop.stop_id, 
                lat: originStop.stop.stop_lat!, 
                lng: originStop.stop.stop_lon!,
                stopId: originStop.stop.stop_id 
              },
              to: { 
                name: destStop.stop.stop_name || destStop.stop.stop_id, 
                lat: destStop.stop.stop_lat!, 
                lng: destStop.stop.stop_lon!,
                stopId: destStop.stop.stop_id 
              },
              routeId: route.trip.routeId,
              routeShortName: routeInfo?.route_short_name,
              routeLongName: routeInfo?.route_long_name,
              routeColor: routeInfo?.route_color,
              departureTime: departureTime,
              arrivalTime: arrivalTime,
              duration: transitTime,
              intermediateStops: route.intermediateStops,
            });

            // Walking from destination stop
            if (walkFromStop > 50) {
              steps.push({
                type: 'walk',
                from: { 
                  name: destStop.stop.stop_name || destStop.stop.stop_id, 
                  lat: destStop.stop.stop_lat!, 
                  lng: destStop.stop.stop_lon!,
                  stopId: destStop.stop.stop_id 
                },
                to: { name: destination.name, lat: destination.lat, lng: destination.lng },
                distance: walkFromStop,
                duration: walkFromStopTime,
              });
            }

            const candidateRoute: PlannedRoute = {
              steps,
              totalDuration,
              totalWalkingDistance,
              departureTime,
              arrivalTime,
            };

            if (!bestRoute || totalDuration < bestRoute.totalDuration) {
              bestRoute = candidateRoute;
            }
          }
        }
      }

      setPlannedRoute(bestRoute);
      if (bestRoute && onRouteSelect) {
        onRouteSelect(bestRoute);
      }
    } catch (error) {
      console.error('Route calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  }, [origin, destination, findNearestStops, findRoutesBetweenStops, routeNamesMap, onRouteSelect]);

  // Search for addresses
  const searchAddress = useCallback(async (query: string, type: 'origin' | 'destination') => {
    if (!query.trim()) {
      if (type === 'origin') setOriginResults([]);
      else setDestinationResults([]);
      return;
    }

    if (type === 'origin') setIsSearchingOrigin(true);
    else setIsSearchingDestination(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cy&limit=5`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await response.json();
      
      if (type === 'origin') {
        setOriginResults(data);
        setShowOriginResults(true);
      } else {
        setDestinationResults(data);
        setShowDestinationResults(true);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
    } finally {
      if (type === 'origin') setIsSearchingOrigin(false);
      else setIsSearchingDestination(false);
    }
  }, []);

  // Handle selecting a search result
  const selectSearchResult = useCallback((result: { display_name: string; lat: string; lon: string }, type: 'origin' | 'destination') => {
    const location: Location = {
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: result.display_name.split(',')[0],
      type: 'search',
    };

    if (type === 'origin') {
      setOrigin(location);
      setOriginQuery(location.name);
      setShowOriginResults(false);
    } else {
      setDestination(location);
      setDestinationQuery(location.name);
      setShowDestinationResults(false);
    }

    onLocationSelect?.(type, location);
  }, [onLocationSelect]);

  // Use current location as origin
  const useCurrentLocation = useCallback(() => {
    if (userLocation) {
      const location: Location = {
        lat: userLocation.lat,
        lng: userLocation.lng,
        name: 'Η τοποθεσία μου',
        type: 'user',
      };
      setOrigin(location);
      setOriginQuery('Η τοποθεσία μου');
      onLocationSelect?.('origin', location);
    }
  }, [userLocation, onLocationSelect]);

  // Swap origin and destination
  const swapLocations = useCallback(() => {
    const tempOrigin = origin;
    const tempOriginQuery = originQuery;
    setOrigin(destination);
    setOriginQuery(destinationQuery);
    setDestination(tempOrigin);
    setDestinationQuery(tempOriginQuery);
    setPlannedRoute(null);
  }, [origin, destination, originQuery, destinationQuery]);

  // Auto-calculate when both locations are set
  useEffect(() => {
    if (origin && destination) {
      calculateRoute();
    }
  }, [origin, destination]);

  if (!isOpen) return null;

  return (
    <div className="absolute top-0 left-0 bottom-0 w-[380px] glass-card z-[1001] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Navigation className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Σχεδιασμός Διαδρομής</h2>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Selecting on map indicator */}
      {selectingOnMap && (
        <div className="p-3 bg-primary/10 border-b border-border flex items-center gap-2 animate-pulse">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm">Πατήστε στον χάρτη για να επιλέξετε {selectingOnMap === 'origin' ? 'αφετηρία' : 'προορισμό'}</span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => setSelectingOnMap(null)}>
            Ακύρωση
          </Button>
        </div>
      )}

      {/* Selected Vehicle Trip Route Display */}
      {selectedVehicleTripInfo && (
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Vehicle Route Header */}
          <div className="p-3 border-b border-border bg-primary/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: selectedVehicleTripInfo.routeColor ? `#${selectedVehicleTripInfo.routeColor}` : 'hsl(var(--primary))' }}
                >
                  <Bus className="h-2.5 w-2.5 text-white" />
                </div>
                <div>
                  <span className="font-semibold" style={{ color: selectedVehicleTripInfo.routeColor ? `#${selectedVehicleTripInfo.routeColor}` : undefined }}>
                    {selectedVehicleTripInfo.routeShortName || 'Γραμμή'}
                  </span>
                  {selectedVehicleTripInfo.vehicleLabel && (
                    <span className="text-xs text-muted-foreground ml-2">({selectedVehicleTripInfo.vehicleLabel})</span>
                  )}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={onClearVehicleTrip}
              >
                <X className="h-3 w-3 mr-1" />
                Κλείσιμο
              </Button>
            </div>
            {selectedVehicleTripInfo.routeLongName && (
              <p className="text-xs text-muted-foreground">{selectedVehicleTripInfo.routeLongName}</p>
            )}
            {/* Current speed indicator */}
            {selectedVehicleTripInfo.vehicleSpeed !== undefined && (
              <div className="flex items-center gap-2 mt-1.5 text-xs">
                <div className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  <Navigation className="h-3 w-3" />
                  <span className="font-medium">
                    {(selectedVehicleTripInfo.vehicleSpeed * 3.6).toFixed(0)} km/h
                  </span>
                </div>
                {selectedVehicleTripInfo.vehicleSpeed < 1 && (
                  <span className="text-muted-foreground">(Σταματημένο)</span>
                )}
              </div>
            )}
            
            {/* Notification settings and indicator */}
            <div className="mt-2 space-y-2">
              {/* Settings toggle */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowNotificationSettings(!showNotificationSettings)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Ρυθμίσεις ειδοποίησης</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showNotificationSettings ? 'rotate-180' : ''}`} />
                </button>
                <span className="text-xs text-muted-foreground">
                  Απόσταση: {notificationDistance >= 1000 ? `${notificationDistance / 1000}χλμ` : `${notificationDistance}μ`}
                </span>
              </div>
              
              {/* Settings panel */}
              {showNotificationSettings && (
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50 space-y-3">
                  {/* Distance options */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Απόσταση ειδοποίησης:</p>
                    <div className="flex flex-wrap gap-2">
                      {distanceOptions.map((distance) => (
                        <button
                          key={distance}
                          onClick={() => setNotificationDistance(distance)}
                          className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                            notificationDistance === distance
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80 text-foreground'
                          }`}
                        >
                          {distance >= 1000 ? `${distance / 1000}χλμ` : `${distance}μ`}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Sound options */}
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Ήχος ειδοποίησης:</p>
                    <div className="flex flex-wrap gap-2">
                      {soundOptions.map((sound) => (
                        <button
                          key={sound.id}
                          onClick={() => {
                            setNotificationSound(sound.id);
                            playNotificationSound(sound.id);
                          }}
                          className={`px-3 py-1.5 text-xs rounded-full transition-colors flex items-center gap-1.5 ${
                            notificationSound === sound.id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted hover:bg-muted/80 text-foreground'
                          }`}
                        >
                          <span>{sound.icon}</span>
                          <span>{sound.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Notification active indicator */}
              {watchedStopId && (
                <div className="flex items-center gap-2 p-2 bg-accent/10 border border-accent/30 rounded-lg text-xs">
                  <Volume2 className="h-4 w-4 text-accent animate-pulse" />
                  <div className="flex-1">
                    <span className="text-accent font-medium">Ειδοποίηση ενεργή</span>
                    <p className="text-muted-foreground">
                      {selectedVehicleTripInfo.stops.find(s => s.stopId === watchedStopId)?.stopName}
                    </p>
                  </div>
                  <button
                    onClick={() => setWatchedStopId(null)}
                    className="p-1 hover:bg-accent/20 rounded"
                    title="Απενεργοποίηση"
                  >
                    <BellOff className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Stops List */}
          <div ref={stopsListRef} className="flex-1 overflow-y-auto p-2">
            <div className="space-y-1">
              {selectedVehicleTripInfo.stops.map((stop, index) => (
                <button 
                  key={`${stop.stopId}-${index}`}
                  ref={stop.isCurrent ? currentStopRef : null}
                  onClick={() => {
                    if (stop.stopLat !== undefined && stop.stopLon !== undefined) {
                      onTripStopClick?.(stop.stopId, stop.stopLat, stop.stopLon);
                    }
                  }}
                  disabled={stop.stopLat === undefined || stop.stopLon === undefined}
                  className={`w-full text-left flex items-start gap-3 p-2 rounded-lg transition-all duration-300 cursor-pointer ${
                    stop.isCurrent 
                      ? 'bg-primary/20 border border-primary/30 shadow-md animate-pulse-subtle' 
                      : stop.isPassed 
                        ? 'opacity-50 hover:opacity-70' 
                        : 'hover:bg-muted/50'
                  } ${stop.stopLat === undefined ? 'cursor-not-allowed' : ''}`}
                >
                  {/* Timeline indicator */}
                  <div className="flex flex-col items-center pt-1">
                    <div 
                      className={`w-3 h-3 rounded-full border-2 ${
                        stop.isCurrent 
                          ? 'bg-primary border-primary animate-pulse' 
                          : stop.isPassed 
                            ? 'bg-muted-foreground/50 border-muted-foreground/50' 
                            : 'bg-background border-primary'
                      }`}
                      style={{ 
                        borderColor: !stop.isPassed && !stop.isCurrent && selectedVehicleTripInfo.routeColor 
                          ? `#${selectedVehicleTripInfo.routeColor}` 
                          : undefined 
                      }}
                    />
                    {index < selectedVehicleTripInfo.stops.length - 1 && (
                      <div 
                        className={`w-0.5 h-6 mt-1 ${stop.isPassed ? 'bg-muted-foreground/30' : 'bg-primary/30'}`}
                        style={{ 
                          background: !stop.isPassed && selectedVehicleTripInfo.routeColor 
                            ? `#${selectedVehicleTripInfo.routeColor}40` 
                            : undefined 
                        }}
                      />
                    )}
                  </div>

                  {/* Stop info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${stop.isCurrent ? 'font-semibold text-primary' : ''}`}>
                        {stop.stopName}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Notification bell for upcoming stops */}
                        {!stop.isPassed && !stop.isCurrent && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (watchedStopId === stop.stopId) {
                                setWatchedStopId(null);
                              } else {
                                // Request notification permission when enabling watch
                                await requestNotificationPermission();
                                setWatchedStopId(stop.stopId);
                                setNotifiedStops(new Set());
                              }
                            }}
                            className={`p-1 rounded-full transition-colors ${
                              watchedStopId === stop.stopId 
                                ? 'bg-primary text-primary-foreground' 
                                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                            title={watchedStopId === stop.stopId ? 'Απενεργοποίηση ειδοποίησης' : 'Ειδοποίηση όταν πλησιάζει'}
                          >
                            {watchedStopId === stop.stopId ? (
                              <Volume2 className="h-3.5 w-3.5" />
                            ) : (
                              <Bell className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                        {stop.isCurrent && (
                          <span className="text-[10px] font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                            ΤΩΡΑ
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* ETA based on vehicle speed */}
                    {!stop.isPassed && !stop.isCurrent && stop.estimatedArrival && selectedVehicleTripInfo.vehicleSpeed && selectedVehicleTripInfo.vehicleSpeed > 0 && (
                      <div className="flex items-center gap-2 text-xs mt-0.5">
                        <div className="flex items-center gap-1 text-primary font-medium">
                          <Navigation className="h-3 w-3" />
                          <span>~{formatTime(stop.estimatedArrival)}</span>
                        </div>
                        {stop.distanceFromVehicle && (
                          <span className="text-muted-foreground">
                            ({stop.distanceFromVehicle < 1000 
                              ? `${Math.round(stop.distanceFromVehicle)}μ` 
                              : `${(stop.distanceFromVehicle / 1000).toFixed(1)}χλμ`})
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Scheduled time */}
                    {(stop.arrivalTime || stop.departureTime) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        <span>
                          Πρόγραμμα: {stop.arrivalTime && formatTime(stop.arrivalTime)}
                          {stop.departureTime && stop.departureTime !== stop.arrivalTime && (
                            <span className="text-muted-foreground/70"> → {formatTime(stop.departureTime)}</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Location inputs - hidden when showing vehicle trip */}
      {!selectedVehicleTripInfo && (
      <div className="p-3 space-y-3 border-b border-border">
        {/* Origin input */}
        <div className="relative">
          <div className="flex items-center gap-2 glass-card rounded-lg p-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Από πού ξεκινάς;"
                value={originQuery}
                onChange={(e) => {
                  setOriginQuery(e.target.value);
                  setShowOriginStops(true);
                  setShowOriginResults(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && searchAddress(originQuery, 'origin')}
                onFocus={() => setShowOriginStops(true)}
                className="border-0 bg-transparent h-8 focus-visible:ring-0 p-0"
              />
            </div>
            {isSearchingOrigin ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex gap-1">
                {userLocation && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={useCurrentLocation} title="Χρήση τρέχουσας τοποθεσίας">
                    <LocateFixed className="h-3.5 w-3.5 text-blue-500" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => requestMapClick('origin')} title="Επιλογή από χάρτη">
                  <MousePointer2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => searchAddress(originQuery, 'origin')} title="Αναζήτηση διεύθυνσης">
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Origin dropdown - shows stops and search results */}
          {(showOriginStops || showOriginResults) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg max-h-64 overflow-y-auto z-20 shadow-xl">
              {/* Geocoding results */}
              {showOriginResults && originResults.length > 0 && (
                <div className="border-b border-border">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">Διευθύνσεις</div>
                  {originResults.map((result, idx) => (
                    <button
                      key={`addr-${idx}`}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-start gap-2"
                      onClick={() => {
                        selectSearchResult(result, 'origin');
                        setShowOriginStops(false);
                      }}
                    >
                      <MapPin className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Bus stops */}
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">Στάσεις λεωφορείων</div>
              {filteredOriginStops.map((stop) => (
                <button
                  key={stop.stop_id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-start gap-2"
                  onClick={() => selectStop(stop, 'origin')}
                >
                  <Bus className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">{stop.stop_name || stop.stop_id}</div>
                    {stop.stop_code && <div className="text-xs text-muted-foreground">Κωδ: {stop.stop_code}</div>}
                  </div>
                </button>
              ))}
              {filteredOriginStops.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Δεν βρέθηκαν στάσεις</div>
              )}
            </div>
          )}
        </div>

        {/* Swap button */}
        <div className="flex justify-center">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={swapLocations} title="Εναλλαγή">
            <div className="flex flex-col items-center">
              <ChevronUp className="h-3 w-3" />
              <ChevronDown className="h-3 w-3 -mt-1" />
            </div>
          </Button>
        </div>

        {/* Destination input */}
        <div className="relative">
          <div className="flex items-center gap-2 glass-card rounded-lg p-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Πού θέλεις να πας;"
                value={destinationQuery}
                onChange={(e) => {
                  setDestinationQuery(e.target.value);
                  setShowDestinationStops(true);
                  setShowDestinationResults(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && searchAddress(destinationQuery, 'destination')}
                onFocus={() => setShowDestinationStops(true)}
                className="border-0 bg-transparent h-8 focus-visible:ring-0 p-0"
              />
            </div>
            {isSearchingDestination ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => requestMapClick('destination')} title="Επιλογή από χάρτη">
                  <MousePointer2 className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => searchAddress(destinationQuery, 'destination')} title="Αναζήτηση διεύθυνσης">
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Destination dropdown - shows stops and search results */}
          {(showDestinationStops || showDestinationResults) && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg max-h-64 overflow-y-auto z-20 shadow-xl">
              {/* Geocoding results */}
              {showDestinationResults && destinationResults.length > 0 && (
                <div className="border-b border-border">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">Διευθύνσεις</div>
                  {destinationResults.map((result, idx) => (
                    <button
                      key={`addr-${idx}`}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-start gap-2"
                      onClick={() => {
                        selectSearchResult(result, 'destination');
                        setShowDestinationStops(false);
                      }}
                    >
                      <MapPin className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{result.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* Bus stops */}
              <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50">Στάσεις λεωφορείων</div>
              {filteredDestinationStops.map((stop) => (
                <button
                  key={stop.stop_id}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors flex items-start gap-2"
                  onClick={() => selectStop(stop, 'destination')}
                >
                  <Bus className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium">{stop.stop_name || stop.stop_id}</div>
                    {stop.stop_code && <div className="text-xs text-muted-foreground">Κωδ: {stop.stop_code}</div>}
                  </div>
                </button>
              ))}
              {filteredDestinationStops.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Δεν βρέθηκαν στάσεις</div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* Route results - hidden when showing vehicle trip */}
      {!selectedVehicleTripInfo && (
      <div className="flex-1 overflow-y-auto">
        {isCalculating && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span className="text-muted-foreground">Υπολογισμός διαδρομής...</span>
          </div>
        )}

        {!isCalculating && !plannedRoute && origin && destination && (
          <div className="p-6 text-center text-muted-foreground">
            <Bus className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Δεν βρέθηκε διαθέσιμη διαδρομή</p>
            <p className="text-xs mt-2">Δοκιμάστε διαφορετικό προορισμό ή ελέγξτε αν υπάρχουν διαθέσιμα δρομολόγια</p>
          </div>
        )}

        {!isCalculating && !origin && !destination && (
          <div className="p-6 text-center text-muted-foreground">
            <MapPin className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Επιλέξτε αφετηρία και προορισμό</p>
            <p className="text-xs mt-2">Χρησιμοποιήστε την αναζήτηση ή πατήστε στον χάρτη</p>
          </div>
        )}

        {plannedRoute && (
          <div className="divide-y divide-border">
            {/* Summary */}
            <div className="p-4 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="font-semibold">{formatDuration(plannedRoute.totalDuration)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Footprints className="h-4 w-4" />
                  <span>{formatDistance(plannedRoute.totalWalkingDistance)}</span>
                </div>
              </div>
              {plannedRoute.departureTime && plannedRoute.arrivalTime && (
                <div className="text-sm text-muted-foreground">
                  {formatTime(plannedRoute.departureTime)} → {formatTime(plannedRoute.arrivalTime)}
                </div>
              )}
            </div>

            {/* Steps */}
            {plannedRoute.steps.map((step, idx) => (
              <div key={idx} className="p-3">
                {step.type === 'walk' ? (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <Footprints className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {idx < plannedRoute.steps.length - 1 && (
                        <div className="w-0.5 h-8 bg-muted-foreground/30 my-1" style={{ borderStyle: 'dashed', borderWidth: '0 0 0 2px' }} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">Περπάτημα</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatDistance(step.distance || 0)} • {Math.round(step.duration || 0)} λεπτά
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Προς <span className="font-medium text-foreground">{step.to.name}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ backgroundColor: step.routeColor ? `#${step.routeColor}` : '#0ea5e9' }}
                      >
                        {step.routeShortName || <Bus className="h-4 w-4" />}
                      </div>
                      {idx < plannedRoute.steps.length - 1 && (
                        <div 
                          className="w-0.5 h-8 my-1" 
                          style={{ backgroundColor: step.routeColor ? `#${step.routeColor}` : '#0ea5e9' }} 
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span 
                          className="font-bold px-2 py-0.5 rounded text-white text-xs"
                          style={{ backgroundColor: step.routeColor ? `#${step.routeColor}` : '#0ea5e9' }}
                        >
                          {step.routeShortName || step.routeId}
                        </span>
                        {step.routeLongName && (
                          <span className="text-xs text-muted-foreground truncate">{step.routeLongName}</span>
                        )}
                      </div>
                      
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                          <span className="font-medium">{step.from.name}</span>
                          {step.departureTime && (
                            <span className="text-xs font-mono text-primary">{formatTime(step.departureTime)}</span>
                          )}
                        </div>
                        
                        {/* Intermediate stops - collapsible */}
                        {step.intermediateStops && step.intermediateStops.length > 0 && (
                          <div className="ml-1">
                            <button 
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setExpandedStep(expandedStep === idx ? null : idx)}
                            >
                              {expandedStep === idx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {step.intermediateStops.length} στάσεις
                            </button>
                            {expandedStep === idx && (
                              <div className="mt-1 ml-2 space-y-1 border-l-2 border-dashed border-muted-foreground/30 pl-3">
                                {step.intermediateStops.map((stop, stopIdx) => (
                                  <div key={stopIdx} className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span>{stop.stopName}</span>
                                    {stop.arrivalTime && (
                                      <span className="font-mono">{formatTime(stop.arrivalTime)}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="font-medium">{step.to.name}</span>
                          {step.arrivalTime && (
                            <span className="text-xs font-mono text-primary">{formatTime(step.arrivalTime)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* Footer with calculate button - hidden when showing vehicle trip */}
      {!selectedVehicleTripInfo && origin && destination && !isCalculating && (
        <div className="p-3 border-t border-border">
          <Button className="w-full" onClick={calculateRoute} disabled={isCalculating}>
            <Navigation className="h-4 w-4 mr-2" />
            Υπολογισμός Διαδρομής
          </Button>
        </div>
      )}
    </div>
  );
}
