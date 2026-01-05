import { useState, useEffect, useMemo } from "react";
import { X, Bus, Clock, MapPin, Trash2, CalendarPlus, Bell, BellOff, ChevronRight, Footprints, AlertCircle } from "lucide-react";
import { format, differenceInMinutes, differenceInHours, differenceInDays } from "date-fns";
import { el } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSavedTrips, generateCalendarUrl, type SavedTrip } from "@/hooks/useSavedTrips";

interface SavedTripsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatCountdown(departureDate: Date): { text: string; isUrgent: boolean; isPast: boolean } {
  const now = new Date();
  
  if (departureDate < now) {
    return { text: "Έφυγε", isUrgent: false, isPast: true };
  }
  
  const minutesDiff = differenceInMinutes(departureDate, now);
  const hoursDiff = differenceInHours(departureDate, now);
  const daysDiff = differenceInDays(departureDate, now);
  
  if (minutesDiff < 15) {
    return { text: `σε ${minutesDiff} λεπτά!`, isUrgent: true, isPast: false };
  } else if (minutesDiff < 60) {
    return { text: `σε ${minutesDiff} λεπτά`, isUrgent: minutesDiff < 30, isPast: false };
  } else if (hoursDiff < 24) {
    const mins = minutesDiff % 60;
    return { text: `σε ${hoursDiff}ω ${mins > 0 ? mins + "'" : ''}`, isUrgent: false, isPast: false };
  } else {
    return { text: `σε ${daysDiff} μέρες`, isUrgent: false, isPast: false };
  }
}

