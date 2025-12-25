import { useMemo, useState } from "react";
import { Search, MapPin, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Trip, StopInfo } from "@/types/gtfs";

interface StopsViewProps {
  trips: Trip[];
  isLoading: boolean;
}

const formatDelay = (seconds?: number) => {
  if (seconds === undefined || seconds === null) return null;
  const mins = Math.round(seconds / 60);
  if (mins === 0) return { text: 'Στην ώρα', className: 'text-transit-ontime' };
  if (mins > 0) return { text: `+${mins}\'`, className: 'text-transit-delay' };
  return { text: `${mins}\'`, className: 'text-transit-early' };
};

export function StopsView({ trips, isLoading }: StopsViewProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const stops = useMemo(() => {
    const stopsMap = new Map<string, StopInfo>();

    trips.forEach((trip) => {
      trip.stopTimeUpdates.forEach((stu) => {
        if (!stu.stopId) return;

        if (!stopsMap.has(stu.stopId)) {
          stopsMap.set(stu.stopId, {
            stopId: stu.stopId,
            delays: [],
          });
        }

        const stopInfo = stopsMap.get(stu.stopId)!;
        stopInfo.delays.push({
          tripId: trip.tripId,
          routeId: trip.routeId,
          arrivalDelay: stu.arrivalDelay,
          departureDelay: stu.departureDelay,
        });
      });
    });

    return Array.from(stopsMap.values()).sort((a, b) =>
      a.stopId.localeCompare(b.stopId)
    );
  }, [trips]);

  const filteredStops = useMemo(() => {
    if (!searchTerm) return stops;
    const term = searchTerm.toLowerCase();
    return stops.filter((stop) =>
      stop.stopId.toLowerCase().includes(term) ||
      stop.stopName?.toLowerCase().includes(term)
    );
  }, [stops, searchTerm]);

  const getAverageDelay = (stop: StopInfo) => {
    const delays = stop.delays
      .map((d) => d.arrivalDelay || d.departureDelay || 0)
      .filter((d) => d !== undefined);
    if (delays.length === 0) return undefined;
    return Math.round(delays.reduce((a, b) => a + b, 0) / delays.length);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Αναζήτηση stop ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {filteredStops.length} στάσεις
          </span>
          <Button variant="outline" size="sm" className="text-xs" disabled>
            <Upload className="h-3 w-3 mr-1" />
            Φόρτωση GTFS Static
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Σημ: Για ονόματα στάσεων και συντεταγμένες, φορτώστε static GTFS (σύντομα διαθέσιμο)
        </p>
      </div>

      <div className="flex-1 overflow-auto scrollbar-thin">
        {isLoading && stops.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredStops.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <MapPin className="h-12 w-12 mb-2 opacity-50" />
            <p>Δεν βρέθηκαν στάσεις</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredStops.map((stop) => {
              const avgDelay = getAverageDelay(stop);
              const delayInfo = formatDelay(avgDelay);

              return (
                <div key={stop.stopId} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-primary/20 text-primary rounded-lg flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-mono text-sm font-medium">
                          {stop.stopId}
                        </div>
                        {stop.stopName && (
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {stop.stopName}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {stop.delays.length} ενημερώσεις
                        </div>
                      </div>
                    </div>
                    {delayInfo && (
                      <span className={`text-sm font-medium ${delayInfo.className}`}>
                        {delayInfo.text}
                      </span>
                    )}
                  </div>

                  {stop.delays.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {stop.delays.slice(0, 5).map((delay, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center px-2 py-0.5 bg-muted/50 rounded text-xs font-mono"
                        >
                          {delay.routeId || delay.tripId?.slice(0, 8) || '-'}
                        </span>
                      ))}
                      {stop.delays.length > 5 && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs text-muted-foreground">
                          +{stop.delays.length - 5}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}