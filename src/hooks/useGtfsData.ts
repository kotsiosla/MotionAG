import { useQuery } from "@tanstack/react-query";
import type { Vehicle, Trip, Alert, GtfsResponse, RouteInfo, StaticStop } from "@/types/gtfs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function fetchFromProxy<T>(endpoint: string, operatorId?: string): Promise<GtfsResponse<T>> {
  const params = operatorId && operatorId !== 'all' 
    ? `?operator=${operatorId}` 
    : '';
  
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy${endpoint}${params}`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
      const params = new URLSearchParams();
      params.set('route', routeId);
      if (operatorId && operatorId !== 'all') params.set('operator', operatorId);
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy/route-shape?${params}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch route shape');
      const result = await response.json();
      return result.data as RouteShapeData;
    },
    enabled: !!routeId && routeId !== 'all',
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
