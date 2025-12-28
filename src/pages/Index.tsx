import { useState, useEffect, useMemo } from "react";
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
import { useVehicles, useTrips, useAlerts, useStaticRoutes, useStaticStops } from "@/hooks/useGtfsData";
import { useTripPlan } from "@/hooks/useTripPlan";
import { useFavoriteRoutes } from "@/hooks/useFavoriteRoutes";
import { useDelayNotifications } from "@/hooks/useDelayNotifications";
import type { RouteInfo, StaticStop } from "@/types/gtfs";
import { toast } from "sonner";

const Index = () => {
  const [isDark, setIsDark] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(10);
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
  
  // Favorites
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavoriteRoutes();

  const vehiclesQuery = useVehicles(refreshInterval, selectedOperator);
  const tripsQuery = useTrips(refreshInterval, selectedOperator);
  const alertsQuery = useAlerts(refreshInterval, selectedOperator);
  const staticRoutesQuery = useStaticRoutes(selectedOperator);
  const staticStopsQuery = useStaticStops(selectedOperator);
  
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
    tripsQuery.data?.data || [],
    routeNamesMap,
    true // enabled
  );

  // Get routes with active vehicles/trips
  const liveRoutes = useMemo(() => {
    const routeSet = new Set<string>();
    vehiclesQuery.data?.data?.forEach(v => {
      if (v.routeId) routeSet.add(v.routeId);
    });
    tripsQuery.data?.data?.forEach(t => {
      if (t.routeId) routeSet.add(t.routeId);
    });
    return routeSet;
  }, [vehiclesQuery.data, tripsQuery.data]);

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
    const vehicles = vehiclesQuery.data?.data || [];
    if (selectedRoute === "all") return vehicles;
    return vehicles.filter(v => v.routeId === selectedRoute);
  }, [vehiclesQuery.data, selectedRoute]);

  const filteredTrips = useMemo(() => {
    const trips = tripsQuery.data?.data || [];
    if (selectedRoute === "all") return trips;
    return trips.filter(t => t.routeId === selectedRoute);
  }, [tripsQuery.data, selectedRoute]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const isLoading = vehiclesQuery.isLoading || tripsQuery.isLoading || alertsQuery.isLoading;
  const hasError = vehiclesQuery.isError || tripsQuery.isError || alertsQuery.isError;
  const errorMessage = vehiclesQuery.error?.message || tripsQuery.error?.message || alertsQuery.error?.message;

  const lastUpdate = Math.max(
    vehiclesQuery.data?.timestamp || 0,
    tripsQuery.data?.timestamp || 0,
    alertsQuery.data?.timestamp || 0
  );

  const handleRetry = () => {
    vehiclesQuery.refetch();
    tripsQuery.refetch();
    alertsQuery.refetch();
  };

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
              />
            </TabsContent>

            <TabsContent value="trips" className="h-[calc(100vh-240px)] sm:h-[calc(100vh-220px)] m-0">
              <TripsTable
                trips={filteredTrips}
                isLoading={tripsQuery.isLoading}
                routeNames={routeNamesMap}
              />
            </TabsContent>

            <TabsContent value="stops" className="h-[calc(100vh-240px)] sm:h-[calc(100vh-220px)] m-0">
              <StopsView
                trips={filteredTrips}
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
                alerts={alertsQuery.data?.data || []}
                trips={filteredTrips}
                routeNamesMap={routeNamesMap}
                isLoading={alertsQuery.isLoading}
              />
            </TabsContent>
          </div>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
