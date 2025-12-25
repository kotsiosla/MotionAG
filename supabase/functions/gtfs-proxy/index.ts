import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GTFS_RT_URL = "http://20.19.98.194:8328/Api/api/gtfs-realtime";

interface FeedEntity {
  id: string;
  vehicle?: {
    trip?: {
      tripId?: string;
      routeId?: string;
      directionId?: number;
      startTime?: string;
      startDate?: string;
      scheduleRelationship?: string;
    };
    position?: {
      latitude?: number;
      longitude?: number;
      bearing?: number;
      speed?: number;
    };
    currentStopSequence?: number;
    stopId?: string;
    currentStatus?: string;
    timestamp?: number;
    vehicle?: {
      id?: string;
      label?: string;
      licensePlate?: string;
    };
  };
  tripUpdate?: {
    trip?: {
      tripId?: string;
      routeId?: string;
      directionId?: number;
      startTime?: string;
      startDate?: string;
      scheduleRelationship?: string;
    };
    vehicle?: {
      id?: string;
      label?: string;
    };
    stopTimeUpdate?: Array<{
      stopSequence?: number;
      stopId?: string;
      arrival?: {
        delay?: number;
        time?: number;
        uncertainty?: number;
      };
      departure?: {
        delay?: number;
        time?: number;
        uncertainty?: number;
      };
      scheduleRelationship?: string;
    }>;
    timestamp?: number;
  };
  alert?: {
    activePeriod?: Array<{
      start?: number;
      end?: number;
    }>;
    informedEntity?: Array<{
      agencyId?: string;
      routeId?: string;
      routeType?: number;
      trip?: {
        tripId?: string;
        routeId?: string;
      };
      stopId?: string;
    }>;
    cause?: string;
    effect?: string;
    url?: {
      translation?: Array<{ text?: string; language?: string }>;
    };
    headerText?: {
      translation?: Array<{ text?: string; language?: string }>;
    };
    descriptionText?: {
      translation?: Array<{ text?: string; language?: string }>;
    };
    severityLevel?: string;
  };
}

interface GtfsRealtimeFeed {
  header?: {
    gtfsRealtimeVersion?: string;
    incrementality?: string;
    timestamp?: number;
  };
  entity?: FeedEntity[];
}

async function fetchGtfsData(): Promise<GtfsRealtimeFeed> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // Try fetching as JSON first (some endpoints serve JSON directly)
    const response = await fetch(GTFS_RT_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json, application/x-protobuf, */*',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    
    // If it's JSON, parse it directly
    if (contentType.includes('application/json')) {
      return await response.json();
    }

    // If it's protobuf, we need to handle it
    // For now, try to parse as JSON anyway (many APIs return JSON)
    const text = await response.text();
    
    try {
      return JSON.parse(text);
    } catch {
      // If we can't parse as JSON, return empty feed
      console.error("Unable to parse response. Content-Type:", contentType);
      console.error("First 500 chars:", text.substring(0, 500));
      
      return {
        header: {
          gtfsRealtimeVersion: "2.0",
          timestamp: Math.floor(Date.now() / 1000),
        },
        entity: [],
      };
    }
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
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
      headerText: entity.alert?.headerText?.translation?.[0]?.text || 
                  entity.alert?.headerText?.translation?.find((t) => t.language === 'el')?.text,
      descriptionText: entity.alert?.descriptionText?.translation?.[0]?.text ||
                       entity.alert?.descriptionText?.translation?.find((t) => t.language === 'el')?.text,
      url: entity.alert?.url?.translation?.[0]?.text,
      severityLevel: entity.alert?.severityLevel,
    }));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace('/gtfs-proxy', '');

  try {
    const feed = await fetchGtfsData();
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
      default:
        return new Response(
          JSON.stringify({ error: 'Not found', availableEndpoints: ['/feed', '/vehicles', '/trips', '/alerts'] }),
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
        feedTimestamp: feed.header?.timestamp,
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
    console.error("Error fetching GTFS data:", error);
    
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