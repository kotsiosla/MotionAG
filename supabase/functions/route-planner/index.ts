
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { loadAllGTFS, GTFSData } from "./gtfs-loader.ts";
import { RaptorRouter } from "./router.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Singleton to persist data across requests in the same worker instance
let cachedData: GTFSData | null = null;
let router: RaptorRouter | null = null;
let lastLoadTime = 0;
const DATA_TTL = 60 * 60 * 1000; // 1 hour

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const originLat = parseFloat(url.searchParams.get('originLat') || '0');
        const originLon = parseFloat(url.searchParams.get('originLon') || '0');
        const destLat = parseFloat(url.searchParams.get('destLat') || '0');
        const destLon = parseFloat(url.searchParams.get('destLon') || '0');
        const departureTime = url.searchParams.get('departureTime') || '08:00:00';
        const maxTransfers = parseInt(url.searchParams.get('maxTransfers') || '2');
        const walkDistance = parseInt(url.searchParams.get('walkDistance') || '1000');

        console.log(`Route request: (${originLat},${originLon}) -> (${destLat},${destLon}) at ${departureTime}`);

        // Load data if not cached or expired
        if (!cachedData || (Date.now() - lastLoadTime > DATA_TTL)) {
            console.log("Loading GTFS data into memory...");
            cachedData = await loadAllGTFS();
            router = new RaptorRouter(cachedData);
            lastLoadTime = Date.now();
        }

        if (!router) throw new Error("Router not initialized");

        const routes = router.findRoutes(originLat, originLon, destLat, destLon, departureTime, {
            maxTransfers,
            maxWalkingDistance: walkDistance,
            maxWalkingTime: 30, // Default 30 min
        });

        return new Response(
            JSON.stringify({
                data: routes,
                timestamp: Date.now(),
                count: routes.length
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        );

    } catch (error) {
        console.error("Error in route-planner:", error);
        return new Response(
            JSON.stringify({ error: String(error) }),
            {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
        );
    }
});
