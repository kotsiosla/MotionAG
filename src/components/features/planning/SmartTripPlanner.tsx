import { useState, useMemo, useEffect } from "react";
import {
  MapPin, ArrowDownUp, Search, Navigation, Loader2, Clock,
  Star, ChevronDown, Trash2, CalendarIcon, Building2,
  Footprints, Route as RouteIcon, MapPinned,
  Mic, MicOff, X, Settings2, Accessibility, ArrowRightLeft,
  ChevronRight, Lightbulb
} from "lucide-react";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  useGeocode,
  findNearestStops,
  formatDistance,
  type GeocodedLocation
} from "@/hooks/useGeocode";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { CYPRUS_POI, getCategoryIcon, type PointOfInterest } from "@/data/cyprusPOI";
import type { StaticStop } from "@/types/gtfs";
import type { FavoriteRoute } from "@/hooks/useFavoriteRoutes";
import type { OptimizationPreference } from "@/hooks/useSmartTripPlan";

interface SmartTripPlannerProps {
  stops: StaticStop[];
  isLoading?: boolean;
  onSearch?: (
    origin: StaticStop | null,
    destination: StaticStop | null,
    departureTime: string,
    departureDate: Date,
    originLocation?: { name: string; lat: number; lon: number },
    destinationLocation?: { name: string; lat: number; lon: number },
    options?: {
      maxWalkingDistance: number;
      maxTransfers: number;
      preference: OptimizationPreference;
      includeNightBuses: boolean;
    },
    walkingInfo?: {
      originWalkingMeters: number;
      originWalkingMinutes: number;
      destWalkingMeters: number;
      destWalkingMinutes: number;
    }
  ) => void;
  favorites?: FavoriteRoute[];
  onRemoveFavorite?: (id: string) => void;
}

// Selected location type - can be a stop, POI, or geocoded address
type SelectedLocation =
  | { type: 'stop'; stop: StaticStop; displayName: string }
  | { type: 'poi'; poi: PointOfInterest; nearestStop: StaticStop; displayName: string }
  | { type: 'address'; location: GeocodedLocation; nearestStop: StaticStop; displayName: string };

// Time mode options
type TimeMode = 'now' | 'all_day' | 'specific';



