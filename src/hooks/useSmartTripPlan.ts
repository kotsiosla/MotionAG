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

// Find nearby stops within a radius (in meters). If maxRadius is 0, return all stops sorted by distance
function findNearbyStops(
  lat: number,
  lon: number,
  stops: StaticStop[],
  maxRadius: number = 0 // 0 means unlimited
): Array<{ stop: StaticStop; distance: number }> {
  const nearby: Array<{ stop: StaticStop; distance: number }> = [];
  
  for (const stop of stops) {
    if (!stop.stop_lat || !stop.stop_lon) continue;
    const distance = calculateDistance(lat, lon, stop.stop_lat, stop.stop_lon);
    // If maxRadius is 0, include all stops; otherwise filter by radius
    if (maxRadius === 0 || distance <= maxRadius) {
      nearby.push({ stop, distance });
    }
  }
  
  // Sort by distance
  nearby.sort((a, b) => a.distance - b.distance);
  return nearby;
}

async function fetchStopTimes(): Promise<StopTimeInfo[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stop-times`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch stop times');
  const result = await response.json();
  return result.data || [];
}

async function fetchTripsStatic(): Promise<TripStaticInfo[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/trips-static`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch static trips');
  const result = await response.json();
  return result.data || [];
}

async function fetchRoutes(): Promise<RouteInfo[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/routes`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });
  if (!response.ok) throw new Error('Failed to fetch routes');
  const result = await response.json();
  return result.data || [];
}

async function fetchStops(): Promise<StaticStop[]> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stops`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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

// Find journeys using BFS-style algorithm
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
  
  // Find all stops near origin and destination for walking (use maxWalkingDistance)
  const originNearbyStops = findNearbyStops(
    originStop.stop_lat || 0, 
    originStop.stop_lon || 0, 
    stops, 
    maxWalkingDistance
  );
  
  const destNearbyStops = findNearbyStops(
    destStop.stop_lat || 0, 
    destStop.stop_lon || 0, 
    stops, 
    maxWalkingDistance
  );
  
  // Include the origin and dest stops themselves
  if (!originNearbyStops.find(n => n.stop.stop_id === originStop.stop_id)) {
    originNearbyStops.unshift({ stop: originStop, distance: 0 });
  }
  if (!destNearbyStops.find(n => n.stop.stop_id === destStop.stop_id)) {
    destNearbyStops.unshift({ stop: destStop, distance: 0 });
  }
  
  console.log(`Searching from ${originNearbyStops.length} origin stops to ${destNearbyStops.length} destination stops`);
  
  // For each combination of origin-nearby and dest-nearby stops
  for (const originNearby of originNearbyStops.slice(0, 10)) { // Limit to 10 nearest
    for (const destNearby of destNearbyStops.slice(0, 10)) { // Limit to 10 nearest
      // Find direct routes
      findDirectJourneys(
        originNearby,
        destNearby,
        originStop,
        destStop,
        originLocation,
        destLocation,
        stopTimesByTrip,
        tripRouteMap,
        routeMap,
        stopMap,
        filterTimeStr,
        journeys
      );
      
      // Find 1-transfer routes
      if (maxTransfers >= 1) {
        findOneTransferJourneys(
          originNearby,
          destNearby,
          originStop,
          destStop,
          originLocation,
          destLocation,
          stops,
          stopTimesByTrip,
          tripRouteMap,
          routeMap,
          stopMap,
          filterTimeStr,
          journeys
        );
      }
    }
  }
  
  // Score and sort journeys
  journeys.forEach(j => {
    // Score: lower is better
    // Penalize: total time, transfers, walking
    j.score = j.totalDurationMinutes + (j.transferCount * 15) + (j.totalWalkingMinutes * 0.5);
  });
  
  journeys.sort((a, b) => a.score - b.score);
  
  // Remove duplicates (same routes, similar times)
  const seen = new Set<string>();
  const uniqueJourneys: JourneyOption[] = [];
  
  for (const j of journeys) {
    const routeKey = j.legs
      .filter(l => l.type === 'bus')
      .map(l => l.route?.route_id)
      .join('-');
    const timeKey = j.departureTime.substring(0, 5);
    const key = `${routeKey}:${timeKey}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueJourneys.push(j);
    }
  }
  
  return uniqueJourneys.slice(0, 10); // Return top 10 options
}

function findDirectJourneys(
  originNearby: { stop: StaticStop; distance: number },
  destNearby: { stop: StaticStop; distance: number },
  realOriginStop: StaticStop,
  realDestStop: StaticStop,
  originLocation: { lat: number; lon: number } | null,
  destLocation: { lat: number; lon: number } | null,
  stopTimesByTrip: Map<string, StopTimeInfo[]>,
  tripRouteMap: Map<string, string>,
  routeMap: Map<string, RouteInfo>,
  stopMap: Map<string, StaticStop>,
  filterTimeStr: string,
  journeys: JourneyOption[]
) {
  const originStopId = originNearby.stop.stop_id;
  const destStopId = destNearby.stop.stop_id;
  
  // Find trips that go from origin to destination
  stopTimesByTrip.forEach((tripStops, tripId) => {
    const originIdx = tripStops.findIndex(st => st.stop_id === originStopId);
    const destIdx = tripStops.findIndex(st => st.stop_id === destStopId);
    
    if (originIdx !== -1 && destIdx !== -1 && originIdx < destIdx) {
      const routeId = tripRouteMap.get(tripId);
      if (!routeId) return;
      
      const route = routeMap.get(routeId);
      if (!route) return;
      
      const originSt = tripStops[originIdx];
      const destSt = tripStops[destIdx];
      
      const depTime = originSt.departure_time;
      if (!depTime || depTime < filterTimeStr) return;
      
      const legs: JourneyLeg[] = [];
      
      // Add walking leg to bus stop if needed
      if (originNearby.distance > 50) {
        legs.push({
          type: 'walk',
          walkingMeters: originNearby.distance,
          walkingMinutes: calculateWalkingMinutes(originNearby.distance),
          fromLocation: {
            lat: realOriginStop.stop_lat || 0,
            lon: realOriginStop.stop_lon || 0,
            name: realOriginStop.stop_name,
          },
          toLocation: {
            lat: originNearby.stop.stop_lat || 0,
            lon: originNearby.stop.stop_lon || 0,
            name: originNearby.stop.stop_name,
          },
        });
      }
      
      // Add bus leg
      legs.push({
        type: 'bus',
        route,
        fromStop: originNearby.stop,
        toStop: destNearby.stop,
        departureTime: depTime,
        arrivalTime: destSt.arrival_time,
        stopCount: destIdx - originIdx,
        tripId,
      });
      
      // Add walking leg from bus stop if needed
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
            lat: realDestStop.stop_lat || 0,
            lon: realDestStop.stop_lon || 0,
            name: realDestStop.stop_name,
          },
        });
      }
      
      // Calculate totals
      const totalWalkingMinutes = legs
        .filter(l => l.type === 'walk')
        .reduce((sum, l) => sum + (l.walkingMinutes || 0), 0);
      
      const busLegs = legs.filter(l => l.type === 'bus');
      let totalBusMinutes = 0;
      if (busLegs.length > 0 && busLegs[0].departureTime && busLegs[busLegs.length - 1].arrivalTime) {
        const depMinutes = parseTimeToMinutes(busLegs[0].departureTime!);
        const arrMinutes = parseTimeToMinutes(busLegs[busLegs.length - 1].arrivalTime!);
        totalBusMinutes = arrMinutes - depMinutes;
      }
      
      journeys.push({
        legs,
        totalDurationMinutes: totalWalkingMinutes + totalBusMinutes,
        totalWalkingMinutes,
        totalBusMinutes,
        transferCount: 0,
        departureTime: depTime,
        arrivalTime: destSt.arrival_time || depTime,
        score: 0,
      });
    }
  });
}

function findOneTransferJourneys(
  originNearby: { stop: StaticStop; distance: number },
  destNearby: { stop: StaticStop; distance: number },
  realOriginStop: StaticStop,
  realDestStop: StaticStop,
  originLocation: { lat: number; lon: number } | null,
  destLocation: { lat: number; lon: number } | null,
  stops: StaticStop[],
  stopTimesByTrip: Map<string, StopTimeInfo[]>,
  tripRouteMap: Map<string, string>,
  routeMap: Map<string, RouteInfo>,
  stopMap: Map<string, StaticStop>,
  filterTimeStr: string,
  journeys: JourneyOption[]
) {
  const originStopId = originNearby.stop.stop_id;
  const destStopId = destNearby.stop.stop_id;
  
  // Find all stops reachable from origin (with route info)
  const reachableFromOrigin = new Map<string, Array<{
    routeId: string;
    tripId: string;
    arrivalTime: string;
    stopSequence: number;
    originDepartureTime: string;
    originStopSequence: number;
  }>>();
  
  stopTimesByTrip.forEach((tripStops, tripId) => {
    const originIdx = tripStops.findIndex(st => st.stop_id === originStopId);
    if (originIdx === -1) return;
    
    const originSt = tripStops[originIdx];
    if (!originSt.departure_time || originSt.departure_time < filterTimeStr) return;
    
    const routeId = tripRouteMap.get(tripId);
    if (!routeId) return;
    
    // All stops after origin are reachable
    for (let i = originIdx + 1; i < tripStops.length; i++) {
      const st = tripStops[i];
      if (!reachableFromOrigin.has(st.stop_id)) {
        reachableFromOrigin.set(st.stop_id, []);
      }
      reachableFromOrigin.get(st.stop_id)!.push({
        routeId,
        tripId,
        arrivalTime: st.arrival_time || '',
        stopSequence: st.stop_sequence,
        originDepartureTime: originSt.departure_time,
        originStopSequence: originSt.stop_sequence,
      });
    }
  });
  
  // Find all stops that can reach destination (with route info)
  const canReachDest = new Map<string, Array<{
    routeId: string;
    tripId: string;
    departureTime: string;
    stopSequence: number;
    destArrivalTime: string;
    destStopSequence: number;
  }>>();
  
  stopTimesByTrip.forEach((tripStops, tripId) => {
    const destIdx = tripStops.findIndex(st => st.stop_id === destStopId);
    if (destIdx === -1) return;
    
    const destSt = tripStops[destIdx];
    const routeId = tripRouteMap.get(tripId);
    if (!routeId) return;
    
    // All stops before destination can reach it
    for (let i = 0; i < destIdx; i++) {
      const st = tripStops[i];
      if (!st.departure_time) continue;
      
      if (!canReachDest.has(st.stop_id)) {
        canReachDest.set(st.stop_id, []);
      }
      canReachDest.get(st.stop_id)!.push({
        routeId,
        tripId,
        departureTime: st.departure_time,
        stopSequence: st.stop_sequence,
        destArrivalTime: destSt.arrival_time || '',
        destStopSequence: destSt.stop_sequence,
      });
    }
  });
  
  // Find transfer points (stops that are both reachable from origin AND can reach dest)
  reachableFromOrigin.forEach((fromOriginOptions, transferStopId) => {
    const toDestOptions = canReachDest.get(transferStopId);
    if (!toDestOptions) return;
    
    const transferStop = stopMap.get(transferStopId);
    if (!transferStop) return;
    
    // Try each combination
    for (const fromOrigin of fromOriginOptions.slice(0, 3)) { // Limit combinations
      for (const toDest of toDestOptions.slice(0, 3)) {
        // Skip if same route (would be direct)
        if (fromOrigin.routeId === toDest.routeId) continue;
        
        // Check timing: arrival at transfer must be before departure to dest
        // Add 2 minutes buffer for transfer
        if (fromOrigin.arrivalTime && toDest.departureTime) {
          const arrivalMinutes = parseTimeToMinutes(fromOrigin.arrivalTime);
          const departureMinutes = parseTimeToMinutes(toDest.departureTime);
          if (arrivalMinutes + 2 > departureMinutes) continue;
        }
        
        const route1 = routeMap.get(fromOrigin.routeId);
        const route2 = routeMap.get(toDest.routeId);
        if (!route1 || !route2) continue;
        
        const legs: JourneyLeg[] = [];
        
        // Walking to first stop if needed
        if (originNearby.distance > 50) {
          legs.push({
            type: 'walk',
            walkingMeters: originNearby.distance,
            walkingMinutes: calculateWalkingMinutes(originNearby.distance),
            fromLocation: {
              lat: realOriginStop.stop_lat || 0,
              lon: realOriginStop.stop_lon || 0,
              name: realOriginStop.stop_name,
            },
            toLocation: {
              lat: originNearby.stop.stop_lat || 0,
              lon: originNearby.stop.stop_lon || 0,
              name: originNearby.stop.stop_name,
            },
          });
        }
        
        // First bus leg
        legs.push({
          type: 'bus',
          route: route1,
          fromStop: originNearby.stop,
          toStop: transferStop,
          departureTime: fromOrigin.originDepartureTime,
          arrivalTime: fromOrigin.arrivalTime,
          stopCount: fromOrigin.stopSequence - fromOrigin.originStopSequence,
          tripId: fromOrigin.tripId,
        });
        
        // Second bus leg
        legs.push({
          type: 'bus',
          route: route2,
          fromStop: transferStop,
          toStop: destNearby.stop,
          departureTime: toDest.departureTime,
          arrivalTime: toDest.destArrivalTime,
          stopCount: toDest.destStopSequence - toDest.stopSequence,
          tripId: toDest.tripId,
        });
        
        // Walking from last stop if needed
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
              lat: realDestStop.stop_lat || 0,
              lon: realDestStop.stop_lon || 0,
              name: realDestStop.stop_name,
            },
          });
        }
        
        // Calculate totals
        const totalWalkingMinutes = legs
          .filter(l => l.type === 'walk')
          .reduce((sum, l) => sum + (l.walkingMinutes || 0), 0);
        
        const firstBusLeg = legs.find(l => l.type === 'bus');
        const lastBusLeg = [...legs].reverse().find(l => l.type === 'bus');
        
        let totalBusMinutes = 0;
        if (firstBusLeg?.departureTime && lastBusLeg?.arrivalTime) {
          const depMinutes = parseTimeToMinutes(firstBusLeg.departureTime);
          const arrMinutes = parseTimeToMinutes(lastBusLeg.arrivalTime);
          totalBusMinutes = arrMinutes - depMinutes;
        }
        
        // Add wait time at transfer
        if (fromOrigin.arrivalTime && toDest.departureTime) {
          const waitMinutes = parseTimeToMinutes(toDest.departureTime) - parseTimeToMinutes(fromOrigin.arrivalTime);
          totalBusMinutes += waitMinutes;
        }
        
        journeys.push({
          legs,
          totalDurationMinutes: totalWalkingMinutes + totalBusMinutes,
          totalWalkingMinutes,
          totalBusMinutes,
          transferCount: 1,
          departureTime: fromOrigin.originDepartureTime,
          arrivalTime: toDest.destArrivalTime || toDest.departureTime,
          score: 0,
        });
      }
    }
  });
  
  // Also check for transfers with short walking between stops
  reachableFromOrigin.forEach((fromOriginOptions, reachableStopId) => {
    const reachableStop = stopMap.get(reachableStopId);
    if (!reachableStop || !reachableStop.stop_lat || !reachableStop.stop_lon) return;
    
    // Find nearby stops that can reach destination (within 300m walk)
    const nearbyTransferStops = findNearbyStops(
      reachableStop.stop_lat,
      reachableStop.stop_lon,
      Array.from(stopMap.values()),
      300
    );
    
    for (const nearbyTransfer of nearbyTransferStops.slice(0, 5)) {
      if (nearbyTransfer.stop.stop_id === reachableStopId) continue; // Skip same stop
      if (nearbyTransfer.distance < 30) continue; // Too close, same stop essentially
      
      const toDestOptions = canReachDest.get(nearbyTransfer.stop.stop_id);
      if (!toDestOptions) continue;
      
      // Try combinations with walking transfer
      for (const fromOrigin of fromOriginOptions.slice(0, 2)) {
        for (const toDest of toDestOptions.slice(0, 2)) {
          if (fromOrigin.routeId === toDest.routeId) continue;
          
          // Check timing with walking buffer
          const walkingMinutes = calculateWalkingMinutes(nearbyTransfer.distance);
          if (fromOrigin.arrivalTime && toDest.departureTime) {
            const arrivalMinutes = parseTimeToMinutes(fromOrigin.arrivalTime);
            const departureMinutes = parseTimeToMinutes(toDest.departureTime);
            if (arrivalMinutes + walkingMinutes + 2 > departureMinutes) continue;
          }
          
          const route1 = routeMap.get(fromOrigin.routeId);
          const route2 = routeMap.get(toDest.routeId);
          if (!route1 || !route2) continue;
          
          const legs: JourneyLeg[] = [];
          
          // Walking to first stop
          if (originNearby.distance > 50) {
            legs.push({
              type: 'walk',
              walkingMeters: originNearby.distance,
              walkingMinutes: calculateWalkingMinutes(originNearby.distance),
              fromLocation: {
                lat: realOriginStop.stop_lat || 0,
                lon: realOriginStop.stop_lon || 0,
                name: realOriginStop.stop_name,
              },
              toLocation: {
                lat: originNearby.stop.stop_lat || 0,
                lon: originNearby.stop.stop_lon || 0,
                name: originNearby.stop.stop_name,
              },
            });
          }
          
          // First bus
          legs.push({
            type: 'bus',
            route: route1,
            fromStop: originNearby.stop,
            toStop: reachableStop,
            departureTime: fromOrigin.originDepartureTime,
            arrivalTime: fromOrigin.arrivalTime,
            stopCount: fromOrigin.stopSequence - fromOrigin.originStopSequence,
            tripId: fromOrigin.tripId,
          });
          
          // Walking between stops
          legs.push({
            type: 'walk',
            walkingMeters: nearbyTransfer.distance,
            walkingMinutes: walkingMinutes,
            fromLocation: {
              lat: reachableStop.stop_lat || 0,
              lon: reachableStop.stop_lon || 0,
              name: reachableStop.stop_name,
            },
            toLocation: {
              lat: nearbyTransfer.stop.stop_lat || 0,
              lon: nearbyTransfer.stop.stop_lon || 0,
              name: nearbyTransfer.stop.stop_name,
            },
          });
          
          // Second bus
          legs.push({
            type: 'bus',
            route: route2,
            fromStop: nearbyTransfer.stop,
            toStop: destNearby.stop,
            departureTime: toDest.departureTime,
            arrivalTime: toDest.destArrivalTime,
            stopCount: toDest.destStopSequence - toDest.stopSequence,
            tripId: toDest.tripId,
          });
          
          // Walking to destination
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
                lat: realDestStop.stop_lat || 0,
                lon: realDestStop.stop_lon || 0,
                name: realDestStop.stop_name,
              },
            });
          }
          
          const totalWalkingMinutes = legs
            .filter(l => l.type === 'walk')
            .reduce((sum, l) => sum + (l.walkingMinutes || 0), 0);
          
          const firstBusLeg = legs.find(l => l.type === 'bus');
          const lastBusLeg = [...legs].reverse().find(l => l.type === 'bus');
          
          let totalBusMinutes = 0;
          if (firstBusLeg?.departureTime && lastBusLeg?.arrivalTime) {
            const depMinutes = parseTimeToMinutes(firstBusLeg.departureTime);
            const arrMinutes = parseTimeToMinutes(lastBusLeg.arrivalTime);
            totalBusMinutes = arrMinutes - depMinutes;
          }
          
          journeys.push({
            legs,
            totalDurationMinutes: totalWalkingMinutes + totalBusMinutes,
            totalWalkingMinutes,
            totalBusMinutes,
            transferCount: 1,
            departureTime: fromOrigin.originDepartureTime,
            arrivalTime: toDest.destArrivalTime || toDest.departureTime,
            score: 0,
          });
        }
      }
    }
  });
}

export function useSmartTripPlan(
  originStop: StaticStop | null,
  destStop: StaticStop | null,
  originLocation: { lat: number; lon: number } | null,
  destLocation: { lat: number; lon: number } | null,
  departureTime?: string,
  departureDate?: Date,
  maxWalkingDistance: number = 500
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
      
      console.log(`Found ${journeyOptions.length} journey options`);
      
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
