import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  MapPin,
  Navigation,
  Bus,
  Bell,
  BellOff,
  ChevronRight,
  Loader2,
  Volume2,
  LocateFixed,
  X,
  AlertCircle,
  Settings,
  Minimize2,
  GripHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { ResizableDraggablePanel } from "@/components/common/ResizableDraggablePanel";
import { toast } from "@/hooks/use-toast";
// import { supabase } from "@/integrations/supabase/client";
import type { StaticStop, Trip, Vehicle, RouteInfo } from "@/types/gtfs";
import { useNearbyArrivals, type StopArrival } from "@/hooks/useNearbyArrivals";
import { useStopNotifications } from "@/hooks/useStopNotifications";
import { useStopArrivalsQuery, type MergedArrival } from "@/hooks/useGtfsData";

// Detect iOS
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Check if running as installed PWA
const isStandalonePWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true;
};

interface NearbyStopsPanelProps {
  stops: StaticStop[];
  trips: Trip[];
  vehicles: Vehicle[];
  routeNamesMap: Map<string, RouteInfo>;
  onSelectVehicle?: (vehicleId: string, tripId: string, routeId?: string) => void;
  onStopSelect?: (stop: StaticStop) => void;
  onHighlightStop?: (stop: StaticStop | null) => void;
}

const formatDistance = (meters: number) => {
  if (meters < 1000) return `${Math.round(meters)} μ.`;
  return `${(meters / 1000).toFixed(1)} χλμ`;
};

