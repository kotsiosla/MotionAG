import { useState, useMemo } from "react";
import { Calendar, Clock, Loader2, Bus } from "lucide-react";
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
import type { RouteInfo } from "@/types/gtfs";

interface ScheduleViewProps {
  selectedOperator: string;
  onOperatorChange: (operator: string) => void;
}

const operators = [
  { id: 'npt', name: 'NPT - Thessaloniki' },
  { id: 'oasa', name: 'ΟΑΣΑ - Athens' },
];

export function ScheduleView({ selectedOperator, onOperatorChange }: ScheduleViewProps) {
  const [selectedRoute, setSelectedRoute] = useState<string>("");
  const [selectedDirection, setSelectedDirection] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

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
              {operators.map(op => (
                <SelectItem key={op.id} value={op.id}>
                  {op.name}
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
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-1.5 py-0.5 rounded text-xs font-bold text-white"
                      style={{ backgroundColor: route.route_color ? `#${route.route_color}` : 'hsl(var(--primary))' }}
                    >
                      {route.route_short_name}
                    </span>
                    <span className="truncate max-w-[200px]">{route.route_long_name}</span>
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