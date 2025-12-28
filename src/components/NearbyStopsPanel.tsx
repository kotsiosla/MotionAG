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
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { StaticStop, Trip, Vehicle, RouteInfo } from "@/types/gtfs";
import { useNearbyArrivals, useStopArrivals, type StopArrival, type NearbyStop } from "@/hooks/useNearbyArrivals";

interface NearbyStopsPanelProps {
  stops: StaticStop[];
  trips: Trip[];
  vehicles: Vehicle[];
  routeNamesMap: Map<string, RouteInfo>;
  onSelectVehicle?: (vehicleId: string, tripId: string, routeId?: string) => void;
  onStopSelect?: (stop: StaticStop) => void;
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
}: NearbyStopsPanelProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<StaticStop | null>(null);
  const [watchedArrival, setWatchedArrival] = useState<StopArrival | null>(null);
  const [notifiedArrivals, setNotifiedArrivals] = useState<Set<string>>(new Set());
  const [notificationDistance, setNotificationDistance] = useState(() => {
    const saved = localStorage.getItem('nearbyNotificationDistance');
    return saved ? parseInt(saved, 10) : 500;
  });
  const [showSettings, setShowSettings] = useState(false);
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

  // Save notification distance
  useEffect(() => {
    localStorage.setItem('nearbyNotificationDistance', notificationDistance.toString());
  }, [notificationDistance]);

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

  // Full notification trigger
  const triggerFullNotification = useCallback((arrival: StopArrival, stopName: string) => {
    const routeName = arrival.routeShortName 
      ? `${arrival.routeShortName}${arrival.routeLongName ? `, ${arrival.routeLongName}` : ''}`
      : arrival.routeId;

    // Sound
    playNotificationSound();
    
    // Vibration
    triggerVibration();
    
    // Voice announcement
    const message = `Προσοχή! Γραμμή ${routeName} πλησιάζει στη στάση ${stopName}. Ετοιμαστείτε για επιβίβαση.`;
    speakAnnouncement(message);
    
    // Push notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`🚌 ${routeName} πλησιάζει!`, {
        body: `Η γραμμή πλησιάζει στη στάση: ${stopName}`,
        icon: '/pwa-192x192.png',
        tag: `arrival-${arrival.tripId}`,
        requireInteraction: true,
      });
    }
  }, [playNotificationSound, triggerVibration, speakAnnouncement]);

  // Monitor watched arrival
  useEffect(() => {
    if (!watchedArrival || !selectedStop) return;

    const arrivalKey = `${watchedArrival.tripId}-${selectedStop.stop_id}`;
    
    // Check if arrival is approaching
    if (watchedArrival.estimatedMinutes !== undefined && 
        watchedArrival.estimatedMinutes <= 2 && 
        !notifiedArrivals.has(arrivalKey)) {
      triggerFullNotification(watchedArrival, selectedStop.stop_name || selectedStop.stop_id);
      setNotifiedArrivals(prev => new Set([...prev, arrivalKey]));
    }
  }, [watchedArrival, selectedStop, notifiedArrivals, triggerFullNotification]);

  // Toggle watch for an arrival
  const toggleWatchArrival = useCallback((arrival: StopArrival) => {
    requestNotificationPermission();
    
    if (watchedArrival?.tripId === arrival.tripId) {
      setWatchedArrival(null);
    } else {
      setWatchedArrival(arrival);
    }
  }, [watchedArrival, requestNotificationPermission]);

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

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="lg"
          className="fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg md:hidden"
          onClick={getLocation}
        >
          <LocateFixed className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
        <SheetHeader className="pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Κοντινές Στάσεις
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                className="h-8 w-8"
              >
                <Settings className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={getLocation}
                disabled={isLocating}
              >
                {isLocating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Navigation className="h-4 w-4" />
                )}
                <span className="ml-2">Ανανέωση</span>
              </Button>
            </div>
          </div>
        </SheetHeader>

        {/* Settings */}
        <Collapsible open={showSettings} onOpenChange={setShowSettings}>
          <CollapsibleContent className="pb-3 border-b mb-3">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Ειδοποίηση όταν το λεωφορείο είναι σε:</p>
              <div className="flex flex-wrap gap-2">
                {[200, 300, 500, 750, 1000].map(dist => (
                  <Button
                    key={dist}
                    variant={notificationDistance === dist ? "default" : "outline"}
                    size="sm"
                    onClick={() => setNotificationDistance(dist)}
                  >
                    {dist < 1000 ? `${dist}μ` : `${dist/1000}χλμ`}
                  </Button>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {locationError && (
          <div className="flex items-center gap-2 text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            {locationError}
          </div>
        )}

        <ScrollArea className="h-[calc(100%-80px)]">
          {/* Show selected stop arrivals */}
          {selectedStop ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{selectedStop.stop_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedStop.stop_id}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStop(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {selectedStopArrivals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bus className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Δεν υπάρχουν επερχόμενες αφίξεις</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedStopArrivals.map((arrival) => (
                    <Card 
                      key={arrival.tripId}
                      className={`${watchedArrival?.tripId === arrival.tripId ? 'ring-2 ring-primary' : ''}`}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <Badge 
                              variant="secondary"
                              className="shrink-0"
                              style={{
                                backgroundColor: arrival.routeColor ? `#${arrival.routeColor}` : undefined,
                                color: arrival.routeColor ? '#fff' : undefined,
                              }}
                            >
                              {arrival.routeShortName || arrival.routeId}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {arrival.routeLongName || arrival.routeId}
                              </p>
                              {arrival.vehicleLabel && (
                                <p className="text-xs text-muted-foreground">
                                  Όχημα: {arrival.vehicleLabel}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <p className={`text-lg font-bold ${
                                arrival.estimatedMinutes !== undefined && arrival.estimatedMinutes <= 2 
                                  ? 'text-success' 
                                  : arrival.estimatedMinutes !== undefined && arrival.estimatedMinutes <= 5
                                  ? 'text-warning'
                                  : ''
                              }`}>
                                {formatArrivalTime(arrival.estimatedMinutes)}
                              </p>
                              {arrival.delay && arrival.delay > 60 && (
                                <p className="text-xs text-warning">
                                  +{Math.round(arrival.delay / 60)} λ.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Button
                            variant={watchedArrival?.tripId === arrival.tripId ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => toggleWatchArrival(arrival)}
                          >
                            {watchedArrival?.tripId === arrival.tripId ? (
                              <>
                                <BellOff className="h-4 w-4 mr-1" />
                                Ακύρωση
                              </>
                            ) : (
                              <>
                                <Bell className="h-4 w-4 mr-1" />
                                Ειδοποίηση
                              </>
                            )}
                          </Button>
                          {arrival.vehicleId && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() => handleTrackVehicle(arrival)}
                            >
                              <Bus className="h-4 w-4 mr-1" />
                              Παρακολούθηση
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
            <div className="space-y-3">
              {!userLocation && !isLocating && !locationError && (
                <div className="text-center py-12">
                  <Navigation className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">
                    Πάτα το κουμπί για να βρεις τις κοντινές στάσεις
                  </p>
                  <Button onClick={getLocation}>
                    <LocateFixed className="h-4 w-4 mr-2" />
                    Εύρεση τοποθεσίας
                  </Button>
                </div>
              )}

              {isLocating && (
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                  <p className="text-muted-foreground">Αναζήτηση τοποθεσίας...</p>
                </div>
              )}

              {userLocation && nearbyStops.length === 0 && (
                <div className="text-center py-12">
                  <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    Δεν βρέθηκαν στάσεις κοντά σου
                  </p>
                </div>
              )}

              {nearbyStops.map((nearbyStop) => (
                <Card 
                  key={nearbyStop.stop.stop_id}
                  className="cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => handleStopSelect(nearbyStop.stop)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <p className="font-medium truncate">{nearbyStop.stop.stop_name}</p>
                        </div>
                        <p className="text-sm text-muted-foreground ml-6">
                          {formatDistance(nearbyStop.distance)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {nearbyStop.arrivals.length > 0 && (
                          <Badge variant="secondary">
                            {nearbyStop.arrivals.length} αφίξεις
                          </Badge>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                    {nearbyStop.arrivals.length > 0 && (
                      <div className="mt-2 ml-6 flex flex-wrap gap-1">
                        {nearbyStop.arrivals.slice(0, 3).map((arrival) => (
                          <Badge 
                            key={arrival.tripId}
                            variant="outline"
                            className="text-xs"
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
                          <Badge variant="outline" className="text-xs">
                            +{nearbyStop.arrivals.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
