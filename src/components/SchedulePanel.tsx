import { useState, useMemo, useEffect } from "react";
import { X, Navigation, Calendar, Radio, Eye, Clock, Loader2, ArrowRight, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ResizableDraggablePanel } from "@/components/ResizableDraggablePanel";
import { useRouteSchedule } from "@/hooks/useGtfsData";
import type { Vehicle, Trip, StaticStop, RouteInfo } from "@/types/gtfs";

interface SchedulePanelProps {
  selectedRoute: string;
  trips: Trip[];
  vehicles: Vehicle[];
  stops: StaticStop[];
  routeInfo?: RouteInfo;
  selectedOperator?: string;
  initialPosition: { x: number; y: number };
  onClose: () => void;
  onVehicleFollow: (vehicleId: string) => void;
  onVehicleFocus: (vehicle: Vehicle) => void;
}

const formatTime = (timestamp?: number) => {
  if (!timestamp) return '--:--:--';
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString('el-GR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatDelay = (delay?: number) => {
  if (delay === undefined || delay === null) return null;
  const minutes = Math.round(delay / 60);
  if (minutes === 0) return { text: 'στην ώρα', color: 'text-muted-foreground' };
  if (minutes > 0) return { text: `+${minutes} λεπτά`, color: 'text-destructive' };
  return { text: `${minutes} λεπτά`, color: 'text-green-500' };
};

const getNextStopInfo = (trip: Trip, stops: StaticStop[]) => {
  if (!trip.stopTimeUpdates?.length) return null;
  
  const now = Math.floor(Date.now() / 1000);
  const nextUpdate = trip.stopTimeUpdates.find(stu => (stu.arrivalTime || 0) > now);
  
  if (!nextUpdate) return null;
  
  const stopInfo = stops.find(s => s.stop_id === nextUpdate.stopId);
  const delayInfo = formatDelay(nextUpdate.arrivalDelay);
  
  return {
    stopName: stopInfo?.stop_name || nextUpdate.stopId || 'Άγνωστη στάση',
    arrivalTime: nextUpdate.arrivalTime,
    delay: delayInfo,
  };
};

export function SchedulePanel({
  selectedRoute,
  trips,
  vehicles,
  stops,
  routeInfo,
  selectedOperator,
  initialPosition,
  onClose,
  onVehicleFollow,
  onVehicleFocus,
}: SchedulePanelProps) {
  const [activeTab, setActiveTab] = useState<string>("live");
  const [selectedDirection, setSelectedDirection] = useState<number>(0);
  const [showUpcomingOnly, setShowUpcomingOnly] = useState<boolean>(true);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay()); // 0 = Sunday

  // Day names in Greek (index 0 = Sunday to match JS getDay())
  const dayNames = ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'];
  const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const today = new Date().getDay();

  // Fetch static schedule data
  const { data: scheduleData, isLoading: isLoadingSchedule, error: scheduleError } = useRouteSchedule(selectedRoute, selectedOperator);

  // Get trips for this route
  const routeTrips = useMemo(() => {
    return trips.filter(t => t.routeId === selectedRoute);
  }, [trips, selectedRoute]);

  // Get vehicles on this route
  const routeVehicles = useMemo(() => {
    return vehicles.filter(v => v.routeId === selectedRoute && v.latitude && v.longitude);
  }, [vehicles, selectedRoute]);

  // Map trips to vehicles for live view
  const liveTripsWithVehicles = useMemo(() => {
    return routeTrips
      .map(trip => {
        const vehicle = routeVehicles.find(v => v.tripId === trip.tripId);
        if (!vehicle) return null;
        
        const nextStop = getNextStopInfo(trip, stops);
        return {
          trip,
          vehicle,
          nextStop,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const timeA = a?.nextStop?.arrivalTime || 0;
        const timeB = b?.nextStop?.arrivalTime || 0;
        return timeA - timeB;
      });
  }, [routeTrips, routeVehicles, stops]);

  // Get service IDs that run on selected day - use calendar or calendar_dates as fallback
  const activeServiceIds = useMemo(() => {
    // If we have calendar.txt data, use it
    if (scheduleData?.calendar && scheduleData.calendar.length > 0) {
      const dayKey = dayKeys[selectedDay];
      return new Set(
        scheduleData.calendar
          .filter(cal => cal[dayKey])
          .map(cal => cal.service_id)
      );
    }
    
    // Fallback: use calendar_dates.txt - check for today's date
    if (scheduleData?.calendar_dates && scheduleData.calendar_dates.length > 0) {
      // Build date string in YYYYMMDD format for the selected day
      const today = new Date();
      const targetDate = new Date(today);
      const dayDiff = selectedDay - today.getDay();
      targetDate.setDate(today.getDate() + dayDiff);
      const dateStr = targetDate.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get service IDs that have exception_type 1 (added) for this date
      return new Set(
        scheduleData.calendar_dates
          .filter(cd => cd.date === dateStr && cd.exception_type === 1)
          .map(cd => cd.service_id)
      );
    }
    
    // If no calendar data at all, return empty set (show all trips)
    return new Set<string>();
  }, [scheduleData?.calendar, scheduleData?.calendar_dates, selectedDay, dayKeys]);

  // Get scheduled trips from static data - filter by day
  const scheduledTrips = useMemo(() => {
    if (!scheduleData?.schedule) return [];
    
    // Get current time in minutes from midnight
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Filter by direction
    const directionSchedule = scheduleData.by_direction[selectedDirection] || scheduleData.schedule;
    
    if (!directionSchedule || directionSchedule.length === 0) return [];
    
    // Filter by selected day (using service_id and calendar)
    // Only filter if we have calendar data
    let filtered = directionSchedule;
    if (activeServiceIds.size > 0) {
      filtered = directionSchedule.filter(entry => activeServiceIds.has(entry.service_id));
    }
    
    // Sort by departure time
    const sorted = [...filtered].sort((a, b) => a.departure_minutes - b.departure_minutes);
    
    // If selected day is today and showing upcoming only
    if (showUpcomingOnly && selectedDay === today) {
      // Filter to show only upcoming trips
      const upcomingTrips = sorted.filter(entry => entry.departure_minutes >= currentMinutes);
      // If no upcoming trips today, show all trips
      return upcomingTrips.length > 0 ? upcomingTrips : sorted;
    }
    
    // Show all trips for the selected day
    return sorted;
  }, [scheduleData, selectedDirection, showUpcomingOnly, selectedDay, today, activeServiceIds]);

  // Count unique departure times
  const uniqueTimeCount = useMemo(() => {
    const times = new Set(scheduledTrips.map(t => t.departure_time));
    return times.size;
  }, [scheduledTrips]);

  // Get available directions
  const availableDirections = useMemo(() => {
    if (!scheduleData?.by_direction) return [];
    return Object.keys(scheduleData.by_direction).map(Number);
  }, [scheduleData]);

  // Auto-switch to schedule tab when no live vehicles
  useEffect(() => {
    if (liveTripsWithVehicles.length === 0 && scheduledTrips.length > 0) {
      setActiveTab("schedule");
    } else if (liveTripsWithVehicles.length > 0) {
      setActiveTab("live");
    }
  }, [liveTripsWithVehicles.length, scheduledTrips.length]);

  const bgColor = routeInfo?.route_color ? `#${routeInfo.route_color}` : 'hsl(var(--primary))';
  const liveCount = liveTripsWithVehicles.length;
  const scheduleCount = scheduledTrips.length;

  return (
    <ResizableDraggablePanel
      initialPosition={initialPosition}
      initialSize={{ width: 380, height: 550 }}
      minSize={{ width: 320, height: 400 }}
      maxSize={{ width: 500, height: 800 }}
      className="rounded-lg overflow-hidden border border-border bg-card/95 backdrop-blur-sm"
      zIndex={1000}
      title="Πρόγραμμα"
    >
      <div className="h-full flex flex-col">
        {/* Header with route info */}
        <div 
          className="p-2 flex items-center gap-2"
          style={{ backgroundColor: bgColor }}
        >
          <Calendar className="h-4 w-4 text-white" />
          <span className="text-xs font-bold text-white flex-1">
            Πρόγραμμα
          </span>
          {routeInfo?.route_short_name && (
            <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded">
              {routeInfo.route_short_name}
            </span>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-5 w-5 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 h-8 rounded-none bg-muted/50 flex-shrink-0">
            <TabsTrigger value="live" className="text-xs gap-1.5 data-[state=active]:bg-background">
              <Radio className="h-3 w-3" />
              Live
              {liveCount > 0 && (
                <span className="bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {liveCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs gap-1.5 data-[state=active]:bg-background">
              <Calendar className="h-3 w-3" />
              Πρόγραμμα
              {scheduleCount > 0 && (
                <span className="bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {scheduleCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Live Tab */}
          <TabsContent value="live" className="flex-1 min-h-0 m-0">
            <div className="h-full overflow-y-auto p-2 space-y-1.5">
              {liveTripsWithVehicles.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-8">
                  Δεν υπάρχουν ενεργά δρομολόγια
                </div>
              ) : (
                liveTripsWithVehicles.map((item) => {
                  if (!item) return null;
                  const { trip, vehicle, nextStop } = item;
                  const vehicleId = vehicle.vehicleId || vehicle.id;
                  
                  return (
                    <div
                      key={trip.tripId || trip.id}
                      className="p-2 rounded-lg bg-secondary/30 border border-border/50 space-y-1.5"
                    >
                      {/* Time and vehicle info row */}
                      <div className="flex items-center gap-2">
                        <span className="bg-green-500/20 text-green-600 dark:text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                          LIVE
                        </span>
                        <span className="font-mono text-sm font-bold" style={{ color: bgColor }}>
                          {formatTime(nextStop?.arrivalTime)}
                        </span>
                        <span className="text-xs text-muted-foreground flex-1">
                          {vehicle.label || vehicleId}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1"
                          style={{ color: bgColor }}
                          onClick={() => {
                            onVehicleFollow(vehicleId);
                            onVehicleFocus(vehicle);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          Παρακολούθηση
                        </Button>
                      </div>
                      
                      {/* Next stop info */}
                      {nextStop && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Επόμενη στάση σε</span>
                          {nextStop.delay && (
                            <span className={nextStop.delay.color}>
                              {(() => {
                                const now = Math.floor(Date.now() / 1000);
                                const diff = (nextStop.arrivalTime || 0) - now;
                                const mins = Math.ceil(diff / 60);
                                return mins > 0 ? `${mins} λεπτά` : 'τώρα';
                              })()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="flex-1 min-h-0 m-0 flex flex-col overflow-hidden">
            {/* Day selector row */}
            <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-muted/50 overflow-x-auto">
              {dayNames.map((name, idx) => (
                <Button
                  key={idx}
                  variant={selectedDay === idx ? "default" : "ghost"}
                  size="sm"
                  className={`h-6 text-[10px] px-2 flex-shrink-0 ${idx === today ? 'ring-1 ring-primary/50' : ''}`}
                  onClick={() => setSelectedDay(idx)}
                >
                  {name.substring(0, 3)}
                  {idx === today && <span className="ml-0.5 text-[8px]">•</span>}
                </Button>
              ))}
            </div>
            
            {/* Filters row */}
            <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
              {/* Direction selector */}
              {availableDirections.length > 1 && (
                <>
                  {availableDirections.map((dir) => (
                    <Button
                      key={dir}
                      variant={selectedDirection === dir ? "default" : "ghost"}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => setSelectedDirection(dir)}
                    >
                      Κατ. {dir + 1}
                    </Button>
                  ))}
                  <div className="w-px h-4 bg-border" />
                </>
              )}
              
              {/* Time filter - only show for today */}
              {selectedDay === today && (
                <Button
                  variant={showUpcomingOnly ? "default" : "outline"}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setShowUpcomingOnly(!showUpcomingOnly)}
                >
                  {showUpcomingOnly ? "Επόμενα" : "Όλα"}
                </Button>
              )}
              
              {/* Trip count */}
              <span className="text-[10px] text-muted-foreground ml-auto">
                {scheduledTrips.length} δρομολόγια ({uniqueTimeCount} ώρες)
              </span>
            </div>
            
            <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
              {isLoadingSchedule ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-6 w-6 mb-2 animate-spin" />
                  <p className="text-xs">Φόρτωση προγράμματος...</p>
                </div>
              ) : scheduledTrips.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-8">
                  Δεν υπάρχουν προγραμματισμένα δρομολόγια
                </div>
              ) : (
                scheduledTrips.map((entry) => {
                  // Check if there's a live vehicle for this trip
                  const liveVehicle = routeVehicles.find(v => v.tripId === entry.trip_id);
                  const isNowOrPast = entry.departure_minutes <= (new Date().getHours() * 60 + new Date().getMinutes());
                  
                  return (
                    <div
                      key={entry.trip_id}
                      className={`p-2 rounded-lg border border-border/50 space-y-1 ${
                        liveVehicle ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/30'
                      }`}
                    >
                      {/* Time row */}
                      <div className="flex items-center gap-2">
                        {liveVehicle ? (
                          <span className="bg-green-500/20 text-green-600 dark:text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded">
                            LIVE
                          </span>
                        ) : (
                          <Clock className={`h-3 w-3 ${isNowOrPast ? 'text-orange-500' : 'text-muted-foreground'}`} />
                        )}
                        <span 
                          className={`font-mono text-sm font-bold ${isNowOrPast && !liveVehicle ? 'text-muted-foreground line-through' : ''}`} 
                          style={{ color: isNowOrPast && !liveVehicle ? undefined : bgColor }}
                        >
                          {entry.departure_time}
                        </span>
                        <span className="flex-1" />
                        {liveVehicle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1"
                            style={{ color: bgColor }}
                            onClick={() => {
                              const vehicleId = liveVehicle.vehicleId || liveVehicle.id;
                              onVehicleFollow(vehicleId);
                              onVehicleFocus(liveVehicle);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            Παρακολούθηση
                          </Button>
                        )}
                      </div>
                      
                      {/* Route info */}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="truncate">{entry.first_stop_name}</span>
                        <ArrowRight className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{entry.last_stop_name}</span>
                      </div>
                      
                      {/* Trip headsign if available */}
                      {entry.trip_headsign && (
                        <div className="text-[10px] text-muted-foreground">
                          → {entry.trip_headsign}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </ResizableDraggablePanel>
  );
}
