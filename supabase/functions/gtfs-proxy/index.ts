import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GTFS_RT_BASE_URL = "http://20.19.98.194:8328/Api/api/gtfs-realtime";
const SIRI_WS_URL = "http://20.19.98.194:8313/SiriWS.asmx";

// Track data source health for intelligent fallback
interface DataSourceHealth {
    lastSuccess: number;
    lastFailure: number;
    consecutiveFailures: number;
    avgResponseTime: number;
}

const dataSourceHealth: Record<string, DataSourceHealth> = {
    gtfs: { lastSuccess: 0, lastFailure: 0, consecutiveFailures: 0, avgResponseTime: 0 },
    siri: { lastSuccess: 0, lastFailure: 0, consecutiveFailures: 0, avgResponseTime: 0 },
};

// Initialize Supabase Client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// GTFS-Realtime Protocol Buffer Parser
// Based on the GTFS-RT specification: https://gtfs.org/realtime/reference/

function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
    let result = 0;
    let shift = 0;
    let bytesRead = 0;

    while (offset + bytesRead < data.length) {
        const byte = data[offset + bytesRead];
        result |= (byte & 0x7F) << shift;
        bytesRead++;
        if ((byte & 0x80) === 0) break;
        shift += 7;
    }

    return { value: result, bytesRead };
}

function readFixed64(data: Uint8Array, offset: number): number {
    const view = new DataView(data.buffer, data.byteOffset + offset, 8);
    return view.getFloat64(0, true);
}

function readFixed32(data: Uint8Array, offset: number): number {
    const view = new DataView(data.buffer, data.byteOffset + offset, 4);
    return view.getFloat32(0, true);
}

function readString(data: Uint8Array, offset: number, length: number): string {
    const decoder = new TextDecoder();
    return decoder.decode(data.slice(offset, offset + length));
}

interface ParsedField {
    fieldNumber: number;
    wireType: number;
    value: unknown;
    rawBytes?: Uint8Array;
}

function parseProtobuf(data: Uint8Array): ParsedField[] {
    const fields: ParsedField[] = [];
    let offset = 0;

    while (offset < data.length) {
        const { value: tag, bytesRead: tagBytes } = readVarint(data, offset);
        offset += tagBytes;

        const fieldNumber = tag >> 3;
        const wireType = tag & 0x7;

        let value: unknown;
        let rawBytes: Uint8Array | undefined;

        switch (wireType) {
            case 0: { // Varint
                const { value: v, bytesRead } = readVarint(data, offset);
                value = v;
                offset += bytesRead;
                break;
            }
            case 1: { // 64-bit
                value = readFixed64(data, offset);
                offset += 8;
                break;
            }
            case 2: { // Length-delimited
                const { value: length, bytesRead } = readVarint(data, offset);
                offset += bytesRead;
                rawBytes = data.slice(offset, offset + length);
                value = rawBytes;
                offset += length;
                break;
            }
            case 5: { // 32-bit
                value = readFixed32(data, offset);
                offset += 4;
                break;
            }
            default:
                console.log(`Unknown wire type: ${wireType} at offset ${offset}`);
                return fields;
        }

        fields.push({ fieldNumber, wireType, value, rawBytes });
    }

    return fields;
}

interface TranslatedString {
    text?: string;
    language?: string;
}

function parseTranslatedString(data: Uint8Array): TranslatedString[] {
    const fields = parseProtobuf(data);
    const translations: TranslatedString[] = [];

    for (const field of fields) {
        if (field.fieldNumber === 1 && field.rawBytes) {
            const transFields = parseProtobuf(field.rawBytes);
            const translation: TranslatedString = {};
            for (const tf of transFields) {
                if (tf.fieldNumber === 1 && tf.rawBytes) {
                    translation.text = readString(tf.rawBytes, 0, tf.rawBytes.length);
                }
                if (tf.fieldNumber === 2 && tf.rawBytes) {
                    translation.language = readString(tf.rawBytes, 0, tf.rawBytes.length);
                }
            }
            translations.push(translation);
        }
    }

    return translations;
}

function parseTripDescriptor(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const trip: Record<string, unknown> = {};

    // GTFS-RT TripDescriptor field numbers:
    // 1: trip_id
    // 2: start_time (e.g., "23:10:00")
    // 3: start_date (e.g., "20251225")
    // 4: schedule_relationship
    // 5: route_id (e.g., "58")
    // 6: direction_id

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) trip.tripId = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 2:
                if (field.rawBytes) trip.startTime = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 3:
                if (field.rawBytes) trip.startDate = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 4:
                trip.scheduleRelationship = field.value;
                break;
            case 5:
                if (field.rawBytes) trip.routeId = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 6:
                trip.directionId = field.value;
                break;
        }
    }

    return trip;
}

