import { X, Bus, Clock, MapPin, ArrowRight, Loader2, ChevronRight, Star, CalendarIcon, Printer, Footprints, Navigation, Map, RefreshCw, Info, AlertCircle, ArrowDown, Building2 } from "lucide-react";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TripPlanResult, TransferRoute, StopRouteInfo, InterCityJourney } from "@/hooks/useTripPlan";
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

// HTML escape function to prevent XSS
const escapeHtml = (unsafe: string | undefined | null): string => {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Sanitize CSS color to prevent CSS injection
const sanitizeColor = (color: string | undefined): string => {
  if (!color) return '#3b82f6';
  // Only allow hex colors (6 chars, alphanumeric)
  if (/^[0-9A-Fa-f]{6}$/.test(color)) {
    return `#${color}`;
  }
  return '#3b82f6'; // Fallback
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
        ${walkingInfo.originWalkingMinutes > 0 ? `<div>• Αφετηρία → Στάση: ${Number(walkingInfo.originWalkingMinutes.toFixed(2))} λεπτά (${formatDistance(walkingInfo.originWalkingMeters)})</div>` : ''}
        ${walkingInfo.destWalkingMinutes > 0 ? `<div>• Στάση → Προορισμός: ${Number(walkingInfo.destWalkingMinutes.toFixed(2))} λεπτά (${formatDistance(walkingInfo.destWalkingMeters)})</div>` : ''}
        <div style="margin-top: 5px; font-weight: bold;">Συνολικό περπάτημα: ${Number((walkingInfo.originWalkingMinutes + walkingInfo.destWalkingMinutes).toFixed(2))} λεπτά</div>
      </div>
    `;
  }

  const routesHtml = results.map(result => {
    const bgColor = sanitizeColor(result.route.route_color);
    const tripsHtml = result.trips.map(trip => {
      const depParts = trip.departureTime.split(':').map(Number);
      const arrParts = trip.arrivalTime.split(':').map(Number);
      const duration = (arrParts[0] * 60 + arrParts[1]) - (depParts[0] * 60 + depParts[1]);
      return `<div style="margin: 5px 0; padding: 8px; background: #f3f4f6; border-radius: 4px;">
        <strong>${escapeHtml(trip.departureTime.substring(0, 5))}</strong> → ${escapeHtml(trip.arrivalTime.substring(0, 5))}
        <span style="color: #666; margin-left: 10px;">(${duration} λεπτά, ${trip.stopCount} στάσεις)</span>
      </div>`;
    }).join('');

    return `<div class="route-result-card">
      <div class="route-badge route-badge-md w-full !justify-start !px-3 !py-2" style="--route-color: ${bgColor}">
        <strong class="text-lg mr-2">${escapeHtml(result.route.route_short_name)}</strong>
        ${escapeHtml(result.route.route_long_name)}
      </div>
      <div class="p-2.5">
        <div class="text-[10px] text-muted-foreground uppercase font-black mb-1">Δρομολόγια:</div>
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
        ${originLocation ? `<div class="route-info"><span>📍 Αφετηρία:</span> <strong>${escapeHtml(originLocation.name)}</strong></div>` : ''}
        <div class="route-info">
          <div class="stop"><span class="origin-dot"></span> <strong>${escapeHtml(origin.stop_name)}</strong> (στάση)</div>
          <span class="arrow">→</span>
          <div class="stop"><span class="dest-dot"></span> <strong>${escapeHtml(destination.stop_name)}</strong> (στάση)</div>
        </div>
        ${destLocation ? `<div class="route-info"><span>🎯 Προορισμός:</span> <strong>${escapeHtml(destLocation.name)}</strong></div>` : ''}
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
  // Enhanced data
  transferRoutes?: TransferRoute[];
  originStopRoutes?: StopRouteInfo[];
  destinationStopRoutes?: StopRouteInfo[];
  interCityJourney?: InterCityJourney;
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
  transferRoutes = [],
  originStopRoutes = [],
  destinationStopRoutes = [],
  interCityJourney,
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
                  <span>Σύνολο περπατήματος: {Number(totalWalkingMinutes.toFixed(2))} λεπτά</span>
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
            <div className="space-y-6">
              {/* No direct routes message */}
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800 dark:text-amber-300">Δεν υπάρχει απευθείας σύνδεση</p>
                    <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                      Δεν βρέθηκε απευθείας γραμμή λεωφορείου μεταξύ αυτών των σημείων. Δείτε παρακάτω εναλλακτικές λύσεις.
                    </p>
                  </div>
                </div>
              </div>

              {/* Inter-city journey section - NEW */}
              {interCityJourney && (
                <div className="space-y-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h3 className="font-bold text-blue-800 dark:text-blue-300">Διαπεριφερειακή Διαδρομή</h3>
                  </div>

                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    {interCityJourney.description}
                  </p>

                  {/* Step 1: Local to Intercity Station */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold">1</div>
                      <span className="font-medium text-sm">Τοπικά λεωφορεία προς υπεραστικό σταθμό</span>
                    </div>
                    {interCityJourney.localToIntercityStation.stationStop && (
                      <div className="text-xs text-muted-foreground pl-8">
                        Κατευθυνθείτε στη στάση: <strong>{interCityJourney.localToIntercityStation.stationStop.stop_name}</strong>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2 pl-8">
                      {interCityJourney.localToIntercityStation.routes.map((routeInfo, idx) => {
                        const bgColor = routeInfo.route.route_color ? `#${routeInfo.route.route_color}` : 'var(--primary)';
                        return (
                          <div key={idx} className="rounded-lg border border-border bg-card/80 p-2 flex items-center gap-2">
                            <span
                              className="route-badge route-badge-sm"
                              style={{ '--route-color': bgColor } as React.CSSProperties}
                            >
                              {routeInfo.route.route_short_name}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate">{routeInfo.route.route_long_name || routeInfo.direction}</div>
                              {routeInfo.nextDepartures.length > 0 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {routeInfo.nextDepartures.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <ArrowDown className="h-5 w-5 text-blue-400" />
                  </div>

                  {/* Step 2: Intercity Bus */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white text-xs font-bold">2</div>
                      <span className="font-medium text-sm">Υπεραστικό λεωφορείο</span>
                    </div>
                    {(interCityJourney.intercityFromStation || interCityJourney.intercityToStation) && (
                      <div className="text-xs text-muted-foreground pl-8 flex items-center gap-2">
                        {interCityJourney.intercityFromStation && (
                          <span>{interCityJourney.intercityFromStation.stop_name}</span>
                        )}
                        <ArrowRight className="h-3 w-3" />
                        {interCityJourney.intercityToStation && (
                          <span>{interCityJourney.intercityToStation.stop_name}</span>
                        )}
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2 pl-8">
                      {interCityJourney.intercityRoutes.map((routeInfo, idx) => {
                        const bgColor = routeInfo.route.route_color ? `#${routeInfo.route.route_color}` : '#059669';
                        return (
                          <div key={idx} className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/30 p-2 flex items-center gap-2">
                            <span
                              className="route-badge route-badge-sm"
                              style={{ '--route-color': bgColor } as React.CSSProperties}
                            >
                              {routeInfo.route.route_short_name}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate font-medium">{routeInfo.route.route_long_name || routeInfo.direction}</div>
                              {routeInfo.nextDepartures.length > 0 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {routeInfo.nextDepartures.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {interCityJourney.intercityRoutes.length === 0 && (
                      <div className="text-xs text-muted-foreground pl-8 italic">
                        Ψάξτε στο motionbuscard.org.cy ή στο Google Maps για ακριβή ωράρια υπεραστικών
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center">
                    <ArrowDown className="h-5 w-5 text-blue-400" />
                  </div>

                  {/* Step 3: Local from Intercity Station */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 bg-white/60 dark:bg-white/10 rounded-lg px-3 py-2">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500 text-white text-xs font-bold">3</div>
                      <span className="font-medium text-sm">Τοπικά λεωφορεία στον προορισμό</span>
                    </div>
                    {interCityJourney.localFromIntercityStation.stationStop && (
                      <div className="text-xs text-muted-foreground pl-8">
                        Από τη στάση: <strong>{interCityJourney.localFromIntercityStation.stationStop.stop_name}</strong>
                      </div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2 pl-8">
                      {interCityJourney.localFromIntercityStation.routes.map((routeInfo, idx) => {
                        const bgColor = routeInfo.route.route_color ? `#${routeInfo.route.route_color}` : 'var(--primary)';
                        return (
                          <div key={idx} className="rounded-lg border border-border bg-card/80 p-2 flex items-center gap-2">
                            <span
                              className="route-badge route-badge-sm"
                              style={{ '--route-color': bgColor } as React.CSSProperties}
                            >
                              {routeInfo.route.route_short_name}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs truncate">{routeInfo.route.route_long_name || routeInfo.direction}</div>
                              {routeInfo.nextDepartures.length > 0 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {routeInfo.nextDepartures.join(', ')}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Transfer routes section */}
              {transferRoutes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Διαδρομές με Μεταβίβαση</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Μπορείτε να φτάσετε με αλλαγή λεωφορείου:
                  </p>
                  {transferRoutes.map((transfer, idx) => (
                    <div key={idx} className="rounded-lg border border-border bg-card overflow-hidden">
                      <div className="p-3 space-y-3">
                        {transfer.legs.map((leg, legIdx) => {
                          const bgColor = leg.route.route_color ? `#${leg.route.route_color}` : 'var(--primary)';
                          return (
                            <div key={legIdx} className="flex items-center gap-2 flex-wrap">
                              <span
                                className="route-badge route-badge-sm"
                                style={{ '--route-color': bgColor } as React.CSSProperties}
                              >
                                {leg.route.route_short_name}
                              </span>
                              <span className="text-sm truncate">{leg.fromStop.name}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm truncate">{leg.toStop.name}</span>
                              {legIdx < transfer.legs.length - 1 && (
                                <div className="w-full flex items-center gap-2 pl-2 py-1 text-xs text-amber-600 dark:text-amber-400">
                                  <RefreshCw className="h-3 w-3" />
                                  <span>Αλλαγή στη στάση: <strong>{transfer.transferStop.name}</strong></span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Routes at origin stop */}
              {originStopRoutes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Γραμμές από τη στάση αφετηρίας</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Στάση: <strong>{origin.stop_name}</strong>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {originStopRoutes.slice(0, 6).map((routeInfo, idx) => {
                      const bgColor = routeInfo.route.route_color ? `#${routeInfo.route.route_color}` : 'var(--primary)';
                      return (
                        <div key={idx} className="rounded-lg border border-border bg-card/50 p-2 flex items-center gap-2">
                          <span
                            className="route-badge route-badge-sm"
                            style={{ '--route-color': bgColor } as React.CSSProperties}
                          >
                            {routeInfo.route.route_short_name}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">{routeInfo.route.route_long_name || routeInfo.direction}</div>
                            {routeInfo.nextDepartures.length > 0 && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {routeInfo.nextDepartures.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Routes at destination stop */}
              {destinationStopRoutes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-destructive" />
                    <h3 className="font-semibold">Γραμμές προς τη στάση προορισμού</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Στάση: <strong>{destination.stop_name}</strong>
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {destinationStopRoutes.slice(0, 6).map((routeInfo, idx) => {
                      const bgColor = routeInfo.route.route_color ? `#${routeInfo.route.route_color}` : 'var(--primary)';
                      return (
                        <div key={idx} className="rounded-lg border border-border bg-card/50 p-2 flex items-center gap-2">
                          <span
                            className="route-badge route-badge-sm"
                            style={{ '--route-color': bgColor } as React.CSSProperties}
                          >
                            {routeInfo.route.route_short_name}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs truncate">{routeInfo.route.route_long_name || routeInfo.direction}</div>
                            {routeInfo.nextDepartures.length > 0 && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {routeInfo.nextDepartures.join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Suggestion to use Google Maps */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-300">Χρησιμοποιήστε το Google Maps</p>
                    <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                      Για πλήρη διαδρομή με όλες τις εναλλακτικές και ακριβείς χρόνους, πατήστε το κουμπί "Άνοιγμα στο Google Maps" παρακάτω.
                    </p>
                  </div>
                </div>
              </div>

              {/* No routes at all fallback */}
              {transferRoutes.length === 0 && originStopRoutes.length === 0 && destinationStopRoutes.length === 0 && (
                <div className="text-center py-6 text-muted-foreground">
                  <Bus className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Δεν βρέθηκαν διαθέσιμα δρομολόγια</p>
                  <p className="text-sm mt-1">Δοκιμάστε διαφορετική ώρα αναχώρησης</p>
                </div>
              )}
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
                      className="route-badge route-badge-md w-full !justify-start !px-3 !py-2 !rounded-none"
                      style={{ '--route-color': bgColor } as React.CSSProperties}
                    >
                      <span className="bg-white/20 text-white text-lg font-bold px-3 py-1 rounded mr-3">
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
