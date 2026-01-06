-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role (required for cron jobs)
GRANT USAGE ON SCHEMA cron TO postgres;

-- Create function to call check-stop-arrivals edge function
CREATE OR REPLACE FUNCTION cron_check_stop_arrivals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  response_status int;
BEGIN
  -- Get Supabase URL and service role key from environment
  -- These should be set in Supabase Dashboard > Settings > Edge Functions > Environment Variables
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Fallback: try to get from function context if available
  IF supabase_url IS NULL OR supabase_url = '' THEN
    -- Use default pattern - will need to be set in Supabase settings
    supabase_url := 'https://mhlyndipnpwpcydjukig.supabase.co';
  END IF;
  
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'Service role key not configured. Set app.settings.service_role_key in Supabase settings.';
    RETURN;
  END IF;
  
  -- Call the edge function using http extension
  -- Note: This requires http extension to be enabled
  -- If http extension is not available, we'll use a different approach
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/check-stop-arrivals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_role_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    -- If http extension not available, log error
    RAISE WARNING 'Could not call check-stop-arrivals: %', SQLERRM;
  END;
END;
$$;

-- Alternative: Use pg_net extension if available (newer Supabase)
-- This is a simpler approach that works with Supabase's built-in http client
CREATE OR REPLACE FUNCTION cron_check_stop_arrivals_v2()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get from environment variables set in Supabase Dashboard
  supabase_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://mhlyndipnpwpcydjukig.supabase.co'
  );
  
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'Service role key not configured in app.settings.service_role_key';
    RETURN;
  END IF;
  
  -- Use pg_net if available (Supabase's built-in HTTP client)
  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/check-stop-arrivals',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || service_role_key,
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error calling check-stop-arrivals: %', SQLERRM;
  END;
END;
$$;

-- Schedule cron job to run every 30 seconds
-- This checks for upcoming arrivals and sends push notifications
SELECT cron.schedule(
  'check-stop-arrivals',
  '*/30 * * * * *', -- Every 30 seconds (cron format: second minute hour day month weekday)
  $$SELECT cron_check_stop_arrivals_v2();$$
);

-- Note: If the above fails, you may need to:
-- 1. Enable pg_net extension: CREATE EXTENSION IF NOT EXISTS pg_net;
-- 2. Set environment variables in Supabase Dashboard:
--    - app.settings.supabase_url = your Supabase URL
--    - app.settings.service_role_key = your service role key
-- 3. Or use the manual approach below

-- Manual setup instructions:
-- 1. Go to Supabase Dashboard > Database > Extensions
-- 2. Enable: pg_cron, pg_net (if available)
-- 3. Go to Settings > Edge Functions > Environment Variables
-- 4. Add: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (these are used by the edge function)
-- 5. Run this SQL to schedule the job:
--    SELECT cron.schedule(
--      'check-stop-arrivals',
--      '*/30 * * * * *',
--      $$SELECT net.http_post(
--        url := 'https://YOUR_PROJECT.supabase.co/functions/v1/check-stop-arrivals',
--        headers := jsonb_build_object('Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'),
--        body := '{}'::jsonb
--      );$$
--    );