function parseVehicleDescriptor(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const vehicle: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) vehicle.id = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 2:
                if (field.rawBytes) vehicle.label = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 3:
                if (field.rawBytes) vehicle.licensePlate = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
        }
    }

    return vehicle;
}

function parsePosition(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const position: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                position.latitude = field.value;
                break;
            case 2:
                position.longitude = field.value;
                break;
            case 3:
                position.bearing = field.value;
                break;
            case 4:
                position.odometer = field.value;
                break;
            case 5:
                position.speed = field.value;
                break;
        }
    }

    return position;
}

function parseStopTimeEvent(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const event: Record<string, number | undefined> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1: {
                let delay = field.value as number;
                // Handle signed varint for delay
                if (delay > 0x7FFFFFFF) {
                    delay = delay - 0x100000000;
                }
                event.delay = delay;
                break;
            }
            case 2:
                event.time = field.value as number;
                break;
            case 3:
                event.uncertainty = field.value as number;
                break;
        }
    }

    return event;
}

function parseStopTimeUpdate(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const stu: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                stu.stopSequence = field.value;
                break;
            case 2:
                if (field.rawBytes) stu.arrival = parseStopTimeEvent(field.rawBytes);
                break;
            case 3:
                if (field.rawBytes) stu.departure = parseStopTimeEvent(field.rawBytes);
                break;
            case 4:
                if (field.rawBytes) stu.stopId = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 5:
                stu.scheduleRelationship = field.value;
                break;
        }
    }

    return stu;
}

function parseTripUpdate(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const tripUpdate: Record<string, unknown> = {};
    const stopTimeUpdates: Record<string, unknown>[] = [];

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) tripUpdate.trip = parseTripDescriptor(field.rawBytes);
                break;
            case 2:
                if (field.rawBytes) stopTimeUpdates.push(parseStopTimeUpdate(field.rawBytes));
                break;
            case 3:
                if (field.rawBytes) tripUpdate.vehicle = parseVehicleDescriptor(field.rawBytes);
                break;
            case 4:
                tripUpdate.timestamp = field.value;
                break;
            case 5:
                tripUpdate.delay = field.value;
                break;
        }
    }

    if (stopTimeUpdates.length > 0) {
        tripUpdate.stopTimeUpdate = stopTimeUpdates;
    }

    return tripUpdate;
}

function parseVehiclePosition(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const vp: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) vp.trip = parseTripDescriptor(field.rawBytes);
                break;
            case 2:
                if (field.rawBytes) vp.position = parsePosition(field.rawBytes);
                break;
            case 3:
                vp.currentStopSequence = field.value;
                break;
            case 4:
                vp.currentStatus = field.value;
                break;
            case 5:
                vp.timestamp = field.value;
                break;
            case 6:
                vp.congestionLevel = field.value;
                break;
            case 7:
                if (field.rawBytes) vp.stopId = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 8:
                if (field.rawBytes) vp.vehicle = parseVehicleDescriptor(field.rawBytes);
                break;
        }
    }

    return vp;
}

function parseActivePeriod(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const period: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                period.start = field.value;
                break;
            case 2:
                period.end = field.value;
                break;
        }
    }

    return period;
}

function parseEntitySelector(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const selector: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) selector.agencyId = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 2:
                if (field.rawBytes) selector.routeId = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 3:
                selector.routeType = field.value;
                break;
            case 4:
                if (field.rawBytes) selector.trip = parseTripDescriptor(field.rawBytes);
                break;
            case 5:
                if (field.rawBytes) selector.stopId = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
        }
    }

    return selector;
}

function parseAlert(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const alert: Record<string, unknown> = {};
    const activePeriods: Record<string, unknown>[] = [];
    const informedEntities: Record<string, unknown>[] = [];

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) activePeriods.push(parseActivePeriod(field.rawBytes));
                break;
            case 5:
                if (field.rawBytes) informedEntities.push(parseEntitySelector(field.rawBytes));
                break;
            case 6:
                alert.cause = field.value;
                break;
            case 7:
                alert.effect = field.value;
                break;
            case 8:
                if (field.rawBytes) alert.url = parseTranslatedString(field.rawBytes);
                break;
            case 10:
                if (field.rawBytes) alert.headerText = parseTranslatedString(field.rawBytes);
                break;
            case 11:
                if (field.rawBytes) alert.descriptionText = parseTranslatedString(field.rawBytes);
                break;
            case 14:
                alert.severityLevel = field.value;
                break;
        }
    }

    if (activePeriods.length > 0) alert.activePeriod = activePeriods;
    if (informedEntities.length > 0) alert.informedEntity = informedEntities;

    return alert;
}

