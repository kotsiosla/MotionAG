-- Table to store scraped route alerts
CREATE TABLE IF NOT EXISTS public.route_alerts (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL,
    route_number TEXT,
    gtfs_route_id TEXT,
    alert_text TEXT NOT NULL,
    header_text TEXT,
    active_start BIGINT,
    active_end BIGINT,
    severity TEXT DEFAULT 'WARNING',
    cause TEXT,
    effect TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups by operator and route
CREATE INDEX IF NOT EXISTS idx_route_alerts_operator_route ON public.route_alerts(operator_id, gtfs_route_id);

-- Enable RLS
ALTER TABLE public.route_alerts ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access" ON public.route_alerts
    FOR SELECT USING (true);

-- Allow service role full access
CREATE POLICY "Allow service role full access" ON public.route_alerts
    USING (auth.jwt() ->> 'role' = 'service_role');
