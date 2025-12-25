import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Vehicle, Trip, Alert, GtfsResponse } from "@/types/gtfs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function fetchFromProxy<T>(endpoint: string): Promise<GtfsResponse<T>> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/gtfs-proxy${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }

  return response.json();
}

export function useVehicles(refreshInterval: number) {
  return useQuery({
    queryKey: ['vehicles'],
    queryFn: () => fetchFromProxy<Vehicle[]>('/vehicles'),
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) / 2,
  });
}

export function useTrips(refreshInterval: number) {
  return useQuery({
    queryKey: ['trips'],
    queryFn: () => fetchFromProxy<Trip[]>('/trips'),
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) / 2,
  });
}

export function useAlerts(refreshInterval: number) {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: () => fetchFromProxy<Alert[]>('/alerts'),
    refetchInterval: refreshInterval * 1000,
    staleTime: (refreshInterval * 1000) / 2,
  });
}