function parseFeedEntity(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const entity: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) entity.id = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 2:
                entity.isDeleted = field.value === 1;
                break;
            case 3:
                if (field.rawBytes) entity.tripUpdate = parseTripUpdate(field.rawBytes);
                break;
            case 4:
                if (field.rawBytes) entity.vehicle = parseVehiclePosition(field.rawBytes);
                break;
            case 5:
                if (field.rawBytes) entity.alert = parseAlert(field.rawBytes);
                break;
        }
    }

    return entity;
}

function parseFeedHeader(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const header: Record<string, unknown> = {};

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) header.gtfsRealtimeVersion = readString(field.rawBytes, 0, field.rawBytes.length);
                break;
            case 2:
                header.incrementality = field.value;
                break;
            case 3:
                header.timestamp = field.value;
                break;
        }
    }

    return header;
}

function parseFeedMessage(data: Uint8Array): Record<string, unknown> {
    const fields = parseProtobuf(data);
    const feed: Record<string, unknown> = {};
    const entities: Record<string, unknown>[] = [];

    for (const field of fields) {
        switch (field.fieldNumber) {
            case 1:
                if (field.rawBytes) feed.header = parseFeedHeader(field.rawBytes);
                break;
            case 2:
                if (field.rawBytes) entities.push(parseFeedEntity(field.rawBytes));
                break;
        }
    }

    feed.entity = entities;
    return feed;
}

// Types for the parsed data
interface GtfsRealtimeFeed {
    header?: {
        gtfsRealtimeVersion?: string;
        incrementality?: number;
        timestamp?: number;
    };
    entity?: FeedEntity[];
}

interface FeedEntity {
    id?: string;
    isDeleted?: boolean;
    vehicle?: VehiclePosition;
    tripUpdate?: TripUpdate;
    alert?: AlertData;
}

interface VehiclePosition {
    trip?: TripDescriptor;
    position?: Position;
    currentStopSequence?: number;
    currentStatus?: number;
    timestamp?: number;
    stopId?: string;
    vehicle?: VehicleDescriptor;
}

interface TripUpdate {
    trip?: TripDescriptor;
    vehicle?: VehicleDescriptor;
    stopTimeUpdate?: StopTimeUpdate[];
    timestamp?: number;
    delay?: number;
}

interface StopTimeUpdate {
    stopSequence?: number;
    stopId?: string;
    arrival?: StopTimeEvent;
    departure?: StopTimeEvent;
    scheduleRelationship?: number;
}

interface StopTimeEvent {
    delay?: number;
    time?: number;
    uncertainty?: number;
}

interface AlertData {
    activePeriod?: { start?: number; end?: number }[];
    informedEntity?: EntitySelector[];
    cause?: number;
    effect?: number;
    url?: TranslatedString[];
    headerText?: TranslatedString[];
    descriptionText?: TranslatedString[];
    severityLevel?: number;
}

interface TripDescriptor {
    tripId?: string;
    routeId?: string;
    directionId?: number;
    startTime?: string;
    startDate?: string;
    scheduleRelationship?: number;
}

interface VehicleDescriptor {
    id?: string;
    label?: string;
    licensePlate?: string;
}

interface Position {
    latitude?: number;
    longitude?: number;
    bearing?: number;
    odometer?: number;
    speed?: number;
}

interface EntitySelector {
    agencyId?: string;
    routeId?: string;
    routeType?: number;
    trip?: TripDescriptor;
    stopId?: string;
}

async function fetchGtfsData(operatorId?: string): Promise<GtfsRealtimeFeed> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000); // 45 second timeout

    // Build URL with optional operator filter
    const url = operatorId && operatorId !== 'all'
        ? `${GTFS_RT_BASE_URL}/${operatorId}`
        : GTFS_RT_BASE_URL;

    console.log(`Fetching GTFS data from: ${url}`);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'Accept': '*/*',
            },
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);

        console.log(`Received ${data.length} bytes of protobuf data`);

        const feed = parseFeedMessage(data) as GtfsRealtimeFeed;

        console.log(`Parsed ${feed.entity?.length || 0} entities`);

        return feed;
    } catch (error) {
        clearTimeout(timeout);
        console.error("Error fetching GTFS data:", error);
        throw error;
    }
}

// ========== SIRI API SUPPORT FOR FALLBACK/VERIFICATION ==========
interface SiriEstimatedCall {
    stopId: string;
    stopName?: string;
    aimedArrivalTime?: number;
    expectedArrivalTime?: number;
    aimedDepartureTime?: number;
    expectedDepartureTime?: number;
}

interface SiriVehicleJourney {
    lineRef: string;
    directionName?: string;
    vehicleJourneyRef?: string;
    vehicleRef?: string;
    publishedLineName?: string;
    operatorRef?: string;
    estimatedCalls: SiriEstimatedCall[];
}

