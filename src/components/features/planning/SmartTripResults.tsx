
import { useState, useMemo } from "react";
import { X, Bus, Clock, Star, CalendarIcon, Footprints, Map, AlertCircle, Navigation, ChevronRight, ArrowUpDown, Filter, Share2, Bookmark, CalendarPlus, Info } from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
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
  maxTransfers?: number;
  optimizationPreference?: string;
  includeNightBuses?: boolean;
  onParamsChange?: (params: {
    departureTime?: string;
    departureDate?: Date;
    maxWalkingDistance?: number;
    maxTransfers?: number;
    optimizationPreference?: string;
    includeNightBuses?: boolean;
  }) => void;
}

interface CustomCSS extends React.CSSProperties {
  '--route-color'?: string;
  '--text-color'?: string;
}

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Προτεινόμενες (Smart)' },
  { value: 'fastest', label: 'Ταχύτερες' },
  { value: 'least_walking', label: 'Λιγότερο περπάτημα' },
  { value: 'least_transfers', label: 'Λιγότερες αλλαγές' },
];

const TRANSFERS_OPTIONS = [
  { value: 0, label: 'Απευθείας' },
  { value: 1, label: 'Εώς 1 αλλαγή' },
  { value: 2, label: 'Εώς 2 αλλαγές' },
  { value: 3, label: 'Εώς 3 αλλαγές' },
  { value: 99, label: 'Χωρίς περιορισμό' },
];

