import { useState, useMemo } from "react";
import { Calendar, Clock, Loader2, Bus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useStaticRoutes, useRouteSchedule } from "@/hooks/useGtfsData";
import { useFavoriteRouteIds } from "@/hooks/useFavoriteRouteIds";
import { toast } from "@/hooks/use-toast";
import { OPERATORS, type RouteInfo } from "@/types/gtfs";

interface ScheduleViewProps {
  selectedOperator: string;
  onOperatorChange: (operator: string) => void;
}

// Filter out 'all' option for schedule view - user must pick a specific operator
const scheduleOperators = OPERATORS.filter(op => op.id !== 'all');

export function ScheduleView({ selectedOperator, onOperatorChange }: ScheduleViewProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [selectedDirection, setSelectedDirection] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const { favoriteRouteIds, isFavorite, toggleFavorite } = useFavoriteRouteIds();

  const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const today = new Date().getDay();

  // Fetch routes for selected operator
  const routesQuery = useStaticRoutes(selectedOperator !== 'all' ? selectedOperator : undefined);
  
  // Fetch schedule for selected route
  const scheduleQuery = useRouteSchedule(
    selectedRoute || null, 
    selectedOperator !== 'all' ? selectedOperator : undefined
  );

  // Sort routes by short name
  const sortedRoutes = useMemo(() => {
    const routes = routesQuery.data?.data || [];
    return [...routes].sort((a, b) => {
      const aNum = parseInt(a.route_short_name || '999');
      const bNum = parseInt(b.route_short_name || '999');
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      return (a.route_short_name || '').localeCompare(b.route_short_name || '');
    });
  }, [routesQuery.data]);

  // Get favorite routes that are available in current operator - maintain order from favoriteRouteIds
  const favoriteRoutes = useMemo(() => {
    const routesMap = new Map(sortedRoutes.map(route => [route.route_id, route]));
    // Maintain order from favoriteRouteIds array
    return favoriteRouteIds
      .filter(routeId => routesMap.has(routeId))
      .slice(0, 4)
      .map(routeId => routesMap.get(routeId)!);
  }, [sortedRoutes, favoriteRouteIds]);

  // Get selected route info
  const selectedRouteInfo = useMemo(() => {
    return sortedRoutes.find(r => r.route_id === selectedRoute);
  }, [sortedRoutes, selectedRoute]);

  // Get service IDs for selected day
  const activeServiceIds = useMemo(() => {
    const scheduleData = scheduleQuery.data;
    if (!scheduleData) return new Set<string>();

    if (scheduleData.calendar && scheduleData.calendar.length > 0) {
      const dayKey = dayKeys[selectedDay];
      return new Set(
        scheduleData.calendar
          .filter(cal => cal[dayKey])
          .map(cal => cal.service_id)
      );
    }

    if (scheduleData.calendar_dates && scheduleData.calendar_dates.length > 0) {
      const today = new Date();
      const targetDate = new Date(today);
      const dayDiff = selectedDay - today.getDay();
      targetDate.setDate(today.getDate() + dayDiff);
      const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');

      return new Set(
        scheduleData.calendar_dates
          .filter(cd => cd.date === dateStr && cd.exception_type === 1)
          .map(cd => cd.service_id)
      );
    }

    return new Set<string>();
  }, [scheduleQuery.data, selectedDay, dayKeys]);

  // Get available directions
  const availableDirections = useMemo(() => {
    if (!scheduleQuery.data?.by_direction) return [];
    return Object.keys(scheduleQuery.data.by_direction).map(Number);
  }, [scheduleQuery.data]);

  // Get scheduled trips
  const scheduledTrips = useMemo(() => {
    const scheduleData = scheduleQuery.data;
    if (!scheduleData?.schedule) return [];

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const directionSchedule = scheduleData.by_direction[selectedDirection] || scheduleData.schedule;
    if (!directionSchedule || directionSchedule.length === 0) return [];

    let filtered = directionSchedule;
    if (activeServiceIds.size > 0) {
      filtered = directionSchedule.filter(entry => activeServiceIds.has(entry.service_id));
    }

    return [...filtered].sort((a, b) => a.departure_minutes - b.departure_minutes);
  }, [scheduleQuery.data, selectedDirection, activeServiceIds]);

  const bgColor = selectedRouteInfo?.route_color ? `#${selectedRouteInfo.route_color}` : 'hsl(var(--primary))';

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Πρόγραμμα Δρομολογίων</h2>
      </div>

      {/* Favorite Routes - Big buttons like distance selector */}
      {favoriteRoutes.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Αγαπημένα δρομολόγια:</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {favoriteRoutes.map((route) => {
              const isSelected = selectedRoute === route.route_id;
              const routeColor = route.route_color ? `#${route.route_color}` : '#6B8E23';
              const textColor = route.route_text_color ? `#${route.route_text_color}` : '#FFFFFF';
              return (
                <Button
                  key={route.route_id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="lg"
                  className={cn(
                    "h-16 flex flex-col items-center justify-center gap-1 font-bold text-base transition-all",
                    isSelected && "ring-2 ring-offset-2"
                  )}
                  style={isSelected ? { 
                    backgroundColor: routeColor, 
                    color: textColor,
                  } : { borderColor: routeColor }}
                  onClick={() => setSelectedRoute(isSelected ? '' : route.route_id)}
                  title={route.route_long_name || route.route_short_name}
                >
                  <Bus className="h-5 w-5" style={{ color: isSelected ? textColor : routeColor }} />
                  <span>{route.route_short_name || route.route_id}</span>
                </Button>
              );
            })}
            {/* Add favorite button if less than 4 */}
            {favoriteRouteIds.length < 4 && (
              <Button
                variant="outline"
                size="lg"
                className="h-16 flex flex-col items-center justify-center gap-1 border-dashed"
                onClick={() => {
                  // Find a route to add - show modal/picker
                  // For now, just log
                  console.log('Add favorite route - implement picker');
                  toast({
                    title: "ℹ️ Προσθήκη αγαπημένου",
                    description: "Επιλέξτε ένα δρομολόγιο από τη λίστα και πατήστε το ⭐ για να το προσθέσετε",
                  });
                }}
                title="Προσθήκη αγαπημένου δρομολογίου"
              >
                <Star className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">+</span>
              </Button>
            )}
          </div>
          {selectedRoute && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => setSelectedRoute('')}
            >
              <X className="h-3 w-3" />
              Καθαρισμός επιλογής
            </Button>
          )}
        </div>
      )}

      {/* Operator & Route Selection */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Operator Select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Φορέας</label>
          <Select value={selectedOperator} onValueChange={(val) => {
            onOperatorChange(val);
            setSelectedRoute("");
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Επιλέξτε φορέα" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {scheduleOperators.map(op => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name} {op.city && `(${op.city})`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Route Select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Γραμμή</label>
          <Select 
            value={selectedRoute} 
            onValueChange={setSelectedRoute}
            disabled={!selectedOperator || selectedOperator === 'all' || routesQuery.isLoading}
          >
            <SelectTrigger className="w-[300px]">
              <SelectValue placeholder={routesQuery.isLoading ? "Φόρτωση..." : "Επιλέξτε γραμμή"} />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50 max-h-[300px]">
              {sortedRoutes.map(route => (
                <SelectItem key={route.route_id} value={route.route_id}>
                  <div className="flex items-center gap-2 w-full">
                    <span 
                      className="px-1.5 py-0.5 rounded text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: route.route_color ? `#${route.route_color}` : 'hsl(var(--primary))' }}
                    >
                      {route.route_short_name}
                    </span>
                    <span className="truncate flex-1">{route.route_long_name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 p-0 hover:bg-transparent flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const wasFavorite = isFavorite(route.route_id);
                        toggleFavorite(route.route_id);
                        if (!wasFavorite) {
                          // Show notification when route is added to favorites
                          toast({
                            title: "✅ Δρομολόγιο προστέθηκε",
                            description: `Το δρομολόγιο "${route.route_short_name || route.route_id}" προστέθηκε στα αγαπημένα`,
                          });
                          // Also send browser notification if permission granted
                          if ('Notification' in window && Notification.permission === 'granted') {
                            new Notification('🚌 Δρομολόγιο προστέθηκε', {
                              body: `Το δρομολόγιο "${route.route_short_name || route.route_id}" προστέθηκε στα αγαπημένα`,
                              icon: '/pwa-192x192.png',
                              tag: 'favorite-route-added',
                            });
                          }
                        }
                      }}
                    >
                      <Star className={cn("h-3.5 w-3.5", isFavorite(route.route_id) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                    </Button>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Schedule Content */}
      {!selectedRoute ? (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Bus className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Επιλέξτε φορέα και γραμμή για να δείτε το πρόγραμμα</p>
          </div>
        </div>
      ) : scheduleQuery.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Route Info Header */}
          {selectedRouteInfo && (
            <div 
              className="p-3 rounded-lg mb-3 flex items-center gap-3"
              style={{ backgroundColor: bgColor }}
            >
              <span className="bg-white/20 text-white text-lg font-bold px-3 py-1 rounded">
                {selectedRouteInfo.route_short_name}
              </span>
              <span className="text-white font-medium">
                {selectedRouteInfo.route_long_name}
              </span>
            </div>
          )}

          {/* Day Selector */}
          <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
            {dayNames.map((name, idx) => (
              <Button
                key={idx}
                variant={selectedDay === idx ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-8 text-xs px-3 flex-shrink-0",
                  idx === today && "ring-2 ring-primary/50"
                )}
                onClick={() => setSelectedDay(idx)}
              >
                {name}
                {idx === today && <span className="ml-1 text-[10px]">(σήμερα)</span>}
              </Button>
            ))}
          </div>

          {/* Direction Selector */}
          {availableDirections.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground">Κατεύθυνση:</span>
              {availableDirections.map((dir) => (
                <Button
                  key={dir}
                  variant={selectedDirection === dir ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSelectedDirection(dir)}
                >
                  {dir === 0 ? "Μετάβαση" : "Επιστροφή"}
                </Button>
              ))}
            </div>
          )}

          {/* Trip Count */}
          <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{scheduledTrips.length} δρομολόγια</span>
          </div>

          {/* Schedule Times */}
          <div className="flex-1 overflow-auto bg-secondary/30 rounded-lg p-4">
            {scheduledTrips.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                Δεν υπάρχουν δρομολόγια για αυτή την ημέρα
              </div>
            ) : (
              <div className="text-sm leading-relaxed">
                {scheduledTrips.map((entry, idx) => {
                  const now = new Date();
                  const currentMinutes = now.getHours() * 60 + now.getMinutes();
                  const isPast = selectedDay === today && entry.departure_minutes < currentMinutes;
                  const isNext = selectedDay === today && !isPast && 
                    (idx === 0 || scheduledTrips[idx - 1].departure_minutes < currentMinutes);

                  return (
                    <span key={entry.trip_id}>
                      <span
                        className={cn(
                          "font-mono",
                          isPast && "text-muted-foreground/50",
                          isNext && "bg-primary/20 px-1.5 py-0.5 rounded font-bold"
                        )}
                        style={!isPast ? { color: bgColor } : undefined}
                      >
                        {entry.departure_time}
                      </span>
                      {idx < scheduledTrips.length - 1 && (
                        <span className="text-muted-foreground">, </span>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}