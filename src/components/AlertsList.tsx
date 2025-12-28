import { useMemo } from "react";
import { AlertTriangle, Info, AlertCircle, Clock, ExternalLink, Bus, Ticket, Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Alert, Trip, RouteInfo } from "@/types/gtfs";

interface AlertsListProps {
  alerts: Alert[];
  trips: Trip[];
  routeNamesMap?: Map<string, RouteInfo>;
  isLoading: boolean;
}

interface DelayAlert {
  id: string;
  routeId: string;
  routeName: string;
  routeColor?: string;
  tripId: string;
  delayMinutes: number;
  stopName?: string;
  timestamp: number;
}

// General info for passengers
const GENERAL_INFO = [
  {
    id: 'ticket-info',
    icon: Ticket,
    title: 'Τιμές Εισιτηρίων',
    description: 'Απλό εισιτήριο: €1.50 | Ημερήσιο: €5.00 | Εβδομαδιαίο: €20.00 | Μηνιαίο: €40.00',
    category: 'tickets'
  },
  {
    id: 'schedule-info',
    icon: Calendar,
    title: 'Γενικά Ωράρια',
    description: 'Καθημερινές: 05:30 - 23:00 | Σαββατοκύριακα: 06:00 - 22:00 | Αργίες: Μειωμένα δρομολόγια',
    category: 'schedule'
  },
  {
    id: 'stop-info',
    icon: MapPin,
    title: 'Στάσεις & Πρόσβαση',
    description: 'Οι στάσεις επισημαίνονται με πινακίδα. Σήμανε έγκαιρα στον οδηγό για να σταματήσει.',
    category: 'stops'
  },
  {
    id: 'bus-info',
    icon: Bus,
    title: 'Κανόνες Επιβίβασης',
    description: 'Επιβίβαση από μπροστινή πόρτα. Επικύρωση εισιτηρίου υποχρεωτική. Παραχώρησε θέση σε ΑΜΕΑ.',
    category: 'rules'
  },
];

const getSeverityInfo = (severity?: string) => {
  switch (severity?.toUpperCase()) {
    case 'SEVERE':
    case 'WARNING':
      return { icon: AlertTriangle, className: 'bg-destructive/20 text-destructive border-destructive/30' };
    case 'INFO':
    case 'UNKNOWN':
    default:
      return { icon: Info, className: 'bg-primary/20 text-primary border-primary/30' };
  }
};