// Location search input component with geocoding and voice search
function LocationSearchInput({
  value,
  onChange,
  placeholder,
  stops,
  icon,
  iconColor,
  onLocationSelect,
  enableVoice = true,
}: {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation | null) => void;
  placeholder: string;
  stops: StaticStop[];
  icon: React.ReactNode;
  iconColor: string;
  onLocationSelect?: (location: SelectedLocation) => void;
  enableVoice?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { searchAddress, results: geocodeResults, isSearching, clearResults } = useGeocode();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Voice search
  const {
    isListening,
    transcript,
    interimTranscript,
    error: voiceError,
    isSupported: voiceSupported,
    startListening,
    stopListening,
    resetTranscript,
  } = useVoiceSearch('el-GR');

  // Update search query when voice transcript changes
  useEffect(() => {
    if (transcript) {
      setSearchQuery(transcript);
    }
  }, [transcript]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      searchAddress(debouncedQuery);
    } else {
      clearResults();
    }
  }, [debouncedQuery, searchAddress, clearResults]);

  // Filter POIs
  const filteredPOIs = useMemo(() => {
    if (!searchQuery) return CYPRUS_POI.slice(0, 8);
    const query = searchQuery.toLowerCase();
    return CYPRUS_POI.filter(poi =>
      poi.name.toLowerCase().includes(query) ||
      poi.name_en.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [searchQuery]);

  // Filter stops
  const filteredStops = useMemo(() => {
    if (!searchQuery) return stops.slice(0, 10);
    const query = searchQuery.toLowerCase();
    return stops.filter(s =>
      s.stop_name.toLowerCase().includes(query) ||
      s.stop_code?.toLowerCase().includes(query)
    ).slice(0, 15);
  }, [stops, searchQuery]);

  const handleSelectStop = (stop: StaticStop) => {
    const location: SelectedLocation = {
      type: 'stop',
      stop,
      displayName: stop.stop_name,
    };
    onChange(location);
    onLocationSelect?.(location);
    setIsOpen(false);
    setSearchQuery('');
    clearResults();
  };

  const handleSelectPOI = (poi: PointOfInterest) => {
    const nearestStops = findNearestStops(poi.lat, poi.lon, stops, 1);
    if (nearestStops.length > 0) {
      const nearestStop = stops.find(s => s.stop_id === nearestStops[0].stopId);
      if (nearestStop) {
        const location: SelectedLocation = {
          type: 'poi',
          poi,
          nearestStop,
          displayName: `${getCategoryIcon(poi.category)} ${poi.name}`,
        };
        onChange(location);
        onLocationSelect?.(location);
      }
    }
    setIsOpen(false);
    setSearchQuery('');
    clearResults();
  };

  const handleSelectAddress = (geocoded: GeocodedLocation) => {
    const nearestStops = findNearestStops(geocoded.lat, geocoded.lon, stops, 1);
    if (nearestStops.length > 0) {
      const nearestStop = stops.find(s => s.stop_id === nearestStops[0].stopId);
      if (nearestStop) {
        const location: SelectedLocation = {
          type: 'address',
          location: geocoded,
          nearestStop,
          displayName: geocoded.shortName,
        };
        onChange(location);
        onLocationSelect?.(location);
      }
    }
    setIsOpen(false);
    setSearchQuery('');
    clearResults();
  };

  const getDisplayValue = () => {
    if (!value) return '';
    return value.displayName;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-start h-10 sm:h-9 text-left font-normal bg-background"
        >
          <span className={cn("mr-2 flex-shrink-0", iconColor)}>
            {icon}
          </span>
          <span className="truncate text-sm">
            {value ? getDisplayValue() : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0 z-[100]" align="start">
        <div className="flex flex-col">
          {/* Search Input with Voice */}
          <div className="p-2 border-b border-border">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={isListening ? "Μιλήστε τώρα..." : "Αναζήτηση οδού, σημείου ή στάσης..."}
                  value={isListening ? (interimTranscript || transcript || searchQuery) : searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn("pl-9 pr-8 h-9", isListening && "bg-primary/5 border-primary")}
                  autoFocus={!isListening}
                  readOnly={isListening}
                />
                {isSearching && !isListening && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {searchQuery && !isListening && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      resetTranscript();
                      clearResults();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground"
                    title="Καθαρισμός αναζήτησης"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Voice Search Button */}
              {enableVoice && voiceSupported && (
                <Button
                  variant={isListening ? "default" : "outline"}
                  size="icon"
                  className={cn(
                    "h-9 w-9 flex-shrink-0 transition-all",
                    isListening && "bg-primary animate-pulse"
                  )}
                  onClick={() => {
                    if (isListening) {
                      stopListening();
                    } else {
                      resetTranscript();
                      setSearchQuery('');
                      startListening();
                    }
                  }}
                  title={isListening ? "Διακοπή ηχογράφησης" : "Φωνητική αναζήτηση"}
                >
                  {isListening ? (
                    <MicOff className="h-4 w-4" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>

            {/* Voice feedback */}
            {isListening && (
              <div className="mt-2 flex items-center gap-2 text-xs text-primary animate-pulse">
                <div className="flex gap-0.5">
                  <span className="w-1 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span>Ακούω...</span>
              </div>
            )}

            {voiceError && (
              <div className="mt-2 text-xs text-destructive">
                {voiceError}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="max-h-[300px] overflow-auto">
            {/* Geocoded Addresses */}
            {geocodeResults.length > 0 && (
              <div className="p-1">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <MapPinned className="h-3 w-3" />
                  Διευθύνσεις & Οδοί
                </div>
                {geocodeResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectAddress(result)}
                    className="w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors flex items-start gap-2"
                  >
                    <MapPin className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{result.shortName}</div>
                      {result.address?.city && (
                        <div className="text-xs text-muted-foreground truncate">
                          {result.address.suburb ? `${result.address.suburb}, ` : ''}{result.address.city}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* POIs */}
            {filteredPOIs.length > 0 && (
              <div className="p-1 border-t border-border first:border-t-0">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Σημεία Ενδιαφέροντος
                </div>
                {filteredPOIs.map((poi) => {
                  const nearest = findNearestStops(poi.lat, poi.lon, stops, 1)[0];
                  return (
                    <button
                      key={poi.id}
                      onClick={() => handleSelectPOI(poi)}
                      className="w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors flex items-start gap-2"
                    >
                      <span className="text-lg">{getCategoryIcon(poi.category)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{poi.name}</div>
                        {nearest && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Footprints className="h-3 w-3" />
                            {formatDistance(nearest.distanceMeters)} περπάτημα στη στάση
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Stops */}
            {filteredStops.length > 0 && (
              <div className="p-1 border-t border-border first:border-t-0">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <RouteIcon className="h-3 w-3" />
                  Στάσεις Λεωφορείων
                </div>
                {filteredStops.map((stop) => (
                  <button
                    key={stop.stop_id}
                    onClick={() => handleSelectStop(stop)}
                    className="w-full text-left px-2 py-2 rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span className="text-sm truncate flex-1">{stop.stop_name}</span>
                    {stop.stop_code && (
                      <span className="text-xs text-muted-foreground">{stop.stop_code}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* No results */}
            {searchQuery.length >= 2 &&
              !isSearching &&
              geocodeResults.length === 0 &&
              filteredPOIs.length === 0 &&
              filteredStops.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Δεν βρέθηκαν αποτελέσματα
                </div>
              )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function SmartTripPlanner({
  stops,
  isLoading,
  onSearch,
  favorites = [],
  onRemoveFavorite
}: SmartTripPlannerProps) {
  const [origin, setOrigin] = useState<SelectedLocation | null>(null);
  const [destination, setDestination] = useState<SelectedLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [timeMode, setTimeMode] = useState<TimeMode>("now");
  const [specificTime, setSpecificTime] = useState<string>("09:00");
  const [departureDate, setDepartureDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // Advanced options
  const [maxTransfers, setMaxTransfers] = useState<number>(2);
  const [maxWalkingDistance, setMaxWalkingDistance] = useState<number>(1000);
  const [optimizationPreference, setOptimizationPreference] = useState<OptimizationPreference>('balanced');
  const [includeNightBuses, setIncludeNightBuses] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Compute the actual departure time to pass to search
  const departureTime = useMemo(() => {
    if (timeMode === 'now') return 'now';
    if (timeMode === 'all_day') return 'all_day';
    return specificTime;
  }, [timeMode, specificTime]);

  const isToday = useMemo(() => {
    const today = new Date();
    return departureDate.toDateString() === today.toDateString();
  }, [departureDate]);

  // Get the actual stop for origin
  const originStop = useMemo(() => {
    if (!origin) return null;
    if (origin.type === 'stop') return origin.stop;
    return origin.nearestStop;
  }, [origin]);

  // Get the actual stop for destination
  const destinationStop = useMemo(() => {
    if (!destination) return null;
    if (destination.type === 'stop') return destination.stop;
    return destination.nearestStop;
  }, [destination]);

  // Calculate walking info
  const walkingInfo = useMemo(() => {
    let originWalkingMeters = 0;
    let originWalkingMinutes = 0;
    let destWalkingMeters = 0;
    let destWalkingMinutes = 0;

    if (origin && origin.type !== 'stop' && originStop) {
      const lat = origin.type === 'poi' ? origin.poi.lat : origin.location.lat;
      const lon = origin.type === 'poi' ? origin.poi.lon : origin.location.lon;
      const nearest = findNearestStops(lat, lon, stops, 1)[0];
      if (nearest) {
        originWalkingMeters = nearest.distanceMeters;
        originWalkingMinutes = nearest.walkingMinutes;
      }
    }

    if (destination && destination.type !== 'stop' && destinationStop) {
      const lat = destination.type === 'poi' ? destination.poi.lat : destination.location.lat;
      const lon = destination.type === 'poi' ? destination.poi.lon : destination.location.lon;
      const nearest = findNearestStops(lat, lon, stops, 1)[0];
      if (nearest) {
        destWalkingMeters = nearest.distanceMeters;
        destWalkingMinutes = nearest.walkingMinutes;
      }
    }

    return { originWalkingMeters, originWalkingMinutes, destWalkingMeters, destWalkingMinutes };
  }, [origin, destination, originStop, destinationStop, stops]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const nearestStops = findNearestStops(latitude, longitude, stops, 1);

        if (nearestStops.length > 0) {
          const nearestStop = stops.find(s => s.stop_id === nearestStops[0].stopId);
          if (nearestStop) {
            setOrigin({
              type: 'address',
              location: {
                id: 'current-location',
                displayName: 'Η τοποθεσία μου',
                shortName: 'Η τοποθεσία μου',
                lat: latitude,
                lon: longitude,
                type: 'place',
              },
              nearestStop,
              displayName: '📍 Η τοποθεσία μου',
            });
          }
        }
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      }
    );
  };

  const handleSwap = () => {
    const temp = origin;
    setOrigin(destination);
    setDestination(temp);
  };

  const handleSearch = () => {
    if (!originStop || !destinationStop) return;

    const originLocation = origin && origin.type !== 'stop' ? {
      name: origin.displayName,
      lat: origin.type === 'poi' ? origin.poi.lat : origin.location.lat,
      lon: origin.type === 'poi' ? origin.poi.lon : origin.location.lon,
    } : undefined;

    const destLocation = destination && destination.type !== 'stop' ? {
      name: destination.displayName,
      lat: destination.type === 'poi' ? destination.poi.lat : destination.location.lat,
      lon: destination.type === 'poi' ? destination.poi.lon : destination.location.lon,
    } : undefined;

    onSearch?.(
      originStop,
      destinationStop,
      departureTime,
      departureDate,
      originLocation,
      destLocation,
      {
        maxWalkingDistance,
        maxTransfers,
        preference: optimizationPreference,
        includeNightBuses
      },
      walkingInfo
    );
  };

  const handleSelectFavorite = (fav: FavoriteRoute) => {
    setOrigin({
      type: 'stop',
      stop: fav.origin,
      displayName: fav.origin.stop_name,
    });
    setDestination({
      type: 'stop',
      stop: fav.destination,
      displayName: fav.destination.stop_name,
    });
  };

  const totalWalkingTime = walkingInfo.originWalkingMinutes + walkingInfo.destWalkingMinutes;

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-2 sm:p-3">
      <div className="flex flex-col gap-2">
        {/* Row 1: Origin and Destination */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
          {/* Origin */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground">Αφετηρία</span>
              <button
                onClick={handleUseMyLocation}
                disabled={isLocating}
                className="text-xs text-primary hover:underline flex items-center gap-1 ml-auto sm:ml-2"
              >
                <Navigation className="h-3 w-3" />
                <span className="hidden xs:inline">{isLocating ? "..." : ""}</span>
              </button>
            </div>
            <LocationSearchInput
              value={origin}
              onChange={setOrigin}
              placeholder="Επιλέξτε αφετηρία..."
              stops={stops}
              icon={<MapPin className="h-4 w-4" />}
              iconColor="text-primary"
            />
            {origin && origin.type !== 'stop' && walkingInfo.originWalkingMinutes > 0 && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Footprints className="h-3 w-3" />
                {walkingInfo.originWalkingMinutes} λεπτά ({formatDistance(walkingInfo.originWalkingMeters)}) μέχρι τη στάση {originStop?.stop_name}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 flex-shrink-0 self-end"
            onClick={handleSwap}
          >
            <ArrowDownUp className="h-4 w-4" />
          </Button>

          {/* Destination */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground">Προορισμός</span>
            </div>
            <LocationSearchInput
              value={destination}
              onChange={setDestination}
              placeholder="Επιλέξτε προορισμό..."
              stops={stops}
              icon={<MapPin className="h-4 w-4" />}
              iconColor="text-destructive"
            />
            {destination && destination.type !== 'stop' && walkingInfo.destWalkingMinutes > 0 && (
              <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                <Footprints className="h-3 w-3" />
                {walkingInfo.destWalkingMinutes} λεπτά ({formatDistance(walkingInfo.destWalkingMeters)}) από τη στάση {destinationStop?.stop_name}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Date, Time, Favorites, Search */}
        <div className="flex flex-wrap items-end gap-2">
          {/* Date Picker */}
          <div className="w-[calc(50%-4px)] sm:w-[120px] flex-shrink-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground">Ημερομηνία</span>
            </div>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-10 sm:h-9 justify-start text-left font-normal bg-background"
                >
                  <CalendarIcon className="h-3 w-3 mr-1 text-muted-foreground" />
                  <span className="text-sm">
                    {isToday ? "Σήμερα" : format(departureDate, "dd/MM", { locale: el })}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 z-[100]" align="start">
                <Calendar
                  mode="single"
                  selected={departureDate}
                  onSelect={(date) => {
                    if (date) {
                      setDepartureDate(date);
                      setDatePickerOpen(false);
                    }
                  }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker - Improved */}
          <div className="w-[calc(50%-4px)] sm:w-auto flex-shrink-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground">Ώρα</span>
            </div>
            <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 sm:h-9 justify-start text-left font-normal bg-background min-w-[120px]"
                >
                  <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                  <span className="text-sm">
                    {timeMode === 'now' && 'Τώρα'}
                    {timeMode === 'all_day' && 'Όλη η μέρα'}
                    {timeMode === 'specific' && specificTime}
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2 z-[100]" align="start">
                <div className="space-y-2">
                  {/* Preset buttons */}
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        setTimeMode('now');
                        setTimePickerOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                        timeMode === 'now'
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                      title="Αναχώρηση τώρα"
                    >
                      <Clock className="h-4 w-4" />
                      <span>Τώρα</span>
                      <span className="text-xs opacity-70 ml-auto">Από αυτή τη στιγμή</span>
                    </button>

                    <button
                      onClick={() => {
                        setTimeMode('all_day');
                        setTimePickerOpen(false);
                      }}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                        timeMode === 'all_day'
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-accent"
                      )}
                      title="Όλη η μέρα"
                    >
                      <CalendarIcon className="h-4 w-4" />
                      <span>Όλη η μέρα</span>
                      <span className="text-xs opacity-70 ml-auto">Όλα τα δρομολόγια</span>
                    </button>
                  </div>

                  <div className="border-t border-border pt-2">
                    <div className="text-xs text-muted-foreground mb-1.5 px-1">Συγκεκριμένη ώρα:</div>
                    <div className="grid grid-cols-4 gap-1 max-h-[200px] overflow-y-auto">
                      {Array.from({ length: 24 }, (_, hour) =>
                        ['00', '30'].map(minutes => {
                          const timeValue = `${hour.toString().padStart(2, '0')}:${minutes}`;
                          const isSelected = timeMode === 'specific' && specificTime === timeValue;
                          return (
                            <button
                              key={timeValue}
                              onClick={() => {
                                setSpecificTime(timeValue);
                                setTimeMode('specific');
                                setTimePickerOpen(false);
                              }}
                              className={cn(
                                "px-2 py-1.5 rounded text-xs font-medium transition-colors",
                                isSelected
                                  ? "bg-primary text-primary-foreground"
                                  : "hover:bg-accent"
                              )}
                            >
                              {timeValue}
                            </button>
                          );
                        })
                      ).flat()}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Favorites Dropdown */}
          {favorites.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 sm:h-9 gap-1 px-2 sm:px-3 flex-shrink-0">
                  <Star className="h-3 w-3 text-yellow-500" />
                  <span className="hidden sm:inline text-xs">Αγαπημένα</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 z-[100]">
                {favorites.map((fav) => (
                  <div key={fav.id} className="flex items-center">
                    <DropdownMenuItem
                      className="flex-1 cursor-pointer"
                      onClick={() => handleSelectFavorite(fav)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" />
                        <span className="truncate text-xs">
                          {fav.origin.stop_name} → {fav.destination.stop_name}
                        </span>
                      </div>
                    </DropdownMenuItem>
                    {onRemoveFavorite && (
                      <>
                        <DropdownMenuSeparator className="h-6 w-px mx-1" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveFavorite(fav.id);
                          }}
                          title="Αφαίρεση από αγαπημένα"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            disabled={!originStop || !destinationStop || isLoading}
            className="flex-1 sm:flex-initial h-10 sm:h-9 gap-2"
            title="Αναζήτηση διαδρομής"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span>Αναζήτηση</span>
          </Button>
        </div>

        {/* Improved Row 3: Advanced Settings Callout */}
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced} className="w-full">
          <div className="flex items-center justify-between px-1">
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Settings2 className={cn("h-3 w-3 transition-transform duration-200", showAdvanced && "rotate-90")} />
              <span>Περισσότερες Επιλογές</span>
              <ChevronRight className={cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90")} />
            </button>

            {!showAdvanced && (
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 hidden sm:flex">
                <span className="flex items-center gap-1">
                  <ArrowRightLeft className="h-2.5 w-2.5" />
                  {maxTransfers === 0 ? 'Χωρίς αλλαγή' : `Έως ${maxTransfers} αλλαγές`}
                </span>
                <span className="flex items-center gap-1">
                  <Footprints className="h-2.5 w-2.5" />
                  {maxWalkingDistance >= 2000 ? 'Απεριόριστο' : `${maxWalkingDistance}m`}
                </span>
                <span className="flex items-center gap-1">
                  <Lightbulb className="h-2.5 w-2.5" />
                  {optimizationPreference === 'fastest' ? 'Ταχύτερο' :
                    optimizationPreference === 'least_walking' ? 'Λιγότερο περπάτημα' :
                      optimizationPreference === 'fewest_transfers' ? 'Λιγότερες αλλαγές' : 'Ισορροπημένο'}
                </span>
              </div>
            )}
          </div>

          <CollapsibleContent className="pt-3 pb-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 rounded-lg border border-border/50 bg-secondary/20">
              {/* Max Transfers */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-xs font-medium">Μέγιστες μετεπιβιβάσεις</Label>
                </div>
                <Select value={maxTransfers.toString()} onValueChange={(v) => setMaxTransfers(parseInt(v))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" className="text-xs">Καμία (Απευθείας)</SelectItem>
                    <SelectItem value="1" className="text-xs">Έως 1 αλλαγή</SelectItem>
                    <SelectItem value="2" className="text-xs">Έως 2 αλλαγές</SelectItem>
                    <SelectItem value="3" className="text-xs">Έως 3 αλλαγές</SelectItem>
                    <SelectItem value="5" className="text-xs">Απεριόριστες</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Max Walking */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Footprints className="h-3.5 w-3.5 text-primary" />
                    <Label className="text-xs font-medium">Μέγιστο περπάτημα</Label>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{maxWalkingDistance}m</span>
                </div>
                <div className="pt-1">
                  <Slider
                    value={[maxWalkingDistance]}
                    onValueChange={([val]) => setMaxWalkingDistance(val)}
                    max={2000}
                    min={200}
                    step={100}
                    className="py-2"
                  />
                </div>
              </div>

              {/* Optimization */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Accessibility className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-xs font-medium">Προτίμηση διαδρομής</Label>
                </div>
                <Select value={optimizationPreference} onValueChange={(v: any) => setOptimizationPreference(v)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fastest" className="text-xs">Πιο γρήγορη</SelectItem>
                    <SelectItem value="least_walking" className="text-xs">Λιγότερο περπάτημα</SelectItem>
                    <SelectItem value="fewest_transfers" className="text-xs">Λιγότερες αλλαγές</SelectItem>
                    <SelectItem value="balanced" className="text-xs">Ισορροπημένη</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Night Buses toggle moved here for better layout */}
              <div className="sm:col-span-3 flex items-center justify-between pt-2 border-t border-border/30 mt-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium">Περίληψη νυχτερινών γραμμών</span>
                    <span className="text-[10px] text-muted-foreground">Εμφάνιση δρομολογίων που λειτουργούν τη νύχτα</span>
                  </div>
                </div>
                <Switch
                  checked={includeNightBuses}
                  onCheckedChange={setIncludeNightBuses}
                  className="scale-75"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Walking info summary */}
        {totalWalkingTime > 0 && origin && destination && (
          <div className="bg-secondary/50 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
            <Footprints className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">
              Συνολικό περπάτημα: <strong className="text-foreground">{totalWalkingTime} λεπτά</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
