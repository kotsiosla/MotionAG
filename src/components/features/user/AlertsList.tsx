import { useState, useEffect } from "react";
import { AlertTriangle, Info, AlertCircle, Clock, ExternalLink, Bus, Ticket, Calendar, MapPin, Bell, BellOff, Trash2, MessageSquare, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useStopNotifications } from "@/hooks/useStopNotifications";
import type { Alert, Trip, RouteInfo } from "@/types/gtfs";

interface StopNotification {
  stopId: string;
  stopName: string;
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  voice: boolean;
  push: boolean;
  beforeMinutes: number;
}

interface AlertsListProps {
  alerts: Alert[];
  trips: Trip[];
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
      hour12: false,
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

export function AlertsList({ alerts, trips, routeNamesMap: _routeNamesMap, isLoading }: AlertsListProps) {
  // Use the hook for centralized state management
  const {
    notifications: stopNotifications,
    setNotification: updateNotification,
    removeNotification,
    clearAllNotifications
  } = useStopNotifications();

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
        <TabsList className="grid w-full grid-cols-3 mx-4 mt-2" style={{ width: 'calc(100% - 2rem)' }}>
          <TabsTrigger value="reminders" className="text-xs gap-1">
            <Bell className="h-3 w-3" />
            Υπενθυμίσεις
            {stopNotifications.filter(n => n.enabled).length > 0 && (
              <Badge variant="default" className="ml-1 h-4 px-1 text-[10px]">
                {stopNotifications.filter(n => n.enabled).length}
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

        {/* Reminders Tab */}
        <TabsContent value="reminders" className="flex-1 overflow-auto p-4 space-y-3">
          {stopNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <Bell className="h-12 w-12 mb-2 opacity-50" />
              <p className="font-medium">Δεν έχετε υπενθυμίσεις</p>
              <p className="text-sm text-center px-4">
                Πατήστε το κουμπί 🔔 σε μια στάση για να λαμβάνετε ειδοποιήσεις όταν πλησιάζει το λεωφορείο
              </p>
            </div>
          ) : (
            <>
              {stopNotifications.map((notification) => (
                <div
                  key={notification.stopId}
                  className={`rounded-lg border p-3 animate-fade-in ${notification.enabled
                    ? 'bg-primary/10 border-primary/30'
                    : 'bg-muted/30 border-muted-foreground/20'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${notification.enabled
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                        }`}
                    >
                      {notification.enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <h3 className="font-medium text-sm truncate">{notification.stopName}</h3>
                      </div>
                      <p className={`text-sm mt-1 ${notification.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                        {notification.enabled ? '✓ Ενεργή ειδοποίηση' : 'Απενεργοποιημένη'}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>⏱️ {notification.beforeMinutes} λεπτά πριν</span>
                        {notification.sound && <span>🔊</span>}
                        {notification.vibration && <span>📳</span>}
                        {notification.voice && <span>🗣️</span>}
                        {notification.push && <span>📲</span>}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => toggleNotification(notification.stopId)}
                        title={notification.enabled ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}
                      >
                        {notification.enabled ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => removeNotification(notification.stopId)}
                        title="Διαγραφή"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-destructive gap-2"
                  onClick={async () => {
                    if (confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε όλες τις ειδοποιήσεις;')) {
                      await clearAllNotifications();
                      window.location.reload();
                    }
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                  Επαναφορά / Διαγραφή Όλων
                </Button>
              </div>
            </>
          )}
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

          <div className="mt-4 p-3 rounded-lg bg-muted/50 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Για περισσότερες πληροφορίες επικοινωνήστε με τον φορέα μεταφορών
            </p>
            <div className="text-[10px] text-gray-300 font-mono text-center opacity-50 pb-safe">
              v1.4.1 (MotionAG) - Robust Mode
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="p-4 space-y-2 pb-safe">
        <button
          onClick={async () => {
            const permission = Notification.permission;
            if (permission !== 'granted') {
              alert('Notification permission: ' + permission + '\nΠρέπει να επιτρέψετε τις ειδοποιήσεις στις ρυθμίσεις!');
              return;
            }

            try {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification('🎉 Ειδοποίηση Δοκιμής', {
                body: 'Αυτό είναι ένα τεστ για v1.4.0!',
                icon: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
                badge: 'https://kotsiosla.github.io/MotionAG/pwa-192x192.png',
                renotify: true,
                tag: 'test-' + Date.now()
              });
              alert('📤 Το αίτημα στάλθηκε στο σύστημα!');
            } catch (e) {
              alert('❌ Error: ' + e);
            }
          }}
          className="w-full bg-blue-600 text-white rounded-lg py-3 font-medium active:scale-95 transition-transform"
        >
          🔔 ΔΟΚΙΜΑΣΤΙΚΗ ΕΙΔΟΠΟΙΗΣΗ (v1.4.0)
        </button>

        <button
          onClick={async () => {
            if (confirm('Θέλεις να κάνεις "Nuclear Reset"; Αυτό θα διαγράψει όλες τις ειδοποιήσεις και θα κάνει refresh.')) {
              try {
                // Clear DB if possible
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const reg of registrations) {
                  const sub = await reg.pushManager.getSubscription();
                  if (sub) await sub.unsubscribe();
                  await reg.unregister();
                }

                // Clear local state
                localStorage.removeItem('push_subscribed_routes');
                localStorage.removeItem('push_subscription_routes');

                // alert('🧼 Καθαρίστηκε! Κάνω refresh...'); // REMOVED BLOCKING ALERT
                console.log('Reset complete, reloading... TS2:' + Date.now());
                window.location.href = window.location.href;
                window.location.reload();
              } catch (e) {
                console.error('Reset error:', e);
                // Force reload anyway
                window.location.href = window.location.href;
              }
            }
          }}
          className="w-full bg-red-600/20 text-red-500 border border-red-500/30 rounded-lg py-3 text-sm active:scale-95 transition-transform"
        >
          ☢️ NUCLEAR RESET (Αν δεν δουλεύει τίποτα)
        </button>

        <p className="text-[10px] text-center text-muted-foreground mt-2 px-4">
          v1.4.0 χρησιμοποιεί Absolute URLs και renotify logic για εγγυημένη εμφάνιση (αν επιτρέπεται από το OS).
        </p>
      </div>
    </div >
  );
}