// Parse SIRI XML response
function parseSiriDateTime(dateStr: string | undefined): number | undefined {
    if (!dateStr) return undefined;
    try {
        return Math.floor(new Date(dateStr).getTime() / 1000);
    } catch {
        return undefined;
    }
}

function extractXmlValue(xml: string, tagName: string): string | undefined {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : undefined;
}

function extractAllXmlBlocks(xml: string, tagName: string): string[] {
    const blocks: string[] = [];
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'gi');
    let match;
    while ((match = regex.exec(xml)) !== null) {
        blocks.push(match[0]);
    }
    return blocks;
}

async function fetchSiriData(stopId?: string, lineRef?: string): Promise<SiriVehicleJourney[]> {
    const startTime = Date.now();

    try {
        // Build SOAP request for SIRI GetEstimatedTimetable
        const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetEstimatedTimetable xmlns="http://20.19.98.194:8313/">
      <operatorRefField></operatorRefField>
      <linesField>${lineRef ? `<LineDirectionStructure><lineRefField><value>${lineRef}</value></lineRefField></LineDirectionStructure>` : ''}</linesField>
      <extensionsField>${stopId ? `<value>${stopId}</value>` : ''}</extensionsField>
    </GetEstimatedTimetable>
  </soap:Body>
</soap:Envelope>`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout for SIRI

        const response = await fetch(SIRI_WS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://20.19.98.194:8313/GetEstimatedTimetable',
            },
            body: soapEnvelope,
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`SIRI HTTP error: ${response.status}`);
        }

        const xmlText = await response.text();
        const journeys: SiriVehicleJourney[] = [];

        // Parse vehicle journeys from XML
        const vehicleJourneyBlocks = extractAllXmlBlocks(xmlText, 'EstimatedVehicleJourney');

        for (const journeyXml of vehicleJourneyBlocks) {
            const lineRefValue = extractXmlValue(journeyXml, 'LineRef') || extractXmlValue(journeyXml, 'lineRefField');
            const vehicleRef = extractXmlValue(journeyXml, 'VehicleRef') || extractXmlValue(journeyXml, 'vehicleRefField');
            const vehicleJourneyRef = extractXmlValue(journeyXml, 'VehicleJourneyRef') || extractXmlValue(journeyXml, 'vehicleJourneyRefField');

            const estimatedCalls: SiriEstimatedCall[] = [];
            const callBlocks = extractAllXmlBlocks(journeyXml, 'EstimatedCall');

            for (const callXml of callBlocks) {
                const stopIdValue = extractXmlValue(callXml, 'StopPointRef') || extractXmlValue(callXml, 'stopPointNameField');
                const aimedArrival = extractXmlValue(callXml, 'AimedArrivalTime') || extractXmlValue(callXml, 'aimedArrivalTimeField');
                const expectedArrival = extractXmlValue(callXml, 'ExpectedArrivalTime') || extractXmlValue(callXml, 'expectedArrivalTimeField');
                const aimedDeparture = extractXmlValue(callXml, 'AimedDepartureTime') || extractXmlValue(callXml, 'aimedDepartureTimeField');
                const expectedDeparture = extractXmlValue(callXml, 'ExpectedDepartureTime') || extractXmlValue(callXml, 'expectedDepartureTimeField');

                if (stopIdValue) {
                    estimatedCalls.push({
                        stopId: stopIdValue,
                        aimedArrivalTime: parseSiriDateTime(aimedArrival),
                        expectedArrivalTime: parseSiriDateTime(expectedArrival),
                        aimedDepartureTime: parseSiriDateTime(aimedDeparture),
                        expectedDepartureTime: parseSiriDateTime(expectedDeparture),
                    });
                }
            }

            if (lineRefValue && estimatedCalls.length > 0) {
                journeys.push({
                    lineRef: lineRefValue,
                    vehicleRef,
                    vehicleJourneyRef,
                    estimatedCalls,
                });
            }
        }

        // Update health metrics
        const responseTime = Date.now() - startTime;
        dataSourceHealth.siri.lastSuccess = Date.now();
        dataSourceHealth.siri.consecutiveFailures = 0;
        dataSourceHealth.siri.avgResponseTime = (dataSourceHealth.siri.avgResponseTime + responseTime) / 2;

        console.log(`SIRI: Parsed ${journeys.length} vehicle journeys in ${responseTime}ms`);

        return journeys;
    } catch (error) {
        dataSourceHealth.siri.lastFailure = Date.now();
        dataSourceHealth.siri.consecutiveFailures++;
        console.error("SIRI fetch error:", error);
        return [];
    }
}

// Merge GTFS-RT and SIRI data for best accuracy
interface MergedArrival {
    stopId: string;
    routeId: string;
    tripId?: string;
    vehicleId?: string;
    // Times from different sources
    gtfsArrivalTime?: number;
    gtfsArrivalDelay?: number;
    siriExpectedArrivalTime?: number;
    siriAimedArrivalTime?: number;
    // Best estimated arrival (uses algorithm to pick most accurate)
    bestArrivalTime: number;
    confidence: 'high' | 'medium' | 'low';
    source: 'gtfs' | 'siri' | 'merged';
}

// ========== STATIC GTFS SUPPORT (SHAPES, TRIPS, STOPS) ==========
// URLs for static GTFS zip files per operator
const GTFS_STATIC_URLS: Record<string, string> = {
    'EMEL': 'https://motionbus.card.co.cy/motionbus/export/gtfs/export-GTFS-EMEL.zip',
    'OSYPA': 'https://motionbus.card.co.cy/motionbus/export/gtfs/export-GTFS-OSYPA.zip',
    'OSEA': 'https://motionbus.card.co.cy/motionbus/export/gtfs/export-GTFS-OSEA.zip',
    'LCA': 'https://motionbus.card.co.cy/motionbus/export/gtfs/export-GTFS-LCA.zip',
    // 'CPT': '...' // Add CPT URL if available
};

// Types for static data
interface ShapePoint {
    shape_id: string;
    shape_pt_lat: number;
    shape_pt_lon: number;
    shape_pt_sequence: number;
}

interface TripStaticInfo {
    route_id: string;
    service_id: string;
    trip_id: string;
    trip_headsign: string;
    direction_id: number;
    shape_id: string;
}

interface StopInfo {
    stop_id: string;
    stop_name: string;
    stop_lat: number;
    stop_lon: number;
}

interface StopTimeInfo {
    trip_id: string;
    arrival_time: string;
    departure_time: string;
    stop_id: string;
    stop_sequence: number;
}

// In-memory cache for static data to avoid fetching/parsing zips on every request
// In a real edge function, this cache persists across invocations if the instance is kept alive
const shapesCache = new Map<string, { data: ShapePoint[], timestamp: number }>();
const tripsCache = new Map<string, { data: TripStaticInfo[], timestamp: number }>();
const stopsCache = new Map<string, { data: StopInfo[], timestamp: number }>();

const CACHE_TTL = 3600 * 1000; // 1 hour cache

// Helper to unzip and parse a specific file from a ZIP
// Note: In Deno, we use a library like 'fflate' or built-in apis.
// For simplicity in this example, we assume we can fetch the text file directly or user a simple unzip lib
import { unzip } from "https://deno.land/x/unzip@v1.0.0/mod.ts";

async function unzipAndParseFile(zipData: Uint8Array, fileName: string): Promise<string | null> {
    // Check signature 
    // PK.. = 0x50 0x4B 0x03 0x04
    if (zipData[0] !== 0x50 || zipData[1] !== 0x4B) {
        console.error("Invalid zip file signature");
        return null;
    }

    // Minimal ZIP parser to find specific file
    // This is a complex task. For reliability in Edge Functions, prefer a robust library.
    // Using fflate via ESM
    try {
        const { unzipSync, strFromU8 } = await import("https://esm.sh/fflate@0.8.1");

        // Decompress
        const files = unzipSync(zipData);

        // Find file
        if (files[fileName]) {
            return strFromU8(files[fileName]);
        }

        // Fallback names (sometimes lowercase/uppercase issues)
        const foundKey = Object.keys(files).find(k => k.toLowerCase() === fileName.toLowerCase());
        if (foundKey) {
            return strFromU8(files[foundKey]);
        }

        return null;
    } catch (e) {
        console.error("Error unzipping:", e);
        return null;
    }
}

function parseCSV(content: string): Record<string, string>[] {
    const lines = content.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const result: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Handle CSV quoting basics
        const values: string[] = [];
        let current = '';
        let inQuote = false;
        for (const char of line) {
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);

        const obj: Record<string, string> = {};
        headers.forEach((h, index) => {
            if (values[index] !== undefined) {
                obj[h] = values[index].trim().replace(/^"|"$/g, '');
            }
        });
        result.push(obj);
    }
    return result;
}

function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());
    return values;
}

async function fetchStaticShapes(operatorId?: string): Promise<ShapePoint[]> {
    const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
    const allShapes: ShapePoint[] = [];

    for (const opId of operators) {
        const cacheKey = `shapes_${opId}`;
        const cached = shapesCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            allShapes.push(...cached.data);
            continue;
        }

        const url = GTFS_STATIC_URLS[opId];
        if (!url) continue;

        try {
            console.log(`Fetching static GTFS shapes for operator ${opId}`);
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Failed to fetch GTFS for operator ${opId}: ${response.status}`);
                continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            const zipData = new Uint8Array(arrayBuffer);

            const fileContent = await unzipAndParseFile(zipData, 'shapes.txt');
            if (!fileContent) {
                console.log(`No shapes.txt found for operator ${opId}`);
                continue;
            }

            const lines = fileContent.split('\n');
            const shapes: ShapePoint[] = [];

            if (lines.length > 0) {
                const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const shapeIdIdx = header.indexOf('shape_id');
                const latIdx = header.indexOf('shape_pt_lat');
                const lonIdx = header.indexOf('shape_pt_lon');
                const seqIdx = header.indexOf('shape_pt_sequence');

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const values = parseCSVLine(line);

                    if (shapeIdIdx >= 0 && latIdx >= 0 && lonIdx >= 0 && seqIdx >= 0) {
                        const lat = parseFloat(values[latIdx]);
                        const lon = parseFloat(values[lonIdx]);
                        const seq = parseInt(values[seqIdx]);

                        if (!isNaN(lat) && !isNaN(lon) && !isNaN(seq)) {
                            shapes.push({
                                shape_id: values[shapeIdIdx],
                                shape_pt_lat: lat,
                                shape_pt_lon: lon,
                                shape_pt_sequence: seq,
                            });
                        }
                    }
                }
            }

            console.log(`Parsed ${shapes.length} shape points for operator ${opId}`);
            shapesCache.set(cacheKey, { data: shapes, timestamp: Date.now() });
            allShapes.push(...shapes);
        } catch (error) {
            console.error(`Error fetching static GTFS shapes for operator ${opId}:`, error);
        }
    }

    return allShapes;
}

