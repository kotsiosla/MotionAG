import { useQuery } from "@tanstack/react-query";
import type { StaticStop, RouteInfo } from "@/types/gtfs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface StopTimeInfo {
  trip_id: string;
  stop_id: string;
  stop_sequence: number;
  arrival_time?: string;
  departure_time?: string;
}

interface TripStaticInfo {
  trip_id: string;
  route_id: string;
  service_id: string;
  direction_id?: number;
  trip_headsign?: string;
  shape_id?: string;
}

export interface TripPlanResult {
  route: RouteInfo;
  trips: Array<{
    tripId: string;
    departureTime: string;
    arrivalTime: string;
    originStopSequence: number;
    destinationStopSequence: number;
    stopCount: number;
  }>;
}

// Transfer/multi-leg route
export interface TransferRoute {
  legs: Array<{
    route: RouteInfo;
    fromStop: { id: string; name: string };
    toStop: { id: string; name: string };
    departureTime?: string;
    arrivalTime?: string;
  }>;
  transferStop: { id: string; name: string };
  totalDuration?: number;
}

// Routes serving a specific stop
export interface StopRouteInfo {
  route: RouteInfo;
  nextDepartures: string[];
  direction?: string;
}

export interface TripPlanData {
  directRoutes: TripPlanResult[];
  transferRoutes: TransferRoute[];
  originStopRoutes: StopRouteInfo[];
  destinationStopRoutes: StopRouteInfo[];
  noDirectConnection: boolean;
}

async function fetchStopTimes(operatorId?: string): Promise<StopTimeInfo[]> {
  const params = operatorId && operatorId !== 'all' ? `?operator=${operatorId}` : '';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stop-times${params}`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch stop times');
  const result = await response.json();
  return result.data || [];
}

async function fetchTripsStatic(operatorId?: string): Promise<TripStaticInfo[]> {
  const params = operatorId && operatorId !== 'all' ? `?operator=${operatorId}` : '';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/trips-static${params}`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch static trips');
  const result = await response.json();
  return result.data || [];
}

async function fetchRoutes(operatorId?: string): Promise<RouteInfo[]> {
  const params = operatorId && operatorId !== 'all' ? `?operator=${operatorId}` : '';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/routes${params}`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch routes');
  const result = await response.json();
  return result.data || [];
}

async function fetchStops(operatorId?: string): Promise<StaticStop[]> {
  const params = operatorId && operatorId !== 'all' ? `?operator=${operatorId}` : '';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stops${params}`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch stops');
  const result = await response.json();
  return result.data || [];
}

