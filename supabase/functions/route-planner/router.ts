
import { GTFSData, StopInfo, RouteInfo } from "./gtfs-loader.ts";

export interface JourneyLeg {
    type: 'walk' | 'bus';
    route?: RouteInfo;
    fromStop?: StopInfo;
    toStop?: StopInfo;
    departureTime?: string;
    arrivalTime?: string;
    stopCount?: number;
    tripId?: string;
    walkingMeters?: number;
    walkingMinutes?: number;
    fromLocation?: { lat: number; lon: number; name: string };
    toLocation?: { lat: number; lon: number; name: string };
}

export interface JourneyOption {
    legs: JourneyLeg[];
    totalDurationMinutes: number;
    totalWalkingMinutes: number;
    totalBusMinutes: number;
    transferCount: number;
    departureTime: string;
    arrivalTime: string;
    score: number;
}

// Convert "HH:MM:SS" to minutes since midnight
function timeToMinutes(time: string): number {
    const [h, m, s] = time.split(':').map(Number);
    return h * 60 + m + (s || 0) / 60;
}

function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = Math.floor(mins % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export class RaptorRouter {
    private data: GTFSData;

    constructor(data: GTFSData) {
        this.data = data;
    }

    public findRoutes(
        originLat: number,
        originLon: number,
        destLat: number,
        destLon: number,
        departureTime: string,
        params: {
            maxTransfers: number;
            maxWalkingDistance: number;
            maxWalkingTime: number;
        }
    ): JourneyOption[] {
        const depMins = timeToMinutes(departureTime);
        const maxRounds = params.maxTransfers + 1;

        // Multi-round arrival times: arrivals[round][stopId]
        const arrivals: Map<string, number>[] = Array.from({ length: maxRounds + 1 }, () => new Map());
        const bestArrivals: Map<string, number> = new Map(); // Best arrival at stop across all rounds

        // Tracking for path reconstruction: parent[round][stopId] = { tripId, fromStopId, depTime, arrTime }
        const parents: Map<string, { tripId: string, fromStopId: string, depTime: number, arrTime: number }>[] =
            Array.from({ length: maxRounds + 1 }, () => new Map());

        // 1. Initial footpaths from origin
        let markedStops: Set<string> = new Set();
        for (const [stopId, stop] of this.data.stops) {
            const dist = calculateDistance(originLat, originLon, stop.stop_lat, stop.stop_lon);
            if (dist <= params.maxWalkingDistance) {
                const walkTime = dist / 83.33; // 5km/h
                const arr = depMins + walkTime;
                arrivals[0].set(stopId, arr);
                bestArrivals.set(stopId, arr);
                markedStops.add(stopId);
            }
        }

        // RAPTOR rounds
        for (let k = 1; k <= maxRounds; k++) {
            const currentMarked: Set<string> = new Set();
            const routesToProcess: Map<string, string> = new Map(); // routeId -> earliest departure stopId

            // Find all routes serving marked stops
            for (const stopId of markedStops) {
                const stopRoutes = this.data.stopTimesByStop.get(stopId)?.map(st => this.data.trips.get(st.trip_id)?.route_id).filter(Boolean) as string[];
                for (const routeId of stopRoutes || []) {
                    if (!routesToProcess.has(routeId)) {
                        routesToProcess.set(routeId, stopId);
                    } else {
                        // Pick the earliest stop on the route that is marked
                        // (Simplified: just store the stopId, we'll find the earliest later)
                    }
                }
            }

            // Process each route
            for (const [routeId, _] of routesToProcess) {
                let currentTripId: string | null = null;
                let boardingStopId: string | null = null;
                let boardingTime = 0;

                // Traverse route stops (this assumes a unified trip pattern for simplicity)
                // In a real implementation, we'd iterate over specific TRIP PATTERNS.
                // For Cyprus GTFS, we'll approximate by taking the first trip of the route.
                const exampleTripId = this.data.tripsByRoute.get(routeId)?.[0];
                if (!exampleTripId) continue;
                const routeStops = this.data.stopTimesByTrip.get(exampleTripId) || [];

                for (const st of routeStops) {
                    const stopId = st.stop_id;

                    // Can we improve the arrival time at this stop?
                    if (currentTripId) {
                        const arr = timeToMinutes(st.arrival_time);
                        if (arr < (bestArrivals.get(stopId) || Infinity)) {
                            arrivals[k].set(stopId, arr);
                            bestArrivals.set(stopId, arr);
                            parents[k].set(stopId, { tripId: currentTripId, fromStopId: boardingStopId!, depTime: boardingTime, arrTime: arr });
                            currentMarked.add(stopId);
                        }
                    }

                    // Can we board a trip at this stop?
                    const prevArr = arrivals[k - 1].get(stopId) || Infinity;
                    if (prevArr !== Infinity) {
                        // Find earliest trip of routeId that departs from stopId >= prevArr + 1 (min transfer)
                        const trips = this.data.tripsByRoute.get(routeId) || [];
                        let bestTrip: string | null = null;
                        let bestDep = Infinity;

                        for (const tid of trips) {
                            const stopTime = this.data.stopTimesByTrip.get(tid)?.find(s => s.stop_id === stopId);
                            if (stopTime) {
                                const dep = timeToMinutes(stopTime.departure_time);
                                if (dep >= prevArr + 2 && dep < bestDep) {
                                    bestDep = dep;
                                    bestTrip = tid;
                                }
                            }
                        }

                        if (bestTrip && (currentTripId === null || bestDep < timeToMinutes(this.data.stopTimesByTrip.get(currentTripId)?.find(s => s.stop_id === stopId)?.departure_time || '23:59:59'))) {
                            currentTripId = bestTrip;
                            boardingStopId = stopId;
                            boardingTime = bestDep;
                        }
                    }
                }
            }

            // Footpaths at the end of round
            const footpathMarked: Set<string> = new Set();
            for (const stopId of currentMarked) {
                const baseArr = arrivals[k].get(stopId)!;
                const lat1 = this.data.stops.get(stopId)!.stop_lat;
                const lon1 = this.data.stops.get(stopId)!.stop_lon;

                for (const [nearId, nearStop] of this.data.stops) {
                    if (nearId === stopId) continue;
                    const dist = calculateDistance(lat1, lon1, nearStop.stop_lat, nearStop.stop_lon);
                    if (dist <= 500) { // Transfer walking limit
                        const walkTime = dist / 83.33;
                        const arr = baseArr + walkTime;
                        if (arr < (bestArrivals.get(nearId) || Infinity)) {
                            arrivals[k].set(nearId, arr);
                            bestArrivals.set(nearId, arr);
                            // Parents for walking: tripId = 'walk'
                            parents[k].set(nearId, { tripId: 'walk', fromStopId: stopId, depTime: baseArr, arrTime: arr });
                            footpathMarked.add(nearId);
                        }
                    }
                }
            }

            markedStops = new Set([...currentMarked, ...footpathMarked]);
            if (markedStops.size === 0) break;
        }

        // Reconstruct results to destination
        const options: JourneyOption[] = [];

        // Find all rounds that reached the destination area
        for (let k = 1; k <= maxRounds; k++) {
            // Find best stop near destination in this round
            let bestStopId: string | null = null;
            let minArr = Infinity;

            for (const [stopId, stop] of this.data.stops) {
                const dist = calculateDistance(destLat, destLon, stop.stop_lat, stop.stop_lon);
                if (dist <= params.maxWalkingDistance) {
                    const walkTime = dist / 83.33;
                    const totalArr = (arrivals[k].get(stopId) || Infinity) + walkTime;
                    if (totalArr < minArr) {
                        minArr = totalArr;
                        bestStopId = stopId;
                    }
                }
            }

            if (bestStopId) {
                const option = this.reconstructPath(bestStopId, k, parents, originLat, originLon, destLat, destLon);
                if (option) options.push(option);
            }
        }

        return options.sort((a, b) => a.score - b.score);
    }

    private reconstructPath(
        targetStopId: string,
        round: number,
        parents: Map<string, { tripId: string, fromStopId: string, depTime: number, arrTime: number }>[],
        originLat: number, originLon: number, destLat: number, destLon: number
    ): JourneyOption | null {
        const legs: JourneyLeg[] = [];
        let currentStopId = targetStopId;
        let k = round;

        // Last walk
        const lastStop = this.data.stops.get(targetStopId)!;
        const distLast = calculateDistance(destLat, destLon, lastStop.stop_lat, lastStop.stop_lon);
        if (distLast > 50) {
            legs.unshift({
                type: 'walk',
                walkingMeters: distLast,
                walkingMinutes: distLast / 83.33,
                fromLocation: { lat: lastStop.stop_lat, lon: lastStop.stop_lon, name: lastStop.stop_name },
                toLocation: { lat: destLat, lon: destLon, name: 'Destination' }
            });
        }

        while (k > 0) {
            const p = parents[k].get(currentStopId);
            if (!p) break;

            if (p.tripId === 'walk') {
                const fromStop = this.data.stops.get(p.fromStopId)!;
                const toStop = this.data.stops.get(currentStopId)!;
                legs.unshift({
                    type: 'walk',
                    walkingMeters: calculateDistance(fromStop.stop_lat, fromStop.stop_lon, toStop.stop_lat, toStop.stop_lon),
                    walkingMinutes: p.arrTime - p.depTime,
                    fromStop: fromStop,
                    toStop: toStop
                });
                currentStopId = p.fromStopId;
                // Don't decrement k yet, walking might be part of the same round or an intermediate step
                // In this simple RAPTOR, walking happens at the end of the round.
            } else {
                const trip = this.data.trips.get(p.tripId)!;
                const route = this.data.routes.get(trip.route_id)!;
                const fromStop = this.data.stops.get(p.fromStopId)!;
                const toStop = this.data.stops.get(currentStopId)!;

                legs.unshift({
                    type: 'bus',
                    route,
                    fromStop,
                    toStop,
                    tripId: p.tripId,
                    departureTime: minutesToTime(p.depTime),
                    arrivalTime: minutesToTime(p.arrTime),
                    stopCount: 0 // Fetch from data if needed
                });
                currentStopId = p.fromStopId;
                k--;
            }
        }

        // First walk
        const firstStopIdx = legs.findIndex(l => l.fromStop);
        const firstStop = firstStopIdx >= 0 ? (legs[firstStopIdx].fromStop!) : lastStop;
        const distFirst = calculateDistance(originLat, originLon, firstStop.stop_lat, firstStop.stop_lon);
        if (distFirst > 50) {
            legs.unshift({
                type: 'walk',
                walkingMeters: distFirst,
                walkingMinutes: distFirst / 83.33,
                fromLocation: { lat: originLat, lon: originLon, name: 'Origin' },
                toLocation: { lat: firstStop.stop_lat, lon: firstStop.stop_lon, name: firstStop.stop_name }
            });
        }

        if (legs.length === 0) return null;

        const totalDuration = timeToMinutes(legs[legs.length - 1].arrivalTime || minutesToTime(bestArrivals.get(targetStopId)!)) - timeToMinutes(legs[0].departureTime || minutesToTime(depMins));

        return {
            legs,
            totalDurationMinutes: totalDuration,
            totalWalkingMinutes: legs.filter(l => l.type === 'walk').reduce((acc, l) => acc + (l.walkingMinutes || 0), 0),
            totalBusMinutes: legs.filter(l => l.type === 'bus').reduce((acc, l) => acc + (timeToMinutes(l.arrivalTime!) - timeToMinutes(l.departureTime!)), 0),
            transferCount: legs.filter(l => l.type === 'bus').length - 1,
            departureTime: legs[0].departureTime || minutesToTime(depMins),
            arrivalTime: legs[legs.length - 1].arrivalTime || minutesToTime(bestArrivals.get(targetStopId)!),
            score: totalDuration // Basic score
        };
    }
}
