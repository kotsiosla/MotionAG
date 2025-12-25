import { AlertTriangle, Info, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Alert } from "@/types/gtfs";

interface AlertsListProps {
  alerts: Alert[];
  isLoading: boolean;
}

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

export function AlertsList({ alerts, isLoading }: AlertsListProps) {
  if (isLoading && alerts.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <AlertCircle className="h-12 w-12 mb-2 opacity-50" />
        <p>Δεν υπάρχουν ενεργές ειδοποιήσεις</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 overflow-auto scrollbar-thin">
      <div className="text-sm text-muted-foreground mb-2">
        {alerts.length} ειδοποιήσεις
      </div>

      {alerts.map((alert) => {
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
      })}
    </div>
  );
}