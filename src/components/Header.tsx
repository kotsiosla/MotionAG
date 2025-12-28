import { useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, RefreshCw, Menu, X, Download, ChevronUp, ChevronDown } from "lucide-react";
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
import { TripPlanner } from "@/components/TripPlanner";
import type { RouteInfo, StaticStop } from "@/types/gtfs";
import type { FavoriteRoute } from "@/hooks/useFavoriteRoutes";
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
  stops?: StaticStop[];
  stopsLoading?: boolean;
  onTripSearch?: (origin: StaticStop | null, destination: StaticStop | null, departureTime: string, departureDate: Date) => void;
  favorites?: FavoriteRoute[];
  onRemoveFavorite?: (id: string) => void;
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
  stops = [],
  stopsLoading,
  onTripSearch,
  favorites = [],
  onRemoveFavorite,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tripPlannerVisible, setTripPlannerVisible] = useState(() => {
    const saved = localStorage.getItem('tripPlannerVisible');
    return saved !== null ? JSON.parse(saved) : true;
  });

  const toggleTripPlanner = () => {
    const newValue = !tripPlannerVisible;
    setTripPlannerVisible(newValue);
    localStorage.setItem('tripPlannerVisible', JSON.stringify(newValue));
  };
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
      <div className="container mx-auto px-3 sm:px-4 py-2">
        {/* Mobile Header */}
        <div className="flex items-center justify-between gap-2 md:hidden">
          <div className="flex items-center gap-2">
            <img src={motionLogo} alt="Motion Logo" className="h-5" />
            <h1 className="text-sm font-bold tracking-tight">GTFS Realtime</h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Status indicator */}
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-warning animate-pulse' : 'bg-success'}`} />
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`} />
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTripPlanner}
              className="h-8 w-8"
              title={tripPlannerVisible ? "Απόκρυψη αναζήτησης" : "Εμφάνιση αναζήτησης"}
            >
              {tripPlannerVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="h-8 w-8"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            <Link to="/install">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
              >
                <Download className="h-4 w-4" />
              </Button>
            </Link>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-8 w-8"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile Expandable Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-border/50 space-y-3">
            <div className="grid grid-cols-2 gap-2">
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
            
            <div className="flex items-center justify-between">
              {onShowLiveOnlyChange && (
                <div className="flex items-center gap-2">
                  <Switch
                    id="live-only-mobile"
                    checked={showLiveOnly}
                    onCheckedChange={onShowLiveOnlyChange}
                  />
                  <Label htmlFor="live-only-mobile" className="text-xs text-muted-foreground cursor-pointer">
                    Μόνο Live ({liveRoutesCount || 0})
                  </Label>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ανανέωση:</span>
                <Select
                  value={refreshInterval.toString()}
                  onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[60px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5s</SelectItem>
                    <SelectItem value="10">10s</SelectItem>
                    <SelectItem value="20">20s</SelectItem>
                    <SelectItem value="30">30s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {lastUpdate && (
              <div className="text-xs text-muted-foreground text-center">
                Τελ. ενημέρωση: {formatLastUpdate(lastUpdate)}
              </div>
            )}
          </div>
        )}

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between gap-4">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-3">
            <img src={motionLogo} alt="Motion Logo" className="h-6" />
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">GTFS Realtime</h1>
              <span className="text-[10px] text-muted-foreground">Live Tracking</span>
            </div>
          </div>

          {/* Center: Selectors and Live toggle */}
          <div className="flex items-center gap-3">
            <div className="flex flex-col gap-1">
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
            {onShowLiveOnlyChange && (
              <div className="flex items-center gap-2 border-l border-border pl-3">
                <Switch
                  id="live-only-header"
                  checked={showLiveOnly}
                  onCheckedChange={onShowLiveOnlyChange}
                />
                <Label htmlFor="live-only-header" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  Live ({liveRoutesCount || 0})
                </Label>
              </div>
            )}
          </div>

          {/* Right: Refresh, Theme */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <Select
                value={refreshInterval.toString()}
                onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
              >
                <SelectTrigger className="w-[60px] h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5s</SelectItem>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="20">20s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-warning animate-pulse' : 'bg-success'}`} />
                <span className="hidden lg:inline">{formatLastUpdate(lastUpdate)}</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTripPlanner}
              className="h-7 w-7"
              title={tripPlannerVisible ? "Απόκρυψη αναζήτησης" : "Εμφάνιση αναζήτησης"}
            >
              {tripPlannerVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Link to="/install">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Εγκατάσταση εφαρμογής"
              >
                <Download className="h-4 w-4" />
              </Button>
            </Link>
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

        {/* Trip Planner - Collapsible */}
        {tripPlannerVisible && (
          <div className="mt-2 pt-2 border-t border-border/50">
            <TripPlanner 
              stops={stops}
              isLoading={stopsLoading}
              onSearch={onTripSearch}
              favorites={favorites}
              onRemoveFavorite={onRemoveFavorite}
            />
          </div>
        )}
      </div>
    </header>
  );
}