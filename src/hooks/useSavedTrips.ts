import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
  syncedToServer?: boolean; // whether this trip is synced to DB
}

const STORAGE_KEY = 'motionbus_saved_trips';
const PUSH_ENDPOINT_KEY = 'motionbus_push_endpoint';

// Get stored push endpoint
function getPushEndpoint(): string | null {
  try {
    return localStorage.getItem(PUSH_ENDPOINT_KEY);
  } catch {
    return null;
  }
}

// Store push endpoint after subscription
export function setPushEndpoint(endpoint: string): void {
  try {
    localStorage.setItem(PUSH_ENDPOINT_KEY, endpoint);
  } catch (e) {
    console.error('Failed to store push endpoint:', e);
  }
}

export function useSavedTrips() {
  const [savedTrips, setSavedTrips] = useState<SavedTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load from localStorage on mount, then sync with server
  useEffect(() => {
    const loadTrips = async () => {
      try {
        // First load from localStorage for immediate UI
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as SavedTrip[];
            setSavedTrips(parsed);
          } catch (e) {
            console.error('Failed to parse saved trips from storage:', e);
            localStorage.removeItem(STORAGE_KEY);
          }
        }

        // Then try to sync with server
        const endpoint = getPushEndpoint();
        if (endpoint) {
          const { data, error } = await supabase
            .from('saved_trips')
            .select('*')
            .eq('push_endpoint', endpoint);

          if (!error && data) {
            // Merge server trips with local trips
            const serverTrips: SavedTrip[] = data.map(t => ({
              id: t.id,
              origin: {
                stop_id: t.origin_stop_id,
                stop_name: t.origin_stop_name,
              } as StaticStop,
              destination: {
                stop_id: t.destination_stop_id,
                stop_name: t.destination_stop_name,
              } as StaticStop,
              journey: t.journey_data as unknown as JourneyOption,
              departureDate: `${t.departure_date}T${t.departure_time}`,
              savedAt: t.created_at,
              reminderMinutes: t.reminder_minutes,
              syncedToServer: true,
            }));

            // Combine with local-only trips (that might not be synced)
            let localTrips: SavedTrip[] = [];
            try {
              localTrips = stored ? JSON.parse(stored) as SavedTrip[] : [];
            } catch {
              localTrips = [];
            }
            const localOnlyTrips = localTrips.filter(
              lt => !serverTrips.find(st => st.id === lt.id)
            );

            const merged = [...serverTrips, ...localOnlyTrips];
            setSavedTrips(merged);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          }
        }
      } catch (e) {
        console.error('Failed to load saved trips:', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadTrips();
  }, []);

  // Save to localStorage
  const persistTrips = useCallback((trips: SavedTrip[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
    } catch (e) {
      console.error('Failed to save trips:', e);
    }
  }, []);

  // Sync trip to server for background notifications
  const syncTripToServer = useCallback(async (trip: SavedTrip): Promise<boolean> => {
    const endpoint = getPushEndpoint();
    if (!endpoint) {
      console.log('No push endpoint, skipping server sync');
      return false;
    }

    try {
      const depDate = new Date(trip.departureDate);
      const busLegs = trip.journey.legs.filter(l => l.type === 'bus');
      const routeNames = busLegs.map(l => l.route?.route_short_name || '').filter(Boolean);

      // Check if trip exists
      const { data: existing } = await supabase
        .from('saved_trips')
        .select('id')
        .eq('id', trip.id)
        .maybeSingle();

      if (existing) {
        // Update existing trip
        const { error } = await supabase
          .from('saved_trips')
          .update({
            push_endpoint: endpoint,
            origin_stop_id: trip.origin.stop_id,
            origin_stop_name: trip.origin.stop_name,
            destination_stop_id: trip.destination.stop_id,
            destination_stop_name: trip.destination.stop_name,
            journey_data: JSON.parse(JSON.stringify(trip.journey)),
            departure_date: depDate.toISOString().split('T')[0],
            departure_time: trip.journey.departureTime,
            reminder_minutes: trip.reminderMinutes || 15,
            route_names: routeNames,
            reminder_sent: false,
          })
          .eq('id', trip.id);

        if (error) {
          console.error('Failed to update trip:', error);
          return false;
        }
      } else {
        // Insert new trip - use raw insert with explicit columns
        const insertData = {
          id: trip.id,
          push_endpoint: endpoint,
          origin_stop_id: trip.origin.stop_id,
          origin_stop_name: trip.origin.stop_name,
          destination_stop_id: trip.destination.stop_id,
          destination_stop_name: trip.destination.stop_name,
          journey_data: JSON.parse(JSON.stringify(trip.journey)),
          departure_date: depDate.toISOString().split('T')[0],
          departure_time: trip.journey.departureTime,
          reminder_minutes: trip.reminderMinutes || 15,
          route_names: routeNames,
          reminder_sent: false,
        };

        const { error } = await supabase
          .from('saved_trips')
          .insert([insertData]);

        if (error) {
          console.error('Failed to insert trip:', error);
          return false;
        }
      }

      console.log('Trip synced to server:', trip.id);
      return true;
    } catch (e) {
      console.error('Error syncing trip:', e);
      return false;
    }
  }, []);

  const saveTrip = useCallback(async (
    origin: StaticStop,
    destination: StaticStop,
    journey: JourneyOption,
    departureDate: Date,
    reminderMinutes: number = 15
  ): Promise<SavedTrip> => {
    const newTrip: SavedTrip = {
      id: `trip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      origin,
      destination,
      journey,
      departureDate: departureDate.toISOString(),
      savedAt: new Date().toISOString(),
      reminderMinutes,
      syncedToServer: false,
    };

    // Update local state immediately
    setSavedTrips(prev => {
      const updated = [newTrip, ...prev];
      persistTrips(updated);
      return updated;
    });

    // Sync to server in background
    const synced = await syncTripToServer(newTrip);
    if (synced) {
      setSavedTrips(prev => {
        const updated = prev.map(t =>
          t.id === newTrip.id ? { ...t, syncedToServer: true } : t
        );
        persistTrips(updated);
        return updated;
      });
    }

    return newTrip;
  }, [persistTrips, syncTripToServer]);

  const deleteTrip = useCallback(async (tripId: string) => {
    // Remove from local state
    setSavedTrips(prev => {
      const updated = prev.filter(t => t.id !== tripId);
      persistTrips(updated);
      return updated;
    });

    // Remove from server
    try {
      await supabase.from('saved_trips').delete().eq('id', tripId);
      console.log('Trip deleted from server:', tripId);
    } catch (e) {
      console.error('Failed to delete trip from server:', e);
    }
  }, [persistTrips]);

  const updateTripReminder = useCallback(async (tripId: string, reminderMinutes: number | undefined) => {
    // Update local state
    setSavedTrips(prev => {
      const updated = prev.map(t =>
        t.id === tripId ? { ...t, reminderMinutes } : t
      );
      persistTrips(updated);

      // Sync to server
      const trip = updated.find(t => t.id === tripId);
      if (trip) {
        syncTripToServer(trip);
      }

      return updated;
    });
  }, [persistTrips, syncTripToServer]);

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

  // Sync all unsynced trips
  const syncAllTrips = useCallback(async () => {
    const unsyncedTrips = savedTrips.filter(t => !t.syncedToServer);
    console.log(`Syncing ${unsyncedTrips.length} unsynced trips...`);

    for (const trip of unsyncedTrips) {
      await syncTripToServer(trip);
    }
  }, [savedTrips, syncTripToServer]);

  return {
    savedTrips,
    isLoading,
    saveTrip,
    deleteTrip,
    updateTripReminder,
    getTripById,
    getUpcomingTrips,
    syncAllTrips,
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
      descriptionLines.push(`${idx + 1}. 🚶 Περπάτημα ${Math.ceil(leg.walkingMinutes || 0)} λεπτά (${leg.walkingMeters}μ)`);
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
      text += `${idx + 1}. 🚶 Περπάτημα ${Math.ceil(leg.walkingMinutes || 0)}'\n`;
    } else if (leg.type === 'bus') {
      text += `${idx + 1}. ${leg.route?.route_short_name}: ${leg.fromStop?.stop_name} → ${leg.toStop?.stop_name}\n`;
      text += `   🟢 ${leg.departureTime} | 🔴 ${leg.arrivalTime}\n`;
    }
  });

  return text;
}