// Fetch stop times filtered by trip IDs to avoid memory issues with large files
async function fetchStaticStopTimesForTrips(operatorId: string | undefined, tripIds: Set<string>): Promise<StopTimeInfo[]> {
    const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
    const allStopTimes: StopTimeInfo[] = [];

    for (const opId of operators) {
        const url = GTFS_STATIC_URLS[opId];
        if (!url) continue;

        try {
            console.log(`Fetching static GTFS stop_times for operator ${opId} (filtering ${tripIds.size} trips)`);
            const response = await fetch(url);

            if (!response.ok) {
                console.error(`Failed to fetch GTFS for operator ${opId}: ${response.status}`);
                continue;
            }

            const arrayBuffer = await response.arrayBuffer();
            const zipData = new Uint8Array(arrayBuffer);

            const fileContent = await unzipAndParseFile(zipData, 'stop_times.txt');
            if (!fileContent) {
                console.log(`No stop_times.txt found for operator ${opId}`);
                continue;
            }

            const lines = fileContent.split('\n');
            const stopTimes: StopTimeInfo[] = [];

            if (lines.length > 0) {
                const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const tripIdIdx = header.indexOf('trip_id');
                const arrivalIdx = header.indexOf('arrival_time');
                const departureIdx = header.indexOf('departure_time');
                const stopIdIdx = header.indexOf('stop_id');
                const seqIdx = header.indexOf('stop_sequence');

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const values = parseCSVLine(line);
                    const tripId = values[tripIdIdx];

                    if (tripIds.has(tripId)) {
                        if (tripIdIdx >= 0 && arrivalIdx >= 0 && stopIdIdx >= 0) {
                            const seq = parseInt(values[seqIdx]);
                            stopTimes.push({
                                trip_id: tripId,
                                arrival_time: values[arrivalIdx],
                                departure_time: values[departureIdx],
                                stop_id: values[stopIdIdx],
                                stop_sequence: isNaN(seq) ? 0 : seq
                            });
                        }
                    }
                }
            }

            console.log(`Parsed ${stopTimes.length} stop times for operator ${opId}`);
            allStopTimes.push(...stopTimes);
        } catch (error) {
            console.error(`Error fetching static GTFS stop_times for operator ${opId}:`, error);
        }
    }

    return allStopTimes;
}

