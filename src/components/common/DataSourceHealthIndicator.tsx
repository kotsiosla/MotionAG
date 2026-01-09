import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wifi, WifiOff, Activity, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface DataSourceHealth {
  lastSuccess: number;
  lastFailure: number;
  consecutiveFailures: number;
  avgResponseTime: number;
}

interface HealthStatus {
  gtfs: DataSourceHealth;
  siri: DataSourceHealth;
  timestamp: number;
}

const formatLastUpdate = (timestamp: number) => {
  if (!timestamp) return 'Ποτέ';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}δ πριν`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}λ πριν`;
  return `${Math.floor(seconds / 3600)}ω πριν`;
};

export function DataSourceHealthIndicator() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gtfs-proxy/health');
      if (!error && data) {
        setHealth(data as HealthStatus);
      }
    } catch (e) {
      console.error('Failed to fetch health status:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const getSourceStatus = (source: DataSourceHealth | undefined) => {
    if (!source) return { status: 'unknown', color: 'text-muted-foreground' };
    
    const timeSinceSuccess = source.lastSuccess ? Date.now() - source.lastSuccess : Infinity;
    const isRecent = timeSinceSuccess < 60000; // Less than 1 minute
    
    if (source.consecutiveFailures >= 3) {
      return { status: 'error', color: 'text-red-500' };
    }
    if (source.consecutiveFailures > 0 || !isRecent) {
      return { status: 'warning', color: 'text-yellow-500' };
    }
    return { status: 'ok', color: 'text-green-500' };
  };

  const gtfsStatus = getSourceStatus(health?.gtfs);
  const siriStatus = getSourceStatus(health?.siri);

  // Determine overall status
  const overallStatus = gtfsStatus.status === 'error' && siriStatus.status === 'error' 
    ? 'error' 
    : gtfsStatus.status === 'error' || siriStatus.status === 'error'
    ? 'warning'
    : gtfsStatus.status === 'ok' || siriStatus.status === 'ok'
    ? 'ok'
    : 'unknown';

  const StatusIcon = overallStatus === 'ok' ? Activity 
    : overallStatus === 'warning' ? AlertTriangle 
    : overallStatus === 'error' ? WifiOff 
    : Wifi;

  const overallColor = overallStatus === 'ok' ? 'text-green-500' 
    : overallStatus === 'warning' ? 'text-yellow-500' 
    : overallStatus === 'error' ? 'text-red-500' 
    : 'text-muted-foreground';

  if (isLoading) {
    return (
      <div className="flex items-center gap-1">
        <Wifi className="h-3 w-3 text-muted-foreground animate-pulse" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            <StatusIcon className={`h-3 w-3 ${overallColor}`} />
            <div className="flex gap-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${gtfsStatus.status === 'ok' ? 'bg-green-500' : gtfsStatus.status === 'warning' ? 'bg-yellow-500' : gtfsStatus.status === 'error' ? 'bg-red-500' : 'bg-muted'}`} />
              <span className={`w-1.5 h-1.5 rounded-full ${siriStatus.status === 'ok' ? 'bg-green-500' : siriStatus.status === 'warning' ? 'bg-yellow-500' : siriStatus.status === 'error' ? 'bg-red-500' : 'bg-muted'}`} />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs p-2 space-y-1.5">
          <div className="font-semibold mb-1">Κατάσταση Πηγών Δεδομένων</div>
          
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${gtfsStatus.status === 'ok' ? 'bg-green-500' : gtfsStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span>GTFS-RT</span>
            </div>
            <span className="text-muted-foreground">
              {health?.gtfs?.lastSuccess ? formatLastUpdate(health.gtfs.lastSuccess) : 'Αναμονή...'}
            </span>
          </div>
          
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${siriStatus.status === 'ok' ? 'bg-green-500' : siriStatus.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'}`} />
              <span>SIRI</span>
            </div>
            <span className="text-muted-foreground">
              {health?.siri?.lastSuccess ? formatLastUpdate(health.siri.lastSuccess) : 'Αναμονή...'}
            </span>
          </div>
          
          {health?.gtfs?.avgResponseTime ? (
            <div className="text-muted-foreground pt-1 border-t border-border">
              Μ.Ο. απόκρισης: {Math.round(health.gtfs.avgResponseTime)}ms
            </div>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}