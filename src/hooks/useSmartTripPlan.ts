import { useQuery } from "@tanstack/react-query";
import type { StaticStop, RouteInfo } from "@/types/gtfs";

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

// A single leg of a journey
export interface JourneyLeg {
  type: 'walk' | 'bus';
  // For bus legs
  route?: RouteInfo;
  fromStop?: StaticStop;
  toStop?: StaticStop;
  departureTime?: string;
  arrivalTime?: string;
  stopCount?: number;
  tripId?: string;
  // For walking legs
  walkingMeters?: number;
  walkingMinutes?: number;
  fromLocation?: { lat: number; lon: number; name: string };
  toLocation?: { lat: number; lon: number; name: string };
}

// Complete journey option
export interface JourneyOption {
  legs: JourneyLeg[];
  totalDurationMinutes: number;
  totalWalkingMinutes: number;
  totalBusMinutes: number;
  transferCount: number;
  departureTime: string;
  arrivalTime: string;
  score: number; // Lower is better (considers time, transfers, walking)
}

export interface SmartTripPlanData {
  journeyOptions: JourneyOption[];
  noRouteFound: boolean;
  searchedStops: number;
  message?: string;
}

// Calculate distance between two points in meters (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Calculate walking time in minutes (average walking speed: 5 km/h)
function calculateWalkingMinutes(meters: number): number {
  return Math.ceil(meters / 83.33); // 5 km/h = 83.33 m/min
}

// Parse time string "HH:MM:SS" to minutes since midnight
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

// Find nearby stops within a radius (in meters). If maxRadius is 0, use a large default (5km) to find all reasonable stops
function findNearbyStops(
  lat: number,
  lon: number,
  stops: StaticStop[],
  maxRadius: number = 0 // 0 means unlimited (use 5km default)
): Array<{ stop: StaticStop; distance: number }> {
  const effectiveRadius = maxRadius === 0 ? 5000 : maxRadius; // 5km when unlimited
  const nearby: Array<{ stop: StaticStop; distance: number }> = [];
  
  for (const stop of stops) {
    if (!stop.stop_lat || !stop.stop_lon) continue;
    const distance = calculateDistance(lat, lon, stop.stop_lat, stop.stop_lon);
    if (distance <= effectiveRadius) {
      nearby.push({ stop, distance });
    }
  }
  
  // Sort by distance
  nearby.sort((a, b) => a.distance - b.distance);
  return nearby;
}