async function fetchStaticTrips(operatorId?: string): Promise<TripStaticInfo[]> {
    const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
    const allTrips: TripStaticInfo[] = [];

    for (const opId of operators) {
        const cacheKey = `trips_${opId}`;
        const cached = tripsCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            allTrips.push(...cached.data);
            continue;
        }

        const url = GTFS_STATIC_URLS[opId];
        if (!url) continue;

        try {
            console.log(`Fetching static GTFS trips for operator ${opId}`);
            const response = await fetch(url);

            if (!response.ok) continue;

            const arrayBuffer = await response.arrayBuffer();
            const zipData = new Uint8Array(arrayBuffer);

            const fileContent = await unzipAndParseFile(zipData, 'trips.txt');
            if (!fileContent) continue;

            const lines = fileContent.split('\n');
            const trips: TripStaticInfo[] = [];

            if (lines.length > 0) {
                const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const routeIdIdx = header.indexOf('route_id');
                const tripidIdx = header.indexOf('trip_id');
                const signIdx = header.indexOf('trip_headsign');
                const dirIdx = header.indexOf('direction_id');
                const shapeIdx = header.indexOf('shape_id');

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const values = parseCSVLine(line);

                    if (routeIdIdx >= 0) {
                        trips.push({
                            route_id: values[routeIdIdx],
                            service_id: '',
                            trip_id: values[tripidIdx] || '',
                            trip_headsign: values[signIdx] || '',
                            direction_id: parseInt(values[dirIdx]) || 0,
                            shape_id: values[shapeIdx] || ''
                        });
                    }
                }
            }

            console.log(`Parsed ${trips.length} trips for operator ${opId}`);
            tripsCache.set(cacheKey, { data: trips, timestamp: Date.now() });
            allTrips.push(...trips);

        } catch (error) {
            console.error(error);
        }
    }
    return allTrips;
}

