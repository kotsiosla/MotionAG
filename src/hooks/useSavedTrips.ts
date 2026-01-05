import { useState, useEffect, useCallback } from 'react';
import type { JourneyOption } from './useSmartTripPlan';
import type { StaticStop } from '@/types/gtfs';

export interface SavedTrip {
  id: string;
  origin: StaticStop;
  destination: StaticStop;
  journey: JourneyOption;
  departureDate: string; // ISO date string
  savedAt: string; // ISO timestamp
  reminderMinutes?: number; // minutes before departure to remind
}

const STORAGE_KEY = 'motionbus_saved_trips';

export function useSavedTrips() {
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SavedTrip[];
        setSavedTrips(parsed);
      }
    } catch (e) {
      console.error('Failed to load saved trips:', e);
    }
  }, []);

  // Save to localStorage whenever trips change
  const persistTrips = useCallback((trips: SavedTrip[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch (e) {
      console.error('Failed to save trips:', e);
    }
  }, []);

  const saveTrip = useCallback((
    origin: StaticStop,
    destination: StaticStop,
    journey: JourneyOption,
    departureDate: Date,
    reminderMinutes?: number
  ): SavedTrip => {
    const newTrip: SavedTrip = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      origin,
      destination,
      journey,
      departureDate: departureDate.toISOString(),
      savedAt: new Date().toISOString(),
      reminderMinutes,
    };

    setSavedTrips(prev => {
      const updated = [newTrip, ...prev];
      persistTrips(updated);
      return updated;
    });

    return newTrip;
  }, [persistTrips]);

  const deleteTrip = useCallback((tripId: string) => {
    setSavedTrips(prev => {
      const updated = prev.filter(t => t.id !== tripId);
      persistTrips(updated);
      return updated;
    });
  }, [persistTrips]);

  const updateTripReminder = useCallback((tripId: string, reminderMinutes: number | undefined) => {
    setSavedTrips(prev => {
      const updated = prev.map(t => 
        t.id === tripId ? { ...t, reminderMinutes } : t
      );
      persistTrips(updated);
      return updated;
    });
  }, [persistTrips]);

  const getTripById = useCallback((tripId: string): SavedTrip | undefined => {
    return savedTrips.find(t => t.id === tripId);
  }, [savedTrips]);

  // Get upcoming trips (sorted by departure)
  const getUpcomingTrips = useCallback((): SavedTrip[] => {
    const now = new Date();
    return savedTrips
      .filter(trip => {
        const depDate = new Date(trip.departureDate);
        const [hours, minutes] = trip.journey.departureTime.split(':').map(Number);
        depDate.setHours(hours, minutes, 0, 0);
        return depDate >= now;
      })
      .sort((a, b) => {
        const dateA = new Date(a.departureDate);
        const dateB = new Date(b.departureDate);
        return dateA.getTime() - dateB.getTime();
      });
  }, [savedTrips]);

  return {
    savedTrips,
    saveTrip,
    deleteTrip,
    updateTripReminder,
    getTripById,
    getUpcomingTrips,
  };
}

// Generate Google Calendar URL
export function generateCalendarUrl(trip: SavedTrip): string {
  const depDate = new Date(trip.departureDate);
  const [depHours, depMinutes] = trip.journey.departureTime.split(':').map(Number);
  depDate.setHours(depHours, depMinutes, 0, 0);
  
  const arrDate = new Date(trip.departureDate);
  const [arrHours, arrMinutes] = trip.journey.arrivalTime.split(':').map(Number);
  arrDate.setHours(arrHours, arrMinutes, 0, 0);
  
  // Handle overnight journeys
  if (arrDate < depDate) {
    arrDate.setDate(arrDate.getDate() + 1);
  }

  // Format dates for Google Calendar (YYYYMMDDTHHmmss)
  const formatGoogleDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const busLegs = trip.journey.legs.filter(l => l.type === 'bus');
  const routeNames = busLegs.map(l => l.route?.route_short_name).join(' → ');
  
  const title = encodeURIComponent(`🚌 ${routeNames}: ${trip.origin.stop_name} → ${trip.destination.stop_name}`);
  
  // Build description with trip details
  const descriptionLines: string[] = [
    `Διαδρομή: ${trip.origin.stop_name} → ${trip.destination.stop_name}`,
    `Αναχώρηση: ${trip.journey.departureTime}`,
    `Άφιξη: ${trip.journey.arrivalTime}`,
    `Διάρκεια: ${trip.journey.totalDurationMinutes} λεπτά`,
    '',
  ];

  trip.journey.legs.forEach((leg, idx) => {
    if (leg.type === 'walk') {
      descriptionLines.push(`${idx + 1}. 🚶 Περπάτημα ${leg.walkingMinutes} λεπτά (${leg.walkingMeters}μ)`);
      if (leg.fromLocation && leg.toLocation) {
        descriptionLines.push(`   ${leg.fromLocation.name} → ${leg.toLocation.name}`);
      }
    } else if (leg.type === 'bus') {
      descriptionLines.push(`${idx + 1}. 🚌 ${leg.route?.route_short_name} - ${leg.route?.route_long_name}`);
      descriptionLines.push(`   Επιβίβαση: ${leg.fromStop?.stop_name} (${leg.departureTime})`);
      descriptionLines.push(`   Αποβίβαση: ${leg.toStop?.stop_name} (${leg.arrivalTime})`);
      if (leg.stopCount) {
        descriptionLines.push(`   ${leg.stopCount} στάσεις`);
      }
    }
  });
  
  const description = encodeURIComponent(descriptionLines.join('\n'));
  const location = encodeURIComponent(trip.origin.stop_name);

  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formatGoogleDate(depDate)}/${formatGoogleDate(arrDate)}&details=${description}&location=${location}`;
}

// Format trip for sharing
export function formatTripForShare(trip: SavedTrip): string {
  const busLegs = trip.journey.legs.filter(l => l.type === 'bus');
  const routeNames = busLegs.map(l => l.route?.route_short_name).join(' → ');
  
  let text = `🚌 Διαδρομή: ${trip.origin.stop_name} → ${trip.destination.stop_name}\n`;
  text += `📅 ${new Date(trip.departureDate).toLocaleDateString('el-GR')}\n`;
  text += `⏰ ${trip.journey.departureTime} - ${trip.journey.arrivalTime}\n`;
  text += `🚍 Γραμμές: ${routeNames}\n\n`;
  
  trip.journey.legs.forEach((leg, idx) => {
    if (leg.type === 'walk') {
      text += `${idx + 1}. 🚶 Περπάτημα ${leg.walkingMinutes}'\n`;
    } else if (leg.type === 'bus') {
      text += `${idx + 1}. ${leg.route?.route_short_name}: ${leg.fromStop?.stop_name} → ${leg.toStop?.stop_name}\n`;
      text += `   🟢 ${leg.departureTime} | 🔴 ${leg.arrivalTime}\n`;
    }
  });
  
  return text;
}
