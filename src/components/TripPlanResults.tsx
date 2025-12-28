import { X, Bus, Clock, MapPin, ArrowRight, Loader2, ChevronRight, Star, CalendarIcon, ExternalLink, Printer } from "lucide-react";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TripPlanResult } from "@/hooks/useTripPlan";
import type { StaticStop } from "@/types/gtfs";

// Generate Google Maps directions URL
const getGoogleMapsUrl = (origin: StaticStop, destination: StaticStop): string => {
  const originCoords = `${origin.stop_lat},${origin.stop_lon}`;
  const destCoords = `${destination.stop_lat},${destination.stop_lon}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=transit`;
};

// Print trip results
const printTripResults = (
  origin: StaticStop,
  destination: StaticStop,
  departureTime: string | undefined,
  departureDate: Date | undefined,
  results: TripPlanResult[]
) => {
  const dateStr = departureDate 
    ? format(departureDate, "dd/MM/yyyy", { locale: el })
    : format(new Date(), "dd/MM/yyyy", { locale: el });
  const timeStr = departureTime === 'now' ? 'Τώρα' : departureTime || '';

  const routesHtml = results.map(result => {
    const bgColor = result.route.route_color ? `#${result.route.route_color}` : '#3b82f6';
    const tripsHtml = result.trips.map(trip => {
      const depParts = trip.departureTime.split(':').map(Number);
      const arrParts = trip.arrivalTime.split(':').map(Number);
      const duration = (arrParts[0] * 60 + arrParts[1]) - (depParts[0] * 60 + depParts[1]);
      return `<div style="margin: 5px 0; padding: 8px; background: #f3f4f6; border-radius: 4px;">
        <strong>${trip.departureTime.substring(0, 5)}</strong> → ${trip.arrivalTime.substring(0, 5)}
        <span style="color: #666; margin-left: 10px;">(${duration} λεπτά, ${trip.stopCount} στάσεις)</span>
      </div>`;
    }).join('');

    return `<div style="margin: 15px 0; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
      <div style="background: ${bgColor}; color: white; padding: 10px;">
        <strong style="font-size: 18px; margin-right: 10px;">${result.route.route_short_name}</strong>
        ${result.route.route_long_name}
      </div>
      <div style="padding: 10px;">
        <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Δρομολόγια:</div>
        ${tripsHtml}
      </div>
    </div>`;
  }).join('');

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Διαδρομή - GTFS Cyprus</title>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { color: #333; font-size: 20px; margin-bottom: 5px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
        .route-info { display: flex; align-items: center; gap: 10px; margin: 10px 0; flex-wrap: wrap; }
        .stop { display: flex; align-items: center; gap: 5px; }
        .origin-dot { width: 10px; height: 10px; background: #3b82f6; border-radius: 50%; }
        .dest-dot { width: 10px; height: 10px; background: #ef4444; border-radius: 50%; }
        .arrow { color: #999; }
        .date-time { background: #f3f4f6; padding: 5px 10px; border-radius: 4px; font-size: 14px; }
        .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚌 Διαδρομή Λεωφορείου</h1>
        <div class="route-info">
          <div class="stop"><span class="origin-dot"></span> <strong>${origin.stop_name}</strong></div>
          <span class="arrow">→</span>
          <div class="stop"><span class="dest-dot"></span> <strong>${destination.stop_name}</strong></div>
        </div>
        <div class="route-info">
          <span class="date-time">📅 ${dateStr}</span>
          <span class="date-time">🕐 ${timeStr}</span>
        </div>
      </div>
      
      <div>
        <strong>Διαθέσιμες Γραμμές (${results.length})</strong>
        ${routesHtml}
      </div>
      
      <div class="footer">
        Εκτυπώθηκε από GTFS Cyprus Realtime - ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: el })}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  }
};

interface TripPlanResultsProps {
  origin: StaticStop | null;
  destination: StaticStop | null;
  departureTime?: string;
  departureDate?: Date;
  results: TripPlanResult[];
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}

export function TripPlanResults({
  origin,
  destination,
  departureTime,
  departureDate,
  results,
  isLoading,
  error,
  onClose,
  isFavorite,
  onToggleFavorite,
}: TripPlanResultsProps) {
  if (!origin || !destination) return null;

  const isToday = departureDate ? departureDate.toDateString() === new Date().toDateString() : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Αποτελέσματα Αναζήτησης</h2>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onToggleFavorite}
                title={isFavorite ? "Αφαίρεση από αγαπημένα" : "Προσθήκη στα αγαπημένα"}
              >
                <Star className={cn(
                  "h-5 w-5",
                  isFavorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"
                )} />
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium truncate max-w-[180px]">{origin.stop_name}</span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-destructive" />
              <span className="font-medium truncate max-w-[180px]">{destination.stop_name}</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded text-xs">
                <CalendarIcon className="h-3 w-3" />
                <span>{isToday ? "Σήμερα" : format(departureDate || new Date(), "dd/MM", { locale: el })}</span>
              </div>
              <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded text-xs">
                <Clock className="h-3 w-3" />
                <span>{departureTime === 'now' ? 'Τώρα' : departureTime}</span>
              </div>
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
        <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0 flex gap-2">
          <Button 
            variant="default" 
            className="flex-1 gap-2"
            onClick={() => window.open(getGoogleMapsUrl(origin, destination), '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Google Maps
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 gap-2"
            onClick={() => printTripResults(origin, destination, departureTime, departureDate, results)}
            disabled={results.length === 0}
          >
            <Printer className="h-4 w-4" />
            Εκτύπωση
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}