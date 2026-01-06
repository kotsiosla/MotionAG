import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

function mergeTripDataWithSiri(
  gtfsTrips: ReturnType<typeof extractTrips>,
  siriJourneys: SiriVehicleJourney[],
  stopId?: string
): MergedArrival[] {
  const mergedArrivals: MergedArrival[] = [];
  const now = Math.floor(Date.now() / 1000);
  
  // Create SIRI lookup by route/line
  const siriByRoute = new Map<string, SiriVehicleJourney[]>();
  for (const journey of siriJourneys) {
    const existing = siriByRoute.get(journey.lineRef) || [];
    existing.push(journey);
    siriByRoute.set(journey.lineRef, existing);
  }
  
  // Process GTFS trips
  for (const trip of gtfsTrips) {
    if (!trip.routeId || !trip.stopTimeUpdates) continue;
    
    const siriMatches = siriByRoute.get(trip.routeId) || [];
    
    for (const stu of trip.stopTimeUpdates) {
      if (!stu.stopId || !stu.arrivalTime) continue;
      if (stopId && stu.stopId !== stopId) continue;
      
      // Find matching SIRI data
      let siriMatch: SiriEstimatedCall | undefined;
      for (const sj of siriMatches) {
        const call = sj.estimatedCalls.find(c => c.stopId === stu.stopId);
        if (call) {
          siriMatch = call;
          break;
        }
      }
      
      // Calculate best arrival time using intelligent algorithm
      let bestTime = stu.arrivalTime;
      let confidence: 'high' | 'medium' | 'low' = 'medium';
      let source: 'gtfs' | 'siri' | 'merged' = 'gtfs';
      
      if (siriMatch?.expectedArrivalTime) {
        // SIRI has real-time expected time - this is usually most accurate
        const siriTime = siriMatch.expectedArrivalTime;
        const gtfsTime = stu.arrivalTime;
        
        // If times differ by less than 2 minutes, prefer SIRI
        const diff = Math.abs(siriTime - gtfsTime);
        
        if (diff < 120) {
          // Times are close - high confidence, use average weighted towards SIRI
          bestTime = Math.round((siriTime * 0.7 + gtfsTime * 0.3));
          confidence = 'high';
          source = 'merged';
        } else if (diff < 300) {
          // Medium difference - use SIRI but medium confidence
          bestTime = siriTime;
          confidence = 'medium';
          source = 'siri';
        } else {
          // Large difference - something is off, use most recent data
          // Prefer GTFS as it's from vehicle GPS
          confidence = 'low';
          source = 'gtfs';
        }
      } else if (stu.arrivalDelay !== undefined && stu.arrivalDelay !== 0) {
        // GTFS has delay info - apply it for better accuracy
        confidence = 'medium';
      } else {
        // Only scheduled time available
        confidence = 'low';
      }
      
      // Only include future arrivals
      if (bestTime > now) {
        mergedArrivals.push({
          stopId: stu.stopId,
          routeId: trip.routeId,
          tripId: trip.tripId,
          vehicleId: trip.vehicleId,
          gtfsArrivalTime: stu.arrivalTime,
          gtfsArrivalDelay: stu.arrivalDelay,
          siriExpectedArrivalTime: siriMatch?.expectedArrivalTime,
          siriAimedArrivalTime: siriMatch?.aimedArrivalTime,
          bestArrivalTime: bestTime,
          confidence,
          source,
        });
      }
    }
  }
  
  // Add any SIRI arrivals that weren't in GTFS
  for (const journey of siriJourneys) {
    for (const call of journey.estimatedCalls) {
      if (stopId && call.stopId !== stopId) continue;
      
      const alreadyMerged = mergedArrivals.some(
        a => a.stopId === call.stopId && a.routeId === journey.lineRef
      );
      
      if (!alreadyMerged && call.expectedArrivalTime && call.expectedArrivalTime > now) {
        mergedArrivals.push({
          stopId: call.stopId,
          routeId: journey.lineRef,
          vehicleId: journey.vehicleRef,
          siriExpectedArrivalTime: call.expectedArrivalTime,
          siriAimedArrivalTime: call.aimedArrivalTime,
          bestArrivalTime: call.expectedArrivalTime,
          confidence: 'high',
          source: 'siri',
        });
      }
    }
  }
  
  // Sort by best arrival time
  mergedArrivals.sort((a, b) => a.bestArrivalTime - b.bestArrivalTime);
  
  return mergedArrivals;
}

function extractVehicles(feed: GtfsRealtimeFeed) {
  if (!feed.entity) return [];
  
  return feed.entity
    .filter((entity) => entity.vehicle)
    .map((entity) => ({
      id: entity.id,
      vehicleId: entity.vehicle?.vehicle?.id || entity.id,
      label: entity.vehicle?.vehicle?.label,
      licensePlate: entity.vehicle?.vehicle?.licensePlate,
      tripId: entity.vehicle?.trip?.tripId,
      routeId: entity.vehicle?.trip?.routeId,
      directionId: entity.vehicle?.trip?.directionId,
      latitude: entity.vehicle?.position?.latitude,
      longitude: entity.vehicle?.position?.longitude,
      bearing: entity.vehicle?.position?.bearing,
      speed: entity.vehicle?.position?.speed,
      currentStopSequence: entity.vehicle?.currentStopSequence,
      stopId: entity.vehicle?.stopId,
      currentStatus: entity.vehicle?.currentStatus,
      timestamp: entity.vehicle?.timestamp,
    }));
}

