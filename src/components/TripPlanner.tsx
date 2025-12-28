import { useState, useMemo } from "react";
import { MapPin, ArrowDownUp, Search, Navigation, Loader2, Clock, Star, ChevronDown, Trash2, CalendarIcon } from "lucide-react";
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

  const isToday = useMemo(() => {
    const today = new Date();
    return departureDate.toDateString() === today.toDateString();
  }, [departureDate]);

  const handleSelectFavorite = (fav: FavoriteRoute) => {
    setOrigin(fav.origin);
    setDestination(fav.destination);
  };

  // Filter stops based on search
  const filteredOriginStops = useMemo(() => {
    if (!originSearch) return stops.slice(0, 50);
    const search = originSearch.toLowerCase();
    return stops.filter(s => 
      s.stop_name.toLowerCase().includes(search) ||
      s.stop_code?.toLowerCase().includes(search)
    ).slice(0, 50);
  }, [stops, originSearch]);

  const filteredDestinationStops = useMemo(() => {
    if (!destinationSearch) return stops.slice(0, 50);
    const search = destinationSearch.toLowerCase();
    return stops.filter(s => 
      s.stop_name.toLowerCase().includes(search) ||
      s.stop_code?.toLowerCase().includes(search)
    ).slice(0, 50);
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
    onSearch?.(origin, destination, departureTime, departureDate);
  };

  return (
    <div className="bg-card/80 backdrop-blur-sm rounded-lg border border-border p-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
        {/* Origin */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-muted-foreground">Αφετηρία</span>
            <button
              onClick={handleUseMyLocation}
              disabled={isLocating}
              className="text-xs text-primary hover:underline flex items-center gap-1 ml-2"
            >
              <Navigation className="h-3 w-3" />
              {isLocating ? "Εντοπισμός..." : "Χρήση τοποθεσίας μου"}
            </button>
          </div>
          <Popover open={originOpen} onOpenChange={setOriginOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={originOpen}
                className="w-full justify-start h-9 text-left font-normal bg-background"
              >
                <MapPin className="h-4 w-4 mr-2 flex-shrink-0 text-primary" />
                <span className="truncate">
                  {origin ? origin.stop_name : "Επιλέξτε αφετηρία..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 z-[100]" align="start">
              <Command>
                <CommandInput 
                  placeholder="Αναζήτηση στάσης..." 
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
                      "Δεν βρέθηκε στάση"
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredOriginStops.map((stop) => (
                      <CommandItem
                        key={stop.stop_id}
                        value={stop.stop_id}
                        onSelect={() => {
                          setOrigin(stop);
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
                    ))}
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
                  {destination ? destination.stop_name : "Επιλέξτε προορισμό..."}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 z-[100]" align="start">
              <Command>
                <CommandInput 
                  placeholder="Αναζήτηση στάσης..." 
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
                      "Δεν βρέθηκε στάση"
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredDestinationStops.map((stop) => (
                      <CommandItem
                        key={stop.stop_id}
                        value={stop.stop_id}
                        onSelect={() => {
                          setDestination(stop);
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
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Date Picker */}
        <div className="w-[120px] flex-shrink-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-muted-foreground">Ημερομηνία</span>
          </div>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full h-9 justify-start text-left font-normal bg-background"
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
        <div className="w-[100px] flex-shrink-0">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-xs text-muted-foreground">Ώρα</span>
          </div>
          <Select value={departureTime} onValueChange={setDepartureTime}>
            <SelectTrigger className="h-9 bg-background">
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
              <Button variant="outline" className="h-9 flex-shrink-0 gap-1">
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
          className="h-9 px-6 flex-shrink-0"
          onClick={handleSearch}
          disabled={!origin || !destination}
        >
          <Search className="h-4 w-4 mr-2" />
          Αναζήτηση
        </Button>
      </div>
    </div>
  );
}