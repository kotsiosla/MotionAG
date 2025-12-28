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

export function useTripPlan(
  originStopId: string | null,
  destinationStopId: string | null,
  operatorId?: string
) {
  return useQuery({
    queryKey: ['trip-plan', originStopId, destinationStopId, operatorId],
    queryFn: async (): Promise<TripPlanResult[]> => {
      if (!originStopId || !destinationStopId) return [];

      console.log(`Planning trip from ${originStopId} to ${destinationStopId}`);

      // Fetch all required data in parallel
      const [stopTimes, tripsStatic, routes] = await Promise.all([
        fetchStopTimes(operatorId),
        fetchTripsStatic(operatorId),
        fetchRoutes(operatorId),
      ]);

      console.log(`Loaded ${stopTimes.length} stop times, ${tripsStatic.length} trips, ${routes.length} routes`);

      // Build maps for faster lookup
      const routeMap = new Map<string, RouteInfo>();
      routes.forEach(r => routeMap.set(r.route_id, r));

      const tripRouteMap = new Map<string, string>();
      tripsStatic.forEach(t => tripRouteMap.set(t.trip_id, t.route_id));

      // Group stop times by trip
      const stopTimesByTrip = new Map<string, StopTimeInfo[]>();
      stopTimes.forEach(st => {
        if (!stopTimesByTrip.has(st.trip_id)) {
          stopTimesByTrip.set(st.trip_id, []);
        }
        stopTimesByTrip.get(st.trip_id)!.push(st);
      });

      // Find trips that pass through both stops
      const matchingTrips: Array<{
        tripId: string;
        routeId: string;
        originStop: StopTimeInfo;
        destinationStop: StopTimeInfo;
      }> = [];

      stopTimesByTrip.forEach((tripStopTimes, tripId) => {
        // Sort by sequence
        tripStopTimes.sort((a, b) => a.stop_sequence - b.stop_sequence);

        // Find origin and destination in this trip
        const originIdx = tripStopTimes.findIndex(st => st.stop_id === originStopId);
        const destIdx = tripStopTimes.findIndex(st => st.stop_id === destinationStopId);

        // Origin must come before destination
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

      console.log(`Found ${matchingTrips.length} matching trips`);

      // Group by route
      const tripsByRoute = new Map<string, typeof matchingTrips>();
      matchingTrips.forEach(t => {
        if (!tripsByRoute.has(t.routeId)) {
          tripsByRoute.set(t.routeId, []);
        }
        tripsByRoute.get(t.routeId)!.push(t);
      });

      // Build results
      const results: TripPlanResult[] = [];

      tripsByRoute.forEach((routeTrips, routeId) => {
        const route = routeMap.get(routeId);
        if (!route) return;

        // Sort trips by departure time
        const sortedTrips = routeTrips
          .filter(t => t.originStop.departure_time)
          .sort((a, b) => {
            const timeA = a.originStop.departure_time || '99:99:99';
            const timeB = b.originStop.departure_time || '99:99:99';
            return timeA.localeCompare(timeB);
          });

        // Get current time to filter upcoming trips
        const now = new Date();
        const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:00`;

        const upcomingTrips = sortedTrips
          .filter(t => (t.originStop.departure_time || '') >= currentTimeStr)
          .slice(0, 5); // Max 5 trips per route

        if (upcomingTrips.length > 0) {
          results.push({
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

      // Sort results by first departure time
      results.sort((a, b) => {
        const timeA = a.trips[0]?.departureTime || '99:99:99';
        const timeB = b.trips[0]?.departureTime || '99:99:99';
        return timeA.localeCompare(timeB);
      });

      console.log(`Returning ${results.length} route options`);
      return results;
    },
    enabled: !!originStopId && !!destinationStopId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}