function extractTrips(feed: GtfsRealtimeFeed) {
  if (!feed.entity) return [];
  
  return feed.entity
    .filter((entity) => entity.tripUpdate)
    .map((entity) => ({
      id: entity.id,
      tripId: entity.tripUpdate?.trip?.tripId,
      routeId: entity.tripUpdate?.trip?.routeId,
      directionId: entity.tripUpdate?.trip?.directionId,
      startTime: entity.tripUpdate?.trip?.startTime,
      startDate: entity.tripUpdate?.trip?.startDate,
      scheduleRelationship: entity.tripUpdate?.trip?.scheduleRelationship,
      vehicleId: entity.tripUpdate?.vehicle?.id,
      vehicleLabel: entity.tripUpdate?.vehicle?.label,
      stopTimeUpdates: entity.tripUpdate?.stopTimeUpdate?.map((stu) => ({
        stopSequence: stu.stopSequence,
        stopId: stu.stopId,
        arrivalDelay: stu.arrival?.delay,
        arrivalTime: stu.arrival?.time,
        departureDelay: stu.departure?.delay,
        departureTime: stu.departure?.time,
        scheduleRelationship: stu.scheduleRelationship,
      })) || [],
      timestamp: entity.tripUpdate?.timestamp,
    }));
}

function extractAlerts(feed: GtfsRealtimeFeed) {
  if (!feed.entity) return [];
  
  return feed.entity
    .filter((entity) => entity.alert)
    .map((entity) => ({
      id: entity.id,
      activePeriods: entity.alert?.activePeriod?.map((ap) => ({
        start: ap.start,
        end: ap.end,
      })) || [],
      informedEntities: entity.alert?.informedEntity?.map((ie) => ({
        agencyId: ie.agencyId,
        routeId: ie.routeId,
        routeType: ie.routeType,
        tripId: ie.trip?.tripId,
        stopId: ie.stopId,
      })) || [],
      cause: entity.alert?.cause,
      effect: entity.alert?.effect,
      headerText: entity.alert?.headerText?.[0]?.text,
      descriptionText: entity.alert?.descriptionText?.[0]?.text,
      url: entity.alert?.url?.[0]?.text,
      severityLevel: entity.alert?.severityLevel,
    }));
}

// Static GTFS data URLs by operator
const GTFS_STATIC_URLS: Record<string, string> = {
  '2': 'https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C2_google_transit.zip&rel=True', // OSYPA
  '4': 'https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C4_google_transit.zip&rel=True', // OSEA
  '5': 'https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C5_google_transit.zip&rel=True', // Intercity
  '6': 'https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C6_google_transit.zip&rel=True', // EMEL
  '9': 'https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C9_google_transit.zip&rel=True', // NPT
  '10': 'https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C10_google_transit.zip&rel=True', // LPT
  '11': 'https://www.motionbuscard.org.cy/opendata/downloadfile?file=GTFS%5C11_google_transit.zip&rel=True', // PAME EXPRESS
};

// Simple in-memory cache for routes, stops, shapes, and stop_times
const routesCache: Map<string, { data: RouteInfo[]; timestamp: number }> = new Map();
const stopsCache: Map<string, { data: StopInfo[]; timestamp: number }> = new Map();
const shapesCache: Map<string, { data: ShapePoint[]; timestamp: number }> = new Map();
const stopTimesCache: Map<string, { data: StopTimeInfo[]; timestamp: number }> = new Map();
const tripsStaticCache: Map<string, { data: TripStaticInfo[]; timestamp: number }> = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

interface RouteInfo {
  route_id: string;
  route_short_name: string;
  route_long_name: string;
  route_type?: number;
  route_color?: string;
  route_text_color?: string;
}

interface StopInfo {
  stop_id: string;
  stop_name: string;
  stop_lat?: number;
  stop_lon?: number;
  stop_code?: string;
  location_type?: number;
  parent_station?: string;
}

interface ShapePoint {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
}

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
  shape_id?: string;
  direction_id?: number;
  trip_headsign?: string;
}

interface CalendarEntry {
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

interface CalendarDateEntry {
  service_id: string;
  date: string;
  exception_type: number; // 1 = added, 2 = removed
}

// Cache for calendar data
const calendarCache = new Map<string, { data: CalendarEntry[]; timestamp: number }>();
const calendarDatesCache = new Map<string, { data: CalendarDateEntry[]; timestamp: number }>();

async function unzipAndParseRoutes(zipData: Uint8Array): Promise<RouteInfo[]> {
  // Parse ZIP file manually (simplified approach for GTFS files)
  // GTFS ZIP files contain routes.txt which is a CSV file
  
  // Find the routes.txt file in the ZIP
  // ZIP file format: https://en.wikipedia.org/wiki/ZIP_(file_format)
  
  let offset = 0;
  const routes: RouteInfo[] = [];
  
  while (offset < zipData.length - 4) {
    // Look for local file header signature (0x04034b50)
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
      
      if (fileName === 'routes.txt') {
        let fileContent: string;
        
        if (compressionMethod === 0) {
          // Stored (no compression)
          fileContent = new TextDecoder().decode(zipData.slice(dataStart, dataStart + uncompressedSize));
        } else if (compressionMethod === 8) {
          // Deflate - use DecompressionStream
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
            for (const chunk of chunks) {
              decompressed.set(chunk, position);
              position += chunk.length;
            }
            
            fileContent = new TextDecoder().decode(decompressed);
          } catch (e) {
            console.error('Failed to decompress routes.txt:', e);
            break;
          }
        } else {
          console.log(`Unsupported compression method: ${compressionMethod}`);
          break;
        }
        
        // Parse CSV
        const lines = fileContent.split('\n');
        if (lines.length > 0) {
          const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const routeIdIdx = header.indexOf('route_id');
          const shortNameIdx = header.indexOf('route_short_name');
          const longNameIdx = header.indexOf('route_long_name');
          const typeIdx = header.indexOf('route_type');
          const colorIdx = header.indexOf('route_color');
          const textColorIdx = header.indexOf('route_text_color');
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line (handle quoted values)
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
            
            if (values.length > routeIdIdx) {
              routes.push({
                route_id: values[routeIdIdx] || '',
                route_short_name: shortNameIdx >= 0 ? values[shortNameIdx] || '' : '',
                route_long_name: longNameIdx >= 0 ? values[longNameIdx] || '' : '',
                route_type: typeIdx >= 0 && values[typeIdx] ? parseInt(values[typeIdx]) : undefined,
                route_color: colorIdx >= 0 ? values[colorIdx] || undefined : undefined,
                route_text_color: textColorIdx >= 0 ? values[textColorIdx] || undefined : undefined,
              });
            }
          }
        }
        break;
      }
      
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  
  return routes;
}

