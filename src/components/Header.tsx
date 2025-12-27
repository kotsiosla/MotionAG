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
        {/* Top row: Logo, Title, Designer, Controls */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-3">
            <img src={motionLogo} alt="Motion Logo" className="h-7" />
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight">GTFS Realtime</h1>
              <span className="text-xs text-muted-foreground hidden sm:inline">Live Tracking</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-border">
              <span className="text-xs text-muted-foreground hidden md:inline">by</span>
              <img 
                src={designerPhoto} 
                alt="Designer" 
                className="h-7 w-7 rounded-full object-cover border border-border"
              />
            </div>
          </div>

          {/* Right: Controls */}
          <div className="flex items-center gap-3">
            {/* Operator and Route Selectors */}
            <div className="flex items-center gap-2">
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
              {onShowLiveOnlyChange && (
                <div className="flex items-center gap-1.5 ml-1">
                  <Switch
                    id="live-only"
                    checked={showLiveOnly}
                    onCheckedChange={onShowLiveOnlyChange}
                    className="scale-75"
                  />
                  <Label htmlFor="live-only" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                    Live ({liveRoutesCount || 0})
                  </Label>
                </div>
              )}
            </div>

            {/* Refresh and Theme */}
            <div className="flex items-center gap-2 pl-2 border-l border-border">
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
              <Select
                value={refreshInterval.toString()}
                onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
              >
                <SelectTrigger className="w-[70px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 sec</SelectItem>
                  <SelectItem value="10">10 sec</SelectItem>
                  <SelectItem value="20">20 sec</SelectItem>
                  <SelectItem value="30">30 sec</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleTheme}
                className="h-7 w-7"
              >
                {isDark ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {/* Status indicator */}
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-2 border-l border-border">
                <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-warning animate-pulse' : 'bg-success'}`} />
                <span className="hidden lg:inline">{formatLastUpdate(lastUpdate)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
