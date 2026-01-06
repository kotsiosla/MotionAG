import { useQuery } from "@tanstack/react-query";
import type { Vehicle, Trip, Alert, GtfsResponse, RouteInfo, StaticStop } from "@/types/gtfs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jftthfniwfarxyisszjh.supabase.co';

async function fetchFromProxy<T>(endpoint: string, operatorId?: string): Promise<GtfsResponse<T>> {
  const params = operatorId && operatorId !== 'all' 
    ? `?operator=${operatorId}` 
    : '';
  
  const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('supabase_anon_key') || '';
    }
    return '';
  })();
  
  if (!SUPABASE_KEY) {
    throw new Error('Supabase API key is missing. Please set VITE_SUPABASE_PUBLISHABLE_KEY in .env file.');
  }
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy${endpoint}${params}`, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }

  return response.json();
}

export function useVehicles(refreshInterval: number, operatorId?: string) {
  return useQuery({
    queryKey: ['vehicles', operatorId],
    queryFn: () => fetchFromProxy<Vehicle[]>('/vehicles', operatorId),
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) / 2,
  });
}

export function useTrips(refreshInterval: number, operatorId?: string) {
  return useQuery({
    queryKey: ['trips', operatorId],
    queryFn: () => fetchFromProxy<Trip[]>('/trips', operatorId),
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) / 2,
  });
}

export function useAlerts(refreshInterval: number, operatorId?: string) {
  return useQuery({
    queryKey: ['alerts', operatorId],
    queryFn: () => fetchFromProxy<Alert[]>('/alerts', operatorId),
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) / 2,
  });
}

export function useStaticRoutes(operatorId?: string) {
  return useQuery({
    queryKey: ['static-routes', operatorId],
    queryFn: () => fetchFromProxy<RouteInfo[]>('/routes', operatorId),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export function useStaticStops(operatorId?: string) {
  return useQuery({
    queryKey: ['static-stops', operatorId],
    queryFn: () => fetchFromProxy<StaticStop[]>('/stops', operatorId),
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}

export interface RouteShapeData {
  route_id: string;
  directions: Array<{
    direction_id: number;
    shape: Array<{ lat: number; lng: number }>;
    stops: Array<{ stop_id: string; stop_name: string; stop_sequence: number; lat?: number; lng?: number }>;
  }>;
}

export function useRouteShape(routeId: string | null, operatorId?: string) {
  return useQuery({
    queryKey: ['route-shape', routeId, operatorId],
    queryFn: async () => {
      if (!routeId || routeId === 'all') return null;
      
      console.log('[useRouteShape] Fetching route shape for:', { routeId, operatorId });
      
      const params = new URLSearchParams();
      params.set('route', routeId);
      if (operatorId && operatorId !== 'all') params.set('operator', operatorId);
      
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '');
      if (!SUPABASE_KEY) throw new Error('Supabase API key is missing');
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/route-shape?${params}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('[useRouteShape] Error:', result);
        throw new Error(result.error || 'Failed to fetch route shape');
      }
      
      console.log('[useRouteShape] Success, directions:', result.data?.directions?.length || 0);
      return result.data as RouteShapeData;
    },
    enabled: !!routeId && routeId !== 'all',
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 2,
  });
}

export interface ScheduleEntry {
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

export interface CalendarDateEntry {
  service_id: string;
  date: string;
  exception_type: number; // 1 = service added, 2 = service removed
}

export interface RouteScheduleData {
  route_id: string;
  schedule: ScheduleEntry[];
  by_direction: Record<number, ScheduleEntry[]>;
  total_trips: number;
  calendar: CalendarEntry[];
  calendar_dates: CalendarDateEntry[];
}

export function useRouteSchedule(routeId: string | null, operatorId?: string) {
  return useQuery({
    queryKey: ['route-schedule', routeId, operatorId],
    queryFn: async () => {
      if (!routeId || routeId === 'all') return null;
      const params = new URLSearchParams();
      params.set('route', routeId);
      if (operatorId && operatorId !== 'all') params.set('operator', operatorId);
      
      console.log(`Fetching schedule for route ${routeId}, operator ${operatorId}`);
      
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '');
      if (!SUPABASE_KEY) throw new Error('Supabase API key is missing');
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/schedule?${params}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      
      if (!response.ok) {
        console.error('Failed to fetch route schedule:', response.status, response.statusText);
        throw new Error('Failed to fetch route schedule');
      }
      const result = await response.json();
      console.log(`Schedule data received:`, result.data?.total_trips || 0, 'trips');
      // Log debug info if available
      if (result.debug) {
        console.log('Schedule debug info:', result.debug);
      }
      return result.data as RouteScheduleData;
    },
    enabled: !!routeId && routeId !== 'all',
    staleTime: 30 * 1000, // 30 seconds for testing
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

export interface StopRoutesData {
  stop_id: string;
  routes: Array<{
    route_id: string;
    route_short_name: string;
    route_long_name: string;
    route_color?: string;
  }>;
}

export function useStopRoutes(stopId: string | null, operatorId?: string) {
  return useQuery({
    queryKey: ['stop-routes', stopId, operatorId],
    queryFn: async () => {
      if (!stopId) return null;
      const params = new URLSearchParams();
      params.set('stop', stopId);
      if (operatorId && operatorId !== 'all') params.set('operator', operatorId);
      
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || (typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '');
      if (!SUPABASE_KEY) throw new Error('Supabase API key is missing');
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/stop-routes?${params}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch stop routes');
      const result = await response.json();
      return result.data as StopRoutesData;
    },
    enabled: !!stopId,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
  });
}
