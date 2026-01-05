import { X, Bus, Clock, MapPin, ArrowRight, Loader2, ChevronRight, Star, CalendarIcon, ExternalLink, Printer, Footprints, Navigation, Map } from "lucide-react";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TripPlanResult } from "@/hooks/useTripPlan";
import type { StaticStop } from "@/types/gtfs";
import { formatDistance } from "@/hooks/useGeocode";

export interface WalkingInfo {
  originWalkingMeters: number;
  originWalkingMinutes: number;
  destWalkingMeters: number;
  destWalkingMinutes: number;
}

export interface LocationInfo {
  name: string;
  lat: number;
  lon: number;
}

// Generate Google Maps directions URL with walking segments
const getGoogleMapsUrl = (
  origin: StaticStop, 
  destination: StaticStop,
  originLocation?: LocationInfo,
  destLocation?: LocationInfo
): string => {
  // If we have actual locations (address/POI), create a multi-waypoint route
  if (originLocation && destLocation) {
    // Origin location -> Origin stop (walk) -> Destination stop (transit) -> Destination location (walk)
    const waypoints = `${origin.stop_lat},${origin.stop_lon}|${destination.stop_lat},${destination.stop_lon}`;
    return `https://www.google.com/maps/dir/${originLocation.lat},${originLocation.lon}/${origin.stop_lat},${origin.stop_lon}/${destination.stop_lat},${destination.stop_lon}/${destLocation.lat},${destLocation.lon}?travelmode=transit`;
  } else if (originLocation) {
    return `https://www.google.com/maps/dir/${originLocation.lat},${originLocation.lon}/${origin.stop_lat},${origin.stop_lon}/${destination.stop_lat},${destination.stop_lon}?travelmode=transit`;
  } else if (destLocation) {
    return `https://www.google.com/maps/dir/${origin.stop_lat},${origin.stop_lon}/${destination.stop_lat},${destination.stop_lon}/${destLocation.lat},${destLocation.lon}?travelmode=transit`;
  }
  
  // Simple stop-to-stop transit
  const originCoords = `${origin.stop_lat},${origin.stop_lon}`;
  const destCoords = `${destination.stop_lat},${destination.stop_lon}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=transit`;
};