async function fetchStaticStops(operatorId?: string): Promise<StopInfo[]> {
    const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
    const allStops: StopInfo[] = [];

    for (const opId of operators) {
        const cacheKey = `stops_${opId}`;
        const cached = stopsCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            allStops.push(...cached.data);
            continue;
        }

        const url = GTFS_STATIC_URLS[opId];
        if (!url) continue;

        try {
            console.log(`Fetching static GTFS stops for operator ${opId}`);
            const response = await fetch(url);

            if (!response.ok) continue;

            const arrayBuffer = await response.arrayBuffer();
            const zipData = new Uint8Array(arrayBuffer);

            const fileContent = await unzipAndParseFile(zipData, 'stops.txt');
            if (!fileContent) continue;

            const lines = fileContent.split('\n');
            const stops: StopInfo[] = [];

            if (lines.length > 0) {
                const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
                const idIdx = header.indexOf('stop_id');
                const nameIdx = header.indexOf('stop_name');
                const latIdx = header.indexOf('stop_lat');
                const lonIdx = header.indexOf('stop_lon');

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    const values = parseCSVLine(line);

                    if (idIdx >= 0) {
                        stops.push({
                            stop_id: values[idIdx],
                            stop_name: values[nameIdx] || '',
                            stop_lat: parseFloat(values[latIdx]) || 0,
                            stop_lon: parseFloat(values[lonIdx]) || 0
                        });
                    }
                }
            }

            console.log(`Parsed ${stops.length} stops for operator ${opId}`);
            stopsCache.set(cacheKey, { data: stops, timestamp: Date.now() });
            allStops.push(...stops);

        } catch (error) {
            console.error(error);
        }
    }
    return allStops;
}