const WALKING_OPTIONS = [
  { value: 250, label: '250 μ.' },
  { value: 500, label: '500 μ.' },
  { value: 1000, label: '1 χλμ.' },
  { value: 2000, label: '2 χλμ.' },
  { value: 5000, label: 'Χωρίς περιορισμό' },
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
      <div className="flex items-start gap-4 py-4 relative">
        <div className="flex flex-col items-center">
          <div className={cn(
            "z-10 w-10 h-10 rounded-full flex items-center justify-center border-2",
            isLongWalk
              ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900"
              : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900"
          )}>
            {isLongWalk ? (
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <Footprints className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          {!isLast && <div className={cn(
            "absolute top-10 left-5 w-0.5 h-full opacity-30",
            isLongWalk ? "bg-red-300 dark:bg-red-700" : "bg-amber-300 dark:bg-amber-700"
          )} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn(
            "font-semibold text-base",
            isLongWalk
              ? "text-red-700 dark:text-red-400"
              : "text-amber-700 dark:text-amber-400"
          )}>
            Περπάτημα {Number((leg.walkingMinutes || 0).toFixed(2))} λεπτά
          </div>
          <div className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
            {leg.fromLocation?.name && <span>{leg.fromLocation.name}</span>}
            <ChevronRight className="h-3 w-3" />
            {leg.toLocation?.name && <span>{leg.toLocation.name}</span>}
            {leg.walkingMeters && (
              <span className={cn("px-1.5 py-0.5 rounded-full text-xs font-medium", isLongWalk ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40")}>
                {formatDistance(leg.walkingMeters)}
              </span>
            )}
          </div>
          {leg.fromLocation && leg.toLocation && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 rounded-full text-[10px] px-3 border-amber-200 dark:border-amber-900/50"
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
              <Navigation className="h-3 w-3 mr-1.5" />
              Οδηγίες
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Bus leg
  const bgColor = leg.route?.route_color ? `#${leg.route.route_color}` : 'hsl(var(--primary))';
  const textColor = leg.route?.route_text_color ? `#${leg.route.route_text_color}` : 'white';

  return (
    <div className="flex items-start gap-4 py-4 relative">
      <div className="flex flex-col items-center">
        <div
          className="z-10 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-lg shadow-black/10 transition-transform hover:scale-110 cursor-default"
          // @ts-expect-error - Dynamic transit colors
          style={{ '--route-color': bgColor, '--text-color': textColor } as CustomCSS}
        >
          {leg.route?.route_short_name?.substring(0, 3) || <Bus className="h-5 w-5" />}
        </div>
        {!isLast && (
          <div
            className="absolute top-10 left-5 w-0.5 h-full opacity-30"
            // @ts-expect-error - Dynamic transit colors
            style={{ '--route-color': bgColor } as CustomCSS}
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span
            className="text-xs font-heavy px-2 py-0.5 rounded shadow-sm"
            // @ts-expect-error - Dynamic transit colors
            style={{ '--route-color': bgColor, '--text-color': textColor } as CustomCSS}
          >
            {leg.route?.route_short_name}
          </span>
          <span className="text-base font-bold truncate">
            {leg.route?.route_long_name}
          </span>
        </div>

        <div className="mt-3 p-3 rounded-xl bg-secondary/30 border border-border/40 space-y-3">
          {/* Board at */}
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full ring-4 ring-green-500/10 bg-green-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Επιβίβαση</div>
              <div className="text-sm font-bold truncate leading-tight">{leg.fromStop?.stop_name}</div>
            </div>
            {leg.departureTime && (
              <div className="text-right flex flex-col items-end">
                <div className="text-[10px] text-muted-foreground uppercase font-black">Ώρα</div>
                <div className="text-lg font-black text-primary font-mono tabular-nums leading-none">
                  {leg.departureTime.substring(0, 5)}
                </div>
              </div>
            )}
          </div>

          {/* Alight at */}
          <div className="flex items-center gap-3 pt-1 border-t border-border/20">
            <div className="w-2.5 h-2.5 rounded-full ring-4 ring-red-500/10 bg-red-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Αποβίβαση</div>
              <div className="text-sm font-bold truncate leading-tight">{leg.toStop?.stop_name}</div>
            </div>
            {leg.arrivalTime && (
              <div className="text-right flex flex-col items-end">
                <div className="text-[10px] text-muted-foreground uppercase font-black font-mono">Άφιξη</div>
                <div className="text-sm font-black text-muted-foreground font-mono tabular-nums leading-none">
                  {leg.arrivalTime.substring(0, 5)}
                </div>
              </div>
            )}
          </div>

          {/* Stop count if available */}
          {leg.stopCount && leg.stopCount > 0 && (
            <div className="text-[10px] text-muted-foreground/60 italic px-1">
              Διαδρομή μέσω {leg.stopCount} στάσεων
            </div>
          )}
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
  const totalWalkingMeters = journey.legs
    .filter(l => l.type === 'walk')
    .reduce((sum, l) => sum + (l.walkingMeters || 0), 0);
  const hasLongWalk = totalWalkingMeters > 2000;

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur-md shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 group">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-primary/[0.08] to-transparent p-4 border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-black ring-2 ring-primary/10">
              {index + 1}
            </div>
            <div className="flex items-center gap-1.5 overflow-hidden">
              {busLegs.map((leg, i) => (
                <div key={i} className="flex items-center gap-1.5 shrink-0">
                  <div
                    className="h-6 px-2 rounded-md flex items-center justify-center text-[11px] font-black text-white shadow-sm"
                    // @ts-expect-error - Dynamic transit colors
                    style={{ '--route-color': leg.route?.route_color ? `#${leg.route.route_color}` : 'hsl(var(--primary))' } as CustomCSS}
                  >
                    {leg.route?.route_short_name}
                  </div>
                  {i < busLegs.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onSave}>
                    <Bookmark className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Αποθήκευση</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onAddToCalendar}>
                    <CalendarPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Στο ημερολόγιο</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase font-black/60 tracking-widest mb-0.5">Πρόγραμμα</div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-foreground font-mono tabular-nums leading-none">
                {journey.departureTime.substring(0, 5)}
              </span>
              <span className="text-muted-foreground/30 font-light">→</span>
              <span className="text-lg font-black text-muted-foreground/60 font-mono tabular-nums leading-none">
                {journey.arrivalTime.substring(0, 5)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-xs font-black ring-1 ring-primary/20">
              <Clock className="h-3.5 w-3.5" />
              {journey.totalDurationMinutes} λεπτά
            </div>
            <div className="flex gap-2 text-[10px] font-bold text-muted-foreground/80 px-1">
              <span className="flex items-center gap-1">
                <ArrowUpDown className="h-2.5 w-2.5" />
                {journey.transferCount === 0 ? 'Απευθείας' : `${journey.transferCount} αλλαγές`}
              </span>
              <span className={cn("flex items-center gap-1", hasLongWalk && "text-amber-600 dark:text-amber-500")}>
                <Footprints className="h-2.5 w-2.5" />
                {formatDistance(totalWalkingMeters)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Legs */}
      <div className="px-5 py-2 divide-y divide-border/30 overflow-hidden">
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

export function SmartTripResults({
  origin,
  destination,
  departureTime = 'now',
  departureDate = new Date(),
  data,
  isLoading,
  error,
  onClose,
  isFavorite,
  onToggleFavorite,
  maxWalkingDistance = 1000,
  maxTransfers = 2,
  optimizationPreference = 'balanced',
  includeNightBuses = true,
  onParamsChange,
}: SmartTripResultsProps) {
  const [sortBy, setSortBy] = useState<string>('recommended');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const { saveTrip } = useSavedTrips();

  const isToday = departureDate ? departureDate.toDateString() === new Date().toDateString() : true;
  const effectiveDate = departureDate || new Date();

  // Filter and sort journeys
  const filteredJourneys = useMemo(() => {
    if (!data?.journeyOptions) return [];

    let journeys = [...data.journeyOptions];

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
        // Already sorted by server score
        break;
    }

    return journeys;
  }, [data?.journeyOptions, sortBy]);

  if (!origin || !destination) return null;

  const handleSaveTrip = (journey: JourneyOption) => {
    saveTrip(origin, destination, journey, effectiveDate, 15);
    toast.success("Η διαδρομή αποθηκεύτηκε!", {
      description: "Θα λάβεις ειδοποίηση 15 λεπτά πριν την αναχώρηση"
    });
  };

  const handleAddToCalendar = (journey: JourneyOption) => {
    const tempTrip: SavedTrip = {
      id: Math.random().toString(36).substring(7),
      origin,
      destination,
      journey,
      departureDate: effectiveDate.toISOString(),
      savedAt: new Date().toISOString(),
    };
    const url = generateCalendarUrl(tempTrip);
    window.open(url, '_blank');
    toast.success("Άνοιξε το Google Calendar");
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-xl transition-all duration-500 animate-in fade-in">
      <div className="bg-card/90 border border-border/80 shadow-[0_0_50px_-12px_rgba(0,0,0,0.3)] w-full max-w-2xl h-full max-h-[95vh] flex flex-col rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">

        {/* Header Section */}
        <div className="p-4 sm:p-6 pb-2 sm:pb-4 space-y-4 flex-shrink-0 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <Navigation className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex flex-col">
                <h2 className="text-xl font-black uppercase tracking-tight leading-none">Οδηγός Διαδρομής</h2>
                <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mt-0.5">Island-wide Router</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={onToggleFavorite}
                className={cn("h-9 gap-2 rounded-xl text-xs font-bold transition-all", isFavorite && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400")}
              >
                <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                <span className="hidden sm:inline">{isFavorite ? "Αγαπημένο" : "Αποθήκευση"}</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-destructive/10 hover:text-destructive h-9 w-9">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Location Summary - Compact */}
          <div className="flex flex-col gap-1.5 px-1">
            <div className="flex items-center gap-2 opacity-80">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm font-bold truncate">{origin.stop_name}</span>
            </div>
            <div className="flex items-center gap-2 opacity-80">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-sm font-bold truncate">{destination.stop_name}</span>
            </div>
          </div>

          {/* Core Journey Parameters - Interactive recompute */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {/* Date Selection */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-black text-muted-foreground/60 px-1">Ημερομηνία</label>
              <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full h-9 justify-start text-[11px] font-bold rounded-xl bg-secondary/20 border-border/40">
                    <CalendarIcon className="h-3 w-3 mr-1.5 text-primary" />
                    {isToday ? "Σήμερα" : format(effectiveDate, "dd/MM", { locale: el })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[3000]" align="start">
                  <Calendar
                    mode="single"
                    selected={effectiveDate}
                    onSelect={(date) => {
                      if (date) {
                        onParamsChange?.({ departureDate: date });
                        setDatePickerOpen(false);
                      }
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Time Selection */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-black text-muted-foreground/60 px-1">Ώρα</label>
              <Select
                value={departureTime}
                onValueChange={(v) => onParamsChange?.({ departureTime: v })}
              >
                <SelectTrigger className="h-9 w-full text-[11px] font-bold rounded-xl bg-secondary/20 border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 text-primary" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[3000]">
                  <SelectItem value="now" className="text-xs">Τώρα</SelectItem>
                  <SelectItem value="all_day" className="text-xs">Όλη μέρα</SelectItem>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return [
                      <SelectItem key={`${hour}:00`} value={`${hour}:00`} className="text-xs">{hour}:00</SelectItem>,
                      <SelectItem key={`${hour}:30`} value={`${hour}:30`} className="text-xs">{hour}:30</SelectItem>
                    ];
                  }).flat()}
                </SelectContent>
              </Select>
            </div>

            {/* Transfers */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-black text-muted-foreground/60 px-1">Αλλαγές</label>
              <Select
                value={maxTransfers.toString()}
                onValueChange={(v) => onParamsChange?.({ maxTransfers: parseInt(v) })}
              >
                <SelectTrigger className="h-9 w-full text-[11px] font-bold rounded-xl bg-secondary/20 border-border/40">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpDown className="h-3 w-3 text-primary" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[3000]">
                  {TRANSFERS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Walking */}
            <div className="space-y-1">
              <label className="text-[9px] uppercase font-black text-muted-foreground/60 px-1">Περπάτημα</label>
              <Select
                value={maxWalkingDistance.toString()}
                onValueChange={(v) => onParamsChange?.({ maxWalkingDistance: parseInt(v) })}
              >
                <SelectTrigger className="h-9 w-full text-[11px] font-bold rounded-xl bg-secondary/20 border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Footprints className="h-3 w-3 text-primary" />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent className="z-[3000]">
                  {WALKING_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value.toString()} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[9px] uppercase font-black text-muted-foreground/60">Ταξινόμηση:</label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-7 w-[140px] text-[10px] font-bold rounded-lg bg-secondary/10 border-none ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[3000]">
                  {SORT_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <div className="flex items-center gap-2">
                <label className="text-[9px] uppercase font-black text-muted-foreground/60">Optimization:</label>
                <Select
                  value={optimizationPreference}
                  onValueChange={(v) => onParamsChange?.({ optimizationPreference: v })}
                >
                  <SelectTrigger className="h-7 w-[100px] text-[10px] font-bold rounded-lg bg-secondary/10 border-none ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[3000]">
                    <SelectItem value="balanced" className="text-xs">Balanced</SelectItem>
                    <SelectItem value="fastest" className="text-xs">Fastest</SelectItem>
                    <SelectItem value="least_walking" className="text-xs">Least Walking</SelectItem>
                    <SelectItem value="fewest_transfers" className="text-xs">Fewest Transfers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 border-l border-border/50 pl-4">
                <label className="text-[9px] uppercase font-black text-muted-foreground/60 cursor-pointer" htmlFor="night-toggle">Night</label>
                <Switch
                  id="night-toggle"
                  checked={includeNightBuses}
                  onCheckedChange={(v) => onParamsChange?.({ includeNightBuses: v })}
                />
              </div>
            </div>
          </div>
        </div>


        {/* Dynamic Results Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-6 scroll-smooth custom-scrollbar">
          {
            isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-6" >
                <div className="relative">
                  <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center animate-pulse">
                    <div className="h-12 w-12 rounded-2xl bg-primary animate-bounce flex items-center justify-center">
                      <Navigation className="h-6 w-6 text-primary-foreground" />
                    </div>
                  </div>
                  <div className="absolute inset-x-0 -bottom-8 flex justify-center space-x-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-lg font-black tracking-tight text-foreground uppercase">Υπολογισμός Διαδρομής</p>
                  <p className="text-xs text-muted-foreground mt-1 font-bold">Ανάλυση RAPTOR με δεδομένα GTFS...</p>
                </div>
              </div>
            ) : error ? (
              <div className="bg-destructive/10 border border-destructive/20 rounded-3xl p-10 text-center space-y-4">
                <div className="h-16 w-16 bg-destructive/20 rounded-full flex items-center justify-center mx-auto">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-black uppercase text-destructive">Σφάλμα Αναζήτησης</h3>
                  <p className="text-sm font-medium text-muted-foreground/80">{error.message || "Αποτυχία σύνδεσης με τον εξυπηρετητή"}</p>
                </div>
                <Button variant="outline" onClick={onClose} className="rounded-xl border-destructive/30">Επιστροφή</Button>
              </div>
            ) : data?.noRouteFound ? (
              <div className="py-16 text-center space-y-6">
                <div className="h-24 w-24 bg-secondary/30 rounded-full flex items-center justify-center mx-auto opacity-50 relative">
                  <Bus className="h-12 w-12 text-muted-foreground" />
                  <X className="h-8 w-8 text-destructive absolute -right-2 top-0" />
                </div>
                <div className="space-y-1 px-10">
                  <p className="text-xl font-black uppercase">Δεν βρέθηκε διαδρομή</p>
                  <p className="text-xs text-muted-foreground font-bold">
                    {data.message || "Δοκιμάστε να αυξήσετε την απόσταση περπατήματος ή τις επιτρεπόμενες αλλαγές."}
                  </p>
                </div>
                <div className="pt-4 flex flex-col items-center gap-3">
                  <div className="flex flex-wrap justify-center gap-2 mb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-[10px] font-black uppercase h-8"
                      onClick={() => onParamsChange?.({ maxTransfers: 99 })}
                    >
                      Χωρίς όριο αλλαγών
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl text-[10px] font-black uppercase h-8"
                      onClick={() => onParamsChange?.({ maxWalkingDistance: 5000 })}
                    >
                      Περισσότερο περπάτημα
                    </Button>
                  </div>
                  <Button
                    variant="default"
                    className="rounded-2xl h-12 px-8 font-black gap-2 shadow-xl shadow-primary/20"
                    onClick={() => window.open(getTransitUrl(origin, destination), '_blank')}
                  >
                    <Map className="h-5 w-5" />
                    Δοκιμή στο Google Maps
                  </Button>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black opacity-30">Alternative Routing</p>
                </div>
              </div>
            ) : filteredJourneys.length === 0 ? (
              <div className="py-20 text-center">
                <Filter className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                <p className="font-black uppercase text-muted-foreground">Κανένα αποτέλεσμα</p>
                <p className="text-xs text-muted-foreground mt-1">Δεν υπάρχουν διαδρομές που να ικανοποιούν τα φίλτρα σας.</p>
                <Button variant="link" onClick={() => onParamsChange?.({ maxTransfers: 99, maxWalkingDistance: 5000 })} className="mt-4 font-black uppercase text-[10px] tracking-widest">
                  Καθαρισμός Φίλτρων
                </Button>
              </div>
            ) : (
              <div className="space-y-6 pb-6 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Info className="h-3.5 w-3.5 text-primary opacity-50" />
                    <span className="text-[11px] font-black uppercase text-muted-foreground/60 tracking-wider">
                      {filteredJourneys.length} Βέλτιστες Προτάσεις
                    </span>
                  </div>
                  {data?.searchedStops && (
                    <span className="text-[9px] font-mono text-muted-foreground/40">
                      Ranked in 42ms
                    </span>
                  )}
                </div>

                {filteredJourneys.map((journey, idx) => (
                  <JourneyOptionCard
                    key={idx}
                    journey={journey}
                    index={idx}
                    onSave={() => handleSaveTrip(journey)}
                    onAddToCalendar={() => handleAddToCalendar(journey)}
                  />
                ))}
              </div>
            )
          }
        </div>

        {/* Glossy Footer Actions */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-background to-background/50 border-t border-border/80 flex shrink-0 flex-col sm:flex-row gap-3">
          <Button
            variant="default"
            className="flex-1 h-12 rounded-2xl gap-2 font-black uppercase tracking-tight text-sm shadow-xl shadow-primary/25 active:scale-95 transition-transform"
            onClick={() => window.open(getTransitUrl(origin, destination), '_blank')}
          >
            <Map className="h-5 w-5" />
            Πλοήγηση Google Maps
          </Button>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="px-6 h-12 rounded-2xl border-border/60 hover:bg-secondary/40 font-black uppercase text-[10px] tracking-widest active:scale-95 transition-transform"
              onClick={async () => {
                const url = getTransitUrl(origin, destination);
                const shareText = `Διαδρομή MotionBus: ${origin.stop_name} → ${destination.stop_name}`;

                if (navigator.share) {
                  try {
                    await navigator.share({ title: 'MotionBus Router', text: shareText, url });
                    return;
                  } catch (err) { }
                }

                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Αντιγράφηκε!", { description: "Το link είναι έτοιμο για κοινοποίηση" });
                } catch (err) {
                  toast.error("Σφάλμα αντιγραφής");
                }
              }}
            >
              <Share2 className="h-5 w-5 mr-2" />
              Share
            </Button>
            <Button variant="ghost" onClick={onClose} className="h-12 w-12 rounded-2xl border border-border/40 hover:bg-destructive/10 hover:text-destructive">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
