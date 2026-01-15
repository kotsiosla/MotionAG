
import { GTFS_STATIC_URLS } from "../gtfs-proxy/index.ts"; // Reuse URLs

export interface RouteInfo {
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    route_type?: number;
    route_color?: string;
}

export interface StopInfo {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
    stop_code?: string;
}

export interface TripInfo {
    trip_id: string;
    route_id: string;
    service_id: string;
    direction_id?: number;
}

export interface StopTimeInfo {
    trip_id: string;
    stop_id: string;
    stop_sequence: number;
    arrival_time: string;
    departure_time: string;
}

export interface CalendarEntry {
    service_id: string;
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
    start_date: string;
    end_date: string;
}

export interface GTFSData {
    routes: Map<string, RouteInfo>;
    stops: Map<string, StopInfo>;
    trips: Map<string, TripInfo>;
    stopTimes: StopTimeInfo[];
    stopTimesByTrip: Map<string, StopTimeInfo[]>;
    stopTimesByStop: Map<string, StopTimeInfo[]>;
    calendar: Map<string, CalendarEntry>;
    tripsByRoute: Map<string, string[]>;
}

async function unzipAndParseFile(zipData: Uint8Array, targetFileName: string): Promise<string | null> {
    let offset = 0;
    while (offset < zipData.length - 4) {
        if (zipData[offset] === 0x50 && zipData[offset + 1] === 0x4b &&
            zipData[offset + 2] === 0x03 && zipData[offset + 3] === 0x04) {
            const view = new DataView(zipData.buffer, zipData.byteOffset + offset);
            const compressionMethod = view.getUint16(8, true);
            const compressedSize = view.getUint32(18, true);
            const uncompressedSize = view.getUint32(22, true);
            const fileNameLength = view.getUint16(26, true);
            const extraFieldLength = view.getUint16(28, true);

            const fileNameStart = offset + 30;
            const fileName = new TextDecoder().decode(zipData.slice(fileNameStart, fileNameStart + fileNameLength));
            const dataStart = fileNameStart + fileNameLength + extraFieldLength;

            if (fileName === targetFileName) {
                if (compressionMethod === 0) {
                    return new TextDecoder().decode(zipData.slice(dataStart, dataStart + uncompressedSize));
                } else if (compressionMethod === 8) {
                    try {
                        const compressedData = zipData.slice(dataStart, dataStart + compressedSize);
                        const ds = new DecompressionStream('deflate-raw');
                        const writer = ds.writable.getWriter();
                        const reader = ds.readable.getReader();
                        writer.write(compressedData);
                        writer.close();
                        const chunks: Uint8Array[] = [];
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            chunks.push(value);
                        }
                        const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
                        const decompressed = new Uint8Array(totalLength);
                        let position = 0;
                        for (const chunk of chunks) { decompressed.set(chunk, position); position += chunk.length; }
                        return new TextDecoder().decode(decompressed);
                    } catch (e) {
                        console.error(`Failed to decompress ${targetFileName}:`, e);
                        return null;
                    }
                }
            }
            offset = dataStart + compressedSize;
        } else { offset++; }
    }
    return null;
}

function parseCSV(content: string): string[][] {
    const lines = content.split('\n');
    return lines.map(line => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (const char of line.trim()) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
            else current += char;
        }
        values.push(current.trim());
        return values;
    }).filter(v => v.length > 1);
}