// ========== MAIN SERVER HANDLER ==========
serve(async (req: Request) => {
    // Handle CORS preflight request
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const path = url.pathname.replace(/\/$/, ""); // remove trailing slash
        const operatorId = url.searchParams.get('operator_id') || 'all';
        const routeId = url.searchParams.get('route_id');
        const stopId = url.searchParams.get('stop_id'); // For verifying specific stop

        console.log(`Proxy request for path: ${path}, operator: ${operatorId}, route: ${routeId || 'N/A'}`);

        // Health check endpoint
        if (path === '/health') {
            return new Response(JSON.stringify(dataSourceHealth), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Handle route-shape endpoint - returns shape and stop sequence for a specific route
        if (path === '/route-shape' && routeId) {
            // 1. Try to get from Supabase Cache
            try {
                const { data: cachedData } = await supabase
                    .from('route_shapes')
                    .select('data')
                    .eq('route_id', routeId)
                    .single();

                if (cachedData && cachedData.data) {
                    console.log(`Serving route shape for ${routeId} from Cache`);
                    return new Response(
                        JSON.stringify({
                            data: cachedData.data,
                            timestamp: Date.now(),
                            source: 'cache'
                        }),
                        {
                            headers: {
                                ...corsHeaders,
                                'Content-Type': 'application/json',
                                'Cache-Control': 'public, max-age=86400',
                            }
                        }
                    );
                }
            } catch (err) {
                console.warn('Cache lookup failed:', err);
            }

            let effectiveOperatorId = operatorId;

            // If no operator specified, search ALL operators to find which one has this route
            // We do this by checking cached trips first or fetching if needed
            if (!effectiveOperatorId || effectiveOperatorId === 'all') {
                // This is expensive if not cached, but necessary if frontend doesn't pass operator
                // For now, assume frontend passes operator if possible.
                // Fallback: Check caches
                for (const op of Object.keys(GTFS_STATIC_URLS)) {
                    // ... optimization: implement route-to-operator map
                }
            }

            // Fetch data needed for shape
            const [trips, shapes, stops] = await Promise.all([
                fetchStaticTrips(effectiveOperatorId),
                fetchStaticShapes(effectiveOperatorId),
                fetchStaticStops(effectiveOperatorId)
            ]);

            // Filter trips for this route
            // Note: route_id in GTFS can be complex. We match exact string.
            const routeTrips = trips.filter((t: TripStaticInfo) => t.route_id === routeId);

            if (routeTrips.length === 0) {
                // Try to fuzzy match or find across all operators if not found
                // ...
                return new Response(JSON.stringify({ error: 'Route not found' }), { headers: corsHeaders, status: 404 });
            }

            // Group by direction
            const tripsByDirection = new Map<number, TripStaticInfo[]>();
            routeTrips.forEach((t: TripStaticInfo) => {
                if (!tripsByDirection.has(t.direction_id)) {
                    tripsByDirection.set(t.direction_id, []);
                }
                tripsByDirection.get(t.direction_id)?.push(t);
            });

            // Collect all trip IDs for stop times fetching
            const allRouteTripIds = new Set(routeTrips.map((t: TripStaticInfo) => t.trip_id));
            const stopTimes = await fetchStaticStopTimesForTrips(effectiveOperatorId, allRouteTripIds);

            // Build response for each direction
            const directions: Array<{
                direction_id: number;
                shape: Array<{ lat: number; lng: number }>;
                stops: Array<{ stop_id: string; stop_name: string; stop_sequence: number; lat?: number; lng?: number }>;
            }> = [];

            for (const [directionId, dirTrips] of tripsByDirection) {
                // Use first trip with shape_id
                const tripWithShape = dirTrips.find((t: TripStaticInfo) => t.shape_id);

                let shapePoints: Array<{ lat: number; lng: number }> = [];
                if (tripWithShape?.shape_id) {
                    shapePoints = shapes
                        .filter((s: ShapePoint) => s.shape_id === tripWithShape.shape_id)
                        .sort((a: ShapePoint, b: ShapePoint) => a.shape_pt_sequence - b.shape_pt_sequence)
                        .map((s: ShapePoint) => ({ lat: s.shape_pt_lat, lng: s.shape_pt_lon }));
                }

                // Get stop sequence from first trip
                const firstTrip = dirTrips[0];
                const tripStopTimes = stopTimes
                    .filter((st: StopTimeInfo) => st.trip_id === firstTrip.trip_id)
                    .sort((a: StopTimeInfo, b: StopTimeInfo) => a.stop_sequence - b.stop_sequence);

                const stopSequence = tripStopTimes.map((st: StopTimeInfo) => {
                    const stopInfo = stops.find((s: StopInfo) => s.stop_id === st.stop_id);
                    return {
                        stop_id: st.stop_id,
                        stop_name: stopInfo?.stop_name || st.stop_id,
                        stop_sequence: st.stop_sequence,
                        lat: stopInfo?.stop_lat,
                        lng: stopInfo?.stop_lon,
                    };
                });

                directions.push({
                    direction_id: directionId,
                    shape: shapePoints,
                    stops: stopSequence,
                });
            }

            const responseData = {
                route_id: routeId,
                directions,
            };

            // 2. Save to Supabase Cache (Fire and forget, but wait for it to ensure execution context holds)
            try {
                console.log(`Caching route shape for ${routeId}`);
                await supabase
                    .from('route_shapes')
                    .upsert({
                        route_id: routeId,
                        data: responseData,
                        updated_at: new Date().toISOString()
                    })
                    .select()
                    .single();
            } catch (err) {
                console.error('Failed to cache route shape:', err);
            }

            return new Response(
                JSON.stringify({
                    data: responseData,
                    timestamp: Date.now(),
                }),
                {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json',
                        'Cache-Control': 'public, max-age=3600',
                    },
                }
            );
        } // End route-shape handler

        // Default: Fetch GTFS-Realtime data
        const gtfsData = await fetchGtfsData(operatorId);

        // Filter by route_id if provided (basic filter, can be improved)
        if (routeId) {
            if (gtfsData.entity) {
                gtfsData.entity = gtfsData.entity.filter(e => {
                    if (e.vehicle?.trip?.routeId === routeId) return true;
                    if (e.tripUpdate?.trip?.routeId === routeId) return true;
                    return false;
                });
            }
        }

        // Optional SIRI enrichment if a specific stop or line is requested (not fully implemented in this optimized proxy yet)
        // ...

        return new Response(JSON.stringify(gtfsData), {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=15', // Cache for 15s to reduce load
            },
        });

    } catch (error) {
        console.error(`Error processing request:`, error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