async function fetchStopTimes(retryCount = 0): Promise<StopTimeInfo[]> {
  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 90000; // 90 seconds
  
  try {
    // Add timeout for large data
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stop-times`, {
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
      
      // Retry on 500 errors or network errors
      if ((response.status >= 500 || response.status === 0) && retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.log(`Retrying stop-times fetch (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchStopTimes(retryCount + 1);
      }
      
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    return result.data || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Retry on timeout
      if (retryCount < MAX_RETRIES) {
        const delay = Math.pow(2, retryCount) * 1000;
        console.log(`Retrying stop-times fetch after timeout (attempt ${retryCount + 1}/${MAX_RETRIES}) after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchStopTimes(retryCount + 1);
      }
      throw new Error('Request timeout - Το αρχείο είναι πολύ μεγάλο. Παρακαλώ δοκιμάστε ξανά σε λίγο.');
    }
    throw error;
  }
}

async function fetchTripsStatic(): Promise<TripStaticInfo[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/trips-static`, {
    headers: {
      'Authorization': `Bearer ${getSupabaseKey()}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch static trips');
  const result = await response.json();
  return result.data || [];
}

async function fetchRoutes(): Promise<RouteInfo[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/routes`, {
    headers: {
      'Authorization': `Bearer ${getSupabaseKey()}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch routes');
  const result = await response.json();
  return result.data || [];
}

async function fetchStops(): Promise<StaticStop[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stops`, {
    headers: {
      'Authorization': `Bearer ${getSupabaseKey()}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch stops');
  const result = await response.json();
  return result.data || [];
}

// Build a graph of which routes serve which stops
interface RouteStopGraph {
  // stop_id -> array of { route_id, trips with times }
  stopToRoutes: Map<string, Array<{
    routeId: string;
    tripId: string;
    departureTime: string;
    stopSequence: number;
  }>>;
  // route_id -> ordered stops with times
  routeStops: Map<string, Array<{
    stopId: string;
    tripId: string;
    arrivalTime: string;
    departureTime: string;
    stopSequence: number;
  }>>;
}

function buildGraph(
  stopTimes: StopTimeInfo[],
  tripRouteMap: Map<string, string>
): RouteStopGraph {
  const stopToRoutes = new Map<string, Array<{
    routeId: string;
    tripId: string;
    departureTime: string;
    stopSequence: number;
  }>>();
  
  const routeStops = new Map<string, Array<{
    stopId: string;
    tripId: string;
    arrivalTime: string;
    departureTime: string;
    stopSequence: number;
  }>>();
  
  for (const st of stopTimes) {
    const routeId = tripRouteMap.get(st.trip_id);
    if (!routeId) continue;
    
    // Add to stop -> routes map
    if (!stopToRoutes.has(st.stop_id)) {
      stopToRoutes.set(st.stop_id, []);
    }
    stopToRoutes.get(st.stop_id)!.push({
      routeId,
      tripId: st.trip_id,
      departureTime: st.departure_time || st.arrival_time || '',
      stopSequence: st.stop_sequence,
    });
    
    // Add to route -> stops map
    if (!routeStops.has(routeId)) {
      routeStops.set(routeId, []);
    }
    routeStops.get(routeId)!.push({
      stopId: st.stop_id,
      tripId: st.trip_id,
      arrivalTime: st.arrival_time || '',
      departureTime: st.departure_time || '',
      stopSequence: st.stop_sequence,
    });
  }
  
  return { stopToRoutes, routeStops };
}

// Find journeys using improved algorithm
function findJourneys(
  originStop: StaticStop,
  destStop: StaticStop,
  originLocation: { lat: number; lon: number } | null,
  destLocation: { lat: number; lon: number } | null,
  stops: StaticStop[],
  stopTimes: StopTimeInfo[],
  tripRouteMap: Map<string, string>,
  routeMap: Map<string, RouteInfo>,
  stopMap: Map<string, StaticStop>,
  filterTimeStr: string,
  maxWalkingDistance: number = 0, // 0 means unlimited
  maxTransfers: number = 2
): JourneyOption[] {
  const journeys: JourneyOption[] = [];
  
  // Group stop times by trip
  const stopTimesByTrip = new Map<string, StopTimeInfo[]>();
  stopTimes.forEach(st => {
    if (!stopTimesByTrip.has(st.trip_id)) {
      stopTimesByTrip.set(st.trip_id, []);
    }
    stopTimesByTrip.get(st.trip_id)!.push(st);
  });
  
  // Sort each trip's stops by sequence
  stopTimesByTrip.forEach(tripStops => {
    tripStops.sort((a, b) => a.stop_sequence - b.stop_sequence);
  });

  // Create a map of stop_id -> which routes serve it
  const stopToRoutes = new Map<string, Set<string>>();
  stopTimes.forEach(st => {
    const routeId = tripRouteMap.get(st.trip_id);
    if (!routeId) return;
    if (!stopToRoutes.has(st.stop_id)) {
      stopToRoutes.set(st.stop_id, new Set());
    }
    stopToRoutes.get(st.stop_id)!.add(routeId);
  });
  
  // Determine effective walking radius
  const effectiveRadius = maxWalkingDistance === 0 ? 5000 : maxWalkingDistance;
  
  // Find all stops near origin
  const originNearbyStops = findNearbyStops(
    originStop.stop_lat || 0, 
    originStop.stop_lon || 0, 
    stops, 
    effectiveRadius
  );
  
  // Find all stops near destination  
  const destNearbyStops = findNearbyStops(
    destStop.stop_lat || 0, 
    destStop.stop_lon || 0, 
    stops, 
    effectiveRadius
  );
  
  // Always include the origin and dest stops themselves
  if (!originNearbyStops.find(n => n.stop.stop_id === originStop.stop_id)) {
    originNearbyStops.unshift({ stop: originStop, distance: 0 });
  }
  if (!destNearbyStops.find(n => n.stop.stop_id === destStop.stop_id)) {
    destNearbyStops.unshift({ stop: destStop, distance: 0 });
  }
  
  console.log(`Origin: ${originStop.stop_name} with ${originNearbyStops.length} nearby stops`);
  console.log(`Destination: ${destStop.stop_name} with ${destNearbyStops.length} nearby stops`);
  
  // Build set of destination stop IDs for quick lookup
  const destStopIds = new Set(destNearbyStops.map(n => n.stop.stop_id));
  const originStopIds = new Set(originNearbyStops.map(n => n.stop.stop_id));
  
  // STEP 1: Find DIRECT routes
  // For each trip, check if it goes through any origin stop and any destination stop
  stopTimesByTrip.forEach((tripStops, tripId) => {
    const routeId = tripRouteMap.get(tripId);
    if (!routeId) return;
    const route = routeMap.get(routeId);
    if (!route) return;
    
    // Find all stops in this trip that are near origin
    const originMatches: Array<{ idx: number; st: StopTimeInfo; nearbyInfo: { stop: StaticStop; distance: number } }> = [];
    // Find all stops in this trip that are near destination
    const destMatches: Array<{ idx: number; st: StopTimeInfo; nearbyInfo: { stop: StaticStop; distance: number } }> = [];
    
    tripStops.forEach((st, idx) => {
      const originNearby = originNearbyStops.find(n => n.stop.stop_id === st.stop_id);
      if (originNearby) {
        originMatches.push({ idx, st, nearbyInfo: originNearby });
      }
      const destNearby = destNearbyStops.find(n => n.stop.stop_id === st.stop_id);
      if (destNearby) {
        destMatches.push({ idx, st, nearbyInfo: destNearby });
      }
    });
    
    // Check all origin -> dest combinations where origin comes before dest
    for (const originMatch of originMatches) {
      for (const destMatch of destMatches) {
        if (originMatch.idx >= destMatch.idx) continue; // Origin must be before dest
        
        const depTime = originMatch.st.departure_time || originMatch.st.arrival_time || '';
        if (!depTime || depTime < filterTimeStr) continue;
        
        const arrTime = destMatch.st.arrival_time || destMatch.st.departure_time || '';
        
        const legs: JourneyLeg[] = [];
        
        // Walking to boarding stop if needed
        if (originMatch.nearbyInfo.distance > 50) {
          legs.push({
            type: 'walk',
            walkingMeters: originMatch.nearbyInfo.distance,
            walkingMinutes: calculateWalkingMinutes(originMatch.nearbyInfo.distance),
            fromLocation: {
              lat: originStop.stop_lat || 0,
              lon: originStop.stop_lon || 0,
              name: originStop.stop_name,
            },
            toLocation: {
              lat: originMatch.nearbyInfo.stop.stop_lat || 0,
              lon: originMatch.nearbyInfo.stop.stop_lon || 0,
              name: originMatch.nearbyInfo.stop.stop_name,
            },
          });
        }
        
        // Bus leg
        legs.push({
          type: 'bus',
          route,
          fromStop: originMatch.nearbyInfo.stop,
          toStop: destMatch.nearbyInfo.stop,
          departureTime: depTime,
          arrivalTime: arrTime,
          stopCount: destMatch.idx - originMatch.idx,
          tripId,
        });
        
        // Walking from alighting stop if needed
        if (destMatch.nearbyInfo.distance > 50) {
          legs.push({
            type: 'walk',
            walkingMeters: destMatch.nearbyInfo.distance,
            walkingMinutes: calculateWalkingMinutes(destMatch.nearbyInfo.distance),
            fromLocation: {
              lat: destMatch.nearbyInfo.stop.stop_lat || 0,
              lon: destMatch.nearbyInfo.stop.stop_lon || 0,
              name: destMatch.nearbyInfo.stop.stop_name,
            },
            toLocation: {
              lat: destStop.stop_lat || 0,
              lon: destStop.stop_lon || 0,
              name: destStop.stop_name,
            },
          });
        }
        
        addJourneyFromLegs(legs, journeys);
      }
    }
  });
  
  console.log(`Found ${journeys.length} direct journeys`);
  
  // STEP 2: Find ONE-TRANSFER routes
  if (maxTransfers >= 1) {
    // For each trip from origin, find where it goes
    // Then for each of those stops, check if another trip can reach destination
    
    // Build: route -> all trips with their stop sequences
    const routeTrips = new Map<string, Array<{ tripId: string; stops: StopTimeInfo[] }>>();
    stopTimesByTrip.forEach((tripStops, tripId) => {
      const routeId = tripRouteMap.get(tripId);
      if (!routeId) return;
      if (!routeTrips.has(routeId)) {
        routeTrips.set(routeId, []);
      }
      routeTrips.get(routeId)!.push({ tripId, stops: tripStops });
    });
    
    // For each origin nearby stop, find routes that serve it
    const originRoutes = new Map<string, Array<{
      originNearby: { stop: StaticStop; distance: number };
      tripId: string;
      originStopIdx: number;
      tripStops: StopTimeInfo[];
    }>>();
    
    for (const originNearby of originNearbyStops.slice(0, 20)) {
      const routes = stopToRoutes.get(originNearby.stop.stop_id);
      if (!routes) continue;
      
      for (const routeId of routes) {
        const trips = routeTrips.get(routeId);
        if (!trips) continue;
        
        for (const { tripId, stops: tripStops } of trips.slice(0, 5)) {
          const originIdx = tripStops.findIndex(st => st.stop_id === originNearby.stop.stop_id);
          if (originIdx === -1) continue;
          
          const depTime = tripStops[originIdx].departure_time || tripStops[originIdx].arrival_time || '';
          if (!depTime || depTime < filterTimeStr) continue;
          
          if (!originRoutes.has(routeId)) {
            originRoutes.set(routeId, []);
          }
          originRoutes.get(routeId)!.push({
            originNearby,
            tripId,
            originStopIdx: originIdx,
            tripStops,
          });
        }
      }
    }
    
    // For each destination nearby stop, find routes that serve it
    const destRoutes = new Map<string, Array<{
      destNearby: { stop: StaticStop; distance: number };
      tripId: string;
      destStopIdx: number;
      tripStops: StopTimeInfo[];
    }>>();
    
    for (const destNearby of destNearbyStops.slice(0, 20)) {
      const routes = stopToRoutes.get(destNearby.stop.stop_id);
      if (!routes) continue;
      
      for (const routeId of routes) {
        const trips = routeTrips.get(routeId);
        if (!trips) continue;
        
        for (const { tripId, stops: tripStops } of trips.slice(0, 5)) {
          const destIdx = tripStops.findIndex(st => st.stop_id === destNearby.stop.stop_id);
          if (destIdx === -1) continue;
          
          if (!destRoutes.has(routeId)) {
            destRoutes.set(routeId, []);
          }
          destRoutes.get(routeId)!.push({
            destNearby,
            tripId,
            destStopIdx: destIdx,
            tripStops,
          });
        }
      }
    }
    
    // Find transfer points: stops where origin route meets dest route
    let transfersFound = 0;
    originRoutes.forEach((originTrips, originRouteId) => {
      destRoutes.forEach((destTrips, destRouteId) => {
        if (originRouteId === destRouteId) return; // Skip same route
        if (transfersFound > 50) return; // Limit
        
        for (const originTrip of originTrips.slice(0, 3)) {
          for (const destTrip of destTrips.slice(0, 3)) {
            // Find common stop (transfer point) that comes AFTER origin in first route
            // and BEFORE destination in second route
            for (let i = originTrip.originStopIdx + 1; i < originTrip.tripStops.length; i++) {
              const transferStopId = originTrip.tripStops[i].stop_id;
              const destTripTransferIdx = destTrip.tripStops.findIndex(st => st.stop_id === transferStopId);
              
              if (destTripTransferIdx === -1 || destTripTransferIdx >= destTrip.destStopIdx) continue;
              
              // Check timing
              const arriveTransfer = originTrip.tripStops[i].arrival_time || '';
              const departTransfer = destTrip.tripStops[destTripTransferIdx].departure_time || '';
              
              if (!arriveTransfer || !departTransfer) continue;
              
              const arriveMin = parseTimeToMinutes(arriveTransfer);
              const departMin = parseTimeToMinutes(departTransfer);
              
              // Need at least 2 minutes for transfer
              if (departMin < arriveMin + 2) continue;
              // Don't wait more than 60 minutes
              if (departMin > arriveMin + 60) continue;
              
              const route1 = routeMap.get(originRouteId);
              const route2 = routeMap.get(destRouteId);
              if (!route1 || !route2) continue;
              
              const transferStop = stopMap.get(transferStopId);
              if (!transferStop) continue;
              
              const legs: JourneyLeg[] = [];
              
              // Walk to first bus if needed
              if (originTrip.originNearby.distance > 50) {
                legs.push({
                  type: 'walk',
                  walkingMeters: originTrip.originNearby.distance,
                  walkingMinutes: calculateWalkingMinutes(originTrip.originNearby.distance),
                  fromLocation: {
                    lat: originStop.stop_lat || 0,
                    lon: originStop.stop_lon || 0,
                    name: originStop.stop_name,
                  },
                  toLocation: {
                    lat: originTrip.originNearby.stop.stop_lat || 0,
                    lon: originTrip.originNearby.stop.stop_lon || 0,
                    name: originTrip.originNearby.stop.stop_name,
                  },
                });
              }
              
              // First bus
              legs.push({
                type: 'bus',
                route: route1,
                fromStop: originTrip.originNearby.stop,
                toStop: transferStop,
                departureTime: originTrip.tripStops[originTrip.originStopIdx].departure_time || '',
                arrivalTime: arriveTransfer,
                stopCount: i - originTrip.originStopIdx,
                tripId: originTrip.tripId,
              });
              
              // Second bus
              legs.push({
                type: 'bus',
                route: route2,
                fromStop: transferStop,
                toStop: destTrip.destNearby.stop,
                departureTime: departTransfer,
                arrivalTime: destTrip.tripStops[destTrip.destStopIdx].arrival_time || '',
                stopCount: destTrip.destStopIdx - destTripTransferIdx,
                tripId: destTrip.tripId,
              });
              
              // Walk from last bus if needed
              if (destTrip.destNearby.distance > 50) {
                legs.push({
                  type: 'walk',
                  walkingMeters: destTrip.destNearby.distance,
                  walkingMinutes: calculateWalkingMinutes(destTrip.destNearby.distance),
                  fromLocation: {
                    lat: destTrip.destNearby.stop.stop_lat || 0,
                    lon: destTrip.destNearby.stop.stop_lon || 0,
                    name: destTrip.destNearby.stop.stop_name,
                  },
                  toLocation: {
                    lat: destStop.stop_lat || 0,
                    lon: destStop.stop_lon || 0,
                    name: destStop.stop_name,
                  },
                });
              }
              
              addJourneyFromLegs(legs, journeys);
              transfersFound++;
              
              if (transfersFound > 50) break;
            }
            if (transfersFound > 50) break;
          }
          if (transfersFound > 50) break;
        }
      });
    });
    
    console.log(`Found ${transfersFound} one-transfer journeys, total: ${journeys.length}`);
  }
  
  // STEP 3: Find TWO-TRANSFER routes (3 buses) if enabled and not enough routes
  if (maxTransfers >= 2 && journeys.length < 10) {
    console.log('Searching for 2-transfer routes...');
    
    // Build route trips map if not already built
    const routeTrips = new Map<string, Array<{ tripId: string; stops: StopTimeInfo[] }>>();
    stopTimesByTrip.forEach((tripStops, tripId) => {
      const routeId = tripRouteMap.get(tripId);
      if (!routeId) return;
      if (!routeTrips.has(routeId)) {
        routeTrips.set(routeId, []);
      }
      routeTrips.get(routeId)!.push({ tripId, stops: tripStops });
    });
    
    // Build stop -> routes map
    const stopRoutes = new Map<string, Set<string>>();
    stopTimes.forEach(st => {
      const routeId = tripRouteMap.get(st.trip_id);
      if (!routeId) return;
      if (!stopRoutes.has(st.stop_id)) {
        stopRoutes.set(st.stop_id, new Set());
      }
      stopRoutes.get(st.stop_id)!.add(routeId);
    });
    
    let twoTransfersFound = 0;
    const maxTwoTransfers = 30;
    
    // For each origin nearby stop
    for (const originNearby of originNearbyStops.slice(0, 10)) {
      if (twoTransfersFound >= maxTwoTransfers) break;
      
      const originStopRoutes = stopRoutes.get(originNearby.stop.stop_id);
      if (!originStopRoutes) continue;
      
      // For each route from origin
      for (const route1Id of originStopRoutes) {
        if (twoTransfersFound >= maxTwoTransfers) break;
        
        const route1Trips = routeTrips.get(route1Id);
        if (!route1Trips) continue;
        
        // Take first few trips of route 1
        for (const trip1 of route1Trips.slice(0, 3)) {
          if (twoTransfersFound >= maxTwoTransfers) break;
          
          const origin1Idx = trip1.stops.findIndex(s => s.stop_id === originNearby.stop.stop_id);
          if (origin1Idx === -1) continue;
          
          const dep1 = trip1.stops[origin1Idx].departure_time || '';
          if (!dep1 || dep1 < filterTimeStr) continue;
          
          // For each possible first transfer stop (after origin on route 1)
          for (let t1Idx = origin1Idx + 2; t1Idx < trip1.stops.length && t1Idx < origin1Idx + 15; t1Idx++) {
            if (twoTransfersFound >= maxTwoTransfers) break;
            
            const transfer1StopId = trip1.stops[t1Idx].stop_id;
            const arr1 = trip1.stops[t1Idx].arrival_time || '';
            if (!arr1) continue;
            
            const transfer1Stop = stopMap.get(transfer1StopId);
            if (!transfer1Stop) continue;
            
            // Find routes at transfer1 stop (excluding route1)
            const transfer1Routes = stopRoutes.get(transfer1StopId);
            if (!transfer1Routes) continue;
            
            for (const route2Id of transfer1Routes) {
              if (route2Id === route1Id) continue;
              if (twoTransfersFound >= maxTwoTransfers) break;
              
              const route2Trips = routeTrips.get(route2Id);
              if (!route2Trips) continue;
              
              for (const trip2 of route2Trips.slice(0, 2)) {
                if (twoTransfersFound >= maxTwoTransfers) break;
                
                const t1OnTrip2Idx = trip2.stops.findIndex(s => s.stop_id === transfer1StopId);
                if (t1OnTrip2Idx === -1) continue;
                
                const dep2 = trip2.stops[t1OnTrip2Idx].departure_time || '';
                if (!dep2) continue;
                
                // Check timing: need at least 2 mins to transfer
                const arr1Min = parseTimeToMinutes(arr1);
                const dep2Min = parseTimeToMinutes(dep2);
                if (dep2Min < arr1Min + 2 || dep2Min > arr1Min + 45) continue;
                
                // For each possible second transfer stop
                for (let t2Idx = t1OnTrip2Idx + 2; t2Idx < trip2.stops.length && t2Idx < t1OnTrip2Idx + 15; t2Idx++) {
                  if (twoTransfersFound >= maxTwoTransfers) break;
                  
                  const transfer2StopId = trip2.stops[t2Idx].stop_id;
                  const arr2 = trip2.stops[t2Idx].arrival_time || '';
                  if (!arr2) continue;
                  
                  const transfer2Stop = stopMap.get(transfer2StopId);
                  if (!transfer2Stop) continue;
                  
                  // Find routes at transfer2 that can reach destination
                  const transfer2Routes = stopRoutes.get(transfer2StopId);
                  if (!transfer2Routes) continue;
                  
                  for (const route3Id of transfer2Routes) {
                    if (route3Id === route2Id) continue;
                    if (twoTransfersFound >= maxTwoTransfers) break;
                    
                    const route3Trips = routeTrips.get(route3Id);
                    if (!route3Trips) continue;
                    
                    for (const trip3 of route3Trips.slice(0, 2)) {
                      if (twoTransfersFound >= maxTwoTransfers) break;
                      
                      const t2OnTrip3Idx = trip3.stops.findIndex(s => s.stop_id === transfer2StopId);
                      if (t2OnTrip3Idx === -1) continue;
                      
                      const dep3 = trip3.stops[t2OnTrip3Idx].departure_time || '';
                      if (!dep3) continue;
                      
                      // Check timing
                      const arr2Min = parseTimeToMinutes(arr2);
                      const dep3Min = parseTimeToMinutes(dep3);
                      if (dep3Min < arr2Min + 2 || dep3Min > arr2Min + 45) continue;
                      
                      // Check if this trip reaches any destination nearby stop
                      for (const destNearby of destNearbyStops.slice(0, 10)) {
                        const destIdx = trip3.stops.findIndex(s => s.stop_id === destNearby.stop.stop_id);
                        if (destIdx === -1 || destIdx <= t2OnTrip3Idx) continue;
                        
                        const arr3 = trip3.stops[destIdx].arrival_time || '';
                        if (!arr3) continue;
                        
                        const route1 = routeMap.get(route1Id);
                        const route2 = routeMap.get(route2Id);
                        const route3 = routeMap.get(route3Id);
                        if (!route1 || !route2 || !route3) continue;
                        
                        // Build the 3-bus journey
                        const legs: JourneyLeg[] = [];
                        
                        // Walk to first stop if needed
                        if (originNearby.distance > 50) {
                          legs.push({
                            type: 'walk',
                            walkingMeters: originNearby.distance,
                            walkingMinutes: calculateWalkingMinutes(originNearby.distance),
                            fromLocation: {
                              lat: originStop.stop_lat || 0,
                              lon: originStop.stop_lon || 0,
                              name: originStop.stop_name,
                            },
                            toLocation: {
                              lat: originNearby.stop.stop_lat || 0,
                              lon: originNearby.stop.stop_lon || 0,
                              name: originNearby.stop.stop_name,
                            },
                          });
                        }
                        
                        // Bus 1
                        legs.push({
                          type: 'bus',
                          route: route1,
                          fromStop: originNearby.stop,
                          toStop: transfer1Stop,
                          departureTime: dep1,
                          arrivalTime: arr1,
                          stopCount: t1Idx - origin1Idx,
                          tripId: trip1.tripId,
                        });
                        
                        // Bus 2
                        legs.push({
                          type: 'bus',
                          route: route2,
                          fromStop: transfer1Stop,
                          toStop: transfer2Stop,
                          departureTime: dep2,
                          arrivalTime: arr2,
                          stopCount: t2Idx - t1OnTrip2Idx,
                          tripId: trip2.tripId,
                        });
                        
                        // Bus 3
                        legs.push({
                          type: 'bus',
                          route: route3,
                          fromStop: transfer2Stop,
                          toStop: destNearby.stop,
                          departureTime: dep3,
                          arrivalTime: arr3,
                          stopCount: destIdx - t2OnTrip3Idx,
                          tripId: trip3.tripId,
                        });
                        
                        // Walk from last stop if needed
                        if (destNearby.distance > 50) {
                          legs.push({
                            type: 'walk',
                            walkingMeters: destNearby.distance,
                            walkingMinutes: calculateWalkingMinutes(destNearby.distance),
                            fromLocation: {
                              lat: destNearby.stop.stop_lat || 0,
                              lon: destNearby.stop.stop_lon || 0,
                              name: destNearby.stop.stop_name,
                            },
                            toLocation: {
                              lat: destStop.stop_lat || 0,
                              lon: destStop.stop_lon || 0,
                              name: destStop.stop_name,
                            },
                          });
                        }
                        
                        addJourneyFromLegs(legs, journeys);
                        twoTransfersFound++;
                        
                        if (twoTransfersFound >= maxTwoTransfers) break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    console.log(`Found ${twoTransfersFound} two-transfer journeys, total: ${journeys.length}`);
  }
  
  // Score and sort journeys
  journeys.forEach(j => {
    j.score = j.totalDurationMinutes + (j.transferCount * 15) + (j.totalWalkingMinutes * 0.5);
  });
  
  journeys.sort((a, b) => a.score - b.score);
  
  // Remove duplicates
  const seen = new Set<string>();
  const uniqueJourneys: JourneyOption[] = [];
  
  for (const j of journeys) {
    const routeKey = j.legs
      .filter(l => l.type === 'bus')
      .map(l => `${l.route?.route_id}-${l.fromStop?.stop_id}-${l.toStop?.stop_id}`)
      .join('|');
    const timeKey = j.departureTime.substring(0, 5);
    const key = `${routeKey}:${timeKey}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueJourneys.push(j);
    }
  }
  
  return uniqueJourneys.slice(0, 15);
}

// Helper to add a journey from legs
function addJourneyFromLegs(legs: JourneyLeg[], journeys: JourneyOption[]) {
  const totalWalkingMinutes = legs
    .filter(l => l.type === 'walk')
    .reduce((sum, l) => sum + (l.walkingMinutes || 0), 0);
  
  const busLegs = legs.filter(l => l.type === 'bus');
  let totalBusMinutes = 0;
  
  if (busLegs.length > 0) {
    const firstBusDep = busLegs[0].departureTime;
    const lastBusArr = busLegs[busLegs.length - 1].arrivalTime;
    if (firstBusDep && lastBusArr) {
      totalBusMinutes = parseTimeToMinutes(lastBusArr) - parseTimeToMinutes(firstBusDep);
    }
  }
  
  const departureTime = busLegs[0]?.departureTime || '';
  const arrivalTime = busLegs[busLegs.length - 1]?.arrivalTime || '';
  
  journeys.push({
    legs,
    totalDurationMinutes: totalWalkingMinutes + totalBusMinutes,
    totalWalkingMinutes,
    totalBusMinutes,
    transferCount: Math.max(0, busLegs.length - 1),
    departureTime,
    arrivalTime,
    score: 0,
  });
}


export function useSmartTripPlan(
  originStop: StaticStop | null,
  destStop: StaticStop | null,
  originLocation: { lat: number; lon: number } | null,
  destLocation: { lat: number; lon: number } | null,
  departureTime?: string,
  departureDate?: Date,
  maxWalkingDistance: number = 0 // 0 = unlimited (5km effective)
) {
  return useQuery({
    queryKey: ['smart-trip-plan', originStop?.stop_id, destStop?.stop_id, departureTime, departureDate?.toDateString(), maxWalkingDistance],
    queryFn: async (): Promise<SmartTripPlanData> => {
      if (!originStop || !destStop) {
        return {
          journeyOptions: [],
          noRouteFound: true,
          searchedStops: 0,
        };
      }
      
      console.log(`Smart trip planning from ${originStop.stop_name} to ${destStop.stop_name} (max walk: ${maxWalkingDistance}m)`);
      
      // Fetch all data
      const [stopTimes, tripsStatic, routes, stops] = await Promise.all([
        fetchStopTimes(),
        fetchTripsStatic(),
        fetchRoutes(),
        fetchStops(),
      ]);
      
      console.log(`Loaded ${stopTimes.length} stop times, ${tripsStatic.length} trips, ${routes.length} routes, ${stops.length} stops`);
      
      if (stopTimes.length === 0) {
        return {
          journeyOptions: [],
          noRouteFound: true,
          searchedStops: stops.length,
          message: 'Δεν φορτώθηκαν τα ωράρια. Δοκιμάστε ξανά.',
        };
      }
      
      // Build maps
      const routeMap = new Map<string, RouteInfo>();
      routes.forEach(r => routeMap.set(r.route_id, r));
      
      const stopMap = new Map<string, StaticStop>();
      stops.forEach(s => stopMap.set(s.stop_id, s));
      
      const tripRouteMap = new Map<string, string>();
      tripsStatic.forEach(t => tripRouteMap.set(t.trip_id, t.route_id));
      
      // Get time filter
      const today = new Date();
      const isToday = departureDate ? departureDate.toDateString() === today.toDateString() : true;
      let filterTimeStr: string;
      
      if (departureTime === 'all_day') {
        // Show all trips for the day - start from 00:00
        filterTimeStr = '00:00:00';
      } else if (!departureTime || departureTime === 'now') {
        if (isToday) {
          filterTimeStr = `${today.getHours().toString().padStart(2, '0')}:${today.getMinutes().toString().padStart(2, '0')}:00`;
        } else {
          filterTimeStr = '00:00:00';
        }
      } else {
        filterTimeStr = `${departureTime}:00`;
      }
      
      console.log(`Searching journeys: origin=${originStop.stop_name}, dest=${destStop.stop_name}, time=${filterTimeStr}, maxWalking=${maxWalkingDistance}`);
      
      // Find journeys with max walking distance
      const journeyOptions = findJourneys(
        originStop,
        destStop,
        originLocation,
        destLocation,
        stops,
        stopTimes,
        tripRouteMap,
        routeMap,
        stopMap,
        filterTimeStr,
        maxWalkingDistance
      );
      
      console.log(`Found ${journeyOptions.length} journey options for ${originStop.stop_name} → ${destStop.stop_name}`);
      
      return {
        journeyOptions,
        noRouteFound: journeyOptions.length === 0,
        searchedStops: stops.length,
        message: journeyOptions.length === 0 
          ? 'Δεν βρέθηκε διαδρομή. Δοκιμάστε διαφορετική ώρα ή αυξήστε την απόσταση περπατήματος.'
          : undefined,
      };
    },
    enabled: !!originStop && !!destStop,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
