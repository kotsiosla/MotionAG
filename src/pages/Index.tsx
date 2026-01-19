import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Map as MapIcon, Route, MapPin, Bell, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/layout/Header";
import { ErrorBanner } from "@/components/common/ErrorBanner";
import { VehicleMap, MapStyleType } from "@/components/features/map/VehicleMap";
import { TripsTable } from "@/components/features/schedule/TripsTable";
import { StopsView } from "@/components/features/schedule/StopsView";
import { AlertsList } from "@/components/features/user/AlertsList";
import { ScheduleView } from "@/components/features/schedule/ScheduleView";
import { SmartTripResults } from "@/components/features/planning/SmartTripResults";
import { NearbyStopsPanel } from "@/components/features/map/NearbyStopsPanel";
import { SavedTripsPanel } from "@/components/features/user/SavedTripsPanel";
import { PWAInstallBanner } from "@/components/common/PWAInstallBanner";
import { PullToRefresh } from "@/components/common/PullToRefresh";
import { AccessibilityWidget } from "@/components/common/AccessibilityWidget";
import { useSavedTrips } from "@/hooks/useSavedTrips";
import { useVehicles, useTrips, useAlerts, useStaticRoutes, useStaticStops } from "@/hooks/useGtfsData";
import { useSmartTripPlan, type OptimizationPreference } from "@/hooks/useSmartTripPlan";
import { useFavoriteRoutes } from "@/hooks/useFavoriteRoutes";
import { useStopNotifications } from "@/hooks/useStopNotifications";
import { useStopArrivalNotifications } from "@/hooks/useStopArrivalNotifications";
import { unlockAudio } from "@/lib/audio-engine";
import type { RouteInfo, StaticStop, Vehicle, Trip, Alert, GtfsResponse } from "@/types/gtfs";
import { toast } from "sonner";

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [isDark, setIsDark] = useState(() => {
    // Check saved preference or default to light
    try {
      const savedTheme = localStorage.getItem('motionbus_theme');
      if (savedTheme !== null) {
        return savedTheme === 'dark';
      }
      const savedMapStyle = localStorage.getItem('motionbus_map_style');
      return savedMapStyle === 'dark' || savedMapStyle === 'satellite';
    } catch { }
    return false;
  });
  const [mapStyle, setMapStyle] = useState<MapStyleType>(() => {
    try {
      const saved = localStorage.getItem('motionbus_map_style');
      if (saved === 'light' || saved === 'dark' || saved === 'satellite') return saved;
    } catch { }
    return 'light';
  });
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [activeTab, setActiveTab] = useState("map");
  const [selectedOperator, setSelectedOperator] = useState("all");
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [showLiveOnly, setShowLiveOnly] = useState(false);

  // Deep link stop state - passed to VehicleMap to open stop panel
  const [deepLinkStopId, setDeepLinkStopId] = useState<string | null>(null);

  // Trip planning state
  const [tripOrigin, setTripOrigin] = useState<StaticStop | null>(null);
  const [tripDestination, setTripDestination] = useState<StaticStop | null>(null);
  const [tripDepartureTime, setTripDepartureTime] = useState<string>("now");
  const [tripDepartureDate, setTripDepartureDate] = useState<Date>(new Date());
  const [showTripResults, setShowTripResults] = useState(false);

  const [maxWalkingDistance, setMaxWalkingDistance] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('maxWalkingDistance');
      return saved ? parseInt(saved, 10) : 1000; // Default to 1km
    } catch {
      return 1000;
    }
  });
  const [maxTransfers, setMaxTransfers] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('maxTransfers');
      return saved ? parseInt(saved, 10) : 2;
    } catch {
      return 2;
    }
  });
  const [optimizationPreference, setOptimizationPreference] = useState<OptimizationPreference>(() => {
    try {
      const saved = localStorage.getItem('optimizationPreference');
      if (saved === 'fastest' || saved === 'leastWalking' || saved === 'leastTransfers' || saved === 'balanced') {
        return saved as OptimizationPreference;
      }
    } catch { }
    return 'balanced';
  });
  const [includeNightBuses, setIncludeNightBuses] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('includeNightBuses');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Highlighted stop (for nearby stops panel)
  const [highlightedStop, setHighlightedStop] = useState<StaticStop | null>(null);

  // Vehicle to follow from NearbyStopsPanel
  const [followVehicleId, setFollowVehicleId] = useState<string | null>(null);

  // Delay notifications toggle
  const [delayNotificationsEnabled, setDelayNotificationsEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem('delayNotificationsEnabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [isAccessibilityEnhanced, setIsAccessibilityEnhanced] = useState(() => {
    try {
      const saved = localStorage.getItem('isAccessibilityEnhanced');
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Apply theme to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (isAccessibilityEnhanced) {
      document.body.classList.add('accessibility-enhanced');
    } else {
      document.body.classList.remove('accessibility-enhanced');
    }
    try {
      localStorage.setItem('isAccessibilityEnhanced', JSON.stringify(isAccessibilityEnhanced));
    } catch { }
  }, [isAccessibilityEnhanced]);

  // Persist trip planning settings
  useEffect(() => {
    try {
      localStorage.setItem('maxWalkingDistance', maxWalkingDistance.toString());
      localStorage.setItem('maxTransfers', maxTransfers.toString());
      localStorage.setItem('optimizationPreference', optimizationPreference);
      localStorage.setItem('includeNightBuses', JSON.stringify(includeNightBuses));
    } catch { }
  }, [maxWalkingDistance, maxTransfers, optimizationPreference, includeNightBuses]);

  // Unlock audio on any user interaction (required for iOS)
  useEffect(() => {
    const handleInteraction = async () => {
      const unlocked = await unlockAudio();
      if (unlocked) {
        document.removeEventListener('touchstart', handleInteraction);
        document.removeEventListener('click', handleInteraction);
      }
    };

    // Listen for various interaction events
    document.addEventListener('touchstart', handleInteraction, { passive: true });
    document.addEventListener('click', handleInteraction, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleInteraction);
      document.removeEventListener('click', handleInteraction);
    };
  }, []);

  // Handle back button for modal
  useEffect(() => {
    if (showTripResults) {
      // Push specific state for modal
      window.history.pushState({ modal: 'tripResults' }, '');

      const handlePopState = () => {
        // If we popped back, close the modal
        setShowTripResults(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [showTripResults]);

  // Sync theme and map style
  const handleThemeToggle = useCallback(() => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    localStorage.setItem('motionbus_theme', newIsDark ? 'dark' : 'light');
    // Sync map style with theme
    if (newIsDark && mapStyle === 'light') {
      setMapStyle('dark');
      localStorage.setItem('motionbus_map_style', 'dark');
    } else if (!newIsDark && mapStyle === 'dark') {
      setMapStyle('light');
      localStorage.setItem('motionbus_map_style', 'light');
    }
  }, [isDark, mapStyle]);

  const handleMapStyleChange = useCallback((newStyle: MapStyleType) => {
    setMapStyle(newStyle);
    localStorage.setItem('motionbus_map_style', newStyle);
    // Sync theme with map style
    if (newStyle === 'dark' || newStyle === 'satellite') {
      setIsDark(true);
    } else {
      setIsDark(false);
    }
  }, []);

  // Toggle delay notifications
  const toggleDelayNotifications = () => {
    const newValue = !delayNotificationsEnabled;
    setDelayNotificationsEnabled(newValue);
    localStorage.setItem('delayNotificationsEnabled', JSON.stringify(newValue));
  };

  // Saved trips
  const { getUpcomingTrips } = useSavedTrips();
  const [showSavedTrips, setShowSavedTrips] = useState(false);

  // Favorites
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoriteRoutes();

  const vehiclesQuery = useVehicles(refreshInterval, selectedOperator);
  const tripsQuery = useTrips(refreshInterval, selectedOperator);
  const alertsQuery = useAlerts(refreshInterval, selectedOperator);
  const staticRoutesQuery = useStaticRoutes(selectedOperator);
  const staticStopsQuery = useStaticStops(selectedOperator);

  const isLoading = vehiclesQuery.isLoading || tripsQuery.isLoading || alertsQuery.isLoading;
  const hasError = vehiclesQuery.isError || tripsQuery.isError || alertsQuery.isError;
  const errorMessage = vehiclesQuery.error?.message || tripsQuery.error?.message || alertsQuery.error?.message;

  // Cache for last known good data - initialize from localStorage
  const [cachedVehicles, setCachedVehicles] = useState<GtfsResponse<Vehicle[]> | null>(() => {
    try {
      const stored = localStorage.getItem('gtfs_cached_vehicles');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [cachedTrips, setCachedTrips] = useState<GtfsResponse<Trip[]> | null>(() => {
    try {
      const stored = localStorage.getItem('gtfs_cached_trips');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [cachedAlerts, setCachedAlerts] = useState<GtfsResponse<Alert[]> | null>(() => {
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

  // Smart trip planning query with route combinations
  const tripPlanQuery = useSmartTripPlan(
    tripOrigin,
    tripDestination,
    {
      departureTime: tripDepartureTime,
      departureDate: tripDepartureDate,
      maxWalkingDistance,
      maxTransfers,
      preference: optimizationPreference,
      includeNightBuses
    }
  );



  // Create a map of route_id -> RouteInfo for quick lookup
  const routeNamesMap = useMemo(() => {
    const routeMap = new Map<string, RouteInfo>();
    staticRoutesQuery.data?.data?.forEach(route => {
      routeMap.set(route.route_id, route);
    });
    return routeMap;
  }, [staticRoutesQuery.data]);

  // Delay notifications disabled - users can view delays in the dedicated "Καθυστερήσεις" tab
  // useDelayNotifications(
  //   effectiveTripsData?.data || [],
  //   routeNamesMap,
  //   delayNotificationsEnabled
  // );

  // Stop notifications - monitors arrivals at user's favorite stops
  const { notifications: stopNotificationSettings } = useStopNotifications();
  useStopArrivalNotifications(
    effectiveTripsData?.data || [],
    routeNamesMap,
    stopNotificationSettings,
    true
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

  // Use a ref to prevent loops between state updates and URL updates
  const isInternalUrlUpdate = useRef(false);

  // Handle deep links from URL parameters
  useEffect(() => {
    // If we just updated the URL from state, don't process these params again
    if (isInternalUrlUpdate.current) {
      console.log('[Index] Skipping sync from URL: update originated from state');
      isInternalUrlUpdate.current = false;
      return;
    }

    const routeParam = searchParams.get('route');
    const stopParam = searchParams.get('stop');

    let stateChanged = false;

    if (routeParam && routeParam !== 'all' && routeParam !== selectedRoute) {
      setSelectedRoute(routeParam);
      stateChanged = true;
    } else if (!routeParam && selectedRoute !== "all") {
      // URL cleared the route, update state
      setSelectedRoute("all");
      stateChanged = true;
    }

    if (stopParam && stopParam !== deepLinkStopId) {
      setDeepLinkStopId(stopParam);
      stateChanged = true;
    } else if (!stopParam && deepLinkStopId !== null) {
      // URL cleared the stop, update state
      setDeepLinkStopId(null);
      stateChanged = true;
    }

    if (stateChanged) {
      setActiveTab("map");
    }
  }, [searchParams]); // Only react to URL changes, not state changes

  // Update URL when route or stop changes
  const updateUrlParams = useCallback((params: { route?: string | null; stop?: string | null }) => {
    const newParams = new URLSearchParams(searchParams);
    let changed = false;

    if (params.route !== undefined) {
      const currentRoute = searchParams.get('route');
      const targetRoute = params.route === 'all' ? null : params.route;

      if (targetRoute !== currentRoute) {
        if (targetRoute) {
          newParams.set('route', targetRoute);
        } else {
          newParams.delete('route');
        }
        changed = true;
      }
    }

    if (params.stop !== undefined) {
      const currentStop = searchParams.get('stop');
      if (params.stop !== currentStop) {
        if (params.stop) {
          newParams.set('stop', params.stop);
        } else {
          newParams.delete('stop');
        }
        changed = true;
      }
    }

    if (changed) {
      console.log('[Index] Updating URL from state:', params);
      isInternalUrlUpdate.current = true;
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Update URL when route changes
  useEffect(() => {
    updateUrlParams({ route: selectedRoute });
  }, [selectedRoute]);

  // Filter data by selected route
  const filteredVehicles = useMemo(() => {
    const vehicles = effectiveVehiclesData?.data || [];
    if (selectedRoute === "all") return vehicles;

    // Robust comparison for route IDs (handle string/number differences)
    const filtered = vehicles.filter(v => String(v.routeId) === String(selectedRoute));

    // Notify if specific route selected but no vehicles found (and not loading)
    if (selectedRoute !== "all" && filtered.length === 0 && !isLoading && vehicles.length > 0) {
      // Debounce this or use a ref to prevent spamming, but for now helpful for debug
      console.log(`[Index] No vehicles found for route ${selectedRoute}`);
    }

    return filtered;
  }, [effectiveVehiclesData, selectedRoute, isLoading]);

  const filteredTrips = useMemo(() => {
    const trips = effectiveTripsData?.data || [];
    if (selectedRoute === "all") return trips;
    // Robust comparison for route IDs
    return trips.filter(t => String(t.routeId) === String(selectedRoute));
  }, [effectiveTripsData, selectedRoute]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);


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

  // Pull-to-refresh handler
  const handlePullRefresh = useCallback(async () => {
    toast.info('Ανανέωση δεδομένων...');
    await Promise.all([
      vehiclesQuery.refetch(),
      tripsQuery.refetch(),
      alertsQuery.refetch(),
    ]);
    toast.success('Τα δεδομένα ανανεώθηκαν');
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

  const handleRoutePlanRequest = (origin: { lat: number, lng: number }, destination: { lat: number, lng: number }) => {
    // Create temporary stop objects for the coordinates
    const originStop: StaticStop = {
      stop_id: 'custom-origin',
      stop_name: 'Επιλεγμένο Σημείο (Αφετηρία)',
      stop_lat: origin.lat,
      stop_lon: origin.lng
    };

    const destStop: StaticStop = {
      stop_id: 'custom-dest',
      stop_name: 'Επιλεγμένο Σημείο (Προορισμός)',
      stop_lat: destination.lat,
      stop_lon: destination.lng
    };

    setTripOrigin(originStop);
    setTripDestination(destStop);
    setTripDepartureTime('now');
    setTripDepartureDate(new Date());
    setShowTripResults(true);
  };



  // Listen for custom route selection events from children (e.g. Map components)
  useEffect(() => {
    const handleRouteSelection = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.routeId) {
        console.log('[Index] Received route selection event:', customEvent.detail.routeId);
        setSelectedRoute(customEvent.detail.routeId);
      }
    };

    window.addEventListener('selectRoute', handleRouteSelection);
    return () => {
      window.removeEventListener('selectRoute', handleRouteSelection);
    };
  }, []);

  const alertCount = alertsQuery.data?.data?.length || 0;

  return (
    <div className="h-[100dvh] flex flex-col bg-background overflow-hidden relative">

      <Header
        isDark={isDark}
        onToggleTheme={handleThemeToggle}
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
        onTripSearch={(origin, destination, departureTime, departureDate, _originLocation, _destLocation, options) => {
          setTripOrigin(origin);
          setTripDestination(destination);
          setTripDepartureTime(departureTime);
          setTripDepartureDate(departureDate);
          if (options) {
            setMaxWalkingDistance(options.maxWalkingDistance);
            setMaxTransfers(options.maxTransfers);
            setOptimizationPreference(options.preference);
            setIncludeNightBuses(options.includeNightBuses);
          }
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
        onOpenSavedTrips={() => setShowSavedTrips(true)}
        savedTripsCount={getUpcomingTrips().length}
        tripOrigin={tripOrigin}
        tripDestination={tripDestination}
        tripDepartureTime={tripDepartureTime}
        tripDepartureDate={tripDepartureDate}
        maxWalkingDistance={maxWalkingDistance}
        maxTransfers={maxTransfers}
        optimizationPreference={optimizationPreference}
        includeNightBuses={includeNightBuses}
      />

      {/* Saved Trips Panel */}
      <SavedTripsPanel
        isOpen={showSavedTrips}
        onClose={() => setShowSavedTrips(false)}
      />

      {/* Smart Trip Plan Results Modal */}
      {showTripResults && (
        <SmartTripResults
          origin={tripOrigin}
          destination={tripDestination}
          departureTime={tripDepartureTime}
          departureDate={tripDepartureDate}
          data={tripPlanQuery.data}
          isLoading={tripPlanQuery.isLoading}
          error={tripPlanQuery.error}
          onClose={() => window.history.back()}
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
          maxWalkingDistance={maxWalkingDistance}
          maxTransfers={maxTransfers}
          optimizationPreference={optimizationPreference}
          includeNightBuses={includeNightBuses}
          onParamsChange={(params) => {
            if (params.departureTime !== undefined) setTripDepartureTime(params.departureTime);
            if (params.departureDate !== undefined) setTripDepartureDate(params.departureDate);
            if (params.maxWalkingDistance !== undefined) setMaxWalkingDistance(params.maxWalkingDistance);
            if (params.maxTransfers !== undefined) setMaxTransfers(params.maxTransfers);
            if (params.optimizationPreference !== undefined) setOptimizationPreference(params.optimizationPreference as OptimizationPreference);
            if (params.includeNightBuses !== undefined) setIncludeNightBuses(params.includeNightBuses);
          }}
        />
      )}

      {hasError && (
        <ErrorBanner message={errorMessage || "Αποτυχία σύνδεσης"} onRetry={handleRetry} />
      )}

      <main className="flex-1 min-h-0 container mx-auto px-0 sm:px-[1rem] py-0 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <div className="flex-1 min-h-0 glass-card rounded-b-none sm:rounded-[1.5rem] overflow-hidden border-none shadow-2xl relative md:border-x md:border-t">
            <TabsContent value="map" className="h-full m-0">
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
                deepLinkStopId={deepLinkStopId}
                onStopPanelChange={(stopId) => {
                  updateUrlParams({ stop: stopId });
                  if (!stopId) setDeepLinkStopId(null);
                }}
                mapStyle={mapStyle}
                onMapStyleChange={handleMapStyleChange}
                onRoutePlanRequest={handleRoutePlanRequest}
              />

            </TabsContent>

            <TabsContent value="trips" className="h-full m-0 overflow-auto custom-scrollbar">
              <PullToRefresh onRefresh={handlePullRefresh} className="h-full">
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
              </PullToRefresh>
            </TabsContent>

            <TabsContent value="stops" className="h-full m-0 overflow-auto custom-scrollbar">
              <PullToRefresh onRefresh={handlePullRefresh} className="h-full">
                <StopsView
                  trips={filteredTrips}
                  stops={staticStopsQuery.data?.data || []}
                  routeNamesMap={routeNamesMap}
                  isLoading={tripsQuery.isLoading}
                  selectedOperator={selectedOperator}
                  onTripSelect={(trip) => {
                    if (trip.routeId) setSelectedRoute(trip.routeId);
                    if (trip.vehicleId) setFollowVehicleId(trip.vehicleId);
                    setActiveTab("map");
                  }}
                />
              </PullToRefresh>
            </TabsContent>

            <TabsContent value="schedule" className="h-full m-0 overflow-auto">
              <ScheduleView
                selectedOperator={selectedOperator}
                onOperatorChange={setSelectedOperator}
                selectedRoute={selectedRoute}
                onRouteSelect={(routeId) => {
                  setSelectedRoute(routeId);
                  setActiveTab("map");
                }}
                onUnsyncedRouteSelect={setSelectedRoute}
              />
            </TabsContent>

            <TabsContent value="alerts" className="h-full m-0">
              <PullToRefresh onRefresh={handlePullRefresh} className="h-full">
                <AlertsList
                  alerts={effectiveAlertsData?.data || []}
                  trips={filteredTrips}
                  routeNamesMap={routeNamesMap}
                  isLoading={alertsQuery.isLoading}
                />
              </PullToRefresh>
            </TabsContent>
          </div>

          <TabsList className="grid w-full grid-cols-5 h-auto md:h-12 flex-shrink-0 bg-card/90 backdrop-blur-xl rounded-none sm:rounded-[1.5rem] p-[0.375rem] md:p-1 shadow-2xl border-t sm:border border-white/10 pb-safe">
            <TabsTrigger value="map" className="flex flex-col items-center gap-[0.25rem] py-[0.5rem] px-0 rounded-[1.125rem] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
              <MapIcon className="h-[1.25em] w-[1.25em] text-emerald-500 data-[state=active]:text-inherit" />
              <span className="text-[0.65rem] font-bold leading-tight text-emerald-500 data-[state=active]:text-inherit">Χάρτης</span>
            </TabsTrigger>
            <TabsTrigger value="trips" className="flex flex-col items-center gap-[0.25rem] py-[0.5rem] px-0 rounded-[1.125rem] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
              <Route className="h-[1.25em] w-[1.25em] text-emerald-500 data-[state=active]:text-inherit" />
              <span className="text-[0.65rem] font-bold leading-tight text-emerald-500 data-[state=active]:text-inherit">Διαδρομές</span>
            </TabsTrigger>
            <TabsTrigger value="stops" className="flex flex-col items-center gap-[0.25rem] py-[0.5rem] px-0 rounded-[1.125rem] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
              <MapPin className="h-[1.25em] w-[1.25em] text-emerald-500 data-[state=active]:text-inherit" />
              <span className="text-[0.65rem] font-bold leading-tight text-emerald-500 data-[state=active]:text-inherit">Στάσεις</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex flex-col items-center gap-[0.25rem] py-[0.5rem] px-0 rounded-[1.125rem] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
              <Calendar className="h-[1.25em] w-[1.25em]" />
              <span className="text-[0.65rem] font-bold leading-tight">Πρόγραμμα</span>
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex flex-col items-center gap-[0.25rem] py-[0.5rem] px-0 relative rounded-[1.125rem] transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg">
              <Bell className="h-[1.25em] w-[1.25em] text-red-500 data-[state=active]:text-inherit" />
              <span className="text-[0.65rem] font-bold leading-tight text-red-500 data-[state=active]:text-inherit">Ειδοπ.</span>
              {alertCount > 0 && (
                <span className="absolute top-[0.375rem] right-[0.375rem] w-[1rem] h-[1rem] bg-destructive text-destructive-foreground text-[0.6rem] rounded-full flex items-center justify-center font-black border-2 border-background">
                  {alertCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </main>

      {/* Nearby Stops Panel - only show on map tab */}
      {activeTab === "map" && (
        <NearbyStopsPanel
          stops={staticStopsQuery.data?.data || []}
          trips={effectiveTripsData?.data || []}
          vehicles={effectiveVehiclesData?.data || []}
          routeNamesMap={routeNamesMap}
          onSelectVehicle={(vehicleId, _tripId, routeId) => {
            if (routeId) setSelectedRoute(routeId);
            setFollowVehicleId(vehicleId);
            setActiveTab("map");
          }}
          onStopSelect={(_stop) => {
            setActiveTab("map");
          }}
          onHighlightStop={(stop) => {
            // Pass highlighted stop to VehicleMap - will be implemented via state
            setHighlightedStop(stop);
          }}
        />
      )}

      {/* PWA Install Banner */}
      <PWAInstallBanner />

      {/* Accessibility Widget */}
      <AccessibilityWidget
        isEnabled={isAccessibilityEnhanced}
        onToggle={setIsAccessibilityEnhanced}
      />
    </div>
  );
};

export default Index;