async function unzipAndParseStops(zipData: Uint8Array): Promise<StopInfo[]> {
  let offset = 0;
  const stops: StopInfo[] = [];
  
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
      
      if (fileName === 'stops.txt') {
        let fileContent: string;
        
        if (compressionMethod === 0) {
          fileContent = new TextDecoder().decode(zipData.slice(dataStart, dataStart + uncompressedSize));
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
            for (const chunk of chunks) {
              decompressed.set(chunk, position);
              position += chunk.length;
            }
            
            fileContent = new TextDecoder().decode(decompressed);
          } catch (e) {
            console.error('Failed to decompress stops.txt:', e);
            break;
          }
        } else {
          console.log(`Unsupported compression method: ${compressionMethod}`);
          break;
        }
        
        // Parse CSV
        const lines = fileContent.split('\n');
        if (lines.length > 0) {
          const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const stopIdIdx = header.indexOf('stop_id');
          const stopNameIdx = header.indexOf('stop_name');
          const stopLatIdx = header.indexOf('stop_lat');
          const stopLonIdx = header.indexOf('stop_lon');
          const stopCodeIdx = header.indexOf('stop_code');
          const locationTypeIdx = header.indexOf('location_type');
          const parentStationIdx = header.indexOf('parent_station');
          
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
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
            
            if (values.length > stopIdIdx && stopIdIdx >= 0) {
              const lat = stopLatIdx >= 0 && values[stopLatIdx] ? parseFloat(values[stopLatIdx]) : undefined;
              const lon = stopLonIdx >= 0 && values[stopLonIdx] ? parseFloat(values[stopLonIdx]) : undefined;
              
              // Only include stops with valid coordinates
              if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
                stops.push({
                  stop_id: values[stopIdIdx] || '',
                  stop_name: stopNameIdx >= 0 ? values[stopNameIdx] || '' : '',
                  stop_lat: lat,
                  stop_lon: lon,
                  stop_code: stopCodeIdx >= 0 ? values[stopCodeIdx] || undefined : undefined,
                  location_type: locationTypeIdx >= 0 && values[locationTypeIdx] ? parseInt(values[locationTypeIdx]) : undefined,
                  parent_station: parentStationIdx >= 0 ? values[parentStationIdx] || undefined : undefined,
                });
              }
            }
          }
        }
        break;
      }
      
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  
  return stops;
}

async function fetchStaticRoutes(operatorId?: string): Promise<RouteInfo[]> {
  const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
  const allRoutes: RouteInfo[] = [];
  
  for (const opId of operators) {
    const cacheKey = `routes_${opId}`;
    const cached = routesCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      allRoutes.push(...cached.data);
      continue;
    }
    
    const url = GTFS_STATIC_URLS[opId];
    if (!url) continue;
    
    try {
      console.log(`Fetching static GTFS for operator ${opId} from ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Failed to fetch GTFS for operator ${opId}: ${response.status}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const zipData = new Uint8Array(arrayBuffer);
      
      console.log(`Downloaded ${zipData.length} bytes for operator ${opId}`);
      
      const routes = await unzipAndParseRoutes(zipData);
      console.log(`Parsed ${routes.length} routes for operator ${opId}`);
      
      routesCache.set(cacheKey, { data: routes, timestamp: Date.now() });
      allRoutes.push(...routes);
    } catch (error) {
      console.error(`Error fetching static GTFS for operator ${opId}:`, error);
    }
  }
  
  return allRoutes;
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
      
      if (!response.ok) {
        console.error(`Failed to fetch GTFS for operator ${opId}: ${response.status}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const zipData = new Uint8Array(arrayBuffer);
      
      const stops = await unzipAndParseStops(zipData);
      console.log(`Parsed ${stops.length} stops for operator ${opId}`);
      
      stopsCache.set(cacheKey, { data: stops, timestamp: Date.now() });
      allStops.push(...stops);
    } catch (error) {
      console.error(`Error fetching static GTFS stops for operator ${opId}:`, error);
    }
  }
  
  return allStops;
}

// Helper function to parse any file from ZIP
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
            for (const chunk of chunks) {
              decompressed.set(chunk, position);
              position += chunk.length;
            }
            
            return new TextDecoder().decode(decompressed);
          } catch (e) {
            console.error(`Failed to decompress ${targetFileName}:`, e);
            return null;
          }
        }
      }
      
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  
  return null;
}

