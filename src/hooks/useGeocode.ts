import { useState, useCallback } from 'react';

export interface GeocodedLocation {
  id: string;
  displayName: string;
  shortName: string;
  lat: number;
  lon: number;
  type: 'address' | 'poi' | 'street' | 'place';
  address?: {
    road?: string;
    city?: string;
    suburb?: string;
    postcode?: string;
  };
}

export interface NearestStopInfo {
  stopId: string;
  stopName: string;
  lat: number;
  lon: number;
  distanceMeters: number;
  walkingMinutes: number;
}

// Calculate distance between two points using Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Estimate walking time (average walking speed 5 km/h = 83.3 m/min)
export function estimateWalkingTime(distanceMeters: number): number {
  return Math.ceil(distanceMeters / 83.3);
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} μ.`;
  }
  return `${(meters / 1000).toFixed(1)} χλμ.`;
}

export function useGeocode() {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<GeocodedLocation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const searchAddress = useCallback(async (query: string): Promise<GeocodedLocation[]> => {
    if (!query || query.length < 2) {
      setResults([]);
      return [];
    }

    setIsSearching(true);
    setError(null);

    try {
      // Use Nominatim for geocoding (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          countrycodes: 'cy',
          limit: '8',
          'accept-language': 'el,en',
        }),
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'MotionCyprusTransit/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();

      const locations: GeocodedLocation[] = data.map((item: {
        place_id: number;
        display_name: string;
        lat: string;
        lon: string;
        type: string;
        class: string;
        address?: {
          road?: string;
          city?: string;
          suburb?: string;
          postcode?: string;
          town?: string;
          village?: string;
        };
      }) => {
        // Determine type
        let type: GeocodedLocation['type'] = 'place';
        if (item.class === 'highway' || item.type === 'road' || item.type === 'street') {
          type = 'street';
        } else if (item.class === 'amenity' || item.class === 'tourism' || item.class === 'shop') {
          type = 'poi';
        } else if (item.type === 'house' || item.type === 'building') {
          type = 'address';
        }

        // Create short name
        const parts = item.display_name.split(',').map(p => p.trim());
        const shortName = parts.slice(0, 2).join(', ');

        return {
          id: `geo-${item.place_id}`,
          displayName: item.display_name,
          shortName,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type,
          address: {
            road: item.address?.road,
            city: item.address?.city || item.address?.town || item.address?.village,
            suburb: item.address?.suburb,
            postcode: item.address?.postcode,
          },
        };
      });

      setResults(locations);
      return locations;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Geocoding error';
      setError(message);
      setResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    searchAddress,
    clearResults,
    results,
    isSearching,
    error,
  };
}

// Find the N nearest stops to a location
export function findNearestStops(
  lat: number,
  lon: number,
  stops: Array<{ stop_id: string; stop_name: string; stop_lat?: number; stop_lon?: number }>,
  limit: number = 5
): NearestStopInfo[] {
  const stopsWithDistance = stops
    .filter(stop => stop.stop_lat && stop.stop_lon)
    .map(stop => {
      const distance = calculateDistance(lat, lon, stop.stop_lat!, stop.stop_lon!);
      return {
        stopId: stop.stop_id,
        stopName: stop.stop_name,
        lat: stop.stop_lat!,
        lon: stop.stop_lon!,
        distanceMeters: distance,
        walkingMinutes: estimateWalkingTime(distance),
      };
    })
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  return stopsWithDistance.slice(0, limit);
}
