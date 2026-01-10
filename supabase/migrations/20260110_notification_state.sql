-- Create table for strict notification logging
-- This replaces the loose 'last_notified' JSON logic with a rigid audit log
CREATE TABLE IF NOT EXISTS public.notifications_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    subscription_id UUID REFERENCES public.stop_notification_subscriptions(id) ON DELETE CASCADE,
    stop_id TEXT NOT NULL,
    route_id TEXT NOT NULL,
    alert_level INT NOT NULL, -- 10, 5, 2, 1 (minutes threshold)
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb, -- Store vehicle_id, trip_id, source (GTFS/SIRI)
    
    -- Ensure we don't send the same alert level for the same subscription "recently"
    -- But since trips repeat, we need a time-based unique constraint or just logic check.
    -- We will rely on Application Logic to check "sent_at > now() - 20 minutes" for dedupe.
    -- But we can add an index for fast lookup.
    CONSTRAINT notifications_log_sub_level_unique UNIQUE (subscription_id, route_id, alert_level, sent_at) 
    -- Actually, UNIQUE on timestamp is useless. We just need fast index.
);

-- Index for fast lookups during the "Check" loop
CREATE INDEX IF NOT EXISTS idx_notifications_log_lookup 
ON public.notifications_log (subscription_id, route_id, alert_level, sent_at DESC);

-- Cleanup function to auto-delete old logs (keep last 24h)
-- This keeps the table small and queries fast.
CREATE OR REPLACE FUNCTION cleanup_notifications_log()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM public.notifications_log
    WHERE sent_at < NOW() - INTERVAL '24 hours';
END;
$$;

-- Schedule cleanup (if pg_cron is available, otherwise app must call it)
-- We will just let the Edge Function call it occasionally or rely on a separate cron if needed.
