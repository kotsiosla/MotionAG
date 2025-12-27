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
import designerPhoto from "@/assets/designer-photo.jpeg";

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
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <header className="glass-card border-b sticky top-0 z-50">
      <div className="container mx-auto px-4 py-2">
        {/* Row 1: Logo, Title, Operator, Route */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo and Title with Designer */}
          <div className="flex items-center gap-3">
            <img src={motionLogo} alt="Motion Logo" className="h-6" />
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">GTFS Realtime</h1>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground">Live Tracking by</span>
                <img 
                  src={designerPhoto} 
                  alt="Designer" 
                  className="h-4 w-4 rounded-full object-cover ring-1 ring-border"
                />
              </div>
            </div>
          </div>

          {/* Center: Selectors */}
          <div className="flex items-center gap-3 flex-1 justify-center">
            <OperatorSelector
              value={selectedOperator}
              onChange={onOperatorChange}
            />
            <RouteSelector
              value={selectedRoute}
              onChange={onRouteChange}
              routes={availableRoutes}
              routeNames={routeNamesMap}
              disabled={selectedOperator === 'all'}
              isLoading={isRoutesLoading}
            />
          </div>

          {/* Right: Theme and Refresh icon */}
          <div className="flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="h-7 w-7"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Row 2: Refresh interval, Live toggle, Updated */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
          {/* Left: Refresh interval */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Ανανέωση:</span>
            <Select
              value={refreshInterval.toString()}
              onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
            >
              <SelectTrigger className="w-[70px] h-6 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 sec</SelectItem>
                <SelectItem value="10">10 sec</SelectItem>
                <SelectItem value="20">20 sec</SelectItem>
                <SelectItem value="30">30 sec</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Center: Live only toggle */}
          {onShowLiveOnlyChange && (
            <div className="flex items-center gap-2">
              <Switch
                id="live-only"
                checked={showLiveOnly}
                onCheckedChange={onShowLiveOnlyChange}
              />
              <Label htmlFor="live-only" className="text-xs text-muted-foreground cursor-pointer">
                Show live Buses only ({liveRoutesCount || 0})
              </Label>
            </div>
          )}

          {/* Right: Last update */}
          {lastUpdate && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-warning animate-pulse' : 'bg-success'}`} />
              <span>Updated: {formatLastUpdate(lastUpdate)}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