// Parse CSV line properly handling quoted values
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
      
      if (lines.length > 0) {
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const tripIdIdx = header.indexOf('trip_id');
        const stopIdIdx = header.indexOf('stop_id');
        const seqIdx = header.indexOf('stop_sequence');
        const arrivalIdx = header.indexOf('arrival_time');
        const departureIdx = header.indexOf('departure_time');
        
        // Parse in batches to avoid stack overflow
        const BATCH_SIZE = 50000;
        for (let start = 1; start < lines.length; start += BATCH_SIZE) {
          const end = Math.min(start + BATCH_SIZE, lines.length);
          
          for (let i = start; i < end; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = parseCSVLine(line);
            
            if (tripIdIdx >= 0 && stopIdIdx >= 0 && seqIdx >= 0) {
              const tripId = values[tripIdIdx];
              
              // Only include stop times for the trips we care about
              if (!tripIds.has(tripId)) continue;
              
              const seq = parseInt(values[seqIdx]);
              
              if (!isNaN(seq)) {
                allStopTimes.push({
                  trip_id: tripId,
                  stop_id: values[stopIdIdx],
                  stop_sequence: seq,
                  arrival_time: arrivalIdx >= 0 ? values[arrivalIdx] || undefined : undefined,
                  departure_time: departureIdx >= 0 ? values[departureIdx] || undefined : undefined,
                });
              }
            }
          }
        }
      }
      
      console.log(`Parsed ${allStopTimes.length} stop_times for ${tripIds.size} trips (operator ${opId})`);
    } catch (error) {
      console.error(`Error fetching static GTFS stop_times for operator ${opId}:`, error);
    }
  }
  
  return allStopTimes;
}

// Fetch calendar_dates.txt as fallback when calendar.txt doesn't exist
async function fetchStaticCalendarDates(operatorId?: string): Promise<CalendarDateEntry[]> {
  const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
  const allCalendarDates: CalendarDateEntry[] = [];
  
  for (const opId of operators) {
    const cacheKey = `calendar_dates_${opId}`;
    const cached = calendarDatesCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      allCalendarDates.push(...cached.data);
      continue;
    }
    
    const url = GTFS_STATIC_URLS[opId];
    if (!url) continue;
    
    try {
      console.log(`Fetching static GTFS calendar_dates for operator ${opId}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Failed to fetch GTFS for operator ${opId}: ${response.status}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const zipData = new Uint8Array(arrayBuffer);
      
      const fileContent = await unzipAndParseFile(zipData, 'calendar_dates.txt');
      if (!fileContent) {
        console.log(`No calendar_dates.txt found for operator ${opId}`);
        continue;
      }
      
      const lines = fileContent.split('\n');
      const calendarDates: CalendarDateEntry[] = [];
      
      if (lines.length > 0) {
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const serviceIdIdx = header.indexOf('service_id');
        const dateIdx = header.indexOf('date');
        const exceptionTypeIdx = header.indexOf('exception_type');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = parseCSVLine(line);
          
          if (serviceIdIdx >= 0 && dateIdx >= 0) {
            calendarDates.push({
              service_id: values[serviceIdIdx],
              date: values[dateIdx],
              exception_type: exceptionTypeIdx >= 0 ? parseInt(values[exceptionTypeIdx]) || 1 : 1,
            });
          }
        }
      }
      
      console.log(`Parsed ${calendarDates.length} calendar_dates entries for operator ${opId}`);
      calendarDatesCache.set(cacheKey, { data: calendarDates, timestamp: Date.now() });
      allCalendarDates.push(...calendarDates);
    } catch (error) {
      console.error(`Error fetching static GTFS calendar_dates for operator ${opId}:`, error);
    }
  }
  
  return allCalendarDates;
}

async function fetchStaticTrips(operatorId?: string): Promise<TripStaticInfo[]> {
  const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
  const allTrips: TripStaticInfo[] = [];
  
  for (const opId of operators) {
    const cacheKey = `trips_static_${opId}`;
    const cached = tripsStaticCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      allTrips.push(...cached.data);
      continue;
    }
    
    const url = GTFS_STATIC_URLS[opId];
    if (!url) continue;
    
    try {
      console.log(`Fetching static GTFS trips for operator ${opId}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Failed to fetch GTFS for operator ${opId}: ${response.status}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const zipData = new Uint8Array(arrayBuffer);
      
      const fileContent = await unzipAndParseFile(zipData, 'trips.txt');
      if (!fileContent) {
        console.log(`No trips.txt found for operator ${opId}`);
        continue;
      }
      
      const lines = fileContent.split('\n');
      const trips: TripStaticInfo[] = [];
      
      if (lines.length > 0) {
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const tripIdIdx = header.indexOf('trip_id');
        const routeIdIdx = header.indexOf('route_id');
        const serviceIdIdx = header.indexOf('service_id');
        const shapeIdIdx = header.indexOf('shape_id');
        const directionIdIdx = header.indexOf('direction_id');
        const headsignIdx = header.indexOf('trip_headsign');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = parseCSVLine(line);
          
          if (tripIdIdx >= 0 && routeIdIdx >= 0) {
            trips.push({
              trip_id: values[tripIdIdx],
              route_id: values[routeIdIdx],
              service_id: serviceIdIdx >= 0 ? values[serviceIdIdx] : '',
              shape_id: shapeIdIdx >= 0 ? values[shapeIdIdx] || undefined : undefined,
              direction_id: directionIdIdx >= 0 && values[directionIdIdx] ? parseInt(values[directionIdIdx]) : undefined,
              trip_headsign: headsignIdx >= 0 ? values[headsignIdx] || undefined : undefined,
            });
          }
        }
      }
      
      console.log(`Parsed ${trips.length} static trips for operator ${opId}`);
      tripsStaticCache.set(cacheKey, { data: trips, timestamp: Date.now() });
      allTrips.push(...trips);
    } catch (error) {
      console.error(`Error fetching static GTFS trips for operator ${opId}:`, error);
    }
  }
  
  return allTrips;
}

