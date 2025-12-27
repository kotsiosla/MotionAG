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
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-6">
          {/* Left: Logo and Title with Designer */}
          <div className="flex items-center gap-3 shrink-0">
            <img src={motionLogo} alt="Motion Logo" className="h-7" />
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight leading-none">GTFS Realtime</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground">Live Tracking by</span>
                <img 
                  src={designerPhoto} 
                  alt="Designer" 
                  className="h-5 w-5 rounded-full object-cover ring-1 ring-border"
                />
              </div>
            </div>
          </div>

          {/* Center: Operator Selector */}
          <div className="flex items-center">
            <OperatorSelector
              value={selectedOperator}
              onChange={onOperatorChange}
            />
          </div>

          {/* Route Selector with live count badge */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <RouteSelector
              value={selectedRoute}
              onChange={onRouteChange}
              routes={availableRoutes}
              routeNames={routeNamesMap}
              disabled={selectedOperator === 'all'}
              isLoading={isRoutesLoading}
            />
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-4 shrink-0">
            {/* Refresh interval */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Ανανέωση:</span>
              <Select
                value={refreshInterval.toString()}
                onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
              >
                <SelectTrigger className="w-[65px] h-7 text-xs border-0 bg-transparent p-0 gap-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 sec</SelectItem>
                  <SelectItem value="10">10 sec</SelectItem>
                  <SelectItem value="20">20 sec</SelectItem>
                  <SelectItem value="30">30 sec</SelectItem>
                </SelectContent>
              </Select>
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </div>

            {/* Theme toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="h-7 w-7"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Live only toggle */}
            {onShowLiveOnlyChange && (
              <div className="flex items-center gap-2">
                <Switch
                  id="live-only"
                  checked={showLiveOnly}
                  onCheckedChange={onShowLiveOnlyChange}
                />
                <Label htmlFor="live-only" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  Show live Buses only ({liveRoutesCount || 0})
                </Label>
              </div>
            )}

            {/* Last update */}
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Updated:</span>
                <span className="font-mono">{formatLastUpdate(lastUpdate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
