import { useState, useEffect, useCallback, useRef } from "react";
import { 
  MapPin, 
  Navigation, 
  Bus, 
  Clock, 
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ResizableDraggablePanel } from "@/components/ResizableDraggablePanel";
import type { StaticStop, Trip, Vehicle, RouteInfo } from "@/types/gtfs";
import { useNearbyArrivals, useStopArrivals, type StopArrival, type NearbyStop } from "@/hooks/useNearbyArrivals";

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
  return `${hours}ω ${mins}λ`;
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
  const [watchedArrivals, setWatchedArrivals] = useState<Set<string>>(new Set());
  const [notifiedArrivals, setNotifiedArrivals] = useState<Set<string>>(new Set());
  const [notificationDistance, setNotificationDistance] = useState(() => {
    const saved = localStorage.getItem('nearbyNotificationDistance');
    return saved ? parseInt(saved, 10) : 500;
  });
  const [notificationSettings, setNotificationSettings] = useState(() => {
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
  const selectedStopArrivals = useStopArrivals(
    selectedStop?.stop_id || null,
    stops,
    trips,
    vehicles,
    routeNamesMap
  );

  // Get nearest stop for highlighting
  const nearestStop = nearbyStops.length > 0 ? nearbyStops[0].stop : null;

  // Highlight nearest stop when panel opens
  useEffect(() => {
    if (isPanelOpen && nearestStop && onHighlightStop) {
      onHighlightStop(nearestStop);
    }
    return () => {
      if (onHighlightStop) {
        onHighlightStop(null);
      }
    };
  }, [isPanelOpen, nearestStop, onHighlightStop]);

  // Save notification distance
  useEffect(() => {
    localStorage.setItem('nearbyNotificationDistance', notificationDistance.toString());
  }, [notificationDistance]);

  // Save notification settings
  useEffect(() => {
    localStorage.setItem('nearbyNotificationSettings', JSON.stringify(notificationSettings));
  }, [notificationSettings]);

  // Toggle notification setting
  const toggleNotificationSetting = useCallback((key: keyof typeof notificationSettings) => {
    setNotificationSettings((prev: typeof notificationSettings) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }, []);

  // Get user location
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError("Η τοποθεσία δεν υποστηρίζεται");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      (error) => {
        setIsLocating(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setLocationError("Δεν επιτρέπεται η πρόσβαση στην τοποθεσία");
            break;
          case error.POSITION_UNAVAILABLE:
            setLocationError("Η τοποθεσία δεν είναι διαθέσιμη");
            break;
          case error.TIMEOUT:
            setLocationError("Η αναζήτηση τοποθεσίας έληξε");
            break;
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
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
      () => {}, // Ignore errors in watch mode
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }, []);

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(1200, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
      console.error('Audio playback failed', e);
    }
  }, []);

  // Trigger vibration
  const triggerVibration = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }
  }, []);

  // Speak announcement
  const speakAnnouncement = useCallback((message: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'el-GR';
      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // Full notification trigger - respects settings
  const triggerFullNotification = useCallback((arrival: StopArrival, stopName: string) => {
    const routeName = arrival.routeShortName 
      ? `${arrival.routeShortName}${arrival.routeLongName ? `, ${arrival.routeLongName}` : ''}`
      : arrival.routeId;

    // Sound
    if (notificationSettings.sound) {
      playNotificationSound();
    }
    
    // Vibration
    if (notificationSettings.vibration) {
      triggerVibration();
    }
    
    // Voice announcement
    if (notificationSettings.voice) {
      const message = `Προσοχή! Γραμμή ${routeName} πλησιάζει στη στάση ${stopName}. Ετοιμαστείτε για επιβίβαση.`;
      speakAnnouncement(message);
    }
    
    // Push notification
    if (notificationSettings.push && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚌 ${routeName} πλησιάζει!`, {
        body: `Η γραμμή πλησιάζει στη στάση: ${stopName}`,
        icon: '/pwa-192x192.png',
        tag: `arrival-${arrival.tripId}`,
        requireInteraction: true,
      });
    }
  }, [playNotificationSound, triggerVibration, speakAnnouncement, notificationSettings]);

  // Monitor watched arrivals
  useEffect(() => {
    if (!selectedStop || watchedArrivals.size === 0) return;

    selectedStopArrivals.forEach(arrival => {
      const arrivalKey = `${arrival.tripId}-${selectedStop.stop_id}`;
      
      // Check if this arrival is being watched and is approaching
      if (watchedArrivals.has(arrival.tripId) &&
          arrival.estimatedMinutes !== undefined && 
          arrival.estimatedMinutes <= 2 && 
          !notifiedArrivals.has(arrivalKey)) {
        triggerFullNotification(arrival, selectedStop.stop_name || selectedStop.stop_id);
        setNotifiedArrivals(prev => new Set([...prev, arrivalKey]));
      }
    });
  }, [selectedStopArrivals, selectedStop, watchedArrivals, notifiedArrivals, triggerFullNotification]);

  // Toggle watch for an arrival
  const toggleWatchArrival = useCallback((arrival: StopArrival) => {
    requestNotificationPermission();
    
    setWatchedArrivals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(arrival.tripId)) {
        newSet.delete(arrival.tripId);
      } else {
        newSet.add(arrival.tripId);
      }
      return newSet;
    });
  }, [requestNotificationPermission]);

  // Select stop and view arrivals
  const handleStopSelect = useCallback((stop: StaticStop) => {
    setSelectedStop(stop);
    onStopSelect?.(stop);
    watchLocation();
  }, [onStopSelect, watchLocation]);

  // Track vehicle
  const handleTrackVehicle = useCallback((arrival: StopArrival) => {
    if (arrival.vehicleId && onSelectVehicle) {
      onSelectVehicle(arrival.vehicleId, arrival.tripId, arrival.routeId);
    }
  }, [onSelectVehicle]);

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

  const handleMobileDragEnd = useCallback(() => {
    setIsDraggingMobile(false);
    
    if (mobileDragMode === 'resize') {
      // Snap to positions
      if (mobileHeight < 40) {
        setMobileHeight(30);
      } else if (mobileHeight > 75) {
        setMobileHeight(85);
      } else {
        setMobileHeight(60);
      }
    }
  }, [mobileHeight, mobileDragMode]);

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
        className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
        onClick={handleOpenPanel}
        title="Κοντινότερη Στάση"
      >
        <LocateFixed className="h-6 w-6" />
      </Button>
    );
  }

  // Minimized view
  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50 md:hidden">
        <Button
          variant="default"
          size="lg"
          className="h-14 px-4 rounded-full shadow-lg flex items-center gap-2"
          onClick={() => setIsMinimized(false)}
        >
          <MapPin className="h-5 w-5" />
          {nearestStop && (
            <span className="text-sm max-w-[120px] truncate">
              {nearestStop.stop_name}
            </span>
          )}
        </Button>
      </div>
    );
  }

  // Panel content
  const panelContent = (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-card/80">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Κοντινότερη Στάση</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="h-7 w-7"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={getLocation}
            disabled={isLocating}
            className="h-7 w-7"
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
            className="h-7 w-7 md:hidden"
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
            className="h-7 w-7"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClosePanel}
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleContent className="p-3 border-b border-border bg-muted/50">
          <div className="space-y-3">
            {/* Notification types */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Τύποι ειδοποίησης:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  className={`h-10 text-xs flex items-center justify-start px-3 rounded-md border-2 transition-all ${
                    notificationSettings.sound 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                  }`}
                  onClick={() => toggleNotificationSetting('sound')}
                >
                  <div className={`w-5 h-5 rounded-full mr-2 flex items-center justify-center ${
                    notificationSettings.sound ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`}>
                    <Volume2 className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-medium">Ήχος</span>
                  {notificationSettings.sound && <span className="ml-auto text-green-400">✓</span>}
                </button>
                <button
                  className={`h-10 text-xs flex items-center justify-start px-3 rounded-md border-2 transition-all ${
                    notificationSettings.vibration 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                  }`}
                  onClick={() => toggleNotificationSetting('vibration')}
                >
                  <div className={`w-5 h-5 rounded-full mr-2 flex items-center justify-center ${
                    notificationSettings.vibration ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`}>
                    <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect x="5" y="2" width="14" height="20" rx="2" />
                      <path d="M2 8v8M22 8v8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="font-medium">Δόνηση</span>
                  {notificationSettings.vibration && <span className="ml-auto text-green-400">✓</span>}
                </button>
                <button
                  className={`h-10 text-xs flex items-center justify-start px-3 rounded-md border-2 transition-all ${
                    notificationSettings.voice 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                  }`}
                  onClick={() => toggleNotificationSetting('voice')}
                >
                  <div className={`w-5 h-5 rounded-full mr-2 flex items-center justify-center ${
                    notificationSettings.voice ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`}>
                    <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
                    </svg>
                  </div>
                  <span className="font-medium">Φωνή</span>
                  {notificationSettings.voice && <span className="ml-auto text-green-400">✓</span>}
                </button>
                <button
                  className={`h-10 text-xs flex items-center justify-start px-3 rounded-md border-2 transition-all ${
                    notificationSettings.push 
                      ? 'bg-green-500/20 border-green-500 text-green-400' 
                      : 'bg-muted/30 border-muted-foreground/20 text-muted-foreground'
                  }`}
                  onClick={() => toggleNotificationSetting('push')}
                >
                  <div className={`w-5 h-5 rounded-full mr-2 flex items-center justify-center ${
                    notificationSettings.push ? 'bg-green-500' : 'bg-muted-foreground/30'
                  }`}>
                    <Bell className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-medium">Push</span>
                  {notificationSettings.push && <span className="ml-auto text-green-400">✓</span>}
                </button>
              </div>
            </div>

            {/* Distance settings */}
            <div>
              <p className="text-xs text-muted-foreground mb-2">Ειδοποίηση όταν το λεωφορείο είναι σε:</p>
              <div className="flex flex-wrap gap-1">
                {[200, 300, 500, 750, 1000, 2000].map(dist => (
                  <Button
                    key={dist}
                    variant={notificationDistance === dist ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => setNotificationDistance(dist)}
                  >
                    {dist < 1000 ? `${dist}μ` : `${dist/1000}χλμ`}
                  </Button>
                ))}
              </div>
            </div>
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
                <Button variant="ghost" size="sm" onClick={() => setSelectedStop(null)}>
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
                  {selectedStopArrivals.map((arrival) => (
                    <Card 
                      key={arrival.tripId}
                      className={`${watchedArrivals.has(arrival.tripId) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
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
                            <p className={`text-sm font-bold ${
                              arrival.estimatedMinutes !== undefined && arrival.estimatedMinutes <= 2 
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
                            variant={watchedArrivals.has(arrival.tripId) ? "default" : "outline"}
                            size="sm"
                            className="flex-1 h-7 text-xs"
                            onClick={() => toggleWatchArrival(arrival)}
                          >
                            {watchedArrivals.has(arrival.tripId) ? (
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
                  ))}
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

              {nearbyStops.map((nearbyStop, index) => (
                <Card 
                  key={nearbyStop.stop.stop_id}
                  className={`cursor-pointer hover:bg-accent/50 transition-colors ${
                    index === 0 ? 'ring-2 ring-green-500 bg-green-500/10' : ''
                  }`}
                  onClick={() => handleStopSelect(nearbyStop.stop)}
                >
                  <CardContent className="p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className={`h-4 w-4 shrink-0 ${index === 0 ? 'text-green-500' : 'text-primary'}`} />
                          <p className="font-medium text-sm truncate">{nearbyStop.stop.stop_name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          {formatDistance(nearbyStop.distance)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
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
              ))}
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
          width: mobilePosition.x === 0 ? 'auto' : '320px',
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
