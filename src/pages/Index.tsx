import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Map as MapIcon, Route, MapPin, Bell, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { ErrorBanner } from "@/components/ErrorBanner";
import { VehicleMap } from "@/components/VehicleMap";
import { TripsTable } from "@/components/TripsTable";
import { StopsView } from "@/components/StopsView";
import { AlertsList } from "@/components/AlertsList";
import { ScheduleView } from "@/components/ScheduleView";
import { TripPlanResults } from "@/components/TripPlanResults";
import { NearbyStopsPanel } from "@/components/NearbyStopsPanel";
import { useVehicles, useTrips, useAlerts, useStaticRoutes, useStaticStops } from "@/hooks/useGtfsData";
import { useTripPlan } from "@/hooks/useTripPlan";
import { useFavoriteRoutes } from "@/hooks/useFavoriteRoutes";
import { useDelayNotifications } from "@/hooks/useDelayNotifications";
import type { RouteInfo, StaticStop } from "@/types/gtfs";
import { toast } from "sonner";

const Index = () => {
  const [isDark, setIsDark] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [activeTab, setActiveTab] = useState("map");
  const [selectedOperator, setSelectedOperator] = useState("all");
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  
  // Trip planning state
  const [tripOrigin, setTripOrigin] = useState<StaticStop | null>(null);
  const [tripDestination, setTripDestination] = useState<StaticStop | null>(null);
  const [tripDepartureTime, setTripDepartureTime] = useState<string>("now");
  const [tripDepartureDate, setTripDepartureDate] = useState<Date>(new Date());
  const [showTripResults, setShowTripResults] = useState(false);
  
  // Highlighted stop (for nearby stops panel)
  const [highlightedStop, setHighlightedStop] = useState<StaticStop | null>(null);
  
  // Vehicle to follow from NearbyStopsPanel
  const [followVehicleId, setFollowVehicleId] = useState<string | null>(null);
  
  // Delay notifications toggle
  const [delayNotificationsEnabled, setDelayNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('delayNotificationsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Toggle delay notifications
  const toggleDelayNotifications = () => {
    const newValue = !delayNotificationsEnabled;
    setDelayNotificationsEnabled(newValue);
    localStorage.setItem('delayNotificationsEnabled', JSON.stringify(newValue));
  };
  
  // Favorites
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoriteRoutes();

  const vehiclesQuery = useVehicles(refreshInterval, selectedOperator);
  const tripsQuery = useTrips(refreshInterval, selectedOperator);
  const alertsQuery = useAlerts(refreshInterval, selectedOperator);
  const staticRoutesQuery = useStaticRoutes(selectedOperator);
  const staticStopsQuery = useStaticStops(selectedOperator);
  
  // Cache for last known good data - initialize from localStorage
  const [cachedVehicles, setCachedVehicles] = useState<typeof vehiclesQuery.data>(() => {
    try {
      const stored = localStorage.getItem('gtfs_cached_vehicles');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [cachedTrips, setCachedTrips] = useState<typeof tripsQuery.data>(() => {
    try {
      const stored = localStorage.getItem('gtfs_cached_trips');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [cachedAlerts, setCachedAlerts] = useState<typeof alertsQuery.data>(() => {
    try {
      const stored = localStorage.getItem('gtfs_cached_alerts');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isUsingCachedData, setIsUsingCachedData] = useState(false);
  
  // Update cache when we get successful data - also persist to localStorage
  useEffect(() => {
    if (vehiclesQuery.data?.data && vehiclesQuery.data.data.length > 0) {
      setCachedVehicles(vehiclesQuery.data);
      try {
        localStorage.setItem('gtfs_cached_vehicles', JSON.stringify(vehiclesQuery.data));
        localStorage.setItem('gtfs_cache_timestamp', Date.now().toString());
      } catch (e) {
        // localStorage might be full or unavailable
        console.warn('Failed to persist vehicle cache:', e);
      }
    }
  }, [vehiclesQuery.data]);
  
  useEffect(() => {
    if (tripsQuery.data?.data && tripsQuery.data.data.length > 0) {
      setCachedTrips(tripsQuery.data);
      try {
        localStorage.setItem('gtfs_cached_trips', JSON.stringify(tripsQuery.data));
      } catch (e) {
        console.warn('Failed to persist trips cache:', e);
      }
    }
  }, [tripsQuery.data]);
  
  useEffect(() => {
    if (alertsQuery.data?.data) {
      setCachedAlerts(alertsQuery.data);
      try {
        localStorage.setItem('gtfs_cached_alerts', JSON.stringify(alertsQuery.data));
      } catch (e) {
        console.warn('Failed to persist alerts cache:', e);
      }
    }
  }, [alertsQuery.data]);
  
  // Get cache age for display
  const getCacheAge = useCallback(() => {
    try {
      const timestamp = localStorage.getItem('gtfs_cache_timestamp');
      if (timestamp) {
        return parseInt(timestamp, 10);
      }
    } catch {
      // ignore
    }
    return null;
  }, []);
  
  // Determine if we're using cached data
  useEffect(() => {
    const hasError = vehiclesQuery.isError || tripsQuery.isError;
    const hasNoCurrentData = !vehiclesQuery.data?.data?.length && !tripsQuery.data?.data?.length;
    const hasCachedData = (cachedVehicles?.data?.length ?? 0) > 0 || (cachedTrips?.data?.length ?? 0) > 0;
    
    setIsUsingCachedData(hasError && hasNoCurrentData && hasCachedData);
  }, [vehiclesQuery.isError, tripsQuery.isError, vehiclesQuery.data, tripsQuery.data, cachedVehicles, cachedTrips]);
  
  // Use current data if available, otherwise fall back to cached data
  const effectiveVehiclesData = useMemo(() => {
    if (vehiclesQuery.data?.data && vehiclesQuery.data.data.length > 0) {
      return vehiclesQuery.data;
    }
    if (vehiclesQuery.isError && cachedVehicles) {
      return cachedVehicles;
    }
    return vehiclesQuery.data;
  }, [vehiclesQuery.data, vehiclesQuery.isError, cachedVehicles]);
  
  const effectiveTripsData = useMemo(() => {
    if (tripsQuery.data?.data && tripsQuery.data.data.length > 0) {
      return tripsQuery.data;
    }
    if (tripsQuery.isError && cachedTrips) {
      return cachedTrips;
    }
    return tripsQuery.data;
  }, [tripsQuery.data, tripsQuery.isError, cachedTrips]);
  
  const effectiveAlertsData = useMemo(() => {
    if (alertsQuery.data?.data) {
      return alertsQuery.data;
    }
    if (alertsQuery.isError && cachedAlerts) {
      return cachedAlerts;
    }
    return alertsQuery.data;
  }, [alertsQuery.data, alertsQuery.isError, cachedAlerts]);
  
  // Trip planning query
  const tripPlanQuery = useTripPlan(
    tripOrigin?.stop_id || null,
    tripDestination?.stop_id || null,
    selectedOperator !== 'all' ? selectedOperator : undefined,
    tripDepartureTime,
    tripDepartureDate
  );

  // Create a map of route_id -> RouteInfo for quick lookup
  const routeNamesMap = useMemo(() => {
    const routeMap = new Map<string, RouteInfo>();
    staticRoutesQuery.data?.data?.forEach(route => {
      routeMap.set(route.route_id, route);
    });
    return routeMap;
  }, [staticRoutesQuery.data]);
  
  // Delay notifications - monitors trips for delays and shows browser notifications
  useDelayNotifications(
    effectiveTripsData?.data || [],
    routeNamesMap,
    delayNotificationsEnabled
  );

  // Get routes with active vehicles/trips
  const liveRoutes = useMemo(() => {
    const routeSet = new Set<string>();
    effectiveVehiclesData?.data?.forEach(v => {
      if (v.routeId) routeSet.add(v.routeId);
    });
    effectiveTripsData?.data?.forEach(t => {
      if (t.routeId) routeSet.add(t.routeId);
    });
    return routeSet;
  }, [effectiveVehiclesData, effectiveTripsData]);

  // Get all available routes from static data, or live routes only
  const availableRoutes = useMemo(() => {
    if (showLiveOnly) {
      return Array.from(liveRoutes);
    }
    
    // Get routes from static GTFS data
    const staticRoutes = staticRoutesQuery.data?.data?.map(r => r.route_id) || [];
    if (staticRoutes.length > 0) {
      return staticRoutes;
    }
    
    // Fallback: use live routes
    return Array.from(liveRoutes);
  }, [staticRoutesQuery.data, liveRoutes, showLiveOnly]);

  // Reset route and refetch stops when operator changes
  useEffect(() => {
    setSelectedRoute("all");
    staticStopsQuery.refetch();
  }, [selectedOperator]);

  // Filter data by selected route
  const filteredVehicles = useMemo(() => {
    const vehicles = effectiveVehiclesData?.data || [];
    if (selectedRoute === "all") return vehicles;
    return vehicles.filter(v => v.routeId === selectedRoute);
  }, [effectiveVehiclesData, selectedRoute]);

  const filteredTrips = useMemo(() => {
    const trips = effectiveTripsData?.data || [];
    if (selectedRoute === "all") return trips;
    return trips.filter(t => t.routeId === selectedRoute);
  }, [effectiveTripsData, selectedRoute]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const isLoading = vehiclesQuery.isLoading || tripsQuery.isLoading || alertsQuery.isLoading;
  const hasError = vehiclesQuery.isError || tripsQuery.isError || alertsQuery.isError;
  const errorMessage = vehiclesQuery.error?.message || tripsQuery.error?.message || alertsQuery.error?.message;

  // Track previous error state to detect connection restored
  const wasOfflineRef = useRef(false);
  
  // Show toast when connection is restored
  useEffect(() => {
    if (wasOfflineRef.current && !hasError && !isLoading) {
      // Connection was restored
      toast.success("Σύνδεση αποκαταστάθηκε", {
        description: "Τα live δεδομένα είναι τώρα διαθέσιμα",
        duration: 4000,
      });
      wasOfflineRef.current = false;
    } else if (hasError && !isLoading) {
      wasOfflineRef.current = true;
    }
  }, [hasError, isLoading]);

  // Track last successful update for status indicator
  const [lastSuccessfulUpdate, setLastSuccessfulUpdate] = useState<number | null>(null);
  
  useEffect(() => {
    if (vehiclesQuery.data?.timestamp || tripsQuery.data?.timestamp) {
      setLastSuccessfulUpdate(Date.now());
    }
  }, [vehiclesQuery.data?.timestamp, tripsQuery.data?.timestamp]);

  const lastUpdate = Math.max(
    vehiclesQuery.data?.timestamp || 0,
    tripsQuery.data?.timestamp || 0,
    alertsQuery.data?.timestamp || 0
  );

  // Auto-retry logic with countdown
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const retryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleRetry = useCallback(() => {
    vehiclesQuery.refetch();
    tripsQuery.refetch();
    alertsQuery.refetch();
  }, [vehiclesQuery, tripsQuery, alertsQuery]);

  // Auto-retry when there's an error
  useEffect(() => {
    if (hasError && !isLoading) {
      // Clear any existing intervals
      if (retryIntervalRef.current) clearTimeout(retryIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      
      // Set countdown to 30 seconds
      const retryDelay = 30;
      setRetryCountdown(retryDelay);
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setRetryCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Schedule retry
      retryIntervalRef.current = setTimeout(() => {
        handleRetry();
      }, retryDelay * 1000);
    } else {
      // Clear intervals when no error
      if (retryIntervalRef.current) {
        clearTimeout(retryIntervalRef.current);
        retryIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setRetryCountdown(0);
    }
    
    return () => {
      if (retryIntervalRef.current) clearTimeout(retryIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [hasError, isLoading, handleRetry]);

  const alertCount = alertsQuery.data?.data?.length || 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        refreshInterval={refreshInterval}
        onRefreshIntervalChange={setRefreshInterval}
        lastUpdate={lastUpdate || null}
        isLoading={isLoading}
        selectedOperator={selectedOperator}
        onOperatorChange={setSelectedOperator}
        selectedRoute={selectedRoute}
        onRouteChange={setSelectedRoute}
        availableRoutes={availableRoutes}
        routeNamesMap={routeNamesMap}
        isRoutesLoading={staticRoutesQuery.isLoading}
        showLiveOnly={showLiveOnly}
        onShowLiveOnlyChange={setShowLiveOnly}
        liveRoutesCount={liveRoutes.size}
        stops={staticStopsQuery.data?.data || []}
        stopsLoading={staticStopsQuery.isLoading}
        onTripSearch={(origin, destination, departureTime, departureDate) => {
          setTripOrigin(origin);
          setTripDestination(destination);
          setTripDepartureTime(departureTime);
          setTripDepartureDate(departureDate);
          setShowTripResults(true);
        }}
        favorites={favorites}
        onRemoveFavorite={removeFavorite}
        delayNotificationsEnabled={delayNotificationsEnabled}
        onToggleDelayNotifications={toggleDelayNotifications}
        hasApiError={hasError}
        apiErrorMessage={errorMessage}
        onApiRetry={handleRetry}
        retryCountdown={retryCountdown}
        isUsingCachedData={isUsingCachedData}
      />
      
      {/* Trip Plan Results Modal */}
      {showTripResults && (
        <TripPlanResults
          origin={tripOrigin}
          destination={tripDestination}
          departureTime={tripDepartureTime}
          departureDate={tripDepartureDate}
          results={tripPlanQuery.data || []}
          isLoading={tripPlanQuery.isLoading}
          error={tripPlanQuery.error}
          onClose={() => setShowTripResults(false)}
          isFavorite={tripOrigin && tripDestination ? isFavorite(tripOrigin.stop_id, tripDestination.stop_id) : false}
          onToggleFavorite={() => {
            if (tripOrigin && tripDestination) {
              const isCurrentlyFavorite = isFavorite(tripOrigin.stop_id, tripDestination.stop_id);
              if (isCurrentlyFavorite) {
                removeFavorite(`${tripOrigin.stop_id}-${tripDestination.stop_id}`);
                toast.success("Αφαιρέθηκε από τα αγαπημένα");
              } else {
                addFavorite(tripOrigin, tripDestination);
                toast.success("Προστέθηκε στα αγαπημένα");
              }
            }
          }}
        />
      )}

      {hasError && (
        <ErrorBanner message={errorMessage || "Αποτυχία σύνδεσης"} onRetry={handleRetry} />
      )}

      <main className="flex-1 container mx-auto px-2 sm:px-4 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-5 mb-2 h-auto">
            <TabsTrigger value="map" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3">
              <MapIcon className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-sm">Χάρτης</span>
            </TabsTrigger>
            <TabsTrigger value="trips" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3">
              <Route className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-sm">Δρομολόγια</span>
            </TabsTrigger>
            <TabsTrigger value="stops" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3">
              <MapPin className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-sm">Στάσεις</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3">
              <Calendar className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-sm">Πρόγραμμα</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex flex-col sm:flex-row items-center gap-1 py-2 px-1 sm:px-3 relative">
              <Bell className="h-4 w-4 sm:h-4 sm:w-4" />
              <span className="text-[10px] sm:text-sm">Ειδοποιήσεις</span>
              {alertCount > 0 && (
                <span className="absolute top-0.5 right-0.5 sm:-top-1 sm:-right-1 w-4 h-4 sm:w-5 sm:h-5 bg-destructive text-destructive-foreground text-[10px] sm:text-xs rounded-full flex items-center justify-center">
                  {alertCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 glass-card rounded-lg overflow-hidden">
            <TabsContent value="map" className="h-[calc(100vh-200px)] sm:h-[calc(100vh-180px)] m-0">
              <VehicleMap
                vehicles={filteredVehicles}
                trips={filteredTrips}
                stops={staticStopsQuery.data?.data || []}
                routeNamesMap={routeNamesMap}
                selectedRoute={selectedRoute}
                selectedOperator={selectedOperator}
                onRouteClose={() => setSelectedRoute('all')}
                isLoading={vehiclesQuery.isLoading}
                highlightedStop={highlightedStop}
                followVehicleId={followVehicleId}
                onFollowVehicle={setFollowVehicleId}
                refreshInterval={refreshInterval}
                lastUpdate={lastUpdate}
              />
            </TabsContent>

            <TabsContent value="trips" className="h-[calc(100vh-240px)] sm:h-[calc(100vh-220px)] m-0">
              <TripsTable
                trips={filteredTrips}
                isLoading={tripsQuery.isLoading}
                routeNames={routeNamesMap}
                stops={staticStopsQuery.data?.data || []}
                onTripSelect={(trip) => {
                  // Set the route
                  if (trip.routeId) {
                    setSelectedRoute(trip.routeId);
                  }
                  // Set the followed vehicle
                  if (trip.vehicleId) {
                    setFollowVehicleId(trip.vehicleId);
                  }
                  // Switch to map tab
                  setActiveTab("map");
                }}
              />
            </TabsContent>

            <TabsContent value="stops" className="h-[calc(100vh-240px)] sm:h-[calc(100vh-220px)] m-0">
              <StopsView
                trips={filteredTrips}
                stops={staticStopsQuery.data?.data || []}
                routeNamesMap={routeNamesMap}
                isLoading={tripsQuery.isLoading}
              />
            </TabsContent>

            <TabsContent value="schedule" className="h-[calc(100vh-240px)] sm:h-[calc(100vh-220px)] m-0">
              <ScheduleView
                selectedOperator={selectedOperator}
                onOperatorChange={setSelectedOperator}
              />
            </TabsContent>

            <TabsContent value="alerts" className="h-[calc(100vh-240px)] sm:h-[calc(100vh-220px)] m-0 overflow-auto">
              <AlertsList
                alerts={effectiveAlertsData?.data || []}
                trips={filteredTrips}
                routeNamesMap={routeNamesMap}
                isLoading={alertsQuery.isLoading}
              />
            </TabsContent>
          </div>
        </Tabs>
      </main>

      {/* Nearby Stops Panel */}
      <NearbyStopsPanel
        stops={staticStopsQuery.data?.data || []}
        trips={effectiveTripsData?.data || []}
        vehicles={effectiveVehiclesData?.data || []}
        routeNamesMap={routeNamesMap}
        onSelectVehicle={(vehicleId, tripId, routeId) => {
          if (routeId) setSelectedRoute(routeId);
          setFollowVehicleId(vehicleId);
          setActiveTab("map");
        }}
        onStopSelect={(stop) => {
          setActiveTab("map");
        }}
        onHighlightStop={(stop) => {
          // Pass highlighted stop to VehicleMap - will be implemented via state
          setHighlightedStop(stop);
        }}
      />
    </div>
  );
};

export default Index;
