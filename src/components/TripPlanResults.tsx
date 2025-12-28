import { X, Bus, Clock, MapPin, ArrowRight, Loader2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TripPlanResult } from "@/hooks/useTripPlan";
import type { StaticStop } from "@/types/gtfs";

interface TripPlanResultsProps {
  origin: StaticStop | null;
  destination: StaticStop | null;
  results: TripPlanResult[];
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
}

export function TripPlanResults({
  origin,
  destination,
  results,
  isLoading,
  error,
  onClose,
}: TripPlanResultsProps) {
  if (!origin || !destination) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Αποτελέσματα Αναζήτησης</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium truncate max-w-[200px]">{origin.stop_name}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-destructive" />
              <span className="font-medium truncate max-w-[200px]">{destination.stop_name}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Αναζήτηση διαδρομών...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              <p>Σφάλμα κατά την αναζήτηση</p>
              <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bus className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Δεν βρέθηκαν διαδρομές</p>
              <p className="text-sm mt-1">Δοκιμάστε διαφορετικές στάσεις</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Βρέθηκαν {results.length} γραμμές που συνδέουν τις δύο στάσεις
              </p>
              
              {results.map((result) => {
                const bgColor = result.route.route_color 
                  ? `#${result.route.route_color}` 
                  : 'hsl(var(--primary))';
                
                return (
                  <div
                    key={result.route.route_id}
                    className="rounded-lg border border-border overflow-hidden bg-card"
                  >
                    {/* Route Header */}
                    <div 
                      className="p-3 flex items-center gap-3"
                      style={{ backgroundColor: bgColor }}
                    >
                      <span className="bg-white/20 text-white text-lg font-bold px-3 py-1 rounded">
                        {result.route.route_short_name}
                      </span>
                      <span className="text-white font-medium truncate">
                        {result.route.route_long_name}
                      </span>
                    </div>
                    
                    {/* Trips */}
                    <div className="p-3 space-y-2">
                      <div className="text-xs text-muted-foreground mb-2">
                        Επόμενα δρομολόγια:
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {result.trips.map((trip) => {
                          // Calculate duration
                          const depParts = trip.departureTime.split(':').map(Number);
                          const arrParts = trip.arrivalTime.split(':').map(Number);
                          const depMinutes = depParts[0] * 60 + depParts[1];
                          const arrMinutes = arrParts[0] * 60 + arrParts[1];
                          const duration = arrMinutes - depMinutes;
                          
                          return (
                            <div
                              key={trip.tripId}
                              className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2"
                            >
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono font-bold" style={{ color: bgColor }}>
                                {trip.departureTime.substring(0, 5)}
                              </span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">
                                {trip.arrivalTime.substring(0, 5)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({duration} λεπτά, {trip.stopCount} στάσεις)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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