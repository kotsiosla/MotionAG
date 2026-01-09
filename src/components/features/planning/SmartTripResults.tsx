
import { useState, useMemo } from "react";
import { X, Bus, Clock, MapPin, ArrowDown, Loader2, Star, CalendarIcon, Footprints, Map, AlertCircle, Navigation, ChevronRight, ArrowUpDown, Filter, Share2, Bookmark, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { JourneyOption, JourneyLeg, SmartTripPlanData } from "@/hooks/useSmartTripPlan";
import type { StaticStop } from "@/types/gtfs";
import { useSavedTrips, generateCalendarUrl, type SavedTrip } from "@/hooks/useSavedTrips";

interface SmartTripResultsProps {
  origin: StaticStop | null;
  destination: StaticStop | null;
  departureTime?: string;
  departureDate?: Date;
  data: SmartTripPlanData | undefined;
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  maxWalkingDistance?: number;
  onWalkingDistanceChange?: (distance: number) => void;
}

const WALKING_DISTANCE_OPTIONS = [
  { value: 0, label: 'Χωρίς όριο' },
  { value: 300, label: '300μ' },
  { value: 400, label: '400μ' },
  { value: 500, label: '500μ' },
  { value: 600, label: '600μ' },
  { value: 800, label: '800μ' },
  { value: 1000, label: '1χλμ' },
];

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Προτεινόμενες' },
  { value: 'fastest', label: 'Ταχύτερες' },
  { value: 'least_walking', label: 'Λιγότερο περπάτημα' },
  { value: 'least_transfers', label: 'Λιγότερες αλλαγές' },
];

const TRANSFER_FILTER_OPTIONS = [
  { value: -1, label: 'Όλες' },
  { value: 0, label: 'Απευθείας' },
  { value: 1, label: 'Μέχρι 1' },
  { value: 2, label: 'Μέχρι 2' },
];

// Format distance nicely
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} μ`;
  }
  return `${(meters / 1000).toFixed(1)} χλμ`;
}

// Get Google Maps walking directions URL
function getWalkingUrl(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}&travelmode=walking`;
}

