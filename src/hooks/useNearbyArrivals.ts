import { useMemo } from "react";
import type { Trip, StaticStop, RouteInfo, Vehicle } from "@/types/gtfs";

export interface StopArrival {
  tripId: string;
  routeId: string;
  routeShortName?: string;
  routeLongName?: string;
  routeColor?: string;
  vehicleId?: string;
  vehicleLabel?: string;
  arrivalTime?: number;
  departureTime?: number;
  delay?: number;
  stopSequence?: number;
  headsign?: string;
  distanceFromVehicle?: number;
  estimatedMinutes?: number;
  source?: 'gtfs' | 'siri' | 'merged';
  confidence?: 'high' | 'medium' | 'low';
}

export interface NearbyStop {
  stop: StaticStop;
  distance: number;
  arrivals: StopArrival[];
}

// Haversine distance calculation
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export function useNearbyArrivals(
  userLocation: { lat: number; lng: number } | null,
  stops: StaticStop[],
  trips: Trip[],
  vehicles: Vehicle[],
  routeNamesMap: Map<string, RouteInfo>,
  maxDistance: number = 500, // meters
  maxStops: number = 5
): NearbyStop[] {
  return useMemo(() => {
    if (!userLocation) return [];

    const now = Math.floor(Date.now() / 1000);

    // Find nearby stops
    const nearbyStops = stops
      .filter(stop => stop.stop_lat && stop.stop_lon)
      .map(stop => ({
        stop,
        distance: calculateDistance(
          userLocation.lat,
          userLocation.lng,
          stop.stop_lat!,
          stop.stop_lon!
        ),
      }))
      .filter(s => s.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, maxStops);

    // Create vehicle map for quick lookup
    const vehicleMap = new Map<string, Vehicle>();
    vehicles.forEach(v => {
      if (v.tripId) vehicleMap.set(v.tripId, v);
    });

    // Get arrivals for each nearby stop
    return nearbyStops.map(({ stop, distance }) => {
      const arrivals: StopArrival[] = [];

      trips.forEach(trip => {
        if (!trip.stopTimeUpdates) return;

        const stopUpdate = trip.stopTimeUpdates.find(stu => stu.stopId === stop.stop_id);
        if (!stopUpdate) return;

        // Skip if the bus has already passed this stop
        const vehicle = trip.tripId ? vehicleMap.get(trip.tripId) : null;
        if (vehicle?.currentStopSequence && stopUpdate.stopSequence &&
          stopUpdate.stopSequence < vehicle.currentStopSequence) {
          return;
        }

        const routeInfo = trip.routeId ? routeNamesMap.get(trip.routeId) : null;

        // Calculate arrival time and estimated minutes
        let arrivalTime = stopUpdate.arrivalTime;
        let estimatedMinutes: number | undefined;

        if (arrivalTime) {
          estimatedMinutes = Math.max(0, Math.round((arrivalTime - now) / 60));
        } else if (vehicle?.latitude && vehicle?.longitude && vehicle?.speed && vehicle.speed > 0) {
          // Estimate based on vehicle position and speed
          const vehicleDistance = calculateDistance(
            vehicle.latitude,
            vehicle.longitude,
            stop.stop_lat!,
            stop.stop_lon!
          );
          const travelTimeMinutes = vehicleDistance / vehicle.speed / 60;
          estimatedMinutes = Math.round(travelTimeMinutes);
        }

        // Only include future arrivals (within next 2 hours)
        if (estimatedMinutes !== undefined && estimatedMinutes > 120) return;
        if (arrivalTime && arrivalTime < now - 60) return; // Allow 1 minute grace period

        arrivals.push({
          tripId: trip.tripId || trip.id,
          routeId: trip.routeId || '',
          routeShortName: routeInfo?.route_short_name,
          routeLongName: routeInfo?.route_long_name,
          routeColor: routeInfo?.route_color,
          vehicleId: vehicle?.vehicleId,
          vehicleLabel: vehicle?.label || trip.vehicleLabel,
          arrivalTime: stopUpdate.arrivalTime,
          departureTime: stopUpdate.departureTime,
          delay: stopUpdate.arrivalDelay,
          stopSequence: stopUpdate.stopSequence,
          estimatedMinutes,
        });
      });

      // Sort by estimated arrival time
      arrivals.sort((a, b) => {
        if (a.estimatedMinutes === undefined) return 1;
        if (b.estimatedMinutes === undefined) return -1;
        return a.estimatedMinutes - b.estimatedMinutes;
      });

      return {
        stop,
        distance,
        arrivals: arrivals.slice(0, 10), // Max 10 arrivals per stop
      };
    });
  }, [userLocation, stops, trips, vehicles, routeNamesMap, maxDistance, maxStops]);
}

