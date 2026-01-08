import { useQuery } from "@tanstack/react-query";
import type { StaticStop, RouteInfo } from "@/types/gtfs";
import { OPERATORS, REGION_KEYWORDS, INTERCITY_STATIONS } from "@/types/gtfs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jftthfniwfarxyisszjh.supabase.co';

const getSupabaseKey = () => {
  return import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 
    (typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '');
};

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

// Multi-city journey suggestion (local + intercity + local)
export interface InterCityJourney {
  originRegion: string;
  destinationRegion: string;
  localToIntercityStation: {
    routes: StopRouteInfo[];
    stationStop?: StaticStop;
  };
  intercityRoutes: StopRouteInfo[];
  intercityFromStation?: StaticStop;
  intercityToStation?: StaticStop;
  localFromIntercityStation: {
    routes: StopRouteInfo[];
    stationStop?: StaticStop;
  };
  description: string;
}

export interface TripPlanData {
  directRoutes: TripPlanResult[];
  transferRoutes: TransferRoute[];
  originStopRoutes: StopRouteInfo[];
  destinationStopRoutes: StopRouteInfo[];
  noDirectConnection: boolean;
  interCityJourney?: InterCityJourney;
}

async function fetchStopTimes(operatorId?: string): Promise<StopTimeInfo[]> {
  const params = operatorId && operatorId !== 'all' ? `?operator=${operatorId}` : '';
  
  try {
    // Add timeout of 60 seconds for large data
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stop-times${params}`, {
      headers: {
        'Authorization': `Bearer ${getSupabaseKey()}`,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      let errorMessage = 'Failed to fetch stop times';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        errorMessage = `Failed to fetch stop times (${response.status} ${response.statusText})`;
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - Το αρχείο είναι πολύ μεγάλο. Παρακαλώ δοκιμάστε ξανά.');
    }
    throw error;
  }
}

async function fetchTripsStatic(operatorId?: string): Promise<TripStaticInfo[]> {
  const params = operatorId && operatorId !== 'all' ? `?operator=${operatorId}` : '';
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/trips-static${params}`, {
    headers: {
      'Authorization': `Bearer ${getSupabaseKey()}`,
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
      'Authorization': `Bearer ${getSupabaseKey()}`,
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
      'Authorization': `Bearer ${getSupabaseKey()}`,
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

  // For trip planning, always fetch ALL operators' data to support inter-city journeys
  // This ensures we can suggest intercity buses even when a specific operator is selected
  const [stopTimes, tripsStatic, routes, stops] = await Promise.all([
    fetchStopTimes(), // All operators
    fetchTripsStatic(), // All operators
    fetchRoutes(), // All operators
    fetchStops(), // All operators
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

  // Detect if origin and destination are in different regions (inter-city journey)
  const originStop = stopMap.get(originStopId);
  const destStop = stopMap.get(destinationStopId);
  
  let interCityJourney: InterCityJourney | undefined;
  
  if (originStop && destStop) {
    const originRegion = detectRegion(originStop.stop_name);
    const destRegion = detectRegion(destStop.stop_name);
    
    console.log(`Origin region: ${originRegion}, Destination region: ${destRegion}`);
    
    // If different regions, suggest inter-city journey
    if (originRegion && destRegion && originRegion !== destRegion) {
      interCityJourney = buildInterCityJourney(
        originStop,
        destStop,
        originRegion,
        destRegion,
        stops,
        stopTimesByStop,
        tripRouteMap,
        routeMap,
        tripHeadsignMap,
        filterTimeStr
      );
    }
  }

  console.log(`Found ${directRoutes.length} direct routes, ${transferRoutes.length} transfer routes${interCityJourney ? ', inter-city journey available' : ''}`);

  return {
    directRoutes,
    transferRoutes,
    originStopRoutes,
    destinationStopRoutes,
    noDirectConnection: directRoutes.length === 0,
    interCityJourney,
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

// Detect which region a stop belongs to based on its name
function detectRegion(stopName: string): string | null {
  const lowerName = stopName.toLowerCase();
  
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        return region;
      }
    }
  }
  
  return null;
}

// Find intercity stations in a region
function findIntercityStations(
  region: string,
  stops: StaticStop[]
): StaticStop[] {
  const stationKeywords = INTERCITY_STATIONS[region] || [];
  const found: StaticStop[] = [];
  
  for (const stop of stops) {
    const lowerName = stop.stop_name.toLowerCase();
    for (const keyword of stationKeywords) {
      if (lowerName.includes(keyword.toLowerCase())) {
        found.push(stop);
        break;
      }
    }
  }
  
  return found;
}

// Get local operator for a region
function getLocalOperator(region: string): string | null {
  const op = OPERATORS.find(o => o.region === region);
  return op?.id || null;
}

// Get intercity operator
function getIntercityOperators(): string[] {
  return OPERATORS.filter(o => o.isIntercity).map(o => o.id);
}

// Build inter-city journey suggestion
function buildInterCityJourney(
  originStop: StaticStop,
  destStop: StaticStop,
  originRegion: string,
  destRegion: string,
  stops: StaticStop[],
  stopTimesByStop: Map<string, StopTimeInfo[]>,
  tripRouteMap: Map<string, string>,
  routeMap: Map<string, RouteInfo>,
  tripHeadsignMap: Map<string, string>,
  filterTimeStr: string
): InterCityJourney {
  // Find intercity stations in both regions
  const originIntercityStations = findIntercityStations(originRegion, stops);
  const destIntercityStations = findIntercityStations(destRegion, stops);
  
  // Get operators
  const originLocalOp = getLocalOperator(originRegion);
  const destLocalOp = getLocalOperator(destRegion);
  const intercityOps = getIntercityOperators();
  
  // Find routes from origin stop (local buses in origin city)
  const localToIntercityRoutes: StopRouteInfo[] = [];
  const stopTimes = stopTimesByStop.get(originStop.stop_id) || [];
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
  
  routeDepartures.forEach((data, routeId) => {
    const route = routeMap.get(routeId);
    if (!route) return;
    
    const sortedTimes = [...new Set(data.times)].sort().slice(0, 3);
    localToIntercityRoutes.push({
      route,
      nextDepartures: sortedTimes.map(t => t.substring(0, 5)),
      direction: data.headsign,
    });
  });
  
  // Find intercity routes (routes from operator 5 or 11)
  const intercityRoutes: StopRouteInfo[] = [];
  const intercityStops = [...originIntercityStations, ...destIntercityStations];
  const seenRoutes = new Set<string>();
  
  for (const station of intercityStops) {
    const stationStopTimes = stopTimesByStop.get(station.stop_id) || [];
    
    stationStopTimes.forEach(st => {
      const routeId = tripRouteMap.get(st.trip_id);
      if (!routeId || seenRoutes.has(routeId)) return;
      
      const route = routeMap.get(routeId);
      if (!route) return;
      
      // Check if this is an intercity route (route name often contains city names)
      const routeName = (route.route_long_name || '').toLowerCase();
      const isIntercity = 
        routeName.includes('λευκωσ') || 
        routeName.includes('λεμεσ') || 
        routeName.includes('λάρνακ') || 
        routeName.includes('πάφο') ||
        routeName.includes('αμμόχωστ') ||
        routeName.includes('nicosia') ||
        routeName.includes('limassol') ||
        routeName.includes('larnaca') ||
        routeName.includes('paphos');
      
      if (isIntercity) {
        seenRoutes.add(routeId);
        const depTime = st.departure_time || st.arrival_time;
        
        intercityRoutes.push({
          route,
          nextDepartures: depTime ? [depTime.substring(0, 5)] : [],
          direction: tripHeadsignMap.get(st.trip_id),
        });
      }
    });
  }
  
  // Find routes at destination stop (local buses in destination city)
  const localFromIntercityRoutes: StopRouteInfo[] = [];
  const destStopTimes = stopTimesByStop.get(destStop.stop_id) || [];
  const destRouteDepartures = new Map<string, { times: string[]; headsign?: string }>();
  
  destStopTimes.forEach(st => {
    const routeId = tripRouteMap.get(st.trip_id);
    if (!routeId) return;
    
    const depTime = st.departure_time || st.arrival_time;
    if (!depTime) return;
    
    if (!destRouteDepartures.has(routeId)) {
      destRouteDepartures.set(routeId, { times: [], headsign: tripHeadsignMap.get(st.trip_id) });
    }
    destRouteDepartures.get(routeId)!.times.push(depTime);
  });
  
  destRouteDepartures.forEach((data, routeId) => {
    const route = routeMap.get(routeId);
    if (!route) return;
    
    const sortedTimes = [...new Set(data.times)].sort().slice(0, 3);
    localFromIntercityRoutes.push({
      route,
      nextDepartures: sortedTimes.map(t => t.substring(0, 5)),
      direction: data.headsign,
    });
  });
  
  // Build region names for display
  const regionNames: Record<string, string> = {
    nicosia: 'Λευκωσία',
    limassol: 'Λεμεσός',
    larnaca: 'Λάρνακα',
    paphos: 'Πάφος',
    famagusta: 'Αμμόχωστος',
  };
  
  const originRegionName = regionNames[originRegion] || originRegion;
  const destRegionName = regionNames[destRegion] || destRegion;
  
  return {
    originRegion,
    destinationRegion: destRegion,
    localToIntercityStation: {
      routes: localToIntercityRoutes.slice(0, 4),
      stationStop: originIntercityStations[0],
    },
    intercityRoutes: intercityRoutes.slice(0, 4),
    intercityFromStation: originIntercityStations[0],
    intercityToStation: destIntercityStations[0],
    localFromIntercityStation: {
      routes: localFromIntercityRoutes.slice(0, 4),
      stationStop: destIntercityStations[0],
    },
    description: `Για να φτάσετε από ${originRegionName} στη ${destRegionName}, μπορείτε να χρησιμοποιήσετε τοπικά λεωφορεία για να φτάσετε στον υπεραστικό σταθμό, υπεραστικό λεωφορείο για τη μεταφορά μεταξύ πόλεων, και τοπικά λεωφορεία στον προορισμό σας.`,
  };
}