// Get Google Maps transit URL
function getTransitUrl(origin: StaticStop, destination: StaticStop): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.stop_lat},${origin.stop_lon}&destination=${destination.stop_lat},${destination.stop_lon}&travelmode=transit`;
}

// Render a single leg of the journey
function JourneyLegView({ leg, isLast }: { leg: JourneyLeg; isLast: boolean }) {
  if (leg.type === 'walk') {
    const isLongWalk = (leg.walkingMeters || 0) > 2000;
    return (
      <div className="flex items-start gap-3 py-3">
        <div className="flex flex-col items-center">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center",
            isLongWalk
              ? "bg-red-100 dark:bg-red-900/40"
              : "bg-amber-100 dark:bg-amber-900/40"
          )}>
            {isLongWalk ? (
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            ) : (
              <Footprints className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          {!isLast && <div className={cn(
            "w-0.5 h-8 mt-1",
            isLongWalk ? "bg-red-200 dark:bg-red-800" : "bg-amber-200 dark:bg-amber-800"
          )} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-medium text-sm",
            isLongWalk
              ? "text-red-700 dark:text-red-400"
              : "text-amber-700 dark:text-amber-400"
          )}>
            Περπάτημα {leg.walkingMinutes} λεπτά
            {isLongWalk && (
              <span className="ml-2 text-xs font-normal bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">
                ⚠️ Μεγάλη απόσταση!
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {leg.fromLocation?.name && leg.toLocation?.name && (
              <span>
                {leg.fromLocation.name} → {leg.toLocation.name}
              </span>
            )}
            {leg.walkingMeters && (
              <span className={cn("ml-2", isLongWalk && "text-red-600 dark:text-red-400 font-medium")}>
                ({formatDistance(leg.walkingMeters)})
              </span>
            )}
          </div>
          {leg.fromLocation && leg.toLocation && (
            <Button
              variant="link"
              size="sm"
              className="h-6 px-0 text-xs text-blue-600"
              onClick={() => window.open(
                getWalkingUrl(
                  leg.fromLocation!.lat,
                  leg.fromLocation!.lon,
                  leg.toLocation!.lat,
                  leg.toLocation!.lon
                ),
                '_blank'
              )}
            >
              <Navigation className="h-3 w-3 mr-1" />
              Οδηγίες περπατήματος
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Bus leg
  const bgColor = leg.route?.route_color ? `#${leg.route.route_color}` : 'hsl(var(--primary))';

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex flex-col items-center">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: bgColor }}
        >
          {leg.route?.route_short_name?.substring(0, 3) || <Bus className="h-4 w-4" />}
        </div>
        {!isLast && <div className="w-0.5 h-8 mt-1" style={{ backgroundColor: bgColor }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className="text-white text-sm font-bold px-2 py-0.5 rounded"
            style={{ backgroundColor: bgColor }}
          >
            {leg.route?.route_short_name}
          </span>
          <span className="text-sm font-medium truncate">
            {leg.route?.route_long_name}
          </span>
        </div>

        <div className="mt-2 space-y-1">
          {/* Board at */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground">Επιβίβαση:</span>
            <span className="font-medium truncate">{leg.fromStop?.stop_name}</span>
            {leg.departureTime && (
              <span className="text-primary font-mono font-bold ml-auto">
                {leg.departureTime.substring(0, 5)}
              </span>
            )}
          </div>

          {/* Stop count */}
          {leg.stopCount && leg.stopCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-4">
              <ChevronRight className="h-3 w-3" />
              <span>{leg.stopCount} στάσεις</span>
            </div>
          )}

          {/* Alight at */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-muted-foreground">Αποβίβαση:</span>
            <span className="font-medium truncate">{leg.toStop?.stop_name}</span>
            {leg.arrivalTime && (
              <span className="text-muted-foreground font-mono ml-auto">
                {leg.arrivalTime.substring(0, 5)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Render a complete journey option
function JourneyOptionCard({
  journey,
  index,
  onSave,
  onAddToCalendar,
}: {
  journey: JourneyOption;
  index: number;
  onSave: () => void;
  onAddToCalendar: () => void;
}) {
  const busLegs = journey.legs.filter(l => l.type === 'bus');
  const routeNames = busLegs.map(l => l.route?.route_short_name).join(' → ');
  const totalWalkingMeters = journey.legs
    .filter(l => l.type === 'walk')
    .reduce((sum, l) => sum + (l.walkingMeters || 0), 0);
  const hasLongWalk = totalWalkingMeters > 2000;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {index + 1}
            </div>
            <span className="font-bold">{routeNames}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onSave}
              title="Αποθήκευση διαδρομής"
            >
              <Bookmark className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onAddToCalendar}
              title="Προσθήκη στο ημερολόγιο"
            >
              <CalendarPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Time display */}
        <div className="flex items-center gap-1 mt-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-bold text-primary">
            {journey.departureTime.substring(0, 5)}
          </span>
          <span className="text-muted-foreground">→</span>
          <span className="font-mono">
            {journey.arrivalTime.substring(0, 5)}
          </span>
        </div>

        {/* Summary badges */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded text-xs">
            <Clock className="h-3 w-3" />
            <span>{journey.totalDurationMinutes} λεπτά</span>
          </div>
          {journey.transferCount > 0 && (
            <div className="flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded text-xs">
              <Bus className="h-3 w-3" />
              <span>{journey.transferCount} αλλαγή{journey.transferCount > 1 ? 'ες' : ''}</span>
            </div>
          )}
          {journey.totalWalkingMinutes > 0 && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded text-xs",
              hasLongWalk
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
            )}>
              {hasLongWalk ? <AlertCircle className="h-3 w-3" /> : <Footprints className="h-3 w-3" />}
              <span>
                {journey.totalWalkingMinutes} λεπτά περπάτημα
                {hasLongWalk && ` (${formatDistance(totalWalkingMeters)})`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legs */}
      <div className="p-3 divide-y divide-border/50">
        {journey.legs.map((leg, idx) => (
          <JourneyLegView
            key={idx}
            leg={leg}
            isLast={idx === journey.legs.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

interface SmartTripResultsProps {
  origin: StaticStop | null;
  destination: StaticStop | null;
  departureTime?: string;
  departureDate?: Date;
  data: SmartTripPlanData | undefined;
  isLoading: boolean;
  error: Error | null;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  maxWalkingDistance?: number;
  onWalkingDistanceChange?: (distance: number) => void;
}

export function SmartTripResults({
  origin,
  destination,
  departureTime,
  departureDate,
  data,
  isLoading,
  error,
  onClose,
  isFavorite,
  onToggleFavorite,
  maxWalkingDistance = 500,
  onWalkingDistanceChange,
}: SmartTripResultsProps) {
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [maxTransfersFilter, setMaxTransfersFilter] = useState<number>(-1);
  const { saveTrip } = useSavedTrips();

  const isToday = departureDate ? departureDate.toDateString() === new Date().toDateString() : true;
  const effectiveDate = departureDate || new Date();

  // Filter and sort journeys
  const filteredJourneys = useMemo(() => {
    if (!data?.journeyOptions) return [];

    let journeys = [...data.journeyOptions];

    // Filter by max transfers
    if (maxTransfersFilter >= 0) {
      journeys = journeys.filter(j => j.transferCount <= maxTransfersFilter);
    }

    // Sort
    switch (sortBy) {
      case 'fastest':
        journeys.sort((a, b) => a.totalDurationMinutes - b.totalDurationMinutes);
        break;
      case 'least_walking':
        journeys.sort((a, b) => a.totalWalkingMinutes - b.totalWalkingMinutes);
        break;
      case 'least_transfers':
        journeys.sort((a, b) => a.transferCount - b.transferCount);
        break;
      case 'recommended':
      default:
        // Already sorted by score
        break;
    }

    return journeys;
  }, [data?.journeyOptions, sortBy, maxTransfersFilter]);

  // Must be after hooks to avoid conditional hook calls
  if (!origin || !destination) return null;

  const handleSaveTrip = (journey: JourneyOption) => {
    saveTrip(origin, destination, journey, effectiveDate, 15);
    toast.success("Η διαδρομή αποθηκεύτηκε!", {
      description: "Θα λάβεις ειδοποίηση 15 λεπτά πριν την αναχώρηση"
    });
  };

  const handleAddToCalendar = (journey: JourneyOption) => {
    const tempTrip: SavedTrip = {
      id: 'temp',
      origin,
      destination,
      journey,
      departureDate: effectiveDate.toISOString(),
      savedAt: new Date().toISOString(),
    };
    const url = generateCalendarUrl(tempTrip);
    window.open(url, '_blank');
    toast.success("Άνοιξε το Google Calendar για προσθήκη");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/50 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Προτεινόμενες Διαδρομές</h2>
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
          <div className="flex items-center flex-wrap gap-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium truncate max-w-[150px]">{origin.stop_name}</span>
            </div>
            <ArrowDown className="h-3 w-3 text-muted-foreground rotate-[-90deg]" />
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-destructive" />
              <span className="font-medium truncate max-w-[150px]">{destination.stop_name}</span>
            </div>
          </div>

          {/* Date/Time and Filters */}
          <div className="flex items-center gap-2 flex-wrap pt-2">
            <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded text-xs">
              <CalendarIcon className="h-3 w-3" />
              <span>{isToday ? "Σήμερα" : format(departureDate || new Date(), "dd/MM", { locale: el })}</span>
            </div>
            <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded text-xs">
              <Clock className="h-3 w-3" />
              <span>
                {departureTime === 'now' && 'Τώρα'}
                {departureTime === 'all_day' && 'Όλη η μέρα'}
                {departureTime !== 'now' && departureTime !== 'all_day' && departureTime}
              </span>
            </div>

            {/* Walking Distance Selector */}
            <div className="flex items-center gap-1">
              <Footprints className="h-3 w-3 text-amber-600" />
              <Select
                value={maxWalkingDistance.toString()}
                onValueChange={(v) => onWalkingDistanceChange?.(parseInt(v, 10))}
              >
                <SelectTrigger className="h-6 w-[80px] text-xs border-amber-200 dark:border-amber-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WALKING_DISTANCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transfers Filter */}
            <div className="flex items-center gap-1">
              <Bus className="h-3 w-3 text-blue-600" />
              <Select
                value={maxTransfersFilter.toString()}
                onValueChange={(v) => setMaxTransfersFilter(parseInt(v, 10))}
              >
                <SelectTrigger className="h-6 w-[80px] text-xs border-blue-200 dark:border-blue-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRANSFER_FILTER_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value.toString()}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">αλλαγές</span>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3 w-3 text-primary" />
              <Select
                value={sortBy}
                onValueChange={setSortBy}
              >
                <SelectTrigger className="h-6 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-muted-foreground">Αναζήτηση διαδρομών...</p>
              <p className="text-xs text-muted-foreground mt-1">Ψάχνω συνδυασμούς γραμμών και κοντινές στάσεις</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Σφάλμα κατά την αναζήτηση</p>
              <p className="text-sm text-muted-foreground mt-1">{error.message}</p>
            </div>
          ) : data?.noRouteFound ? (
            <div className="text-center py-12">
              <Bus className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-medium">Δεν βρέθηκε διαδρομή</p>
              <p className="text-sm text-muted-foreground mt-1">{data.message}</p>
              <div className="mt-4">
                <Button
                  variant="default"
                  onClick={() => window.open(getTransitUrl(origin, destination), '_blank')}
                >
                  <Map className="h-4 w-4 mr-2" />
                  Δοκιμάστε το Google Maps
                </Button>
              </div>
            </div>
          ) : filteredJourneys.length === 0 && data?.journeyOptions && data.journeyOptions.length > 0 ? (
            <div className="text-center py-12">
              <Filter className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="font-medium">Καμία διαδρομή με αυτά τα φίλτρα</p>
              <p className="text-sm text-muted-foreground mt-1">
                Δοκιμάστε να αλλάξετε τα φίλτρα (αλλαγές: {maxTransfersFilter === -1 ? 'Όλες' : maxTransfersFilter})
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => setMaxTransfersFilter(-1)}
              >
                Εμφάνιση όλων
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Εμφανίζονται {filteredJourneys.length} από {data?.journeyOptions.length || 0} διαδρομές
              </p>

              {filteredJourneys.map((journey, idx) => (
                <JourneyOptionCard
                  key={idx}
                  journey={journey}
                  index={idx}
                  onSave={() => handleSaveTrip(journey)}
                  onAddToCalendar={() => handleAddToCalendar(journey)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex-shrink-0 flex flex-wrap gap-2">
          <Button
            variant="default"
            className="flex-1 gap-2"
            onClick={() => window.open(getTransitUrl(origin, destination), '_blank')}
          >
            <Map className="h-4 w-4" />
            Άνοιγμα στο Google Maps
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={async () => {
              const url = getTransitUrl(origin, destination);
              const shareText = `Διαδρομή: ${origin.stop_name} → ${destination.stop_name}`;

              // Try native share first (works on mobile)
              if (navigator.share) {
                try {
                  await navigator.share({
                    title: 'MotionBus - Διαδρομή',
                    text: shareText,
                    url: url,
                  });
                  return;
                } catch (err) {
                  // User cancelled or error, fall back to copy
                }
              }

              // Fallback: copy to clipboard
              try {
                await navigator.clipboard.writeText(url);
                toast.success("Το link αντιγράφηκε!", {
                  description: "Μοιράστε το για να ανοίξει η διαδρομή στο Google Maps"
                });
              } catch (err) {
                toast.error("Δεν ήταν δυνατή η αντιγραφή");
              }
            }}
          >
            <Share2 className="h-4 w-4" />
            Κοινοποίηση
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
