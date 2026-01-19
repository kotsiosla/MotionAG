import { useState, useMemo, useEffect } from "react";
import { Calendar, Loader2, Bus, Star, X, MapPin } from "lucide-react";
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
import { OPERATORS } from "@/types/gtfs";

interface ScheduleViewProps {
  selectedOperator: string;
  onOperatorChange: (operator: string) => void;
  selectedRoute?: string;
  onRouteSelect?: (routeId: string) => void;
  onUnsyncedRouteSelect?: (routeId: string) => void;
}

// Filter out 'all' option for schedule view - user must pick a specific operator
const scheduleOperators = OPERATORS.filter(op => op.id !== 'all');

export function ScheduleView({
  selectedOperator,
  onOperatorChange,
  selectedRoute = "",
  onRouteSelect,
  onUnsyncedRouteSelect
}: ScheduleViewProps) {
  // Use prop directly - treat 'all' as empty
  const effectiveRouteId = selectedRoute === 'all' ? "" : selectedRoute;
  const [selectedDirection, setSelectedDirection] = useState<number>(0);

  // Reset direction when route changes
  useEffect(() => {
    setSelectedDirection(0);
  }, [effectiveRouteId]);

  const { favoriteRouteIds } = useFavoriteRouteIds();

  const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const today = new Date().getDay();

  // Fetch routes for selected operator
  const routesQuery = useStaticRoutes(selectedOperator !== 'all' ? selectedOperator : undefined);

  // Fetch schedule for selected route
  const scheduleQuery = useRouteSchedule(
    effectiveRouteId || null,
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
    return sortedRoutes.find(r => r.route_id === effectiveRouteId);
  }, [sortedRoutes, effectiveRouteId]);

  // Get available directions
  const availableDirections = useMemo(() => {
    if (!scheduleQuery.data?.by_direction) return [];
    return Object.keys(scheduleQuery.data.by_direction).map(Number);
  }, [scheduleQuery.data]);

  const bgColor = selectedRouteInfo?.route_color ? `#${selectedRouteInfo.route_color}` : 'hsl(var(--primary))';

  return (
    <div className="h-full flex flex-col p-2 lg:p-4 overflow-hidden">
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
                  onClick={() => {
                    const newValue = isSelected ? '' : route.route_id;
                    if (onUnsyncedRouteSelect) onUnsyncedRouteSelect(newValue);
                  }}
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
              className="h-6 w-auto px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (onUnsyncedRouteSelect) onUnsyncedRouteSelect("");
              }}
            >
              <X className="h-3 w-3" />
              Καθαρισμός επιλογής
            </Button>
          )}
        </div>
      )
      }

      {/* Operator & Route Selection */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Operator Select */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Φορέας</label>
          <Select value={selectedOperator} onValueChange={(val) => {
            onOperatorChange(val);
            if (onUnsyncedRouteSelect) onUnsyncedRouteSelect("");
          }}>
            <SelectTrigger className="w-full sm:w-[200px]">
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
            value={effectiveRouteId}
            onValueChange={(val) => {
              if (onUnsyncedRouteSelect) onUnsyncedRouteSelect(val);
            }}
            disabled={!selectedOperator || selectedOperator === 'all' || routesQuery.isLoading}
          >
            <SelectTrigger className="w-[calc(100vw-48px)] sm:w-[300px]" disabled={!selectedOperator || selectedOperator === 'all' || routesQuery.isLoading}>
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
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Schedule Content */}
      {
        !effectiveRouteId ? (
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
                className="p-3 rounded-lg mb-3 flex items-center justify-between gap-3 shadow-md"
                style={{ backgroundColor: bgColor }}
              >
                <div className="flex items-center gap-3">
                  <span className="bg-white/20 text-white text-lg font-bold px-3 py-1 rounded">
                    {selectedRouteInfo.route_short_name}
                  </span>
                  <span className="text-white font-medium">
                    {selectedRouteInfo.route_long_name}
                  </span>
                </div>

                {onRouteSelect && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 shadow-sm font-bold bg-white text-black hover:bg-white/90"
                    onClick={() => onRouteSelect(effectiveRouteId)}
                  >
                    <MapPin className="h-4 w-4 mr-1.5" />
                    Live Χάρτης
                  </Button>
                )}
              </div>
            )}

            {/* Schedule View - Full Width */}
            <div className="flex-1 flex flex-col overflow-hidden space-y-3 h-full">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Calendar className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Πρόγραμμα Εβδομάδας</h3>
              </div>

              {/* Direction Selector */}
              {availableDirections.length > 1 && (
                <div className="flex items-center gap-2">
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

              {/* Weekly Schedule list */}
              {(() => {
                const scheduleData = scheduleQuery.data;
                const directionSchedule = scheduleData?.by_direction[selectedDirection] || scheduleData?.schedule || [];

                // Calculate trips for each day
                const tripsByDay = dayNames.map((_, dayIdx) => {
                  let dayServiceIds = new Set<string>();

                  if (scheduleData) {
                    if (scheduleData.calendar && scheduleData.calendar.length > 0) {
                      const dayKey = dayKeys[dayIdx];
                      dayServiceIds = new Set(
                        scheduleData.calendar
                          .filter((cal: any) => cal[dayKey])
                          .map((cal: any) => cal.service_id)
                      );
                    } else if (scheduleData.calendar_dates && scheduleData.calendar_dates.length > 0) {
                      const now = new Date();
                      const targetDate = new Date(now);
                      const dayDiff = dayIdx - now.getDay();
                      targetDate.setDate(now.getDate() + dayDiff);
                      const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');

                      dayServiceIds = new Set(
                        scheduleData.calendar_dates
                          .filter((cd: any) => cd.date === dateStr && cd.exception_type === 1)
                          .map((cd: any) => cd.service_id)
                      );
                    }
                  }

                  // Use bgColor for schedule items
                  const scheduleItemColor = selectedRouteInfo?.route_color ?
                    `#${selectedRouteInfo.route_color}` :
                    'hsl(var(--primary))';

                  let filtered = directionSchedule;
                  if (dayServiceIds.size > 0 && filtered.length > 0) {
                    filtered = filtered.filter((entry: any) => dayServiceIds.has(entry.service_id));
                  }

                  return {
                    dayTrips: [...filtered].sort((a, b) => a.departure_minutes - b.departure_minutes),
                    scheduleItemColor
                  };
                });

                const now = new Date();
                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                // Reorder days to start from today
                const reorderedDays = [];
                for (let i = 0; i < dayNames.length; i++) {
                  const dayIdx = (today + i) % dayNames.length;
                  const { dayTrips, scheduleItemColor } = tripsByDay[dayIdx];
                  reorderedDays.push({
                    dayIdx,
                    dayName: dayNames[dayIdx],
                    dayTrips,
                    scheduleItemColor
                  });
                }

                return (
                  <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-2 lg:space-y-3 pr-1 lg:pr-2 scrollbar-thin">
                    {reorderedDays.map(({ dayIdx, dayName, dayTrips, scheduleItemColor }) => {
                      const isToday = dayIdx === today;

                      return (
                        <div
                          key={dayIdx}
                          className={cn(
                            "p-2 lg:p-3 rounded-lg border bg-card flex-shrink-0",
                            isToday && "ring-2 ring-primary/50 bg-primary/5"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className={cn(
                              "text-xs lg:text-sm font-semibold",
                              isToday && "text-primary"
                            )}>
                              {dayName}
                              {isToday && <span className="ml-1 text-[10px] lg:text-xs">(σήμερα)</span>}
                            </span>
                            <span className="text-[10px] lg:text-xs text-muted-foreground ml-auto">
                              {dayTrips.length} δρομολόγια
                            </span>
                          </div>
                          {dayTrips.length === 0 ? (
                            <div className="text-xs text-muted-foreground py-2">
                              Δεν υπάρχουν δρομολόγια
                            </div>
                          ) : (
                            <div
                              className="flex gap-1.5 overflow-x-auto overflow-y-hidden pb-2 -mx-1 px-1"
                              style={{
                                scrollbarWidth: 'thin',
                                WebkitOverflowScrolling: 'touch',
                                scrollBehavior: 'smooth',
                              }}
                            >
                              {dayTrips.map((entry) => {
                                const isPast = isToday && entry.departure_minutes < currentMinutes;
                                const isNext = isToday && !isPast &&
                                  entry.departure_minutes >= currentMinutes &&
                                  (dayTrips.findIndex(t => t.trip_id === entry.trip_id) === 0 ||
                                    dayTrips[dayTrips.findIndex(t => t.trip_id === entry.trip_id) - 1]?.departure_minutes < currentMinutes);

                                return (
                                  <span
                                    key={entry.trip_id}
                                    className={cn(
                                      "inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-mono transition-all flex-shrink-0",
                                      "select-none touch-none", // Prevent text selection and touch callouts
                                      isPast && "bg-muted/50 text-muted-foreground/50",
                                      isNext && "bg-primary text-white shadow-md scale-105 ring-2 ring-primary/30",
                                      !isPast && !isNext && "bg-primary/20 border border-primary/30",
                                    )}
                                    style={!isPast && !isNext ? { color: scheduleItemColor, borderColor: scheduleItemColor } : undefined}
                                  >
                                    {entry.departure_time}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )
      }
    </div>
  );
}