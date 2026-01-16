
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
            preference?: 'balanced' | 'fastest' | 'least_walking' | 'fewest_transfers';
            includeNightBuses?: boolean;
        }
    ): JourneyOption[] {
        const timeParts = departureTime.split(':');
        const depMins = parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]);
        const maxRounds = params.maxTransfers + 1;

        const stopCount = this.data.indexToStopId.length;
        const arrivals = Array.from({ length: maxRounds + 1 }, () => new Float32Array(stopCount).fill(Infinity));
        const bestArrivals = new Float32Array(stopCount).fill(Infinity);

        // Tracking for path reconstruction: parent[round][stopIdx] = { tripIdx, fromStopIdx, depTime, arrTime }
        const parents: any[] = Array.from({ length: maxRounds + 1 }, () => ({
            tripIdx: new Int32Array(stopCount).fill(-1),
            fromStopIdx: new Int32Array(stopCount).fill(-1),
            depTime: new Int32Array(stopCount).fill(-1),
            arrTime: new Int32Array(stopCount).fill(-1)
        }));

        // 1. Initial footpaths from origin
        let markedStops = new Set<number>();
        for (let sIdx = 0; sIdx < stopCount; sIdx++) {
            const stop = this.data.stops.get(this.data.indexToStopId[sIdx])!;
            const dist = calculateDistance(originLat, originLon, stop.stop_lat, stop.stop_lon);
            if (dist <= params.maxWalkingDistance) {
                const arr = depMins + (dist / 83.33);
                arrivals[0][sIdx] = arr;
                bestArrivals[sIdx] = arr;
                markedStops.add(sIdx);
            }
        }

        for (let k = 1; k <= maxRounds; k++) {
            const currentMarked = new Set<number>();
            const routesToProcess = new Map<string, number>(); // routeId -> earliest sIdx

            for (const sIdx of markedStops) {
                const start = this.data.stopTimesByStopStart[sIdx];
                const len = this.data.stopTimesByStopLength[sIdx];
                for (let i = 0; i < len; i++) {
                    const stPtr = this.data.stopTimesByStopData[start + i];
                    const tIdx = this.data.stopTimesData[stPtr * 5 + 1];
                    const tripId = this.data.indexToTripId[tIdx];
                    const trip = this.data.trips.get(tripId);
                    if (trip) {
                        if (!routesToProcess.has(trip.route_id)) routesToProcess.set(trip.route_id, sIdx);
                        // Simplified: we'll process all stops on the route anyway
                    }
                }
            }

            for (const [routeId, _] of routesToProcess) {
                let currentTIdx = -1;
                let boardingSIdx = -1;
                let boardingTime = 0;

                const trips = this.data.tripsByRoute.get(routeId) || [];
                if (trips.length === 0) continue;

                // Use the first trip's stops as representative of the route
                const repTIdx = this.data.tripIdToIndex.get(trips[0])!;
                const start = this.data.stopTimesByTripStart[repTIdx];
                const len = this.data.stopTimesByTripLength[repTIdx];

                for (let i = 0; i < len; i++) {
                    const stPtr = start + i;
                    const sIdx = this.data.stopTimesData[stPtr * 5];
                    const arr = this.data.stopTimesData[stPtr * 5 + 3];

                    if (currentTIdx !== -1) {
                        // Find this stop in the CURRENT trip
                        const curStart = this.data.stopTimesByTripStart[currentTIdx];
                        const curLen = this.data.stopTimesByTripLength[currentTIdx];
                        let foundArr = -1;
                        for (let j = 0; j < curLen; j++) {
                            if (this.data.stopTimesData[(curStart + j) * 5] === sIdx) {
                                foundArr = this.data.stopTimesData[(curStart + j) * 5 + 3];
                                break;
                            }
                        }

                        if (foundArr !== -1 && foundArr < bestArrivals[sIdx]) {
                            arrivals[k][sIdx] = foundArr;
                            bestArrivals[sIdx] = foundArr;
                            parents[k].tripIdx[sIdx] = currentTIdx;
                            parents[k].fromStopIdx[sIdx] = boardingSIdx;
                            parents[k].depTime[sIdx] = boardingTime;
                            parents[k].arrTime[sIdx] = foundArr;
                            currentMarked.add(sIdx);
                        }
                    }

                    const prevArr = arrivals[k - 1][sIdx];
                    if (prevArr !== Infinity) {
                        // Find earliest trip that departs after prevArr + 2
                        let bestTIdx = -1;
                        let bestDep = Infinity;
                        for (const tid of trips) {
                            const tIdx = this.data.tripIdToIndex.get(tid)!;
                            const trip = this.data.trips.get(tid);
                            const route = trip ? this.data.routes.get(trip.route_id) : null;

                            // Night bus filtering
                            if (params.includeNightBuses === false) {
                                const isNightRoute = route?.route_short_name?.toUpperCase().startsWith('N');
                                if (isNightRoute) continue;
                            }

                            const tStart = this.data.stopTimesByTripStart[tIdx];
                            const tLen = this.data.stopTimesByTripLength[tIdx];
                            for (let j = 0; j < tLen; j++) {
                                const ptr = tStart + j;
                                if (this.data.stopTimesData[ptr * 5] === sIdx) {
                                    const dep = this.data.stopTimesData[ptr * 5 + 4];

                                    // Additional filter: if not includeNightBuses, skip trips starting after 21:00 (1260 mins)
                                    if (params.includeNightBuses === false && dep > 1260) continue;

                                    if (dep >= prevArr + 2 && dep < bestDep) {
                                        bestDep = dep;
                                        bestTIdx = tIdx;
                                    }
                                    break;
                                }
                            }
                        }
                        if (bestTIdx !== -1 && (currentTIdx === -1 || bestDep < boardingTime)) {
                            currentTIdx = bestTIdx;
                            boardingSIdx = sIdx;
                            boardingTime = bestDep;
                        }
                    }
                }
            }

            // Footpaths
            const footpathMarked = new Set<number>();
            for (const sIdx of currentMarked) {
                const baseArr = arrivals[k][sIdx];
                const lat1 = this.data.stopLats[sIdx];
                const lon1 = this.data.stopLons[sIdx];
                for (let s2Idx = 0; s2Idx < stopCount; s2Idx++) {
                    if (sIdx === s2Idx) continue;

                    const lat2 = this.data.stopLats[s2Idx];
                    const lon2 = this.data.stopLons[s2Idx];

                    // Quick bounding box check (~500m is ~0.005 degrees)
                    if (Math.abs(lat1 - lat2) > 0.005 || Math.abs(lon1 - lon2) > 0.005) continue;

                    const dist = calculateDistance(lat1, lon1, lat2, lon2);
                    if (dist <= 500) {
                        const arr = baseArr + (dist / 83.33);
                        if (arr < bestArrivals[s2Idx]) {
                            arrivals[k][s2Idx] = arr;
                            bestArrivals[s2Idx] = arr;
                            parents[k].tripIdx[s2Idx] = -2; // -2 for walk
                            parents[k].fromStopIdx[s2Idx] = sIdx;
                            parents[k].depTime[s2Idx] = baseArr;
                            parents[k].arrTime[s2Idx] = arr;
                            footpathMarked.add(s2Idx);
                        }
                    }
                }
            }
            markedStops = new Set([...currentMarked, ...footpathMarked]);
            if (markedStops.size === 0) break;
        }

        const options: JourneyOption[] = [];
        for (let k = 1; k <= maxRounds; k++) {
            let bestSIdx = -1;
            let minArr = Infinity;
            for (let sIdx = 0; sIdx < stopCount; sIdx++) {
                const stop = this.data.stops.get(this.data.indexToStopId[sIdx])!;
                const dist = calculateDistance(destLat, destLon, stop.stop_lat, stop.stop_lon);
                if (dist <= params.maxWalkingDistance) {
                    const totalArr = arrivals[k][sIdx] + (dist / 83.33);
                    if (totalArr < minArr) { minArr = totalArr; bestSIdx = sIdx; }
                }
            }
            if (bestSIdx !== -1) {
                const opt = this.reconstructPath(bestSIdx, k, parents, originLat, originLon, destLat, destLon, depMins, params);
                if (opt) options.push(opt);
            }
        }
        return options.sort((a, b) => a.score - b.score);
    }

    private reconstructPath(targetSIdx: number, round: number, parents: any[], oLat: number, oLon: number, dLat: number, dLon: number, depMins: number, params: any): JourneyOption | null {
        const legs: JourneyLeg[] = [];
        let curSIdx = targetSIdx;
        let k = round;

        const lastStop = this.data.stops.get(this.data.indexToStopId[targetSIdx])!;
        const dLast = calculateDistance(dLat, dLon, lastStop.stop_lat, lastStop.stop_lon);
        if (dLast > 50) {
            legs.unshift({ type: 'walk', walkingMeters: dLast, walkingMinutes: dLast / 83.33, fromLocation: { lat: lastStop.stop_lat, lon: lastStop.stop_lon, name: lastStop.stop_name }, toLocation: { lat: dLat, lon: dLon, name: 'Destination' } });
        }

        while (k > 0) {
            const tIdx = parents[k].tripIdx[curSIdx];
            const fSIdx = parents[k].fromStopIdx[curSIdx];
            if (fSIdx === -1) break;

            if (tIdx === -2) { // walk
                const fS = this.data.stops.get(this.data.indexToStopId[fSIdx])!;
                const tS = this.data.stops.get(this.data.indexToStopId[curSIdx])!;
                legs.unshift({ type: 'walk', walkingMeters: calculateDistance(fS.stop_lat, fS.stop_lon, tS.stop_lat, tS.stop_lon), walkingMinutes: parents[k].arrTime[curSIdx] - parents[k].depTime[curSIdx], fromStop: fS, toStop: tS });
                curSIdx = fSIdx;
            } else {
                const tripId = this.data.indexToTripId[tIdx];
                const trip = this.data.trips.get(tripId)!;
                const route = this.data.routes.get(trip.route_id)!;
                legs.unshift({ type: 'bus', route, fromStop: this.data.stops.get(this.data.indexToStopId[fSIdx]), toStop: this.data.stops.get(this.data.indexToStopId[curSIdx]), tripId, departureTime: minutesToTime(parents[k].depTime[curSIdx]), arrivalTime: minutesToTime(parents[k].arrTime[curSIdx]) });
                curSIdx = fSIdx;
                k--;
            }
        }

        const firstStop = legs.length > 0 && legs[0].fromStop ? legs[0].fromStop : lastStop;
        const dFirst = calculateDistance(oLat, oLon, firstStop.stop_lat, firstStop.stop_lon);
        if (dFirst > 50) {
            legs.unshift({ type: 'walk', walkingMeters: dFirst, walkingMinutes: dFirst / 83.33, fromLocation: { lat: oLat, lon: oLon, name: 'Origin' }, toLocation: { lat: firstStop.stop_lat, lon: firstStop.stop_lon, name: firstStop.stop_name } });
        }

        if (legs.length === 0) return null;
        const duration = (parents[round].arrTime[targetSIdx] || depMins) - depMins;
        const transferCount = legs.filter(l => l.type === 'bus').length - 1;
        const walkingMinutes = legs.filter(l => l.type === 'walk').reduce((a, l) => a + (l.walkingMinutes || 0), 0);

        let score = duration;
        if (params.preference === 'least_walking') score += walkingMinutes * 10;
        else if (params.preference === 'fewest_transfers') score += transferCount * 30;
        else if (params.preference === 'fastest') score = duration;
        else score += (transferCount * 5) + (walkingMinutes * 2);

        return { legs, totalDurationMinutes: duration, totalWalkingMinutes: walkingMinutes, totalBusMinutes: legs.filter(l => l.type === 'bus').reduce((a, l) => a + (parseInt(l.arrivalTime!.split(':')[0]) * 60 + parseInt(l.arrivalTime!.split(':')[1]) - (parseInt(l.departureTime!.split(':')[0]) * 60 + parseInt(l.departureTime!.split(':')[1]))), 0), transferCount, departureTime: legs[0].departureTime || minutesToTime(depMins), arrivalTime: legs[legs.length - 1].arrivalTime || minutesToTime(depMins + duration), score };
    }
}
