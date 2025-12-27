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
      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center justify-between">
          {/* Left: Logo, Title and Designer */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img src={motionLogo} alt="Motion Logo" className="h-6" />
              <div>
                <h1 className="text-base font-bold tracking-tight leading-none">GTFS Realtime</h1>
                <span className="text-[10px] text-muted-foreground">Live Tracking</span>
              </div>
            </div>
            <div className="h-6 w-px bg-border" />
            <img 
              src={designerPhoto} 
              alt="Designer" 
              className="h-6 w-6 rounded-full object-cover ring-1 ring-border"
            />
          </div>

          {/* Center: Selectors */}
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
          </div>

          {/* Right: Live toggle, Refresh, Theme, Status */}
          <div className="flex items-center gap-3">
            {onShowLiveOnlyChange && (
              <div className="flex items-center gap-1.5">
                <Switch
                  id="live-only"
                  checked={showLiveOnly}
                  onCheckedChange={onShowLiveOnlyChange}
                  className="scale-75"
                />
                <Label htmlFor="live-only" className="text-[10px] text-muted-foreground cursor-pointer">
                  Live ({liveRoutesCount || 0})
                </Label>
              </div>
            )}

            <div className="h-5 w-px bg-border" />

            <div className="flex items-center gap-1.5">
              <RefreshCw className={`h-3 w-3 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
              <Select
                value={refreshInterval.toString()}
                onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
              >
                <SelectTrigger className="w-[60px] h-6 text-[10px] px-2">
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

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="h-6 w-6"
            >
              {isDark ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
            </Button>

            {lastUpdate && (
              <>
                <div className="h-5 w-px bg-border" />
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <div className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-warning animate-pulse' : 'bg-success'}`} />
                  <span>{formatLastUpdate(lastUpdate)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
