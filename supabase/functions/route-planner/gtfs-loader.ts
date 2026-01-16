
import { GTFS_STATIC_URLS } from "../_shared/gtfs-constants.ts";

export interface RouteInfo {
    route_id: string;
    route_short_name: string;
    route_long_name: string;
}

export interface StopInfo {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
}

export interface TripInfo {
    trip_id: string;
    route_id: string;
    service_id: string;
}

export interface GTFSData {
    routes: Map<string, RouteInfo>;
    stops: Map<string, StopInfo>;
    trips: Map<string, TripInfo>;
    calendar: Map<string, any>;
    tripsByRoute: Map<string, string[]>;

    stopTimesData: Int32Array;
    stopTimesByTripStart: Int32Array;
    stopTimesByTripLength: Int32Array;
    stopTimesByStopData: Int32Array;
    stopTimesByStopStart: Int32Array;
    stopTimesByStopLength: Int32Array;

    // Stop coordinates in TypedArrays for fast spatial search
    stopLats: Float32Array;
    stopLons: Float32Array;

    stopIdToIndex: Map<string, number>;
    indexToStopId: string[];
    tripIdToIndex: Map<string, number>;
    indexToTripId: string[];
    loadedDate?: string;
}

async function unzipAndProcess(zipData: Uint8Array, targetFileName: string, rowHandler: (row: string[]) => void): Promise<void> {
    let offset = 0;
    while (offset < zipData.length - 4) {
        if (zipData[offset] === 0x50 && zipData[offset + 1] === 0x4b &&
            zipData[offset + 2] === 0x03 && zipData[offset + 3] === 0x04) {
            const view = new DataView(zipData.buffer, zipData.byteOffset + offset);
            const compressionMethod = view.getUint16(8, true);
            const compressedSize = view.getUint32(18, true);
            const fileNameLength = view.getUint16(26, true);
            const extraFieldLength = view.getUint16(28, true);
            const fileNameStart = offset + 30;
            const fileName = new TextDecoder().decode(zipData.slice(fileNameStart, fileNameStart + fileNameLength));
            const dataStart = fileNameStart + fileNameLength + extraFieldLength;

            if (fileName === targetFileName) {
                if (compressionMethod === 0) {
                    const decoder = new TextDecoder();
                    const content = decoder.decode(zipData.slice(dataStart, dataStart + compressedSize));
                    const lines = content.split('\n');
                    for (const line of lines) { if (line.trim()) rowHandler(parseCSVLine(line)); }
                    return;
                } else if (compressionMethod === 8) {
                    const ds = new DecompressionStream('deflate-raw');
                    const writer = ds.writable.getWriter();
                    writer.write(zipData.slice(dataStart, dataStart + compressedSize));
                    writer.close();
                    const reader = ds.readable.getReader();
                    const decoder = new TextDecoder();
                    let remaining = "";
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = remaining + decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');
                        remaining = lines.pop() || "";
                        for (const line of lines) { if (line.trim()) rowHandler(parseCSVLine(line)); }
                    }
                    if (remaining.trim()) rowHandler(parseCSVLine(remaining));
                    return;
                }
            }
            offset = dataStart + compressedSize;
        } else { offset++; }
    }
}

function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
        else current += char;
    }
    values.push(current.trim());
    return values;
}