async function fetchStaticCalendar(operatorId?: string): Promise<CalendarEntry[]> {
  const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
  const allCalendar: CalendarEntry[] = [];
  
  for (const opId of operators) {
    const cacheKey = `calendar_${opId}`;
    const cached = calendarCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      allCalendar.push(...cached.data);
      continue;
    }
    
    const url = GTFS_STATIC_URLS[opId];
    if (!url) continue;
    
    try {
      console.log(`Fetching static GTFS calendar for operator ${opId}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error(`Failed to fetch GTFS for operator ${opId}: ${response.status}`);
        continue;
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const zipData = new Uint8Array(arrayBuffer);
      
      const fileContent = await unzipAndParseFile(zipData, 'calendar.txt');
      if (!fileContent) {
        console.log(`No calendar.txt found for operator ${opId}`);
        continue;
      }
      
      const lines = fileContent.split('\n');
      const calendar: CalendarEntry[] = [];
      
      if (lines.length > 0) {
        const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const serviceIdIdx = header.indexOf('service_id');
        const mondayIdx = header.indexOf('monday');
        const tuesdayIdx = header.indexOf('tuesday');
        const wednesdayIdx = header.indexOf('wednesday');
        const thursdayIdx = header.indexOf('thursday');
        const fridayIdx = header.indexOf('friday');
        const saturdayIdx = header.indexOf('saturday');
        const sundayIdx = header.indexOf('sunday');
        const startDateIdx = header.indexOf('start_date');
        const endDateIdx = header.indexOf('end_date');
        
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const values = parseCSVLine(line);
          
          if (serviceIdIdx >= 0) {
            calendar.push({
              service_id: values[serviceIdIdx],
              monday: mondayIdx >= 0 && values[mondayIdx] === '1',
              tuesday: tuesdayIdx >= 0 && values[tuesdayIdx] === '1',
              wednesday: wednesdayIdx >= 0 && values[wednesdayIdx] === '1',
              thursday: thursdayIdx >= 0 && values[thursdayIdx] === '1',
              friday: fridayIdx >= 0 && values[fridayIdx] === '1',
              saturday: saturdayIdx >= 0 && values[saturdayIdx] === '1',
              sunday: sundayIdx >= 0 && values[sundayIdx] === '1',
              start_date: startDateIdx >= 0 ? values[startDateIdx] : '',
              end_date: endDateIdx >= 0 ? values[endDateIdx] : '',
            });
          }
        }
      }
      
      console.log(`Parsed ${calendar.length} calendar entries for operator ${opId}`);
      calendarCache.set(cacheKey, { data: calendar, timestamp: Date.now() });
      allCalendar.push(...calendar);
    } catch (error) {
      console.error(`Error fetching static GTFS calendar for operator ${opId}:`, error);
    }
  }
  
  return allCalendar;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/gtfs-proxy', '');
  const operatorId = url.searchParams.get('operator') || undefined;
  const routeId = url.searchParams.get('route') || undefined;

  console.log(`Request path: ${path}, operator: ${operatorId || 'all'}, route: ${routeId || 'none'}`);

  try {
    // Handle static routes endpoint separately
    if (path === '/routes') {
      const routes = await fetchStaticRoutes(operatorId);
      return new Response(
        JSON.stringify({
          data: routes,
          timestamp: Date.now(),
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }
    
    // Handle static stops endpoint
    if (path === '/stops') {
      const stops = await fetchStaticStops(operatorId);
      return new Response(
        JSON.stringify({
          data: stops,
          timestamp: Date.now(),
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }
    
    // Handle shapes endpoint
    if (path === '/shapes') {
      const shapes = await fetchStaticShapes(operatorId);
      return new Response(
        JSON.stringify({
          data: shapes,
          timestamp: Date.now(),
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }
    
    // Handle stop_times endpoint - Load all stop times for trip planning
    if (path === '/stop-times') {
      console.log('Loading stop_times for trip planning...');
      
      try {
        const allStopTimes: StopTimeInfo[] = [];
        const operators = operatorId && operatorId !== 'all' ? [operatorId] : Object.keys(GTFS_STATIC_URLS);
        
        for (const opId of operators) {
          const url = GTFS_STATIC_URLS[opId];
          if (!url) continue;
          
          try {
            console.log(`Fetching stop_times for operator ${opId}`);
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
            
            if (lines.length > 0) {
              const header = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
              const tripIdIdx = header.indexOf('trip_id');
              const stopIdIdx = header.indexOf('stop_id');
              const seqIdx = header.indexOf('stop_sequence');
              const arrivalIdx = header.indexOf('arrival_time');
              const departureIdx = header.indexOf('departure_time');
              
              // Parse in batches
              const BATCH_SIZE = 50000;
              for (let start = 1; start < lines.length; start += BATCH_SIZE) {
                const end = Math.min(start + BATCH_SIZE, lines.length);
                
                for (let i = start; i < end; i++) {
                  const line = lines[i].trim();
                  if (!line) continue;
                  
                  const values = parseCSVLine(line);
                  
                  if (tripIdIdx >= 0 && stopIdIdx >= 0 && seqIdx >= 0) {
                    const seq = parseInt(values[seqIdx]);
                    
                    if (!isNaN(seq)) {
                      allStopTimes.push({
                        trip_id: values[tripIdIdx],
                        stop_id: values[stopIdIdx],
                        stop_sequence: seq,
                        arrival_time: arrivalIdx >= 0 ? values[arrivalIdx] || undefined : undefined,
                        departure_time: departureIdx >= 0 ? values[departureIdx] || undefined : undefined,
                      });
                    }
                  }
                }
              }
              
              console.log(`Parsed ${allStopTimes.length} stop_times so far (after operator ${opId})`);
            }
          } catch (error) {
            console.error(`Error fetching stop_times for operator ${opId}:`, error);
          }
        }
        
        console.log(`Total stop_times loaded: ${allStopTimes.length}`);
        
        return new Response(
          JSON.stringify({
            data: allStopTimes,
            timestamp: Date.now(),
            count: allStopTimes.length,
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
            } 
          }
        );
      } catch (error) {
        console.error('Error in stop-times endpoint:', error);
        return new Response(
          JSON.stringify({ error: String(error), data: [] }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    // Handle stop-routes endpoint - returns all routes that pass through a specific stop
    if (path === '/stop-routes') {
      const stopId = url.searchParams.get('stop');
      
      if (!stopId) {
        return new Response(
          JSON.stringify({ error: 'Missing stop parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Stop routes request for stop: ${stopId}, operator: ${operatorId}`);
      
      try {
        // Determine which operators to query
        const operators = operatorId && operatorId !== 'all' 
          ? [operatorId] 
          : ['2', '4', '5', '6', '9', '10', '11'];
        
        const routesAtStop: Array<{
          route_id: string;
          route_short_name: string;
          route_long_name: string;
          route_color?: string;
        }> = [];
        
        const seenRoutes = new Set<string>();
        
        for (const opId of operators) {
          const gtfsUrl = `http://20.19.98.194:8328/Api/gtfs-static/${opId}.zip`;
          
          try {
            const response = await fetch(gtfsUrl);
            if (!response.ok) continue;
            
            const arrayBuffer = await response.arrayBuffer();
            const zipData = new Uint8Array(arrayBuffer);
            
            // Load stop_times.txt - we need to find trips that stop at this stop
            const stopTimesContent = await unzipAndParseFile(zipData, 'stop_times.txt');
            if (!stopTimesContent) continue;
            
            const stopTimesLines = stopTimesContent.split('\n');
            const stopTimesHeader = stopTimesLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const stopIdIdx = stopTimesHeader.indexOf('stop_id');
            const tripIdIdx = stopTimesHeader.indexOf('trip_id');
            
            if (stopIdIdx === -1 || tripIdIdx === -1) continue;
            
            // Find all trips that stop at this stop
            const tripIds = new Set<string>();
            for (let i = 1; i < stopTimesLines.length; i++) {
              const line = stopTimesLines[i];
              if (!line.trim()) continue;
              
              const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
              if (parts[stopIdIdx] === stopId) {
                tripIds.add(parts[tripIdIdx]);
              }
            }
            
            if (tripIds.size === 0) continue;
            
            // Load trips.txt to find route_ids for these trips
            const tripsContent = await unzipAndParseFile(zipData, 'trips.txt');
            if (!tripsContent) continue;
            
            const tripsLines = tripsContent.split('\n');
            const tripsHeader = tripsLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const tripIdIdxTrips = tripsHeader.indexOf('trip_id');
            const routeIdIdx = tripsHeader.indexOf('route_id');
            
            if (tripIdIdxTrips === -1 || routeIdIdx === -1) continue;
            
            const routeIds = new Set<string>();
            for (let i = 1; i < tripsLines.length; i++) {
              const line = tripsLines[i];
              if (!line.trim()) continue;
              
              const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
              if (tripIds.has(parts[tripIdIdxTrips])) {
                routeIds.add(parts[routeIdIdx]);
              }
            }
            
            if (routeIds.size === 0) continue;
            
            // Load routes.txt to get route info
            const routesContent = await unzipAndParseFile(zipData, 'routes.txt');
            if (!routesContent) continue;
            
            const routesLines = routesContent.split('\n');
            const routesHeader = routesLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
            const routeIdIdxRoutes = routesHeader.indexOf('route_id');
            const shortNameIdx = routesHeader.indexOf('route_short_name');
            const longNameIdx = routesHeader.indexOf('route_long_name');
            const colorIdx = routesHeader.indexOf('route_color');
            
            for (let i = 1; i < routesLines.length; i++) {
              const line = routesLines[i];
              if (!line.trim()) continue;
              
              const parts = line.split(',').map(p => p.trim().replace(/"/g, ''));
              const routeId = parts[routeIdIdxRoutes];
              
              if (routeIds.has(routeId) && !seenRoutes.has(routeId)) {
                seenRoutes.add(routeId);
                routesAtStop.push({
                  route_id: routeId,
                  route_short_name: parts[shortNameIdx] || routeId,
                  route_long_name: parts[longNameIdx] || '',
                  route_color: parts[colorIdx] || undefined,
                });
              }
            }
            
            console.log(`Found ${routeIds.size} routes at stop ${stopId} for operator ${opId}`);
          } catch (error) {
            console.error(`Error fetching stop routes for operator ${opId}:`, error);
          }
        }
        
        return new Response(
          JSON.stringify({
            data: {
              stop_id: stopId,
              routes: routesAtStop.sort((a, b) => a.route_short_name.localeCompare(b.route_short_name)),
            },
            timestamp: Date.now(),
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
            } 
          }
        );
      } catch (error) {
        console.error('Error in stop-routes endpoint:', error);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch stop routes' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Handle static trips endpoint
    if (path === '/trips-static') {
      const tripsStatic = await fetchStaticTrips(operatorId);
      return new Response(
        JSON.stringify({
          data: tripsStatic,
          timestamp: Date.now(),
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }
    
    // Handle schedule endpoint - returns scheduled trips for a specific route with departure times
    if (path === '/schedule' && routeId) {
      console.log(`Schedule request for route: ${routeId}, operator: ${operatorId}`);
      
      // First, load trips and stops (not stop_times yet - it's too large)
      const [tripsStatic, stops] = await Promise.all([
        fetchStaticTrips(operatorId),
        fetchStaticStops(operatorId),
      ]);
      
      console.log(`Loaded ${tripsStatic.length} static trips, ${stops.length} stops`);
      
      // Get unique route IDs from trips for debugging
      const uniqueRouteIds = [...new Set(tripsStatic.map((t: TripStaticInfo) => t.route_id))].slice(0, 20);
      console.log(`Sample route IDs from trips: ${uniqueRouteIds.join(', ')}`);
      
      // Find trips for this route
      // Route IDs in realtime have format like "8040012" (8 + operatorId + staticRouteId)
      // We need to try multiple matching strategies
      let routeTrips: TripStaticInfo[] = tripsStatic.filter((t: TripStaticInfo) => t.route_id === routeId);
      let matchedRouteId = routeId;
      
      // Strategy 1: If route ID starts with 8, extract the static route ID (last 4 digits typically)
      if (routeTrips.length === 0 && routeId.startsWith('8') && routeId.length >= 4) {
        // Try extracting just the last 4 characters (e.g., "0012" from "8040012")
        const last4 = routeId.slice(-4);
        routeTrips = tripsStatic.filter((t: TripStaticInfo) => t.route_id === last4);
        if (routeTrips.length > 0) {
          matchedRouteId = last4;
          console.log(`Matched using last 4 chars: ${last4}, found ${routeTrips.length} trips`);
        }
      }
      
      // Strategy 2: Try removing the "8XX" prefix (operator encoding)  
      if (routeTrips.length === 0 && routeId.length > 3) {
        const shortRouteId = routeId.substring(3);
        routeTrips = tripsStatic.filter((t: TripStaticInfo) => t.route_id === shortRouteId);
        if (routeTrips.length > 0) {
          matchedRouteId = shortRouteId;
          console.log(`Matched using substring(3): ${shortRouteId}, found ${routeTrips.length} trips`);
        }
      }
      
      // Strategy 3: Try finding any route ID that ends with the same digits
      if (routeTrips.length === 0) {
        const suffix = routeId.slice(-4);
        routeTrips = tripsStatic.filter((t: TripStaticInfo) => t.route_id.endsWith(suffix) || t.route_id === suffix);
        if (routeTrips.length > 0) {
          matchedRouteId = routeTrips[0].route_id;
          console.log(`Matched using suffix ${suffix}: found ${routeTrips.length} trips with route_id ${matchedRouteId}`);
        }
      }
      
      console.log(`Found ${routeTrips.length} trips for route ${routeId}`);
      
      if (routeTrips.length === 0) {
        return new Response(
          JSON.stringify({ 
            data: { route_id: routeId, schedule: [], by_direction: {}, total_trips: 0 },
            debug: { 
              requestedRouteId: routeId, 
              availableRouteIds: uniqueRouteIds,
              tripsLoaded: tripsStatic.length
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Get current time to filter relevant trips
      const now = new Date();
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
      
      // Fetch calendar data and also calendar_dates as fallback
      const [calendar, calendarDates] = await Promise.all([
        fetchStaticCalendar(operatorId),
        fetchStaticCalendarDates(operatorId),
      ]);
      
      // Build a Set of trip IDs for this route
      const routeTripIds = new Set(routeTrips.map((t: TripStaticInfo) => t.trip_id));
      
      // Now fetch stop times only for these trips (filtered loading)
      const stopTimes = await fetchStaticStopTimesForTrips(operatorId, routeTripIds);
      console.log(`Loaded ${stopTimes.length} stop_times for ${routeTripIds.size} trips`);
      
      // Build schedule entries for each trip
      const scheduleEntries: Array<{
        trip_id: string;
        service_id: string;
        direction_id?: number;
        trip_headsign?: string;
        departure_time: string;
        departure_minutes: number;
        first_stop_id: string;
        first_stop_name: string;
        last_stop_id: string;
        last_stop_name: string;
        stop_count: number;
      }> = [];
      
      for (const trip of routeTrips) {
        // Get stop times for this trip
        const tripStopTimes = stopTimes
          .filter((st: StopTimeInfo) => st.trip_id === trip.trip_id)
          .sort((a: StopTimeInfo, b: StopTimeInfo) => a.stop_sequence - b.stop_sequence);
        
        if (tripStopTimes.length === 0) continue;
        
        const firstStopTime = tripStopTimes[0];
        const lastStopTime = tripStopTimes[tripStopTimes.length - 1];
        
        // Parse departure time (format: HH:MM:SS)
        const departureTime = firstStopTime.departure_time || firstStopTime.arrival_time;
        if (!departureTime) continue;
        
        // Calculate minutes from midnight for sorting and filtering
        const timeParts = departureTime.split(':');
        let hours = parseInt(timeParts[0]) || 0;
        const minutes = parseInt(timeParts[1]) || 0;
        
        // Handle times past midnight (e.g., 25:00:00)
        if (hours >= 24) {
          hours = hours - 24;
        }
        
        const departureMinutes = hours * 60 + minutes;
        
        // Get stop names
        const firstStop = stops.find((s: StopInfo) => s.stop_id === firstStopTime.stop_id);
        const lastStop = stops.find((s: StopInfo) => s.stop_id === lastStopTime.stop_id);
        
        scheduleEntries.push({
          trip_id: trip.trip_id,
          service_id: trip.service_id,
          direction_id: trip.direction_id,
          trip_headsign: trip.trip_headsign,
          departure_time: departureTime.substring(0, 5), // HH:MM
          departure_minutes: departureMinutes,
          first_stop_id: firstStopTime.stop_id,
          first_stop_name: firstStop?.stop_name || firstStopTime.stop_id,
          last_stop_id: lastStopTime.stop_id,
          last_stop_name: lastStop?.stop_name || lastStopTime.stop_id,
          stop_count: tripStopTimes.length,
        });
      }
      
      // Sort by departure time
      scheduleEntries.sort((a, b) => a.departure_minutes - b.departure_minutes);
      
      // Group by direction
      const byDirection: Record<number, typeof scheduleEntries> = {};
      for (const entry of scheduleEntries) {
        const dir = entry.direction_id ?? 0;
        if (!byDirection[dir]) {
          byDirection[dir] = [];
        }
        byDirection[dir].push(entry);
      }
      
      return new Response(
        JSON.stringify({
          data: {
            route_id: routeId,
            schedule: scheduleEntries,
            by_direction: byDirection,
            total_trips: scheduleEntries.length,
            calendar: calendar,
            calendar_dates: calendarDates,
          },
          timestamp: Date.now(),
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }
    
    // Handle route-shape endpoint - returns shape and stop sequence for a specific route
    if (path === '/route-shape' && routeId) {
      let effectiveOperatorId = operatorId;
      
      // If no operator specified, search ALL operators to find which one has this route
      if (!operatorId || operatorId === 'all') {
        console.log(`No operator specified for route ${routeId}, searching all operators...`);
        
        const allOperators = Object.keys(GTFS_STATIC_URLS);
        let foundOperator: string | null = null;
        
        // Search each operator's trips to find the route
        for (const opId of allOperators) {
          const trips = await fetchStaticTrips(opId);
          const hasRoute = trips.some((t: TripStaticInfo) => t.route_id === routeId);
          
          if (hasRoute) {
            foundOperator = opId;
            console.log(`Found route ${routeId} in operator ${opId}`);
            break;
          }
        }
        
        if (foundOperator) {
          effectiveOperatorId = foundOperator;
        } else {
          console.log(`Route ${routeId} not found in any operator`);
          return new Response(
            JSON.stringify({ 
              data: null, 
              error: 'Route not found in any operator',
              routeId 
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 404
            }
          );
        }
      }
      
      console.log(`Loading route-shape for operator ${effectiveOperatorId}, route ${routeId}`);
      
      const [tripsStatic, shapes, stops] = await Promise.all([
        fetchStaticTrips(effectiveOperatorId),
        fetchStaticShapes(effectiveOperatorId),
        fetchStaticStops(effectiveOperatorId),
      ]);
      
      // Find trips for this route
      const routeTrips: TripStaticInfo[] = tripsStatic.filter((t: TripStaticInfo) => t.route_id === routeId);
      if (routeTrips.length === 0) {
        return new Response(
          JSON.stringify({ data: null, error: 'Route not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Group trips by direction
      const tripsByDirection: Map<number, TripStaticInfo[]> = new Map();
      routeTrips.forEach((trip: TripStaticInfo) => {
        const dir = trip.direction_id ?? 0;
        if (!tripsByDirection.has(dir)) {
          tripsByDirection.set(dir, []);
        }
        tripsByDirection.get(dir)!.push(trip);
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
      
      return new Response(
        JSON.stringify({
          data: {
            route_id: routeId,
            directions,
          },
          timestamp: Date.now(),
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
          } 
        }
      );
    }

    const feed = await fetchGtfsData(operatorId);
    let data: unknown;

    switch (path) {
      case '/feed':
      case '':
        data = feed;
        break;
      case '/vehicles':
        data = extractVehicles(feed);
        break;
      case '/trips':
        data = extractTrips(feed);
        break;
      case '/alerts':
        data = extractAlerts(feed);
        break;
      case '/arrivals': {
        // High-accuracy arrivals endpoint - merges GTFS-RT and SIRI
        const stopIdParam = url.searchParams.get('stopId') || undefined;
        const routeIdParam = url.searchParams.get('routeId') || undefined;
        
        console.log(`Fetching high-accuracy arrivals for stop: ${stopIdParam}, route: ${routeIdParam}`);
        
        const gtfsTrips = extractTrips(feed);
        
        // Try to get SIRI data in parallel for better accuracy
        let siriJourneys: SiriVehicleJourney[] = [];
        try {
          // Only fetch SIRI if we have a specific stop or route (to avoid overload)
          if (stopIdParam || routeIdParam) {
            siriJourneys = await fetchSiriData(stopIdParam, routeIdParam);
          }
        } catch (e) {
          console.warn('SIRI fetch failed, using GTFS only:', e);
        }
        
        const mergedArrivals = mergeTripDataWithSiri(gtfsTrips, siriJourneys, stopIdParam);
        
        // Filter by route if specified
        const filteredArrivals = routeIdParam 
          ? mergedArrivals.filter(a => a.routeId === routeIdParam)
          : mergedArrivals;
        
        return new Response(
          JSON.stringify({
            data: filteredArrivals,
            sources: {
              gtfs: { 
                healthy: dataSourceHealth.gtfs.consecutiveFailures < 3,
                lastSuccess: dataSourceHealth.gtfs.lastSuccess,
              },
              siri: { 
                healthy: dataSourceHealth.siri.consecutiveFailures < 3,
                lastSuccess: dataSourceHealth.siri.lastSuccess,
                available: siriJourneys.length > 0,
              },
            },
            timestamp: Date.now(),
            feedTimestamp: (feed.header?.timestamp as number) || undefined,
          }),
          { 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache',
            } 
          }
        );
      }
      case '/health': {
        // Health check endpoint for data sources
        return new Response(
          JSON.stringify({
            gtfs: dataSourceHealth.gtfs,
            siri: dataSourceHealth.siri,
            timestamp: Date.now(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      default:
        return new Response(
          JSON.stringify({ error: 'Not found', availableEndpoints: ['/feed', '/vehicles', '/trips', '/alerts', '/arrivals', '/health', '/routes', '/stops', '/shapes', '/stop-times', '/trips-static', '/route-shape'] }),
          { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

    return new Response(
      JSON.stringify({
        data,
        timestamp: Date.now(),
        feedTimestamp: (feed.header?.timestamp as number) || undefined,
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        } 
      }
    );
  } catch (error) {
    console.error("Error in gtfs-proxy:", error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch GTFS data',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});