const formatPeriod = (start?: number, end?: number) => {
  const formatDate = (ts: number) => {
    const date = new Date(ts * 1000);
    return date.toLocaleString('el-GR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (start && end) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
  if (start) {
    return `Από ${formatDate(start)}`;
  }
  if (end) {
    return `Έως ${formatDate(end)}`;
  }
  return null;
};

export function AlertsList({ alerts, trips, routeNamesMap, isLoading }: AlertsListProps) {
  // Generate delay alerts from live trip data
  const delayAlerts = useMemo(() => {
    const delays: DelayAlert[] = [];
    
    trips.forEach(trip => {
      if (!trip.stopTimeUpdates?.length) return;
      
      // Find significant delays (> 3 minutes)
      trip.stopTimeUpdates.forEach(stu => {
        const delay = stu.arrivalDelay || stu.departureDelay || 0;
        const delayMinutes = Math.round(delay / 60);
        
        if (delayMinutes >= 3) {
          const routeInfo = routeNamesMap?.get(trip.routeId || '');
          delays.push({
            id: `${trip.tripId}-${stu.stopId}`,
            routeId: trip.routeId || '',
            routeName: routeInfo 
              ? `${routeInfo.route_short_name} - ${routeInfo.route_long_name}`
              : trip.routeId || 'Άγνωστη γραμμή',
            routeColor: routeInfo?.route_color,
            tripId: trip.tripId || '',
            delayMinutes,
            stopName: stu.stopId,
            timestamp: trip.timestamp || Date.now() / 1000,
          });
        }
      });
    });
    
    // Sort by delay (highest first) and deduplicate by route
    const uniqueByRoute = new Map<string, DelayAlert>();
    delays
      .sort((a, b) => b.delayMinutes - a.delayMinutes)
      .forEach(d => {
        if (!uniqueByRoute.has(d.routeId) || uniqueByRoute.get(d.routeId)!.delayMinutes < d.delayMinutes) {
          uniqueByRoute.set(d.routeId, d);
        }
      });
    
    return Array.from(uniqueByRoute.values()).slice(0, 10);
  }, [trips, routeNamesMap]);

  if (isLoading && alerts.length === 0 && trips.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalAlerts = alerts.length + delayAlerts.length;

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="delays" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
          <TabsTrigger value="delays" className="text-xs gap-1">
            <Clock className="h-3 w-3" />
            Καθυστερήσεις
            {delayAlerts.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">
                {delayAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-xs gap-1">
            <AlertTriangle className="h-3 w-3" />
            Ανακοινώσεις
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="info" className="text-xs gap-1">
            <Info className="h-3 w-3" />
            Πληροφορίες
          </TabsTrigger>
        </TabsList>

        {/* Delays Tab */}
        <TabsContent value="delays" className="flex-1 overflow-auto p-4 space-y-3">
          {delayAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Clock className="h-12 w-12 mb-2 opacity-50" />
              <p className="font-medium">Όλα τα δρομολόγια στην ώρα τους!</p>
              <p className="text-sm">Δεν υπάρχουν σημαντικές καθυστερήσεις</p>
            </div>
          ) : (
            delayAlerts.map((delay) => (
              <div
                key={delay.id}
                className="rounded-lg border p-3 bg-destructive/10 border-destructive/30 animate-fade-in"
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: delay.routeColor ? `#${delay.routeColor}` : 'hsl(var(--destructive))' }}
                  >
                    <Bus className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{delay.routeName}</h3>
                    </div>
                    <p className="text-destructive font-bold text-lg">
                      +{delay.delayMinutes} λεπτά καθυστέρηση
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ενημέρωση: {new Date(delay.timestamp * 1000).toLocaleTimeString('el-GR')}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* GTFS Alerts Tab */}
        <TabsContent value="alerts" className="flex-1 overflow-auto p-4 space-y-3">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-2 opacity-50" />
              <p className="font-medium">Δεν υπάρχουν ανακοινώσεις</p>
              <p className="text-sm">Όλα λειτουργούν κανονικά</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const severity = getSeverityInfo(alert.severityLevel);
              const Icon = severity.icon;
              const activePeriod = alert.activePeriods[0];

              return (
                <div
                  key={alert.id}
                  className={`rounded-lg border p-4 ${severity.className} animate-fade-in`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">
                        {alert.headerText || 'Ειδοποίηση'}
                      </h3>
                      {alert.descriptionText && (
                        <p className="text-sm mt-1 opacity-90">
                          {alert.descriptionText}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        {activePeriod && (
                          <div className="flex items-center gap-1 text-xs opacity-75">
                            <Clock className="h-3 w-3" />
                            {formatPeriod(activePeriod.start, activePeriod.end)}
                          </div>
                        )}

                        {alert.cause && (
                          <Badge variant="secondary" className="text-xs">
                            {alert.cause}
                          </Badge>
                        )}

                        {alert.effect && (
                          <Badge variant="outline" className="text-xs">
                            {alert.effect}
                          </Badge>
                        )}
                      </div>

                      {alert.informedEntities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {alert.informedEntities.slice(0, 5).map((entity, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 bg-background/50 rounded text-xs font-mono"
                            >
                              {entity.routeId || entity.stopId || entity.agencyId || '-'}
                            </span>
                          ))}
                        </div>
                      )}

                      {alert.url && (
                        <a
                          href={alert.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs mt-2 hover:underline"
                        >
                          Περισσότερα <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* General Info Tab */}
        <TabsContent value="info" className="flex-1 overflow-auto p-4 space-y-3">
          {GENERAL_INFO.map((info) => {
            const Icon = info.icon;
            return (
              <div
                key={info.id}
                className="rounded-lg border p-4 bg-secondary/30 border-border animate-fade-in"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm">{info.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {info.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          
          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xs text-muted-foreground">
              Για περισσότερες πληροφορίες επικοινωνήστε με τον φορέα μεταφορών
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}