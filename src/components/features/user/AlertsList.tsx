import { AlertTriangle, Info, AlertCircle, Clock, ExternalLink, Bus, Ticket, Calendar, MapPin, Bell, BellOff, Trash2, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useStopNotifications } from "@/hooks/useStopNotifications";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { unlockAudio, speakTest } from "@/lib/audio-engine";
import type { Alert, Trip, RouteInfo, Vehicle } from "@/types/gtfs";

interface AlertsListProps {
  alerts: Alert[];
  trips: Trip[];
  vehicles?: Vehicle[];
  routeNamesMap?: Map<string, RouteInfo>;
  isLoading: boolean;
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

const getSeverityInfo = (severity?: string | number) => {
  const s = String(severity || '').toUpperCase();
  switch (s) {
    case 'SEVERE':
    case 'WARNING':
    case '3': // GTFS-RT WARNING
    case '4': // GTFS-RT SEVERE
      return { icon: AlertTriangle, className: 'bg-destructive/20 text-destructive border-destructive/30' };
    case 'INFO':
    case '2': // GTFS-RT INFO
    case 'UNKNOWN':
    default:
      return { icon: Info, className: 'bg-primary/20 text-primary border-primary/30' };
  }
};

const CAUSE_LABELS: Record<string, string> = {
  '1': 'Άγνωστη Αιτία',
  '2': 'Άλλη Αιτία',
  '3': 'Τεχνικό Πρόβλημα',
  '4': 'Απεργία',
  '5': 'Διαδήλωση',
  '6': 'Ατύχημα',
  '7': 'Αργία',
  '8': 'Καιρικές Συνθήκες',
  '9': 'Συντήρηση',
  '10': 'Έργα Οδοποιίας',
  '11': 'Ιατρικό Περιστατικό',
};

const EFFECT_LABELS: Record<string, string> = {
  '1': 'Διακοπή Υπηρεσίας',
  '2': 'Μειωμένη Υπηρεσία',
  '3': 'Σημαντικές Καθυστερήσεις',
  '4': 'Παράκαμψη',
  '5': 'Επιπλέον Υπηρεσία',
  '6': 'Τροποποιημένη Διαδρομή',
  '7': 'Άλλη Επίδραση',
  '8': 'Άγνωστη Επίδραση',
  '9': 'Μετακίνηση Στάσης',
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

export function AlertsList({ alerts, trips, vehicles = [], routeNamesMap, isLoading }: AlertsListProps) {
  // Use the hook for centralized state management
  const {
    notifications: stopNotifications,
    setNotification: updateNotification,
    removeNotification,
    clearAllNotifications,
    forceSync, // Added forceSync
  } = useStopNotifications();

  const { subscribe } = usePushSubscription();

  // Helper to find next arrival for a stop
  const getNextArrivalForStop = (stopId: string) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const arrivals: any[] = [];

    trips.forEach(trip => {
      const updates = trip.stopTimeUpdates;
      if (!updates || !Array.isArray(updates)) return;

      const stu = updates.find(u => u.stopId === stopId);
      if (stu && stu.arrivalTime && stu.arrivalTime > nowSeconds) {
        const vehicle = Array.isArray(vehicles)
          ? vehicles.find(v => v.tripId === trip.tripId || (trip.vehicleId && v.vehicleId === trip.vehicleId))
          : null;

        const routeInfo = routeNamesMap?.get(trip.routeId || '');
        const longName = routeInfo?.route_long_name || '';
        const destination = longName.includes(' - ') ? longName.split(' - ').pop()?.trim() : longName;

        arrivals.push({
          tripId: trip.tripId,
          routeShortName: routeInfo?.route_short_name,
          arrivalTime: stu.arrivalTime,
          minutesUntil: Math.round((stu.arrivalTime - nowSeconds) / 60),
          licensePlate: vehicle?.licensePlate,
          destination: destination || undefined
        });
      }
    });

    return arrivals.sort((a, b) => a.arrivalTime - b.arrivalTime)[0];
  };

  // Toggle notification enabled state
  const toggleNotification = (stopId: string) => {
    const existing = stopNotifications.find(n => n.stopId === stopId);
    if (existing) {
      updateNotification({ ...existing, enabled: !existing.enabled });
    }
  };



  if (isLoading && alerts.length === 0 && trips.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="reminders" className="h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 gap-[0.5rem] px-[1rem] mt-[1rem]">
          <TabsTrigger value="reminders" className="text-[0.75rem] gap-[0.25rem] min-h-[2.75rem]">
            <Bell />
            Υπενθ.
            {stopNotifications.filter(n => n.enabled).length > 0 && (
              <Badge variant="default" className="ml-[0.25rem] h-[1.2rem] px-[0.25rem] text-[0.6rem]">
                {stopNotifications.filter(n => n.enabled).length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="alerts" className="text-[0.75rem] gap-[0.25rem] min-h-[2.75rem]">
            <AlertTriangle />
            Ανακ.
            {alerts.length > 0 && (
              <Badge variant="secondary" className="ml-[0.25rem] h-[1.2rem] px-[0.25rem] text-[0.6rem]">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="info" className="text-[0.75rem] gap-[0.25rem] min-h-[2.75rem]">
            <Info />
            Πληροφ.
          </TabsTrigger>
        </TabsList>

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="flex-1 overflow-auto p-4 space-y-3">
          {stopNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[12rem] text-muted-foreground">
              <Bell className="h-[3rem] w-[3rem] mb-[0.5rem] opacity-50" />
              <p className="font-medium text-[1rem]">Δεν έχετε υπενθυμίσεις</p>
              <p className="text-[0.875rem] text-center px-[1rem]">
                Πατήστε το κουμπί 🔔 σε μια στάση για να λαμβάνετε ειδοποιήσεις όταν πλησιάζει το λεωφορείο
              </p>
            </div>
          ) : (
            <div className="space-y-[1rem]">
              {stopNotifications.map((notification) => {
                const nextArrival = getNextArrivalForStop(notification.stopId);

                return (
                  <div
                    key={notification.stopId}
                    className={`rounded-[1rem] border p-[1rem] animate-fade-in ${notification.enabled
                      ? 'bg-primary/10 border-primary/30'
                      : 'bg-muted/30 border-muted-foreground/20'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-[1rem]">
                      <div className="flex items-start gap-[1rem] flex-1 min-w-0 w-full">
                        <div
                          className={`w-[2.75rem] h-[2.75rem] rounded-[0.75rem] flex items-center justify-center flex-shrink-0 ${notification.enabled
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                            }`}
                        >
                          {notification.enabled ? <Bell /> : <BellOff />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[0.5rem]">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-bold text-[1rem] truncate">{notification.stopName}</h3>
                          </div>

                          {notification.enabled && nextArrival && (
                            <div className="mt-2 p-2 bg-background/50 rounded-lg border border-primary/20">
                              <div className="flex items-center justify-between text-xs font-medium text-primary">
                                <span className="flex items-center gap-1">
                                  <Bus className="h-3 w-3" />
                                  Γραμμή {nextArrival.routeShortName}
                                </span>
                                <span>σε {nextArrival.minutesUntil}λ</span>
                              </div>
                              <div className="mt-1 text-[10px] text-muted-foreground flex flex-col gap-0.5">
                                {nextArrival.destination && (
                                  <div className="flex items-center gap-1">
                                    <span className="opacity-70">Προς:</span>
                                    <span className="font-medium">{nextArrival.destination}</span>
                                  </div>
                                )}
                                {nextArrival.licensePlate && (
                                  <div className="flex items-center gap-1">
                                    <span className="opacity-70">Λεωφορείο:</span>
                                    <span className="font-mono bg-muted px-1 rounded">{nextArrival.licensePlate}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <p className={`text-[0.875rem] mt-[0.25rem] ${notification.enabled ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                            {notification.enabled ? '✓ Ενεργή ειδοποίηση' : 'Απενεργοποιημένη'}
                          </p>
                          <div className="flex flex-wrap items-center gap-[0.5rem] mt-[0.5rem] text-[0.75rem] text-muted-foreground">
                            <span className="bg-muted px-[0.5rem] py-[0.125rem] rounded-full">⏱️ {notification.beforeMinutes}λ</span>
                            {notification.voice && <span title="Φωνή">🗣️</span>}
                            {notification.push && <span title="Push">📲</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex sm:flex-col gap-[0.5rem] w-full sm:w-auto mt-[0.5rem] sm:mt-0 pt-[0.5rem] sm:pt-0 border-t sm:border-t-0 border-border/50">
                        <Button
                          variant={notification.enabled ? "secondary" : "default"}
                          size="sm"
                          className="flex-1 sm:h-[2.5rem] sm:w-[2.5rem] p-0 gap-2"
                          onClick={() => toggleNotification(notification.stopId)}
                        >
                          {notification.enabled ? <BellOff /> : <Bell />}
                          <span className="sm:hidden">{notification.enabled ? 'Κλείσιμο' : 'Άνοιγμα'}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 sm:h-[2.5rem] sm:w-[2.5rem] p-0 text-destructive hover:bg-destructive/10 gap-2"
                          onClick={() => removeNotification(notification.stopId)}
                        >
                          <Trash2 />
                          <span className="sm:hidden">Διαγραφή</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Debug/Tool Footer - Always Visible */}
          <div className="pt-6 border-t border-border/50 flex flex-col items-center gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive gap-2"
                onClick={async () => {
                  if (confirm('ΠΡΟΣΟΧΗ: Αυτό θα διαγράψει ΟΛΕΣ τις ρυθμίσεις και θα κατεβάσει ξανά την εφαρμογή. Είστε σίγουροι;')) {
                    await clearAllNotifications();
                    await subscribe([]);
                    if ('serviceWorker' in navigator) {
                      const regs = await navigator.serviceWorker.getRegistrations();
                      for (const reg of regs) {
                        await reg.unregister();
                      }
                    }
                    setTimeout(() => { forceSync(); }, 100);
                    localStorage.clear();
                    window.location.reload();
                  }
                }}
              >
                <Trash2 className="h-3 w-3" />
                Reset App
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs text-primary hover:text-primary gap-2"
                onClick={() => {
                  toast({
                    title: "🔊 Ενεργοποίηση Φωνής",
                    description: "Γίνεται προσπάθεια ενεργοποίησης...",
                  });
                  unlockAudio();
                  speakTest((status: string) => {
                    if (status === "Finished") {
                      toast({
                        title: "✅ Φωνή Ενεργή",
                        description: "Οι φωνητικές αναγγελίες λειτουργούν!",
                      });
                    } else if (status.startsWith("Error")) {
                      toast({
                        title: "❌ Σφάλμα",
                        description: status,
                        variant: "destructive",
                      });
                    }
                  });
                }}
              >
                <Bell className="h-3 w-3" />
                Ενεργοποίηση Φωνής (iOS Fix)
              </Button>
            </div>
            <Badge variant="outline" className="font-mono text-[0.625rem] text-muted-foreground opacity-50">
              v1.7.3 (MotionAG)
            </Badge>
          </div>
        </TabsContent>

        {/* GTFS Alerts Tab */}
        <TabsContent value="alerts" className="flex-1 overflow-auto p-4 space-y-3">
          {/* Feedback Section - positioned in the middle */}
          <div className="my-6 rounded-lg border bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 p-4">
            <div className="flex items-start gap-4">
              {/* Profile Photo */}
              <div className="flex-shrink-0">
                <img
                  src={`${import.meta.env.BASE_URL}profile-photo.jpg`}
                  alt="Developer"
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary/30 shadow-md bg-primary/20"
                  onError={(e) => {
                    // Try different filename formats
                    const img = e.target as HTMLImageElement;
                    const baseUrl = import.meta.env.BASE_URL || '/';
                    const currentSrc = img.src;

                    if (currentSrc.endsWith('.jpg')) {
                      // Try .png
                      img.src = `${baseUrl}profile-photo.png`;
                      return;
                    }
                    if (currentSrc.endsWith('.png')) {
                      // Try .svg
                      img.src = `${baseUrl}profile-photo.svg`;
                      return;
                    }
                    // Fallback to inline SVG placeholder if none exists
                    img.style.display = 'none';
                    const placeholder = document.createElement('div');
                    placeholder.className = 'w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/30 shadow-md flex items-center justify-center overflow-hidden';
                    placeholder.innerHTML = '<svg class="w-16 h-16" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="32" fill="#6B8E23"/><circle cx="32" cy="24" r="10" fill="white" opacity="0.9"/><path d="M12 54C12 46 20 44 32 44C44 44 52 46 52 54V58H12V54Z" fill="white" opacity="0.9"/></svg>';
                    img.parentNode?.replaceChild(placeholder, img);
                  }}
                />
              </div>

              {/* Feedback Form */}
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Σχόλια & Εισηγήσεις
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Έχετε ιδέες για βελτίωση; Θέλετε να αναφέρετε κάποιο πρόβλημα; Θα χαρούμε να ακούσουμε!
                  </p>
                </div>

                <form
                  className="space-y-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const formData = new FormData(form);
                    const email = formData.get('email') as string;
                    const message = formData.get('message') as string;

                    if (!message || message.trim() === '') {
                      toast({
                        title: "Σφάλμα",
                        description: "Παρακαλώ συμπληρώστε το μήνυμά σας",
                        variant: "destructive",
                      });
                      return;
                    }

                    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
                    const originalButtonContent = submitButton?.innerHTML;

                    try {
                      if (submitButton) {
                        submitButton.disabled = true;
                        submitButton.innerHTML = '<div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>';
                      }

                      const response = await fetch('https://formspree.io/f/xjgknoze', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'Accept': 'application/json',
                        },
                        body: JSON.stringify({
                          email: email?.trim() || undefined,
                          message: message.trim(),
                        }),
                      });

                      if (response.ok) {
                        toast({
                          title: "✅ Επιτυχία!",
                          description: "Το μήνυμά σας στάλθηκε επιτυχώς. Ευχαριστούμε για τα σχόλιά σας!",
                        });
                        form.reset();
                      } else {
                        const data = await response.json().catch(() => ({}));
                        throw new Error(data.error || 'Σφάλμα κατά την αποστολή');
                      }
                    } catch (error) {
                      console.error('Form submission error:', error);
                      toast({
                        title: "Σφάλμα",
                        description: error instanceof Error ? error.message : "Προέκυψε σφάλμα κατά την αποστολή. Παρακαλώ δοκιμάστε ξανά.",
                        variant: "destructive",
                      });
                    } finally {
                      if (submitButton && originalButtonContent) {
                        submitButton.disabled = false;
                        submitButton.innerHTML = originalButtonContent;
                      }
                    }
                  }}
                >
                  <Input
                    type="email"
                    name="email"
                    placeholder="Το email σας (προαιρετικό)"
                    className="text-xs h-9"
                  />
                  <Textarea
                    name="message"
                    placeholder="Γράψτε το σχόλιο ή την εισηγήση σας..."
                    className="text-xs min-h-[80px] resize-none"
                    required
                    rows={4}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="w-full h-8 text-xs gap-2"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Αποστολή
                  </Button>
                </form>
              </div>
            </div>
          </div>

          {/* Alerts List */}
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
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-sm">
                          {alert.headerText || 'Ειδοποίηση'}
                        </h3>
                        {alert.isScraped && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-primary/5 text-primary border-primary/20">
                            Live Scraper
                          </Badge>
                        )}
                      </div>
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
                            {CAUSE_LABELS[String(alert.cause)] || alert.cause}
                          </Badge>
                        )}

                        {alert.effect && (
                          <Badge variant="outline" className="text-xs">
                            {EFFECT_LABELS[String(alert.effect)] || alert.effect}
                          </Badge>
                        )}
                      </div>

                      {!alert.isScraped && alert.informedEntities.length > 0 && (
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
          <p className="text-[0.7rem] text-muted-foreground mt-[0.25rem]">v1.7.7 (Adaptive Phase Complete)</p>
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


    </div >
  );
}