function TripCard({ trip, onDelete, onAddToCalendar }: {
  trip: SavedTrip;
  onDelete: () => void;
  onAddToCalendar: () => void;
}) {
  const [countdown, setCountdown] = useState<{ text: string; isUrgent: boolean; isPast: boolean }>({ text: '', isUrgent: false, isPast: false });
  
  // Calculate departure datetime
  const departureDateTime = useMemo(() => {
    const date = new Date(trip.departureDate);
    const [hours, minutes] = trip.journey.departureTime.split(':').map(Number);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }, [trip.departureDate, trip.journey.departureTime]);
  
  // Update countdown every minute
  useEffect(() => {
    const update = () => setCountdown(formatCountdown(departureDateTime));
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [departureDateTime]);
  
  // Check for notifications
  useEffect(() => {
    if (!trip.reminderMinutes) return;
    
    const checkReminder = () => {
      const now = new Date();
      const minutesUntil = differenceInMinutes(departureDateTime, now);
      
      if (minutesUntil > 0 && minutesUntil <= trip.reminderMinutes) {
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const busLegs = trip.journey.legs.filter(l => l.type === 'bus');
          const firstBus = busLegs[0];
          new Notification('🚌 Ώρα να φύγεις!', {
            body: `Πιάσε τη γραμμή ${firstBus?.route?.route_short_name} σε ${minutesUntil} λεπτά από ${firstBus?.fromStop?.stop_name}`,
            icon: '/pwa-192x192.png',
            tag: `trip-${trip.id}`,
          });
        }
        
        toast.info(`🚌 Σε ${minutesUntil} λεπτά!`, {
          description: `Πιάσε τη γραμμή από ${trip.origin.stop_name}`,
        });
      }
    };
    
    checkReminder();
    const interval = setInterval(checkReminder, 60000);
    return () => clearInterval(interval);
  }, [trip, departureDateTime]);
  
  const busLegs = trip.journey.legs.filter(l => l.type === 'bus');
  const routeNames = busLegs.map(l => l.route?.route_short_name).join(' → ');
  const firstBusLeg = busLegs[0];
  
  return (
    <div className={cn(
      "rounded-xl border bg-card overflow-hidden transition-all",
      countdown.isUrgent && "border-amber-500 ring-2 ring-amber-500/20 animate-pulse",
      countdown.isPast && "opacity-50"
    )}>
      {/* Header with countdown */}
      <div className={cn(
        "p-3 border-b",
        countdown.isUrgent 
          ? "bg-gradient-to-r from-amber-500/20 to-orange-500/10 border-amber-500/30" 
          : "bg-gradient-to-r from-primary/10 to-primary/5 border-border"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{routeNames}</span>
          </div>
          <div className={cn(
            "text-sm font-bold px-2 py-1 rounded",
            countdown.isUrgent 
              ? "bg-amber-500 text-white" 
              : countdown.isPast 
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
          )}>
            {countdown.text}
          </div>
        </div>
        
        {/* Route info */}
        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{trip.origin.stop_name}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate">{trip.destination.stop_name}</span>
        </div>
        
        <div className="flex items-center gap-2 mt-1 text-sm">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono font-bold text-primary">
            {trip.journey.departureTime.substring(0, 5)}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono text-muted-foreground">
            {trip.journey.arrivalTime.substring(0, 5)}
          </span>
          <span className="text-xs text-muted-foreground ml-2">
            {format(new Date(trip.departureDate), "dd/MM", { locale: el })}
          </span>
        </div>
      </div>
      
      {/* Trip steps summary */}
      <div className="p-3 space-y-2">
        {trip.journey.legs.map((leg, idx) => (
          <div key={idx} className="flex items-center gap-2 text-sm">
            {leg.type === 'walk' ? (
              <>
                <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Footprints className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-muted-foreground">
                  Περπάτημα {leg.walkingMinutes}'
                </span>
              </>
            ) : (
              <>
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: leg.route?.route_color ? `#${leg.route.route_color}` : 'hsl(var(--primary))' }}
                >
                  {leg.route?.route_short_name?.substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{leg.fromStop?.stop_name}</span>
                  <span className="text-muted-foreground mx-1">→</span>
                  <span className="text-muted-foreground">{leg.toStop?.stop_name}</span>
                </div>
                <span className="font-mono text-xs text-primary">{leg.departureTime?.substring(0, 5)}</span>
              </>
            )}
          </div>
        ))}
      </div>
      
      {/* Actions */}
      <div className="p-2 border-t border-border bg-muted/30 flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 text-xs gap-1"
          onClick={onAddToCalendar}
        >
          <CalendarPlus className="h-3 w-3" />
          Ημερολόγιο
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SavedTripsPanel({ isOpen, onClose }: SavedTripsPanelProps) {
  const { savedTrips, deleteTrip, getUpcomingTrips } = useSavedTrips();
  
  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);
  
  const upcomingTrips = getUpcomingTrips();
  const pastTrips = savedTrips.filter(t => !upcomingTrips.includes(t));
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bus className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Οι Διαδρομές μου</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          {savedTrips.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {upcomingTrips.length} επερχόμενες διαδρομές
            </p>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {savedTrips.length === 0 ? (
            <div className="text-center py-12">
              <Bus className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-medium">Δεν υπάρχουν αποθηκευμένες διαδρομές</p>
              <p className="text-sm text-muted-foreground mt-1">
                Αποθήκευσε μια διαδρομή για να λαμβάνεις ειδοποιήσεις
              </p>
            </div>
          ) : (
            <>
              {upcomingTrips.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Επερχόμενες</h3>
                  <div className="space-y-3">
                    {upcomingTrips.map(trip => (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        onDelete={() => {
                          deleteTrip(trip.id);
                          toast.success("Η διαδρομή διαγράφηκε");
                        }}
                        onAddToCalendar={() => {
                          window.open(generateCalendarUrl(trip), '_blank');
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {pastTrips.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Παλαιότερες</h3>
                  <div className="space-y-3">
                    {pastTrips.slice(0, 5).map(trip => (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        onDelete={() => {
                          deleteTrip(trip.id);
                          toast.success("Η διαδρομή διαγράφηκε");
                        }}
                        onAddToCalendar={() => {
                          window.open(generateCalendarUrl(trip), '_blank');
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0">
          <Button variant="outline" className="w-full" onClick={onClose}>
            Κλείσιμο
          </Button>
        </div>
      </div>
    </div>
  );
}