export async function loadAllGTFS(targetDate?: string): Promise<GTFSData> {
    const data: any = {
        routes: new Map(),
        stops: new Map(),
        trips: new Map(),
        calendar: new Map(),
        tripsByRoute: new Map(),
        stopIdToIndex: new Map(),
        indexToStopId: [],
        tripIdToIndex: new Map(),
        indexToTripId: [],
        loadedDate: targetDate || new Date().toISOString().split('T')[0]
    };

    function timeToMinutes(time: string): number {
        const parts = time.trim().split(':');
        if (parts.length < 2) return 0;
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }

    const loadDate = targetDate ? new Date(targetDate) : new Date();
    const currentDay = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][loadDate.getDay()];
    const dateStr = data.loadedDate.replace(/-/g, '');

    const MAX_STOP_TIMES = 800000;
    const stopTimesData = new Int32Array(MAX_STOP_TIMES * 5);
    let stopTimePtr = 0;

    console.log(`Loading optimized island-wide GTFS for date: ${dateStr}`);

    for (const opId of Object.keys(GTFS_STATIC_URLS)) {
        try {
            const resp = await fetch(GTFS_STATIC_URLS[opId]);
            if (!resp.ok) continue;
            const zipData = new Uint8Array(await resp.arrayBuffer());

            const activeServices = new Set<string>();
            const opActiveTrips = new Set<string>();

            async function processWithHeader(fn: string, hdl: (row: string[], h: Record<string, number>) => void) {
                let h: Record<string, number> | null = null;
                await unzipAndProcess(zipData, fn, (row) => {
                    if (!h) { h = {}; row.forEach((c, i) => h![c.trim()] = i); }
                    else hdl(row, h);
                });
            }

            await processWithHeader('calendar.txt', (row, h) => {
                if (row[h[currentDay]] === '1' && dateStr >= row[h['start_date']] && dateStr <= row[h['end_date']]) activeServices.add(row[h['service_id']]);
            });

            await processWithHeader('calendar_dates.txt', (row, h) => {
                if (row[h['date']] === dateStr) {
                    if (row[h['exception_type']] === '1') activeServices.add(row[h['service_id']]);
                    else if (row[h['exception_type']] === '2') activeServices.delete(row[h['service_id']]);
                }
            });

            if (activeServices.size === 0) continue;

            await processWithHeader('routes.txt', (row, h) => {
                const id = row[h['route_id']];
                data.routes.set(id, { route_id: id, route_short_name: row[h['route_short_name']] || '', route_long_name: row[h['route_long_name']] || '' });
            });

            await processWithHeader('stops.txt', (row, h) => {
                const id = row[h['stop_id']];
                if (!data.stopIdToIndex.has(id)) {
                    data.stopIdToIndex.set(id, data.indexToStopId.length);
                    data.indexToStopId.push(id);
                    data.stops.set(id, { stop_id: id, stop_name: row[h['stop_name']], stop_lat: parseFloat(row[h['stop_lat']]), stop_lon: parseFloat(row[h['stop_lon']]) });
                }
            });

            await processWithHeader('trips.txt', (row, h) => {
                if (activeServices.has(row[h['service_id']])) {
                    const tid = row[h['trip_id']];
                    const rid = row[h['route_id']];
                    opActiveTrips.add(tid);
                    if (!data.tripIdToIndex.has(tid)) {
                        data.tripIdToIndex.set(tid, data.indexToTripId.length);
                        data.indexToTripId.push(tid);
                        data.trips.set(tid, { trip_id: tid, route_id: rid, service_id: row[h['service_id']] });
                        if (!data.tripsByRoute.has(rid)) data.tripsByRoute.set(rid, []);
                        data.tripsByRoute.get(rid)!.push(tid);
                    }
                }
            });

            await processWithHeader('stop_times.txt', (row, h) => {
                const tid = row[h['trip_id']];
                if (opActiveTrips.has(tid)) {
                    if (stopTimePtr < MAX_STOP_TIMES) {
                        const base = stopTimePtr * 5;
                        stopTimesData[base] = data.stopIdToIndex.get(row[h['stop_id']]);
                        stopTimesData[base + 1] = data.tripIdToIndex.get(tid);
                        stopTimesData[base + 2] = parseInt(row[h['stop_sequence']]);
                        stopTimesData[base + 3] = timeToMinutes(row[h['arrival_time']]);
                        stopTimesData[base + 4] = timeToMinutes(row[h['departure_time']]);
                        stopTimePtr++;
                    }
                }
            });
            console.log(`Loaded ${opActiveTrips.size} trips for ${opId}`);
        } catch (e) { console.error(`${opId} failed:`, e); }
    }

    if (stopTimePtr === 0) throw new Error("No data loaded");

    data.stopTimesData = stopTimesData.slice(0, stopTimePtr * 5);

    // Build stop coordinate TypedArrays
    data.stopLats = new Float32Array(data.indexToStopId.length);
    data.stopLons = new Float32Array(data.indexToStopId.length);
    for (let i = 0; i < data.indexToStopId.length; i++) {
        const s = data.stops.get(data.indexToStopId[i])!;
        data.stopLats[i] = s.stop_lat;
        data.stopLons[i] = s.stop_lon;
    }

    const tripsCount = data.indexToTripId.length;
    data.stopTimesByTripStart = new Int32Array(tripsCount).fill(-1);
    data.stopTimesByTripLength = new Int32Array(tripsCount).fill(0);

    const indices = new Int32Array(stopTimePtr);
    for (let i = 0; i < stopTimePtr; i++) indices[i] = i;
    indices.sort((a, b) => {
        const ta = data.stopTimesData[a * 5 + 1];
        const tb = data.stopTimesData[b * 5 + 1];
        if (ta !== tb) return ta - tb;
        return data.stopTimesData[a * 5 + 2] - data.stopTimesData[b * 5 + 2];
    });

    const sortedST = new Int32Array(data.stopTimesData.length);
    for (let i = 0; i < stopTimePtr; i++) {
        const oldBase = indices[i] * 5;
        const newBase = i * 5;
        sortedST.set(data.stopTimesData.subarray(oldBase, oldBase + 5), newBase);
        const tIdx = sortedST[newBase + 1];
        if (data.stopTimesByTripStart[tIdx] === -1) data.stopTimesByTripStart[tIdx] = i;
        data.stopTimesByTripLength[tIdx]++;
    }
    data.stopTimesData = sortedST;

    const stopsCount = data.indexToStopId.length;
    data.stopTimesByStopStart = new Int32Array(stopsCount).fill(-1);
    data.stopTimesByStopLength = new Int32Array(stopsCount).fill(0);
    for (let i = 0; i < stopTimePtr; i++) data.stopTimesByStopLength[data.stopTimesData[i * 5]]++;
    let currentStart = 0;
    for (let i = 0; i < stopsCount; i++) {
        data.stopTimesByStopStart[i] = currentStart;
        currentStart += data.stopTimesByStopLength[i];
    }
    data.stopTimesByStopData = new Int32Array(stopTimePtr);
    const stopFillPtr = new Int32Array(stopsCount).fill(0);
    for (let i = 0; i < stopTimePtr; i++) {
        const sIdx = data.stopTimesData[i * 5];
        data.stopTimesByStopData[data.stopTimesByStopStart[sIdx] + stopFillPtr[sIdx]] = i;
        stopFillPtr[sIdx]++;
    }

    return data as GTFSData;
}