const formatArrivalTime = (minutes?: number) => {
  if (minutes === undefined) return "—";
  if (minutes === 0) return "Τώρα";
  if (minutes === 1) return "1 λεπτό";
  if (minutes < 60) return `${minutes} λεπτά`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}ω ${mins} λ`;
};

export function NearbyStopsPanel({
  stops,
  trips,
  vehicles,
  routeNamesMap,
  onSelectVehicle,
  onStopSelect,
  onHighlightStop,
}: NearbyStopsPanelProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<StaticStop | null>(null);
  // REMOVED local legacy states (watchedArrivals, notifiedArrivals)

  const [notificationDistance, setNotificationDistance] = useState(() => {
    const saved = localStorage.getItem('nearbyNotificationDistance');
    return saved ? parseInt(saved, 10) : 500;
  });

  // Use shared notification settings hook
  const {
    setNotification,
    getNotification,
  } = useStopNotifications();

  // Local settings for the panel UI (merged into stop settings when saving)
  const [panelSettings, setPanelSettings] = useState(() => {
    const saved = localStorage.getItem('nearbyNotificationSettings');
    return saved ? JSON.parse(saved) : {
      sound: true,
      vibration: true,
      voice: true,
      push: true,
    };
  });

  const [showSettings, setShowSettings] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Fixed stop mode vs auto-track
  const [trackingMode, setTrackingMode] = useState<'auto' | 'fixed'>('fixed');
  const [fixedStop, setFixedStop] = useState<{ stopId: string; stopName: string } | null>(null);

  const [isMinimized, setIsMinimized] = useState(false);
  const [mobileHeight, setMobileHeight] = useState(70); // percentage of viewport height
  const [mobilePosition, setMobilePosition] = useState({ x: 0, y: 0 }); // for free dragging
  const [isDraggingMobile, setIsDraggingMobile] = useState(false);
  const [mobileDragMode, setMobileDragMode] = useState<'resize' | 'move'>('resize');
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragStartHeightRef = useRef<number>(70);
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const watchIdRef = useRef<number | null>(null);

  // Get nearby stops with arrivals
  const nearbyStops = useNearbyArrivals(
    userLocation,
    stops,
    trips,
    vehicles,
    routeNamesMap,
    1000, // 1km radius
    10 // max 10 stops
  );

  // Get arrivals for selected stop
  // Get arrivals for selected stop (SERVER-SIDE)
  const { data: serverArrivals } = useStopArrivalsQuery(selectedStop?.stop_id || null);

  const selectedStopArrivals: StopArrival[] = useMemo(() => {
    if (!serverArrivals) return [];

    const now = Math.floor(Date.now() / 1000);

    return serverArrivals.map((arrival: MergedArrival) => {
      const routeInfo = routeNamesMap.get(arrival.routeId);
      const estimatedMinutes = Math.max(0, Math.round((arrival.bestArrivalTime - now) / 60));

      return {
        tripId: arrival.tripId || `siri-${arrival.routeId}-${arrival.bestArrivalTime}`,
        routeId: arrival.routeId,
        routeShortName: routeInfo?.route_short_name || arrival.routeId,
        routeLongName: routeInfo?.route_long_name,
        routeColor: routeInfo?.route_color,
        vehicleId: arrival.vehicleId,
        vehicleLabel: arrival.vehicleId,
        arrivalTime: arrival.bestArrivalTime,
        estimatedMinutes,
        source: arrival.source,
        confidence: arrival.confidence,
      };
    });
  }, [serverArrivals, routeNamesMap]);

  // Get nearest stop for highlighting
  const nearestStop = nearbyStops.length > 0 ? nearbyStops[0].stop : null;

  // Get active stop based on mode
  // MODIFIED: Only use fixedStop (manual selection). Ignore nearestStop for auto-selection.
  const activeStop = fixedStop
    ? { stop_id: fixedStop.stopId, stop_name: fixedStop.stopName }
    : (selectedStop ? { stop_id: selectedStop.stop_id, stop_name: selectedStop.stop_name } : null);

  // Highlight nearest stop when panel opens
  useEffect(() => {
    if (isPanelOpen && nearestStop && onHighlightStop) {
      onHighlightStop(nearestStop);
    }
    return () => {
      // Don't clear highlight on unmount to prevent flickering if parent handles it
    };
  }, [isPanelOpen, nearestStop, onHighlightStop]);

  // Save notification distance
  useEffect(() => {
    localStorage.setItem('nearbyNotificationDistance', notificationDistance.toString());
  }, [notificationDistance]);

  // Save panel settings
  useEffect(() => {
    localStorage.setItem('nearbyNotificationSettings', JSON.stringify(panelSettings));
  }, [panelSettings]);

  // Save tracking mode and fixed stop
  useEffect(() => {
    localStorage.setItem('stopTrackingMode', trackingMode);
  }, [trackingMode]);

  // REMOVED: Saving fixedStop to localStorage (We want clean slate manual mode)

  // Function to set a stop as fixed
  const setAsFixedStop = useCallback((stop: { stop_id: string; stop_name: string }) => {
    setFixedStop({ stopId: stop.stop_id, stopName: stop.stop_name });
    setTrackingMode('fixed');
    toast({
      title: "📍 Σταθερή στάση ορίστηκε",
      description: stop.stop_name,
    });
  }, []);

  // Request notification permission if needed
  const ensurePermission = useCallback(async () => {
    if (!('Notification' in window)) return false;

    if (Notification.permission === 'granted') return true;

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // REMOVED: Auto-update notification settings when active stop changes.
  // This was causing the "System automatically chooses the closer bus stop" issue.
  // Notification updates are now MANUAL ONLY via user interaction.

  // Toggle notification setting
  const togglePanelSetting = useCallback((key: keyof typeof panelSettings) => {
    setPanelSettings((prev: any) => {
      const newState = { ...prev, [key]: !prev[key] };

      // If turning push ON, ensure permission
      if (key === 'push' && newState.push) {
        ensurePermission().then(granted => {
          if (!granted) {
            setPanelSettings((curr: any) => ({ ...curr, push: false }));
            toast({
              title: "⚠️ Απαιτείται άδεια",
              description: "Ενεργοποιήστε τις ειδοποιήσεις στις ρυθμίσεις του browser",
              variant: "destructive",
            });
          }
        });
      }

      return newState;
    });
  }, [ensurePermission]);

  // Get user location with retry logic
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Η τοποθεσία δεν υποστηρίζεται");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    // Try high accuracy first, then fallback to low accuracy
    const tryGetPosition = (highAccuracy: boolean, retryCount: number = 0) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsLocating(false);
          setLocationError(null);
        },
        (error) => {
          // If high accuracy failed and we haven't tried low accuracy yet
          if (highAccuracy && retryCount === 0) {
            console.log('High accuracy failed, trying low accuracy...');
            tryGetPosition(false, 1);
            return;
          }

          // If low accuracy also failed, retry once more with longer timeout
          if (!highAccuracy && retryCount === 1) {
            console.log('Low accuracy failed, final retry...');
            tryGetPosition(false, 2);
            return;
          }

          setIsLocating(false);
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setLocationError("Δεν επιτρέπεται η πρόσβαση στην τοποθεσία");
              break;
            case error.POSITION_UNAVAILABLE:
              setLocationError("Η τοποθεσία δεν είναι διαθέσιμη");
              break;
            case error.TIMEOUT:
              setLocationError("Η αναζήτηση τοποθεσίας έληξε. Πατήστε για επανάληψη.");
              break;
          }
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 15000 : 30000,
          maximumAge: 60000
        }
      );
    };

    tryGetPosition(true, 0);
  }, []);

  // Watch location continuously
  const watchLocation = useCallback(() => {
    if (!navigator.geolocation) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationError(null);
      },
      () => { }, // Ignore errors in watch mode
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Full notification trigger for in-app simple alerts (bell icon)
  // This logic is separate from the persistent stop subscriptions
  // REMOVED legacy triggerSimpleNotification and manual watch effect


  // Toggle watch for an specific arrival
  const toggleWatchArrival = useCallback((arrival: StopArrival) => {
    ensurePermission();

    if (!activeStop) return;

    const existing = getNotification(activeStop.stop_id);
    const currentWatched = existing?.watchedTrips || [];

    let newWatched: string[];
    const isWatched = currentWatched.includes(arrival.tripId);

    if (isWatched) {
      newWatched = currentWatched.filter(id => id !== arrival.tripId);
    } else {
      newWatched = [...currentWatched, arrival.tripId];
    }

    // Update global settings
    setNotification({
      stopId: activeStop.stop_id,
      stopName: activeStop.stop_name,
      enabled: true, // Ensure enabled when toggling
      sound: panelSettings.sound,
      vibration: panelSettings.vibration,
      voice: panelSettings.voice,
      push: panelSettings.push,
      beforeMinutes: Math.round(notificationDistance / 100),
      watchedTrips: newWatched,
    });

    toast({
      title: isWatched ? "Ειδοποίηση αφαιρέθηκε" : "Ειδοποίηση προστέθηκε",
      description: `Για το λεωφορείο: ${arrival.routeShortName || arrival.routeId}`,
    });
  }, [ensurePermission, activeStop, getNotification, setNotification, panelSettings, notificationDistance]);

  // Select stop and view arrivals
  const handleStopSelect = useCallback((stop: StaticStop) => {
    setSelectedStop(stop);
    onStopSelect?.(stop);

    // CRITICAL FIX: Highlight stop on map when selected from list
    if (onHighlightStop) {
      onHighlightStop(stop);
    }

    watchLocation();
  }, [onStopSelect, onHighlightStop, watchLocation]);

  // Track vehicle - close panel and follow vehicle
  const handleTrackVehicle = useCallback((arrival: StopArrival) => {
    if (arrival.vehicleId && onSelectVehicle) {
      // Close the panel first for unobstructed view
      setIsPanelOpen(false);
      setIsMinimized(false);
      setSelectedStop(null);
      if (onHighlightStop) {
        onHighlightStop(null);
      }
      // Then trigger vehicle tracking
      onSelectVehicle(arrival.vehicleId, arrival.tripId, arrival.routeId);
    }
  }, [onSelectVehicle, onHighlightStop]);

  // Handle panel open
  const handleOpenPanel = useCallback(() => {
    setIsPanelOpen(true);
    setIsMinimized(false);
    getLocation();
  }, [getLocation]);

  // Handle panel close
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedStop(null);
    setMobileHeight(70);
    if (onHighlightStop) {
      onHighlightStop(null);
    }
  }, [onHighlightStop]);

  // Mobile resize drag handlers (for bottom sheet height)
  const handleMobileResizeStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingMobile(true);
    setMobileDragMode('resize');
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: 0, y: clientY };
    dragStartHeightRef.current = mobileHeight;
  }, [mobileHeight]);

  // Mobile move drag handlers (for free positioning)
  const handleMobileMoveStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    // Don't start drag if clicking on buttons or interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('[data-no-drag]')) {
      return;
    }

    e.preventDefault();
    setIsDraggingMobile(true);
    setMobileDragMode('move');
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartRef.current = { x: clientX, y: clientY };
    dragStartPosRef.current = { x: mobilePosition.x, y: mobilePosition.y };
  }, [mobilePosition]);

  const handleMobileDragMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (!isDraggingMobile) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    if (mobileDragMode === 'resize') {
      const deltaY = dragStartRef.current.y - clientY;
      const deltaPercent = (deltaY / window.innerHeight) * 100;
      const newHeight = Math.max(30, Math.min(90, dragStartHeightRef.current + deltaPercent));
      setMobileHeight(newHeight);
    } else {
      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;
      const maxX = window.innerWidth - 320;
      const maxY = window.innerHeight - 200;
      const newX = Math.max(-20, Math.min(maxX, dragStartPosRef.current.x + deltaX));
      const newY = Math.max(60, Math.min(maxY, dragStartPosRef.current.y + deltaY));
      setMobilePosition({ x: newX, y: newY });
    }
  }, [isDraggingMobile, mobileDragMode]);

  const handleMobileDragEnd = useCallback((e?: TouchEvent | MouseEvent) => {
    setIsDraggingMobile(false);

    if (mobileDragMode === 'resize') {
      // Check for swipe down to close
      const endY = e && 'changedTouches' in e ? e.changedTouches[0].clientY : (e as MouseEvent)?.clientY || 0;
      const swipeDistance = endY - dragStartRef.current.y;
      const swipeVelocity = swipeDistance / 200; // rough velocity estimate

      // Close if swiped down fast or dragged below 20% height
      if (swipeDistance > 150 || mobileHeight < 20 || swipeVelocity > 1.5) {
        handleClosePanel();
        return;
      }

      // Snap to positions
      if (mobileHeight < 40) {
        setMobileHeight(30);
      } else if (mobileHeight > 75) {
        setMobileHeight(85);
      } else {
        setMobileHeight(60);
      }
    } else {
      // For floating mode, check if dragged to bottom to close
      if (mobilePosition.y > window.innerHeight - 100) {
        handleClosePanel();
      }
    }
  }, [mobileHeight, mobileDragMode, mobilePosition.y, handleClosePanel]);

  // Add/remove drag listeners for mobile
  useEffect(() => {
    if (isDraggingMobile) {
      document.addEventListener('mousemove', handleMobileDragMove);
      document.addEventListener('mouseup', handleMobileDragEnd);
      document.addEventListener('touchmove', handleMobileDragMove, { passive: false });
      document.addEventListener('touchend', handleMobileDragEnd);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMobileDragMove);
      document.removeEventListener('mouseup', handleMobileDragEnd);
      document.removeEventListener('touchmove', handleMobileDragMove);
      document.removeEventListener('touchend', handleMobileDragEnd);
      document.body.style.userSelect = '';
    };
  }, [isDraggingMobile, handleMobileDragMove, handleMobileDragEnd]);

  // Floating button (shown when panel is closed)
  if (!isPanelOpen) {
    return (
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-24 sm:bottom-20 right-4 z-40 h-12 w-12 sm:h-14 sm:w-14 rounded-full shadow-lg hover:scale-105 transition-transform"
        onClick={handleOpenPanel}
        title="Στάσεις Κοντά μου"
      >
        <MapPin className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-24 sm:bottom-20 right-4 z-40 md:hidden">
        <Button
          variant="default"
          size="lg"
          className="h-12 sm:h-14 px-3 sm:px-4 rounded-full shadow-lg flex items-center gap-2 hover:scale-105 transition-transform"
          onClick={() => setIsMinimized(false)}
        >
          <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-xs sm:text-sm max-w-[100px] sm:max-w-[120px] truncate">
            Στάσεις Κοντά μου
          </span>
        </Button>
      </div>
    );
  }

  // Panel content
  const panelContent = (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 border-b border-border"
        style={{ backgroundColor: '#6B8E23' }}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-white" />
          <span className="font-semibold text-sm text-white">Στάσεις Κοντά μου</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="h-7 w-7 text-white hover:bg-white/20"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={getLocation}
            disabled={isLocating}
            className="h-7 w-7 text-white hover:bg-white/20"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
          </Button>
          {/* Toggle floating mode - mobile only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (mobilePosition.x === 0 && mobilePosition.y === 0) {
                setMobilePosition({ x: 16, y: 100 });
              } else {
                setMobilePosition({ x: 0, y: 0 });
              }
            }}
            className="h-7 w-7 md:hidden text-white hover:bg-white/20"
            title={mobilePosition.x === 0 ? "Floating mode" : "Docked mode"}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobilePosition.x === 0 && mobilePosition.y === 0 ? (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M3 9h6" />
                </>
              ) : (
                <>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 15h18" />
                </>
              )}
            </svg>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMinimized(true)}
            className="h-7 w-7 text-white hover:bg-white/20"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClosePanel}
            className="h-7 w-7 text-white hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Simplified Settings */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleContent className="p-3 border-b border-border bg-muted/50">
          <div className="space-y-3">
            {/* Push notification toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className={`h-4 w-4 ${panelSettings.push ? 'text-green-500' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium">Push Ειδοποιήσεις</span>
              </div>
              <button
                className={`relative w-12 h-6 rounded-full transition-colors ${panelSettings.push ? 'bg-green-500' : 'bg-muted-foreground/30'}`}
                onClick={() => togglePanelSetting('push')}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${panelSettings.push ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {/* Extra notification types - shown when push is on */}
            {panelSettings.push && (
              <div className="flex gap-2">
                <button
                  className={`flex-1 h-9 text-xs flex items-center justify-center gap-1.5 rounded-md border transition-all ${panelSettings.sound
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                    }`}
                  onClick={() => togglePanelSetting('sound')}
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Ήχος
                </button>
                <button
                  className={`flex-1 h-9 text-xs flex items-center justify-center gap-1.5 rounded-md border transition-all ${panelSettings.vibration
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                    }`}
                  onClick={() => togglePanelSetting('vibration')}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <path d="M2 8v8M22 8v8" strokeLinecap="round" />
                  </svg>
                  Δόνηση
                </button>
                <button
                  className={`flex-1 h-9 text-xs flex items-center justify-center gap-1.5 rounded-md border transition-all ${panelSettings.voice
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                    }`}
                  onClick={() => togglePanelSetting('voice')}
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                  </svg>
                  Φωνή
                </button>
              </div>
            )}

            {/* Notification Mode Toggle (All vs Selected) */}
            {panelSettings.push && (
              <div className="flex items-center justify-between p-2 rounded-md bg-muted/40">
                <span className="text-xs font-medium">Ειδοποίηση για όλα τα λεωφορεία;</span>
                <button
                  className={`relative w-10 h-5 rounded-full transition-colors ${getNotification(activeStop?.stop_id || '')?.notifyType === 'all'
                    ? 'bg-blue-500'
                    : 'bg-muted-foreground/30'
                    }`}
                  onClick={() => {
                    const current = getNotification(activeStop?.stop_id || '');
                    if (current && activeStop) {
                      setNotification({
                        ...current,
                        notifyType: current.notifyType === 'all' ? 'selected' : 'all'
                      });
                      toast({
                        title: current.notifyType === 'all' ? "Λειτουργία: Επιλεγμένα" : "Λειτουργία: Όλα",
                        description: current.notifyType === 'all'
                          ? "Θα λαμβάνετε ειδοποιήσεις μόνο για τα λεωφορεία που επιλέγετε (καμπανάκι)."
                          : "Θα λαμβάνετε ειδοποιήσεις για ΟΛΑ τα λεωφορεία σε αυτή τη στάση."
                      });
                    }
                  }}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow transition-transform ${getNotification(activeStop?.stop_id || '')?.notifyType === 'all'
                    ? 'translate-x-6'
                    : 'translate-x-1'
                    }`} />
                </button>
              </div>
            )}

            {/* Distance settings */}
            {panelSettings.push && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Ειδοποίηση όταν το λεωφορείο είναι σε:</span>
                  <span className="text-sm font-bold text-primary">
                    {notificationDistance < 1000 ? `${notificationDistance} μ` : `${notificationDistance / 1000} χλμ`}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[200, 500, 1000, 2000].map(dist => (
                    <Button
                      key={dist}
                      variant={notificationDistance === dist ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setNotificationDistance(dist)}
                    >
                      {dist < 1000 ? `${dist} μ` : `${dist / 1000} χλμ`}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Tracking mode toggle REMOVED (Manual selection only) */}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {locationError && (
        <div className="flex items-center gap-2 text-destructive text-xs p-2 bg-destructive/10">
          <AlertCircle className="h-3 w-3" />
          {locationError}
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {/* Show selected stop arrivals */}
          {selectedStop ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">{selectedStop.stop_name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedStop.stop_id}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => {
                  setSelectedStop(null);
                  if (onHighlightStop) onHighlightStop(null);
                }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {selectedStopArrivals.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Bus className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Δεν υπάρχουν επερχόμενες αφίξεις</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStopArrivals.map((arrival) => {
                    // Check if watched using global state
                    const notif = getNotification(selectedStop.stop_id);
                    const isWatched = notif?.watchedTrips?.includes(arrival.tripId);

                    return (
                      <Card
                        key={arrival.tripId}
                        className={`${isWatched ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                      >
                        <CardContent className="p-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Badge
                                variant="secondary"
                                className="shrink-0 text-xs"
                                style={{
                                  backgroundColor: arrival.routeColor ? `#${arrival.routeColor}` : undefined,
                                  color: arrival.routeColor ? '#fff' : undefined,
                                }}
                              >
                                {arrival.routeShortName || arrival.routeId}
                              </Badge>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">
                                  {arrival.routeLongName || arrival.routeId}
                                </p>
                                {arrival.vehicleLabel && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Όχημα: {arrival.vehicleLabel}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className={`text-sm font-bold ${arrival.estimatedMinutes !== undefined && arrival.estimatedMinutes <= 2
                                ? 'text-green-500'
                                : arrival.estimatedMinutes !== undefined && arrival.estimatedMinutes <= 5
                                  ? 'text-yellow-500'
                                  : ''
                                }`}>
                                {formatArrivalTime(arrival.estimatedMinutes)}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-1 mt-2">
                            <Button
                              variant={isWatched ? "default" : "outline"}
                              size="sm"
                              className="flex-1 h-7 text-xs"
                              onClick={() => toggleWatchArrival(arrival)}
                            >
                              {isWatched ? (
                                <>
                                  <BellOff className="h-3 w-3 mr-1" />
                                  Ακύρωση
                                </>
                              ) : (
                                <>
                                  <Bell className="h-3 w-3 mr-1" />
                                  Ειδοποίηση
                                </>
                              )}
                            </Button>
                            {arrival.vehicleId && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 h-7 text-xs"
                                onClick={() => handleTrackVehicle(arrival)}
                              >
                                <Bus className="h-3 w-3 mr-1" />
                                Παρακολ.
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Show nearby stops list */
            <>
              {!userLocation && !isLocating && !locationError && (
                <div className="text-center py-8">
                  <Navigation className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Πάτα για τοποθεσία
                  </p>
                  <Button size="sm" onClick={getLocation}>
                    <LocateFixed className="h-4 w-4 mr-1" />
                    Εύρεση
                  </Button>
                </div>
              )}

              {isLocating && (
                <div className="text-center py-8">
                  <Loader2 className="h-10 w-10 mx-auto mb-3 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Αναζήτηση...</p>
                </div>
              )}

              {userLocation && nearbyStops.length === 0 && (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Δεν βρέθηκαν στάσεις
                  </p>
                </div>
              )}

              {nearbyStops.map((nearbyStop, index) => {
                const isFixed = trackingMode === 'fixed' && fixedStop?.stopId === nearbyStop.stop.stop_id;
                return (
                  <Card
                    key={nearbyStop.stop.stop_id}
                    className={`cursor-pointer hover:bg-accent/50 transition-colors ${isFixed ? 'ring-2 ring-primary bg-primary/10' :
                      index === 0 && trackingMode === 'auto' ? 'ring-2 ring-green-500 bg-green-500/10' : ''
                      }`}
                    onClick={() => handleStopSelect(nearbyStop.stop)}
                  >
                    <CardContent className="p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <MapPin className={`h-4 w-4 shrink-0 mt-0.5 ${isFixed ? 'text-primary' :
                              index === 0 && trackingMode === 'auto' ? 'text-green-500' : 'text-muted-foreground'
                              }`} />
                            <div className="min-w-0">
                              <p className="font-medium text-sm leading-tight">{nearbyStop.stop.stop_name}</p>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-muted-foreground">
                                  {formatDistance(nearbyStop.distance)}
                                </p>
                                {isFixed && (
                                  <span className="text-[10px] text-primary font-medium">📍 Σταθερή</span>
                                )}
                                {index === 0 && trackingMode === 'auto' && (
                                  <span className="text-[10px] text-green-500 font-medium">✓ Πλησιέστερη</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Set as fixed button */}
                          {panelSettings.push && !isFixed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAsFixedStop(nearbyStop.stop);
                              }}
                            >
                              <MapPin className="h-3 w-3" />
                            </Button>
                          )}
                          {nearbyStop.arrivals.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {nearbyStop.arrivals.length}
                            </Badge>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                      {nearbyStop.arrivals.length > 0 && (
                        <div className="mt-1 ml-6 flex flex-wrap gap-1">
                          {nearbyStop.arrivals.slice(0, 3).map((arrival) => (
                            <Badge
                              key={arrival.tripId}
                              variant="outline"
                              className="text-[10px] py-0"
                              style={{
                                borderColor: arrival.routeColor ? `#${arrival.routeColor}` : undefined,
                              }}
                            >
                              {arrival.routeShortName || arrival.routeId}
                              {arrival.estimatedMinutes !== undefined && (
                                <span className="ml-1 opacity-70">
                                  {arrival.estimatedMinutes}′
                                </span>
                              )}
                            </Badge>
                          ))}
                          {nearbyStop.arrivals.length > 3 && (
                            <Badge variant="outline" className="text-[10px] py-0">
                              +{nearbyStop.arrivals.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Desktop: Draggable/Resizable panel
  // Mobile: Draggable bottom sheet
  return (
    <>
      {/* Mobile: Draggable floating panel */}
      <div
        className="fixed z-50 md:hidden transition-all duration-150 ease-out shadow-2xl"
        style={{
          left: mobilePosition.x === 0 ? 0 : mobilePosition.x,
          right: mobilePosition.x === 0 ? 0 : 'auto',
          bottom: mobilePosition.y === 0 ? 0 : 'auto',
          top: mobilePosition.y !== 0 ? mobilePosition.y : 'auto',
          height: mobilePosition.y === 0 ? `${mobileHeight}vh` : '60vh',
          width: mobilePosition.x === 0 ? 'auto' : 'min(90vw, 360px)',
        }}
      >
        {/* Drag handle for resize (when docked at bottom) */}
        {mobilePosition.x === 0 && mobilePosition.y === 0 && (
          <div
            className="absolute top-0 left-0 right-0 h-6 flex items-center justify-center cursor-grab active:cursor-grabbing bg-card rounded-t-xl border-t border-x border-border touch-none"
            onMouseDown={handleMobileResizeStart}
            onTouchStart={handleMobileResizeStart}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
          </div>
        )}
        {/* Drag handle for move (when floating) */}
        {(mobilePosition.x !== 0 || mobilePosition.y !== 0) && (
          <div
            className="absolute top-0 left-0 right-0 h-8 flex items-center justify-center gap-2 cursor-grab active:cursor-grabbing bg-card rounded-t-xl border border-border touch-none"
            onMouseDown={handleMobileMoveStart}
            onTouchStart={handleMobileMoveStart}
          >
            <GripHorizontal className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Σύρε για μετακίνηση</span>
          </div>
        )}
        <div
          className={`h-full ${mobilePosition.x === 0 && mobilePosition.y === 0 ? 'pt-6' : 'pt-8 rounded-xl border border-border overflow-hidden'}`}
          onMouseDown={mobilePosition.x !== 0 || mobilePosition.y !== 0 ? handleMobileMoveStart : undefined}
          onTouchStart={mobilePosition.x !== 0 || mobilePosition.y !== 0 ? handleMobileMoveStart : undefined}
        >
          {panelContent}
        </div>
      </div>

      {/* Desktop: Draggable/Resizable panel */}
      <div className="hidden md:block fixed inset-0 pointer-events-none z-50">
        <div className="relative w-full h-full pointer-events-none">
          <ResizableDraggablePanel
            initialPosition={{ x: window.innerWidth - 360, y: 100 }}
            initialSize={{ width: 340, height: 450 }}
            minSize={{ width: 280, height: 300 }}
            maxSize={{ width: 500, height: 700 }}
            className="pointer-events-auto"
            title="Κοντινότερη Στάση"
            zIndex={1100}
          >
            {panelContent}
          </ResizableDraggablePanel>
        </div>
      </div>
    </>
  );
}