export function useTripPlan(
  originStopId: string | null,
  destinationStopId: string | null,
  operatorId?: string,
  departureTime?: string,
  departureDate?: Date
) {
  return useQuery({
    queryKey: ['trip-plan', originStopId, destinationStopId, operatorId, departureTime, departureDate?.toDateString()],
    queryFn: async (): Promise<TripPlanResult[]> => {
      if (!originStopId || !destinationStopId) return [];

      const data = await fetchTripPlanData(originStopId, destinationStopId, operatorId, departureTime, departureDate);
      return data.directRoutes;
    },
    enabled: !!originStopId && !!destinationStopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

// Enhanced trip plan hook that includes transfers and stop info
export function useEnhancedTripPlan(
  originStopId: string | null,
  destinationStopId: string | null,
  operatorId?: string,
  departureTime?: string,
  departureDate?: Date
) {
  return useQuery({
    queryKey: ['enhanced-trip-plan', originStopId, destinationStopId, operatorId, departureTime, departureDate?.toDateString()],
    queryFn: async (): Promise<TripPlanData> => {
      if (!originStopId || !destinationStopId) {
        return {
          directRoutes: [],
          transferRoutes: [],
          originStopRoutes: [],
          destinationStopRoutes: [],
          noDirectConnection: false,
        };
      }

      return fetchTripPlanData(originStopId, destinationStopId, operatorId, departureTime, departureDate);
    },
    enabled: !!originStopId && !!destinationStopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

async function fetchTripPlanData(
  originStopId: string,
  destinationStopId: string,
  operatorId?: string,
  departureTime?: string,
  departureDate?: Date
): Promise<TripPlanData> {
  console.log(`Planning trip from ${originStopId} to ${destinationStopId}`);

  // Fetch all required data in parallel
  const [stopTimes, tripsStatic, routes, stops] = await Promise.all([
    fetchStopTimes(operatorId),
    fetchTripsStatic(operatorId),
    fetchRoutes(operatorId),
    fetchStops(operatorId),
  ]);

  console.log(`Loaded ${stopTimes.length} stop times, ${tripsStatic.length} trips, ${routes.length} routes`);

  // Build maps for faster lookup
  const routeMap = new Map<string, RouteInfo>();
  routes.forEach(r => routeMap.set(r.route_id, r));

  const stopMap = new Map<string, StaticStop>();
  stops.forEach(s => stopMap.set(s.stop_id, s));

  const tripRouteMap = new Map<string, string>();
  const tripHeadsignMap = new Map<string, string>();
  tripsStatic.forEach(t => {
    tripRouteMap.set(t.trip_id, t.route_id);
    if (t.trip_headsign) tripHeadsignMap.set(t.trip_id, t.trip_headsign);
  });

  // Group stop times by trip
  const stopTimesByTrip = new Map<string, StopTimeInfo[]>();
  stopTimes.forEach(st => {
    if (!stopTimesByTrip.has(st.trip_id)) {
      stopTimesByTrip.set(st.trip_id, []);
    }
    stopTimesByTrip.get(st.trip_id)!.push(st);
  });

  // Group stop times by stop (for finding routes at each stop)
  const stopTimesByStop = new Map<string, StopTimeInfo[]>();
  stopTimes.forEach(st => {
    if (!stopTimesByStop.has(st.stop_id)) {
      stopTimesByStop.set(st.stop_id, []);
    }
    stopTimesByStop.get(st.stop_id)!.push(st);
  });

  // Get current time filter
  const today = new Date();
  const isToday = departureDate ? departureDate.toDateString() === today.toDateString() : true;
  let filterTimeStr: string;
  if (!departureTime || departureTime === 'now') {
    if (isToday) {
      filterTimeStr = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}:00`;
    } else {
      filterTimeStr = '00:00:00';
    }
  } else {
    filterTimeStr = `${departureTime}:00`;
  }

  // Find direct routes
  const matchingTrips: Array<{
    tripId: string;
    routeId: string;
    originStop: StopTimeInfo;
    destinationStop: StopTimeInfo;
  }> = [];

  stopTimesByTrip.forEach((tripStopTimes, tripId) => {
    tripStopTimes.sort((a, b) => a.stop_sequence - b.stop_sequence);
    const originIdx = tripStopTimes.findIndex(st => st.stop_id === originStopId);
    const destIdx = tripStopTimes.findIndex(st => st.stop_id === destinationStopId);

    if (originIdx !== -1 && destIdx !== -1 && originIdx < destIdx) {
      const routeId = tripRouteMap.get(tripId);
      if (routeId) {
        matchingTrips.push({
          tripId,
          routeId,
          originStop: tripStopTimes[originIdx],
          destinationStop: tripStopTimes[destIdx],
        });
      }
    }
  });

  // Group by route for direct connections
  const tripsByRoute = new Map<string, typeof matchingTrips>();
  matchingTrips.forEach(t => {
    if (!tripsByRoute.has(t.routeId)) {
      tripsByRoute.set(t.routeId, []);
    }
    tripsByRoute.get(t.routeId)!.push(t);
  });

  // Build direct route results
  const directRoutes: TripPlanResult[] = [];
  tripsByRoute.forEach((routeTrips, routeId) => {
    const route = routeMap.get(routeId);
    if (!route) return;

    const sortedTrips = routeTrips
      .filter(t => t.originStop.departure_time)
      .sort((a, b) => {
        const timeA = a.originStop.departure_time || '99:99:99';
        const timeB = b.originStop.departure_time || '99:99:99';
        return timeA.localeCompare(timeB);
      });

    const upcomingTrips = sortedTrips
      .filter(t => (t.originStop.departure_time || '') >= filterTimeStr)
      .slice(0, 5);

    if (upcomingTrips.length > 0) {
      directRoutes.push({
        route,
        trips: upcomingTrips.map(t => ({
          tripId: t.tripId,
          departureTime: t.originStop.departure_time || '',
          arrivalTime: t.destinationStop.arrival_time || '',
          originStopSequence: t.originStop.stop_sequence,
          destinationStopSequence: t.destinationStop.stop_sequence,
          stopCount: t.destinationStop.stop_sequence - t.originStop.stop_sequence,
        })),
      });
    }
  });

  directRoutes.sort((a, b) => {
    const timeA = a.trips[0]?.departureTime || '99:99:99';
    const timeB = b.trips[0]?.departureTime || '99:99:99';
    return timeA.localeCompare(timeB);
  });

  // Find routes serving origin stop
  const originStopRoutes = findRoutesAtStop(
    originStopId, 
    stopTimesByStop, 
    tripRouteMap, 
    routeMap, 
    tripHeadsignMap,
    filterTimeStr
  );

  // Find routes serving destination stop
  const destinationStopRoutes = findRoutesAtStop(
    destinationStopId, 
    stopTimesByStop, 
    tripRouteMap, 
    routeMap, 
    tripHeadsignMap,
    filterTimeStr
  );

  // Find transfer routes if no direct connection
  let transferRoutes: TransferRoute[] = [];
  if (directRoutes.length === 0) {
    transferRoutes = findTransferRoutes(
      originStopId,
      destinationStopId,
      stopTimesByTrip,
      stopTimesByStop,
      tripRouteMap,
      routeMap,
      stopMap,
      filterTimeStr
    );
  }

  console.log(`Found ${directRoutes.length} direct routes, ${transferRoutes.length} transfer routes`);

  return {
    directRoutes,
    transferRoutes,
    originStopRoutes,
    destinationStopRoutes,
    noDirectConnection: directRoutes.length === 0,
  };
}

function findRoutesAtStop(
  stopId: string,
  stopTimesByStop: Map<string, StopTimeInfo[]>,
  tripRouteMap: Map<string, string>,
  routeMap: Map<string, RouteInfo>,
  tripHeadsignMap: Map<string, string>,
  filterTimeStr: string
): StopRouteInfo[] {
  const stopTimes = stopTimesByStop.get(stopId) || [];
  
  // Group by route
  const routeDepartures = new Map<string, { times: string[]; headsign?: string }>();
  
  stopTimes.forEach(st => {
    const routeId = tripRouteMap.get(st.trip_id);
    if (!routeId) return;
    
    const depTime = st.departure_time || st.arrival_time;
    if (!depTime || depTime < filterTimeStr) return;
    
    if (!routeDepartures.has(routeId)) {
      routeDepartures.set(routeId, { times: [], headsign: tripHeadsignMap.get(st.trip_id) });
    }
    routeDepartures.get(routeId)!.times.push(depTime);
  });

  const results: StopRouteInfo[] = [];
  routeDepartures.forEach((data, routeId) => {
    const route = routeMap.get(routeId);
    if (!route) return;

    // Sort and take next 3 departures
    const sortedTimes = [...new Set(data.times)].sort().slice(0, 3);
    
    results.push({
      route,
      nextDepartures: sortedTimes.map(t => t.substring(0, 5)),
      direction: data.headsign,
    });
  });

  // Sort by route short name
  results.sort((a, b) => (a.route.route_short_name || '').localeCompare(b.route.route_short_name || ''));

  return results;
}

function findTransferRoutes(
  originStopId: string,
  destinationStopId: string,
  stopTimesByTrip: Map<string, StopTimeInfo[]>,
  stopTimesByStop: Map<string, StopTimeInfo[]>,
  tripRouteMap: Map<string, string>,
  routeMap: Map<string, RouteInfo>,
  stopMap: Map<string, StaticStop>,
  filterTimeStr: string
): TransferRoute[] {
  // Find all stops reachable from origin
  const stopsFromOrigin = new Map<string, { routeId: string; arrivalTime: string }>();
  
  stopTimesByTrip.forEach((tripStopTimes, tripId) => {
    tripStopTimes.sort((a, b) => a.stop_sequence - b.stop_sequence);
    const originIdx = tripStopTimes.findIndex(st => st.stop_id === originStopId);
    
    if (originIdx !== -1) {
      const depTime = tripStopTimes[originIdx].departure_time;
      if (!depTime || depTime < filterTimeStr) return;
      
      const routeId = tripRouteMap.get(tripId);
      if (!routeId) return;

      // Mark all stops after origin as reachable
      for (let i = originIdx + 1; i < tripStopTimes.length; i++) {
        const st = tripStopTimes[i];
        const existing = stopsFromOrigin.get(st.stop_id);
        if (!existing || (st.arrival_time && st.arrival_time < existing.arrivalTime)) {
          stopsFromOrigin.set(st.stop_id, { 
            routeId, 
            arrivalTime: st.arrival_time || '' 
          });
        }
      }
    }
  });

  // Find all stops that can reach destination
  const stopsToDestination = new Map<string, { routeId: string; departureTime: string }>();
  
  stopTimesByTrip.forEach((tripStopTimes, tripId) => {
    tripStopTimes.sort((a, b) => a.stop_sequence - b.stop_sequence);
    const destIdx = tripStopTimes.findIndex(st => st.stop_id === destinationStopId);
    
    if (destIdx !== -1) {
      const routeId = tripRouteMap.get(tripId);
      if (!routeId) return;

      // Mark all stops before destination as potential transfers
      for (let i = 0; i < destIdx; i++) {
        const st = tripStopTimes[i];
        const depTime = st.departure_time;
        if (!depTime) continue;

        const existing = stopsToDestination.get(st.stop_id);
        if (!existing || depTime < existing.departureTime) {
          stopsToDestination.set(st.stop_id, { 
            routeId, 
            departureTime: depTime 
          });
        }
      }
    }
  });

  // Find common stops (transfer points)
  const transferRoutes: TransferRoute[] = [];
  const seenTransfers = new Set<string>();

  stopsFromOrigin.forEach((fromOriginData, transferStopId) => {
    const toDestData = stopsToDestination.get(transferStopId);
    if (!toDestData) return;
    
    // Check timing - arrival at transfer must be before departure to destination
    if (fromOriginData.arrivalTime && toDestData.departureTime) {
      if (fromOriginData.arrivalTime > toDestData.departureTime) return;
    }

    // Skip if same route (would be direct)
    if (fromOriginData.routeId === toDestData.routeId) return;

    const transferKey = `${fromOriginData.routeId}-${toDestData.routeId}-${transferStopId}`;
    if (seenTransfers.has(transferKey)) return;
    seenTransfers.add(transferKey);

    const route1 = routeMap.get(fromOriginData.routeId);
    const route2 = routeMap.get(toDestData.routeId);
    const transferStop = stopMap.get(transferStopId);
    const originStop = stopMap.get(originStopId);
    const destStop = stopMap.get(destinationStopId);

    if (!route1 || !route2 || !transferStop || !originStop || !destStop) return;

    transferRoutes.push({
      legs: [
        {
          route: route1,
          fromStop: { id: originStopId, name: originStop.stop_name },
          toStop: { id: transferStopId, name: transferStop.stop_name },
          arrivalTime: fromOriginData.arrivalTime,
        },
        {
          route: route2,
          fromStop: { id: transferStopId, name: transferStop.stop_name },
          toStop: { id: destinationStopId, name: destStop.stop_name },
          departureTime: toDestData.departureTime,
        },
      ],
      transferStop: { id: transferStopId, name: transferStop.stop_name },
    });
  });

  // Sort by earliest arrival at transfer point
  transferRoutes.sort((a, b) => {
    const timeA = a.legs[0].arrivalTime || '99:99';
    const timeB = b.legs[0].arrivalTime || '99:99';
    return timeA.localeCompare(timeB);
  });

  // Limit to top 5 transfer options
  return transferRoutes.slice(0, 5);
}