// Get walking directions URL
const getWalkingUrl = (fromLat: number, fromLon: number, toLat: number, toLon: number): string => {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}&travelmode=walking`;
};

// Print trip results
const printTripResults = (
  origin: StaticStop,
  destination: StaticStop,
  departureTime: string | undefined,
  departureDate: Date | undefined,
  results: TripPlanResult[],
  originLocation?: LocationInfo,
  destLocation?: LocationInfo,
  walkingInfo?: WalkingInfo
) => {
  const dateStr = departureDate 
    ? format(departureDate, "dd/MM/yyyy", { locale: el })
    : format(new Date(), "dd/MM/yyyy", { locale: el });
  const timeStr = departureTime === 'now' ? 'Τώρα' : departureTime || '';

  let walkingHtml = '';
  if (walkingInfo && (walkingInfo.originWalkingMinutes > 0 || walkingInfo.destWalkingMinutes > 0)) {
    walkingHtml = `
      <div style="background: #fef3c7; padding: 10px; border-radius: 8px; margin: 10px 0;">
        <strong>🚶 Περπάτημα:</strong>
        ${walkingInfo.originWalkingMinutes > 0 ? `<div>• Αφετηρία → Στάση: ${walkingInfo.originWalkingMinutes} λεπτά (${formatDistance(walkingInfo.originWalkingMeters)})</div>` : ''}
        ${walkingInfo.destWalkingMinutes > 0 ? `<div>• Στάση → Προορισμός: ${walkingInfo.destWalkingMinutes} λεπτά (${formatDistance(walkingInfo.destWalkingMeters)})</div>` : ''}
        <div style="margin-top: 5px; font-weight: bold;">Συνολικό περπάτημα: ${walkingInfo.originWalkingMinutes + walkingInfo.destWalkingMinutes} λεπτά</div>
      </div>
    `;
  }

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
      <title>Διαδρομή - Motion Cyprus</title>
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
        ${originLocation ? `<div class="route-info"><span>📍 Αφετηρία:</span> <strong>${originLocation.name}</strong></div>` : ''}
        <div class="route-info">
          <div class="stop"><span class="origin-dot"></span> <strong>${origin.stop_name}</strong> (στάση)</div>
          <span class="arrow">→</span>
          <div class="stop"><span class="dest-dot"></span> <strong>${destination.stop_name}</strong> (στάση)</div>
        </div>
        ${destLocation ? `<div class="route-info"><span>🎯 Προορισμός:</span> <strong>${destLocation.name}</strong></div>` : ''}
        <div class="route-info">
          <span class="date-time">📅 ${dateStr}</span>
          <span class="date-time">🕐 ${timeStr}</span>
        </div>
      </div>
      
      ${walkingHtml}
      
      <div>
        <strong>Διαθέσιμες Γραμμές (${results.length})</strong>
        ${routesHtml}
      </div>
      
      <div class="footer">
        Εκτυπώθηκε από Motion Cyprus - ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: el })}
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
  originLocation?: LocationInfo;
  destLocation?: LocationInfo;
  walkingInfo?: WalkingInfo;
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
  originLocation,
  destLocation,
  walkingInfo,
}: TripPlanResultsProps) {
  if (!origin || !destination) return null;

  const isToday = departureDate ? departureDate.toDateString() === new Date().toDateString() : true;
  const totalWalkingMinutes = (walkingInfo?.originWalkingMinutes || 0) + (walkingInfo?.destWalkingMinutes || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-border">
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
          
          {/* Journey Overview */}
          <div className="space-y-2">
            {/* Origin location if different from stop */}
            {originLocation && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-blue-500" />
                <span className="font-medium truncate">{originLocation.name}</span>
                {walkingInfo && walkingInfo.originWalkingMinutes > 0 && (
                  <button
                    onClick={() => window.open(getWalkingUrl(originLocation.lat, originLocation.lon, origin.stop_lat || 0, origin.stop_lon || 0), '_blank')}
                    className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full ml-auto hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                  >
                    <Footprints className="h-3 w-3" />
                    {walkingInfo.originWalkingMinutes}' ({formatDistance(walkingInfo.originWalkingMeters)})
                    <Navigation className="h-3 w-3 ml-1" />
                  </button>
                )}
              </div>
            )}

            {/* Stops */}
            <div className="flex items-center flex-wrap gap-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="font-medium truncate max-w-[150px]">{origin.stop_name}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Bus className="h-3 w-3" />
                <ArrowRight className="h-3 w-3" />
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-destructive" />
                <span className="font-medium truncate max-w-[150px]">{destination.stop_name}</span>
              </div>
            </div>

            {/* Destination location if different from stop */}
            {destLocation && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-red-500" />
                <span className="font-medium truncate">{destLocation.name}</span>
                {walkingInfo && walkingInfo.destWalkingMinutes > 0 && (
                  <button
                    onClick={() => window.open(getWalkingUrl(destination.stop_lat || 0, destination.stop_lon || 0, destLocation.lat, destLocation.lon), '_blank')}
                    className="flex items-center gap-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full ml-auto hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                  >
                    <Footprints className="h-3 w-3" />
                    {walkingInfo.destWalkingMinutes}' ({formatDistance(walkingInfo.destWalkingMeters)})
                    <Navigation className="h-3 w-3 ml-1" />
                  </button>
                )}
              </div>
            )}

            {/* Date/Time and Walking Summary */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded text-xs">
                <CalendarIcon className="h-3 w-3" />
                <span>{isToday ? "Σήμερα" : format(departureDate || new Date(), "dd/MM", { locale: el })}</span>
              </div>
              <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded text-xs">
                <Clock className="h-3 w-3" />
                <span>{departureTime === 'now' ? 'Τώρα' : departureTime}</span>
              </div>
              {totalWalkingMinutes > 0 && (
                <div className="flex items-center gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded text-xs">
                  <Footprints className="h-3 w-3" />
                  <span>Σύνολο περπατήματος: {totalWalkingMinutes} λεπτά</span>
                </div>
              )}
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
              <p className="text-sm mt-1">Δοκιμάστε διαφορετικές στάσεις ή ώρα αναχώρησης</p>
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
                          const busDuration = arrMinutes - depMinutes;
                          const totalDuration = busDuration + totalWalkingMinutes;
                          
                          return (
                            <div
                              key={trip.tripId}
                              className="bg-secondary/50 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono font-bold" style={{ color: bgColor }}>
                                  {trip.departureTime.substring(0, 5)}
                                </span>
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono">
                                  {trip.arrivalTime.substring(0, 5)}
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                <span>{busDuration} λεπτά λεωφορείο</span>
                                <span>•</span>
                                <span>{trip.stopCount} στάσεις</span>
                                {totalWalkingMinutes > 0 && (
                                  <>
                                    <span>•</span>
                                    <span className="text-amber-600 dark:text-amber-400">
                                      Σύνολο: ~{totalDuration} λεπτά
                                    </span>
                                  </>
                                )}
                              </div>
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
        <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0 flex flex-wrap gap-2">
          <Button 
            variant="default" 
            className="flex-1 gap-2"
            onClick={() => window.open(getGoogleMapsUrl(origin, destination, originLocation, destLocation), '_blank')}
          >
            <Map className="h-4 w-4" />
            Άνοιγμα στο Google Maps
          </Button>
          <Button 
            variant="secondary" 
            className="gap-2"
            onClick={() => printTripResults(origin, destination, departureTime, departureDate, results, originLocation, destLocation, walkingInfo)}
            disabled={results.length === 0}
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Εκτύπωση</span>
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
