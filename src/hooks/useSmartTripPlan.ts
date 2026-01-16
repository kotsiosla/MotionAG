
import { useQuery } from "@tanstack/react-query";
import type { StaticStop, RouteInfo } from "@/types/gtfs";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://jftthfniwfarxyisszjh.supabase.co';

const getSupabaseAnonKey = () => {
  return (
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    (typeof window !== 'undefined' ? localStorage.getItem('supabase_anon_key') || '' : '')
  );
};

// A single leg of a journey
export interface JourneyLeg {
  type: 'walk' | 'bus';
  // For bus legs
  route?: RouteInfo;
  fromStop?: StaticStop;
  toStop?: StaticStop;
  departureTime?: string;
  arrivalTime?: string;
  stopCount?: number;
  tripId?: string;
  // For walking legs
  walkingMeters?: number;
  walkingMinutes?: number;
  fromLocation?: { lat: number; lon: number; name: string };
  toLocation?: { lat: number; lon: number; name: string };
}

// Complete journey option
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

export interface SmartTripPlanData {
  journeyOptions: JourneyOption[];
  noRouteFound: boolean;
  searchedStops?: number;
  message?: string;
}

export type OptimizationPreference = 'fastest' | 'least_walking' | 'fewest_transfers' | 'balanced';

export interface SmartTripPlanOptions {
  departureTime?: string;
  departureDate?: Date;
  maxWalkingDistance?: number;
  maxTransfers?: number;
  preference?: OptimizationPreference;
  includeNightBuses?: boolean;
}

export function useSmartTripPlan(
  originStop: StaticStop | null,
  destStop: StaticStop | null,
  options: SmartTripPlanOptions = {}
) {
  const {
    departureTime = 'now',
    departureDate = new Date(),
    maxWalkingDistance = 1000,
    maxTransfers = 2,
    preference = 'balanced',
    includeNightBuses = true
  } = options;

  // Format date for query key to be stable (YYYY-MM-DD)
  const dateKey = departureDate.toISOString().split('T')[0];

  return useQuery({
    queryKey: [
      'smart-trip-plan',
      originStop?.stop_id,
      destStop?.stop_id,
      departureTime,
      dateKey,
      maxWalkingDistance,
      maxTransfers,
      preference,
      includeNightBuses
    ],
    queryFn: async (): Promise<SmartTripPlanData> => {
      if (!originStop || !destStop) {
        return { journeyOptions: [], noRouteFound: true };
      }

      const anonKey = getSupabaseAnonKey();

      // Calculate active time
      let timeStr = departureTime;
      if (departureTime === 'now') {
        timeStr = new Date().toLocaleTimeString('en-GB', { hour12: false });
      } else if (departureTime === 'all_day') {
        timeStr = '00:00:00';
      } else if (departureTime.length === 5) {
        timeStr = `${departureTime}:00`;
      }

      const params = new URLSearchParams({
        originLat: (originStop.stop_lat ?? 0).toString(),
        originLon: (originStop.stop_lon ?? 0).toString(),
        destLat: (destStop.stop_lat ?? 0).toString(),
        destLon: (destStop.stop_lon ?? 0).toString(),
        departureTime: timeStr,
        departure_date: dateKey,
        maxTransfers: maxTransfers.toString(),
        walkDistance: maxWalkingDistance.toString(),
        preference,
        includeNightBuses: includeNightBuses.toString()
      });

      console.log(`Searching journeys: ${originStop.stop_name} → ${destStop.stop_name} [${timeStr}, ${dateKey}]`);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/route-planner?${params}`, {
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'apikey': anonKey,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch routes from backend');
      }

      const result = await response.json();
      const journeyOptions: JourneyOption[] = result.data || [];

      return {
        journeyOptions,
        noRouteFound: journeyOptions.length === 0,
        message: result.message || (journeyOptions.length === 0
          ? 'Δεν βρέθηκε διαδρομή για τις επιλεγμένες παραμέτρους.'
          : undefined)
      };
    },
    enabled: !!originStop && !!destStop,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
}