export async function loadAllGTFS(): Promise<GTFSData> {
    const data: GTFSData = {
        routes: new Map(),
        stops: new Map(),
        trips: new Map(),
        stopTimes: [],
        stopTimesByTrip: new Map(),
        stopTimesByStop: new Map(),
        calendar: new Map(),
        tripsByRoute: new Map(),
    };

    const operators = Object.keys(GTFS_STATIC_URLS);

    for (const opId of operators) {
        const url = GTFS_STATIC_URLS[opId];
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const zipData = new Uint8Array(await response.arrayBuffer());

            // Parse routes.txt
            const routesContent = await unzipAndParseFile(zipData, 'routes.txt');
            if (routesContent) {
                const rows = parseCSV(routesContent);
                const header = rows[0];
                const idIdx = header.indexOf('route_id');
                const shortIdx = header.indexOf('route_short_name');
                const longIdx = header.indexOf('route_long_name');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    data.routes.set(row[idIdx], {
                        route_id: row[idIdx],
                        route_short_name: row[shortIdx] || '',
                        route_long_name: row[longIdx] || '',
                    });
                }
            }

            // Parse stops.txt
            const stopsContent = await unzipAndParseFile(zipData, 'stops.txt');
            if (stopsContent) {
                const rows = parseCSV(stopsContent);
                const header = rows[0];
                const idIdx = header.indexOf('stop_id');
                const nameIdx = header.indexOf('stop_name');
                const latIdx = header.indexOf('stop_lat');
                const lonIdx = header.indexOf('stop_lon');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const lat = parseFloat(row[latIdx]);
                    const lon = parseFloat(row[lonIdx]);
                    if (!isNaN(lat) && !isNaN(lon)) {
                        data.stops.set(row[idIdx], {
                            stop_id: row[idIdx],
                            stop_name: row[nameIdx],
                            stop_lat: lat,
                            stop_lon: lon,
                        });
                    }
                }
            }

            // Parse trips.txt
            const tripsContent = await unzipAndParseFile(zipData, 'trips.txt');
            if (tripsContent) {
                const rows = parseCSV(tripsContent);
                const header = rows[0];
                const idIdx = header.indexOf('trip_id');
                const routeIdx = header.indexOf('route_id');
                const serviceIdx = header.indexOf('service_id');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    data.trips.set(row[idIdx], {
                        trip_id: row[idIdx],
                        route_id: row[routeIdx],
                        service_id: row[serviceIdx],
                    });
                    if (!data.tripsByRoute.has(row[routeIdx])) data.tripsByRoute.set(row[routeIdx], []);
                    data.tripsByRoute.get(row[routeIdx])!.push(row[idIdx]);
                }
            }

            // Parse stop_times.txt
            const stopTimesContent = await unzipAndParseFile(zipData, 'stop_times.txt');
            if (stopTimesContent) {
                const rows = parseCSV(stopTimesContent);
                const header = rows[0];
                const tripIdx = header.indexOf('trip_id');
                const stopIdx = header.indexOf('stop_id');
                const seqIdx = header.indexOf('stop_sequence');
                const arrIdx = header.indexOf('arrival_time');
                const depIdx = header.indexOf('departure_time');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    const st: StopTimeInfo = {
                        trip_id: row[tripIdx],
                        stop_id: row[stopIdx],
                        stop_sequence: parseInt(row[seqIdx]),
                        arrival_time: row[arrIdx],
                        departure_time: row[depIdx],
                    };
                    data.stopTimes.push(st);
                    if (!data.stopTimesByTrip.has(st.trip_id)) data.stopTimesByTrip.set(st.trip_id, []);
                    data.stopTimesByTrip.get(st.trip_id)!.push(st);
                    if (!data.stopTimesByStop.has(st.stop_id)) data.stopTimesByStop.set(st.stop_id, []);
                    data.stopTimesByStop.get(st.stop_id)!.push(st);
                }
            }

            // Parse calendar.txt
            const calendarContent = await unzipAndParseFile(zipData, 'calendar.txt');
            if (calendarContent) {
                const rows = parseCSV(calendarContent);
                const header = rows[0];
                const idIdx = header.indexOf('service_id');
                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    data.calendar.set(row[idIdx], {
                        service_id: row[idIdx],
                        monday: row[header.indexOf('monday')] === '1',
                        tuesday: row[header.indexOf('tuesday')] === '1',
                        wednesday: row[header.indexOf('wednesday')] === '1',
                        thursday: row[header.indexOf('thursday')] === '1',
                        friday: row[header.indexOf('friday')] === '1',
                        saturday: row[header.indexOf('saturday')] === '1',
                        sunday: row[header.indexOf('sunday')] === '1',
                        start_date: row[header.indexOf('start_date')],
                        end_date: row[header.indexOf('end_date')],
                    });
                }
            }

            console.log(`Loaded GTFS for operator ${opId}`);
        } catch (e) {
            console.error(`Error loading GTFS for ${opId}:`, e);
        }
    }

    // Final sort for stopTimesByTrip
    for (const tripId of data.stopTimesByTrip.keys()) {
        data.stopTimesByTrip.get(tripId)!.sort((a, b) => a.stop_sequence - b.stop_sequence);
    }

    return data;
}
