import { useState } from "react";
import { Link } from "react-router-dom";
import { Moon, Sun, Menu, X, Download, ChevronUp, ChevronDown, Bookmark } from "lucide-react";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationButton } from "@/components/features/user/NotificationButton";
import { ApiStatusIndicator } from "@/components/common/ApiStatusIndicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OperatorSelector } from "@/components/common/OperatorSelector";
import { RouteSelector } from "@/components/features/routes/RouteSelector";
import { SmartTripPlanner } from "@/components/features/planning/SmartTripPlanner";
import { AnimatedLogo } from "@/components/common/AnimatedLogo";
import type { RouteInfo, StaticStop } from "@/types/gtfs";
import type { FavoriteRoute } from "@/hooks/useFavoriteRoutes";
import type { OptimizationPreference } from "@/hooks/useSmartTripPlan";

interface LocationInfo {
  lat: number;
  lon: number;
  name: string;
}

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
  onTripSearch?: (
    origin: StaticStop | null,
    destination: StaticStop | null,
    departureTime: string,
    departureDate: Date,
    originLocation?: LocationInfo,
    destLocation?: LocationInfo,
    options?: {
      maxWalkingDistance: number;
      maxTransfers: number;
      preference: OptimizationPreference;
      includeNightBuses: boolean;
    }
  ) => void;
  favorites?: FavoriteRoute[];
  onRemoveFavorite?: (id: string) => void;
  delayNotificationsEnabled?: boolean;
  onToggleDelayNotifications?: () => void;
  // API Status props
  hasApiError?: boolean;
  apiErrorMessage?: string;
  onApiRetry?: () => void;
  retryCountdown?: number;
  isUsingCachedData?: boolean;
  onOpenSavedTrips?: () => void;
  savedTripsCount?: number;
  // External state for synchronization
  tripOrigin?: StaticStop | null;
  tripDestination?: StaticStop | null;
  tripDepartureTime?: string;
  tripDepartureDate?: Date;
  maxWalkingDistance?: number;
  maxTransfers?: number;
  optimizationPreference?: OptimizationPreference;
  includeNightBuses?: boolean;
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
  hasApiError = false,
  apiErrorMessage,
  onApiRetry,
  retryCountdown,
  isUsingCachedData = false,
  onOpenSavedTrips,
  savedTripsCount = 0,
  tripOrigin,
  tripDestination,
  tripDepartureTime,
  tripDepartureDate,
  maxWalkingDistance,
  maxTransfers,
  optimizationPreference,
  includeNightBuses,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [tripPlannerVisible, setTripPlannerVisible] = useState(() => {
    try {
      const saved = localStorage.getItem('tripPlannerVisible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleTripPlanner = () => {
    const newValue = !tripPlannerVisible;
    setTripPlannerVisible(newValue);
    localStorage.setItem('tripPlannerVisible', JSON.stringify(newValue));
  };
  const formatLastUpdate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('el-GR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  return (
    <header className="glass-card border-b sticky top-0 z-50 safe-area-top flex-shrink-0">
      <div className="container mx-auto px-2 sm:px-4 py-1.5 sm:py-2">
        {/* Mobile Header - Compact single-row layout v2.0.0 */}
        <div className="flex items-center justify-between gap-[0.375rem] md:hidden">
          <div className="flex items-center gap-[0.25rem] flex-shrink-0">
            <AnimatedLogo height="1rem" className="h-auto" />
            <Badge variant="outline" className="px-2 py-0 h-6 text-[10px] font-mono border-zinc-700/50 text-emerald-400 bg-emerald-500/10 gap-1.5 shadow-[0_0_10px_-3px_rgba(52,211,153,0.3)] backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_3s_ease-in-out_infinite]" />
              v1.7.10
            </Badge>
          </div>

          <div className="flex items-center justify-end gap-[0.125rem] overflow-x-auto no-scrollbar">
            {/* API Status indicator - Minimal */}
            <ApiStatusIndicator
              isError={hasApiError}
              isLoading={isLoading}
              errorMessage={apiErrorMessage}
              onRetry={onApiRetry || (() => { })}
              lastSuccessfulUpdate={lastUpdate || undefined}
              retryCountdown={retryCountdown}
              isUsingCachedData={isUsingCachedData}
            />

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTripPlanner}
              className="w-[2.5rem] h-[2.5rem]"
              title={tripPlannerVisible ? "Απόκρυψη αναζήτησης" : "Εμφάνιση αναζήτησης"}
            >
              {tripPlannerVisible ? <ChevronUp className="h-[1.25em] w-[1.25em]" /> : <ChevronDown className="h-[1.25em] w-[1.25em]" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTheme}
              className="w-[2.5rem] h-[2.5rem]"
            >
              {isDark ? <Sun className="h-[1.25em] w-[1.25em]" /> : <Moon className="h-[1.25em] w-[1.25em]" />}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSavedTrips}
              className="w-[2.5rem] h-[2.5rem] relative"
              title="Οι διαδρομές μου"
            >
              <Bookmark className="h-[1.25em] w-[1.25em]" />
              {savedTripsCount > 0 && (
                <span className="absolute top-[0.375rem] right-[0.375rem] h-[0.875rem] w-[0.875rem] rounded-full bg-primary text-[0.55rem] text-primary-foreground flex items-center justify-center font-bold">
                  {savedTripsCount}
                </span>
              )}
            </Button>

            <div className="flex items-center">
              <NotificationButton />
            </div>

            <Link to="/install">
              <Button
                variant="ghost"
                size="icon"
                className="w-[2.5rem] h-[2.5rem]"
              >
                <Download className="h-[1.25em] w-[1.25em]" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-[2.5rem] h-[2.5rem]"
            >
              {mobileMenuOpen ? <X className="h-[1.25em] w-[1.25em]" /> : <Menu className="h-[1.25em] w-[1.25em]" />}
            </Button>
          </div>
        </div>

        {/* Mobile Expandable Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-[1rem] pt-[1rem] border-t border-border/50 space-y-[1rem]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-[1rem]">
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

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-[1rem]">
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-[0.5rem]">
                  <h1 className="text-[1.1rem] sm:text-[1.25rem] font-black tracking-tight text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                    Motion <span className="text-primary hidden xs:inline">GTFS</span>
                  </h1>
                  <div className="hidden xs:flex items-center gap-[0.25rem] px-[0.5rem] py-[0.125rem] bg-green-500/10 border border-green-500/20 rounded-full">
                    <div className="w-[0.5rem] h-[0.5rem] bg-green-500 rounded-full animate-pulse" />
                    <span className="text-[0.625rem] font-bold text-green-600 uppercase tracking-wider">Live</span>
                  </div>
                </div>
                <p className="text-[0.6rem] sm:text-[0.7rem] text-muted-foreground font-medium flex items-center gap-[0.25rem] whitespace-nowrap">
                  <span className="hidden sm:inline">Cyprus</span> Public Transport <span className="text-primary/70 font-bold ml-auto">v1.7.10</span>
                </p>
              </div>
              {onShowLiveOnlyChange && (
                <div className="flex items-center justify-between gap-[0.5rem]">
                  <Label htmlFor="live-only-mobile" className="text-[0.75rem] text-muted-foreground cursor-pointer">
                    Μόνο Live ({liveRoutesCount || 0})
                  </Label>
                  <Switch
                    id="live-only-mobile"
                    checked={showLiveOnly}
                    onCheckedChange={onShowLiveOnlyChange}
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-[0.5rem]">
                <span className="text-[0.75rem] text-muted-foreground">Ανανέωση:</span>
                <Select
                  value={refreshInterval.toString()}
                  onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
                >
                  <SelectTrigger className="w-[5rem] h-[2.75rem] text-[0.75rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3s</SelectItem>
                    <SelectItem value="5">5s</SelectItem>
                    <SelectItem value="10">10s</SelectItem>
                    <SelectItem value="15">15s</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {lastUpdate && (
              <div className="text-[0.75rem] text-muted-foreground text-center">
                Τελ. ενημέρωση: {formatLastUpdate(lastUpdate)}
              </div>
            )}
          </div>
        )}

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between gap-4">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-3">
            <AnimatedLogo height="1.5rem" />
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
              <div className="flex items-center gap-2 border-l border-border pl-4">
                <div className="flex items-center gap-1.5">
                  <Switch
                    id="live-only-header"
                    checked={showLiveOnly}
                    onCheckedChange={onShowLiveOnlyChange}
                    className="data-[state=checked]:bg-emerald-500"
                  />
                  <Label htmlFor="live-only-header" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground cursor-pointer whitespace-nowrap">
                    Live ({liveRoutesCount || 0})
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Right: API Status, Refresh, Theme */}
          <div className="flex items-center gap-2">
            {/* API Status Indicator */}
            <ApiStatusIndicator
              isError={hasApiError}
              isLoading={isLoading}
              errorMessage={apiErrorMessage}
              onRetry={onApiRetry || (() => { })}
              lastSuccessfulUpdate={lastUpdate || undefined}
              retryCountdown={retryCountdown}
              isUsingCachedData={isUsingCachedData}
            />

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-l border-border pl-2">
              <Select
                value={refreshInterval.toString()}
                onValueChange={(value) => onRefreshIntervalChange(parseInt(value))}
              >
                <SelectTrigger className="w-[60px] h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3s</SelectItem>
                  <SelectItem value="5">5s</SelectItem>
                  <SelectItem value="10">10s</SelectItem>
                  <SelectItem value="15">15s</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTripPlanner}
              className="h-7 w-7"
              title={tripPlannerVisible ? "Απόκρυψη αναζήτησης" : "Εμφάνιση αναζήτησης"}
            >
              {tripPlannerVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            {/* Saved trips button - Desktop */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSavedTrips}
              className="h-7 w-7 relative"
              title="Οι διαδρομές μου"
            >
              <Bookmark className="h-4 w-4" />
              {savedTripsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center">
                  {savedTripsCount}
                </span>
              )}
            </Button>
            {/* Push Notifications button - Desktop */}
            <NotificationButton />
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

        {/* Trip Planner - Collapsible with animation */}
        <Collapsible open={tripPlannerVisible} onOpenChange={setTripPlannerVisible}>
          <CollapsibleContent className="mt-2 pt-2 border-t border-border/50">
            <SmartTripPlanner
              stops={stops}
              isLoading={stopsLoading}
              onSearch={onTripSearch}
              favorites={favorites}
              onRemoveFavorite={onRemoveFavorite}
              initialOrigin={tripOrigin}
              initialDestination={tripDestination}
              initialDepartureTime={tripDepartureTime}
              initialDepartureDate={tripDepartureDate}
              initialMaxWalkingDistance={maxWalkingDistance}
              initialMaxTransfers={maxTransfers}
              initialOptimizationPreference={optimizationPreference}
              initialIncludeNightBuses={includeNightBuses}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </header>
  );
}