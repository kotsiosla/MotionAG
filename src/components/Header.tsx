import { Moon, Sun, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OperatorSelector } from "@/components/OperatorSelector";
import { RouteSelector } from "@/components/RouteSelector";
import type { RouteInfo } from "@/types/gtfs";
import motionLogo from "@/assets/motion-logo.svg";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  refreshInterval: number;
  onRefreshIntervalChange: (interval: number) => void;
  lastUpdate: number | null;
  isLoading: boolean;
  selectedOperator: string;
  onOperatorChange: (operator: string) => void;
  selectedRoute: string;
  onRouteChange: (route: string) => void;
  availableRoutes: string[];
  routeNamesMap?: Map<string, RouteInfo>;
  isRoutesLoading?: boolean;
  showLiveOnly?: boolean;
  onShowLiveOnlyChange?: (value: boolean) => void;
  liveRoutesCount?: number;
}

const REFRESH_OPTIONS: Array<{ label: string; value: number }> = [
  { label: "5s", value: 5000 },
  { label: "10s", value: 10000 },
  { label: "30s", value: 30000 },
  { label: "60s", value: 60000 },
];

export function Header({
  isDark,
  onToggleTheme,
  refreshInterval,
  onRefreshIntervalChange,
  lastUpdate,
  isLoading,
  selectedOperator,
  onOperatorChange,
  selectedRoute,
  onRouteChange,
  availableRoutes,
  routeNamesMap,
  isRoutesLoading,
  showLiveOnly,
  onShowLiveOnlyChange,
  liveRoutesCount,
}: HeaderProps) {
  const formatLastUpdate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("el-GR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const refreshValue = String(refreshInterval);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-7xl px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Left: logo + title + filters */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <img src={motionLogo} alt="Motion Logo" className="h-8 w-auto" />
              <div>
                <h1 className="text-lg font-bold tracking-tight">GTFS Realtime</h1>
                <p className="text-xs text-muted-foreground">
                  Τελευταία ενημέρωση: {lastUpdate ? formatLastUpdate(lastUpdate) : "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <OperatorSelector value={selectedOperator} onChange={onOperatorChange} />

              <RouteSelector
                value={selectedRoute}
                onChange={onRouteChange}
                routes={availableRoutes}
                routeNames={routeNamesMap}
                disabled={selectedOperator === "all"}
                isLoading={isRoutesLoading}
              />

              {onShowLiveOnlyChange && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="live-only"
                    checked={!!showLiveOnly}
                    onCheckedChange={onShowLiveOnlyChange}
                  />
                  <Label htmlFor="live-only" className="text-xs text-muted-foreground">
                    Live only ({liveRoutesCount || 0})
                  </Label>
                </div>
              )}
            </div>
          </div>

          {/* Right: refresh interval + theme */}
          <div className="flex items-center gap-3 justify-between lg:justify-end">
            <div className="flex items-center gap-2">
              <RefreshCw className={
                "h-4 w-4 text-muted-foreground" + (isLoading ? " animate-spin" : "")
              } />
              <Select
                value={refreshValue}
                onValueChange={(v) => onRefreshIntervalChange(Number(v))}
              >
                <SelectTrigger className="w-[90px] h-8 text-xs">
                  <SelectValue placeholder="Refresh" />
                </SelectTrigger>
                <SelectContent>
                  {REFRESH_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