export function useStopArrivals(
  stopId: string | null,
  stops: StaticStop[],
  trips: Trip[],
  vehicles: Vehicle[],
  routeNamesMap: Map<string, RouteInfo>
): StopArrival[] {
  return useMemo(() => {
    if (!stopId) return [];

    const now = Math.floor(Date.now() / 1000);
    const stop = stops.find(s => s.stop_id === stopId);
    if (!stop) return [];

    const arrivals: StopArrival[] = [];

    // Create vehicle map for quick lookup
    const vehicleMap = new Map<string, Vehicle>();
    vehicles.forEach(v => {
      if (v.tripId) vehicleMap.set(v.tripId, v);
    });

    trips.forEach(trip => {
      if (!trip.stopTimeUpdates) return;

      const stopUpdate = trip.stopTimeUpdates.find(stu => stu.stopId === stopId);
      if (!stopUpdate) return;

      // Skip if the bus has already passed this stop
      const vehicle = trip.tripId ? vehicleMap.get(trip.tripId) : null;
      if (vehicle?.currentStopSequence && stopUpdate.stopSequence &&
        stopUpdate.stopSequence < vehicle.currentStopSequence) {
        return;
      }

      const routeInfo = trip.routeId ? routeNamesMap.get(trip.routeId) : null;

      let arrivalTime = stopUpdate.arrivalTime;
      let estimatedMinutes: number | undefined;

      if (arrivalTime) {
        estimatedMinutes = Math.max(0, Math.round((arrivalTime - now) / 60));
      } else if (vehicle?.latitude && vehicle?.longitude && vehicle?.speed && vehicle.speed > 0 && stop.stop_lat && stop.stop_lon) {
        const vehicleDistance = calculateDistance(
          vehicle.latitude,
          vehicle.longitude,
          stop.stop_lat,
          stop.stop_lon
        );
        const travelTimeMinutes = vehicleDistance / vehicle.speed / 60;
        estimatedMinutes = Math.round(travelTimeMinutes);
      }

      if (estimatedMinutes !== undefined && estimatedMinutes > 120) return;
      if (arrivalTime && arrivalTime < now - 60) return;

      arrivals.push({
        tripId: trip.tripId || trip.id,
        routeId: trip.routeId || '',
        routeShortName: routeInfo?.route_short_name,
        routeLongName: routeInfo?.route_long_name,
        routeColor: routeInfo?.route_color,
        vehicleId: vehicle?.vehicleId,
        vehicleLabel: vehicle?.label || trip.vehicleLabel,
        arrivalTime: stopUpdate.arrivalTime,
        departureTime: stopUpdate.departureTime,
        delay: stopUpdate.arrivalDelay,
        stopSequence: stopUpdate.stopSequence,
        estimatedMinutes,
      });
    });

    arrivals.sort((a, b) => {
      if (a.estimatedMinutes === undefined) return 1;
      if (b.estimatedMinutes === undefined) return -1;
      return a.estimatedMinutes - b.estimatedMinutes;
    });

    return arrivals.slice(0, 15);
  }, [stopId, stops, trips, vehicles, routeNamesMap]);
}
