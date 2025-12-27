import { useState, useMemo } from "react";
import { X, Navigation, Calendar, Radio, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableDraggablePanel } from "@/components/ResizableDraggablePanel";
import type { Vehicle, Trip, StaticStop, RouteInfo } from "@/types/gtfs";

interface SchedulePanelProps {
  selectedRoute: string;
  trips: Trip[];
  vehicles: Vehicle[];
  stops: StaticStop[];
  routeInfo?: RouteInfo;
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
  initialPosition,
  onClose,
  onVehicleFollow,
  onVehicleFocus,
}: SchedulePanelProps) {
  const [activeTab, setActiveTab] = useState<string>("live");

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
        // Sort by next arrival time
        const timeA = a?.nextStop?.arrivalTime || 0;
        const timeB = b?.nextStop?.arrivalTime || 0;
        return timeA - timeB;
      });
  }, [routeTrips, routeVehicles, stops]);

  // Get scheduled trips (future departures)
  const scheduledTrips = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    
    return routeTrips
      .map(trip => {
        const firstStop = trip.stopTimeUpdates?.[0];
        if (!firstStop?.arrivalTime) return null;
        
        // Only show future trips
        if (firstStop.arrivalTime < now) return null;
        
        const stopInfo = stops.find(s => s.stop_id === firstStop.stopId);
        const vehicle = routeVehicles.find(v => v.tripId === trip.tripId);
        
        return {
          trip,
          vehicle,
          departureTime: firstStop.arrivalTime,
          firstStopName: stopInfo?.stop_name || firstStop.stopId || 'Άγνωστη στάση',
          delay: formatDelay(firstStop.arrivalDelay),
        };
      })
      .filter(Boolean)
      .sort((a, b) => (a?.departureTime || 0) - (b?.departureTime || 0))
      .slice(0, 10);
  }, [routeTrips, stops, routeVehicles]);

  const bgColor = routeInfo?.route_color ? `#${routeInfo.route_color}` : 'hsl(var(--primary))';
  const liveCount = liveTripsWithVehicles.length;

  return (
    <ResizableDraggablePanel
      initialPosition={initialPosition}
      initialSize={{ width: 320, height: 350 }}
      minSize={{ width: 280, height: 250 }}
      maxSize={{ width: 450, height: 500 }}
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 h-8 rounded-none bg-muted/50">
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
            </TabsTrigger>
          </TabsList>

          {/* Live Tab */}
          <TabsContent value="live" className="flex-1 overflow-hidden m-0">
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

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="flex-1 overflow-hidden m-0">
            <div className="h-full overflow-y-auto p-2 space-y-1.5">
              {scheduledTrips.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-8">
                  Δεν υπάρχουν προγραμματισμένα δρομολόγια
                </div>
              ) : (
                scheduledTrips.map((item) => {
                  if (!item) return null;
                  const { trip, vehicle, departureTime, firstStopName, delay } = item;
                  const vehicleId = vehicle?.vehicleId || vehicle?.id;
                  
                  return (
                    <div
                      key={trip.tripId || trip.id}
                      className="p-2 rounded-lg bg-secondary/30 border border-border/50 space-y-1"
                    >
                      {/* Time row */}
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold" style={{ color: bgColor }}>
                          {formatTime(departureTime)}
                        </span>
                        {delay && (
                          <span className={`text-[10px] ${delay.color}`}>
                            ({delay.text})
                          </span>
                        )}
                        <span className="flex-1" />
                        {vehicle && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1"
                            style={{ color: bgColor }}
                            onClick={() => {
                              onVehicleFollow(vehicleId!);
                              onVehicleFocus(vehicle);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            Παρακολούθηση
                          </Button>
                        )}
                      </div>
                      
                      {/* First stop */}
                      <div className="text-xs text-muted-foreground truncate">
                        Αναχώρηση: {firstStopName}
                      </div>
                      
                      {/* Vehicle assignment */}
                      {vehicleId && (
                        <div className="text-[10px] text-muted-foreground">
                          Όχημα: {vehicle?.label || vehicleId}
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
