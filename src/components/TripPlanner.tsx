import { useState, useMemo } from "react";
import { MapPin, ArrowDownUp, Search, Navigation, Loader2, Clock, Star, ChevronDown, Trash2, CalendarIcon, Building2 } from "lucide-react";
import { format } from "date-fns";
import { el } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { StaticStop } from "@/types/gtfs";
import type { FavoriteRoute } from "@/hooks/useFavoriteRoutes";
import { CYPRUS_POI, getCategoryIcon, type PointOfInterest } from "@/data/cyprusPOI";

interface TripPlannerProps {
  stops: StaticStop[];
  isLoading?: boolean;
  onSearch?: (origin: StaticStop | null, destination: StaticStop | null, departureTime: string, departureDate: Date) => void;
  favorites?: FavoriteRoute[];
  onRemoveFavorite?: (id: string) => void;
}

// Generate time options (every 15 minutes)
const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = [];
  options.push({ value: 'now', label: 'Τώρα' });
  
  for (let h = 5; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      options.push({ value: time, label: time });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

// Find nearest stop to a POI
const findNearestStop = (poi: PointOfInterest, stops: StaticStop[]): StaticStop | null => {
  let nearestStop: StaticStop | null = null;
  let minDistance = Infinity;
  
  stops.forEach(stop => {
    if (stop.stop_lat && stop.stop_lon) {
      const distance = Math.sqrt(
        Math.pow(stop.stop_lat - poi.lat, 2) + 
        Math.pow(stop.stop_lon - poi.lon, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestStop = stop;
      }
    }
  });
  
  return nearestStop;
};

// Combined search item type
type SearchItem = 
  | { type: 'stop'; data: StaticStop }
  | { type: 'poi'; data: PointOfInterest };

export function TripPlanner({ stops, isLoading, onSearch, favorites = [], onRemoveFavorite }: TripPlannerProps) {
  const [origin, setOrigin] = useState<StaticStop | null>(null);
  const [destination, setDestination] = useState<StaticStop | null>(null);
  const [originOpen, setOriginOpen] = useState(false);
  const [destinationOpen, setDestinationOpen] = useState(false);
  const [originSearch, setOriginSearch] = useState("");
  const [destinationSearch, setDestinationSearch] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [departureTime, setDepartureTime] = useState<string>("now");
  const [departureDate, setDepartureDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  // Track if selection came from POI (to display POI name)
  const [originPOI, setOriginPOI] = useState<PointOfInterest | null>(null);
  const [destinationPOI, setDestinationPOI] = useState<PointOfInterest | null>(null);

  const isToday = useMemo(() => {
    const today = new Date();
    return departureDate.toDateString() === today.toDateString();
  }, [departureDate]);

  const handleSelectFavorite = (fav: FavoriteRoute) => {
    setOrigin(fav.origin);
    setDestination(fav.destination);
    setOriginPOI(null);
    setDestinationPOI(null);
  };

  // Filter POIs based on search
  const filterPOIs = (search: string): PointOfInterest[] => {
    if (!search) return CYPRUS_POI.slice(0, 10);
    const searchLower = search.toLowerCase();
    return CYPRUS_POI.filter(poi => 
      poi.name.toLowerCase().includes(searchLower) ||
      poi.name_en.toLowerCase().includes(searchLower)
    ).slice(0, 15);
  };

  // Filter stops based on search
  const filterStops = (search: string): StaticStop[] => {
    if (!search) return stops.slice(0, 30);
    const searchLower = search.toLowerCase();
    return stops.filter(s => 
      s.stop_name.toLowerCase().includes(searchLower) ||
      s.stop_code?.toLowerCase().includes(searchLower)
    ).slice(0, 30);
  };

  // Combined filtered results for origin
  const filteredOriginItems = useMemo((): SearchItem[] => {
    const pois = filterPOIs(originSearch).map(poi => ({ type: 'poi' as const, data: poi }));
    const stopsFiltered = filterStops(originSearch).map(stop => ({ type: 'stop' as const, data: stop }));
    return [...pois, ...stopsFiltered];
  }, [stops, originSearch]);

  // Combined filtered results for destination
  const filteredDestinationItems = useMemo((): SearchItem[] => {
    const pois = filterPOIs(destinationSearch).map(poi => ({ type: 'poi' as const, data: poi }));
    const stopsFiltered = filterStops(destinationSearch).map(stop => ({ type: 'stop' as const, data: stop }));
    return [...pois, ...stopsFiltered];
  }, [stops, destinationSearch]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        // Find nearest stop
        let nearestStop: StaticStop | null = null;
        let minDistance = Infinity;
        
        stops.forEach(stop => {
          if (stop.stop_lat && stop.stop_lon) {
            const distance = Math.sqrt(
              Math.pow(stop.stop_lat - latitude, 2) + 
              Math.pow(stop.stop_lon - longitude, 2)
            );
            if (distance < minDistance) {
              minDistance = distance;
              nearestStop = stop;
            }
          }
        });
        
        if (nearestStop) {
          setOrigin(nearestStop);
          setOriginPOI(null);
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
    const tempPOI = originPOI;
    setOrigin(destination);
    setOriginPOI(destinationPOI);
    setDestination(temp);
    setDestinationPOI(tempPOI);
  };

  const handleSearch = () => {
    onSearch?.(origin, destination, departureTime, departureDate);
  };

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
                <span className="hidden xs:inline">{isLocating ? "Εντοπισμός..." : "Τοποθεσία μου"}</span>
              </button>
            </div>
            <Popover open={originOpen} onOpenChange={setOriginOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={originOpen}
                  className="w-full justify-start h-10 sm:h-9 text-left font-normal bg-background"
                >
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
                  <span className="truncate text-sm">
                    {originPOI ? `${getCategoryIcon(originPOI.category)} ${originPOI.name}` : origin ? origin.stop_name : "Επιλέξτε αφετηρία..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 z-[100]" align="start">
              <Command>
                <CommandInput 
                  placeholder="Αναζήτηση στάσης ή σημείου..." 
                  value={originSearch}
                  onValueChange={setOriginSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      "Δεν βρέθηκε"
                    )}
                  </CommandEmpty>
                  {filteredOriginItems.filter(item => item.type === 'poi').length > 0 && (
                    <CommandGroup heading="📍 Σημεία Ενδιαφέροντος">
                      {filteredOriginItems
                        .filter(item => item.type === 'poi')
                        .map((item) => {
                          const poi = item.data as PointOfInterest;
                          return (
                            <CommandItem
                              key={poi.id}
                              value={poi.id}
                              onSelect={() => {
                                const nearestStop = findNearestStop(poi, stops);
                                if (nearestStop) {
                                  setOrigin(nearestStop);
                                  setOriginPOI(poi);
                                  setOriginOpen(false);
                                  setOriginSearch("");
                                }
                              }}
                            >
                              <span className="mr-2">{getCategoryIcon(poi.category)}</span>
                              <span className="truncate">{poi.name}</span>
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  )}
                  <CommandGroup heading="🚏 Στάσεις">
                    {filteredOriginItems
                      .filter(item => item.type === 'stop')
                      .map((item) => {
                        const stop = item.data as StaticStop;
                        return (
                          <CommandItem
                            key={stop.stop_id}
                            value={stop.stop_id}
                            onSelect={() => {
                              setOrigin(stop);
                              setOriginPOI(null);
                              setOriginOpen(false);
                              setOriginSearch("");
                            }}
                          >
                            <MapPin className="h-3 w-3 mr-2 text-muted-foreground" />
                            <span className="truncate">{stop.stop_name}</span>
                            {stop.stop_code && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                {stop.stop_code}
                              </span>
                            )}
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
          <Popover open={destinationOpen} onOpenChange={setDestinationOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={destinationOpen}
                className="w-full justify-start h-9 text-left font-normal bg-background"
              >
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-destructive" />
                <span className="truncate">
                  {destinationPOI ? `${getCategoryIcon(destinationPOI.category)} ${destinationPOI.name}` : destination ? destination.stop_name : "Επιλέξτε προορισμό..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 z-[100]" align="start">
              <Command>
                <CommandInput 
                  placeholder="Αναζήτηση στάσης ή σημείου..." 
                  value={destinationSearch}
                  onValueChange={setDestinationSearch}
                />
                <CommandList>
                  <CommandEmpty>
                    {isLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : (
                      "Δεν βρέθηκε"
                    )}
                  </CommandEmpty>
                  {filteredDestinationItems.filter(item => item.type === 'poi').length > 0 && (
                    <CommandGroup heading="📍 Σημεία Ενδιαφέροντος">
                      {filteredDestinationItems
                        .filter(item => item.type === 'poi')
                        .map((item) => {
                          const poi = item.data as PointOfInterest;
                          return (
                            <CommandItem
                              key={poi.id}
                              value={poi.id}
                              onSelect={() => {
                                const nearestStop = findNearestStop(poi, stops);
                                if (nearestStop) {
                                  setDestination(nearestStop);
                                  setDestinationPOI(poi);
                                  setDestinationOpen(false);
                                  setDestinationSearch("");
                                }
                              }}
                            >
                              <span className="mr-2">{getCategoryIcon(poi.category)}</span>
                              <span className="truncate">{poi.name}</span>
                            </CommandItem>
                          );
                        })}
                    </CommandGroup>
                  )}
                  <CommandGroup heading="🚏 Στάσεις">
                    {filteredDestinationItems
                      .filter(item => item.type === 'stop')
                      .map((item) => {
                        const stop = item.data as StaticStop;
                        return (
                          <CommandItem
                            key={stop.stop_id}
                            value={stop.stop_id}
                            onSelect={() => {
                              setDestination(stop);
                              setDestinationPOI(null);
                              setDestinationOpen(false);
                              setDestinationSearch("");
                            }}
                          >
                            <MapPin className="h-3 w-3 mr-2 text-muted-foreground" />
                            <span className="truncate">{stop.stop_name}</span>
                            {stop.stop_code && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                {stop.stop_code}
                              </span>
                            )}
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="w-[calc(50%-4px)] sm:w-[100px] flex-shrink-0">
            <div className="flex items-center gap-1 mb-1">
              <span className="text-xs text-muted-foreground">Ώρα</span>
            </div>
            <Select value={departureTime} onValueChange={setDepartureTime}>
              <SelectTrigger className="h-10 sm:h-9 bg-background">
                <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] z-[100]">
                {TIME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Favorites Dropdown */}
          {favorites.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-10 sm:h-9 flex-shrink-0 gap-1">
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[280px] z-[100]">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Αγαπημένες Διαδρομές
                </div>
                <DropdownMenuSeparator />
                {favorites.map((fav) => (
                  <DropdownMenuItem
                    key={fav.id}
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => handleSelectFavorite(fav)}
                  >
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
                        <span className="truncate">{fav.origin.stop_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        <MapPin className="h-3 w-3 text-destructive flex-shrink-0" />
                        <span className="truncate">{fav.destination.stop_name}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite?.(fav.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Search Button */}
          <Button 
            className="h-10 sm:h-9 px-4 sm:px-6 flex-1 sm:flex-none"
            onClick={handleSearch}
            disabled={!origin || !destination}
          >
            <Search className="h-4 w-4 mr-2" />
            <span className="sm:inline">Αναζήτηση</span>
          </Button>
        </div>
      </div>
    </div>
  );
}