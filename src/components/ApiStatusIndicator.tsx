import { useState, useEffect } from "react";
import { Wifi, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ApiStatusIndicatorProps {
  isError: boolean;
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
  lastSuccessfulUpdate?: number;
  retryCountdown?: number;
}

export function ApiStatusIndicator({
  isError,
  isLoading,
  errorMessage,
  onRetry,
  lastSuccessfulUpdate,
  retryCountdown,
}: ApiStatusIndicatorProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = () => {
    setIsRetrying(true);
    onRetry();
    setTimeout(() => setIsRetrying(false), 2000);
  };

  const getTimeSinceUpdate = () => {
    if (!lastSuccessfulUpdate) return null;
    const seconds = Math.floor((Date.now() - lastSuccessfulUpdate) / 1000);
    if (seconds < 60) return `${seconds}δ πριν`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}λ πριν`;
    const hours = Math.floor(minutes / 60);
    return `${hours}ω πριν`;
  };

  if (!isError && !isLoading) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
            <Wifi className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs text-emerald-500 font-medium">Online</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Σύνδεση με GTFS API ενεργή</p>
          {lastSuccessfulUpdate && (
            <p className="text-muted-foreground text-xs">
              Τελευταία ενημέρωση: {getTimeSinceUpdate()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  if (isLoading && !isError) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
        <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
        <span className="text-xs text-primary font-medium">Φόρτωση...</span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-destructive/10 border border-destructive/20">
            <WifiOff className="h-3.5 w-3.5 text-destructive" />
            <span className="text-xs text-destructive font-medium">Offline</span>
            {retryCountdown !== undefined && retryCountdown > 0 && (
              <span className="text-xs text-destructive/70">({retryCountdown}δ)</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={handleRetry}
            disabled={isRetrying || isLoading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", (isRetrying || isLoading) && "animate-spin")} />
          </Button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium text-destructive">Αποτυχία σύνδεσης με GTFS API</p>
          {errorMessage && (
            <p className="text-xs text-muted-foreground">{errorMessage}</p>
          )}
          {lastSuccessfulUpdate && (
            <p className="text-xs text-muted-foreground">
              Τελευταία επιτυχής ενημέρωση: {getTimeSinceUpdate()}
            </p>
          )}
          {retryCountdown !== undefined && retryCountdown > 0 && (
            <p className="text-xs text-muted-foreground">
              Αυτόματη επανάληψη σε {retryCountdown} δευτερόλεπτα
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
