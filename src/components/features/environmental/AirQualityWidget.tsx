import React from 'react';
import { useAirQuality } from '@/hooks/useAirQuality';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CloudFog, Wind } from 'lucide-react';

interface AirQualityWidgetProps {
    userLocation?: { lat: number; lng: number } | null;
}

export const AirQualityWidget: React.FC<AirQualityWidgetProps> = ({ userLocation }) => {
    // Default to Limassol/Paphos region if no user location is available yet?
    // Let's use Paphos as default for the demo if null: 34.77, 32.42
    const lat = userLocation?.lat || 34.77;
    const lng = userLocation?.lng || 32.42;

    const { data, loading } = useAirQuality(lat, lng);

    if (loading && !data) return null; // Or skeleton
    if (!data) return null;

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/50 hover:bg-background/80 border border-border/50 transition-colors text-xs font-medium backdrop-blur-md cursor-pointer"
                    title="Ποιότητα Αέρα (Air Quality)"
                >
                    <div className="relative">
                        <CloudFog className="w-3.5 h-3.5 opacity-80" />
                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-background" style={{ backgroundColor: data.color }} />
                    </div>
                    <span className="hidden sm:inline opacity-90">{data.description}</span>
                    <span className="sm:hidden font-mono">{data.aqi}</span>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                            <CloudFog className="w-4 h-4 text-muted-foreground" />
                            Ποιότητα Αέρα
                        </h4>
                        <Badge variant="outline" style={{ borderColor: data.color, color: data.color, backgroundColor: `${data.color}15` }}>
                            EAQI: {data.aqi}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-muted/30 p-2 rounded border border-border/50">
                            <div className="text-muted-foreground text-[10px] uppercase font-bold mb-0.5">PM 2.5</div>
                            <div className="font-mono font-medium flex items-baseline gap-1">
                                {data.pm2_5} <span className="text-[10px] opacity-70">µg/m³</span>
                            </div>
                        </div>
                        <div className="bg-muted/30 p-2 rounded border border-border/50">
                            <div className="text-muted-foreground text-[10px] uppercase font-bold mb-0.5">PM 10</div>
                            <div className="font-mono font-medium flex items-baseline gap-1">
                                {data.pm10} <span className="text-[10px] opacity-70">µg/m³</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-[10px] text-muted-foreground text-center pt-1">
                        Data provided by Open-Meteo
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
