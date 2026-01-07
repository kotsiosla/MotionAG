-- Setup Cron Job for Background Notifications
-- Run this in Supabase Dashboard > Database > SQL Editor

-- Step 1: Enable extensions (if available)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;

-- Step 3: Create function to call check-stop-arrivals
CREATE OR REPLACE FUNCTION cron_check_stop_arrivals_v2()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Hardcoded values (replace with your actual values)
  supabase_url := 'https://jftthfniwfarxyisszjh.supabase.co';
  
  -- IMPORTANT: Replace YOUR_SERVICE_ROLE_KEY_HERE with your actual service role key
  -- Get it from: Supabase Dashboard > Settings > API > service_role key
  service_role_key := 'YOUR_SERVICE_ROLE_KEY_HERE';
  
  IF service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
    RAISE WARNING 'Service role key not configured. Please replace YOUR_SERVICE_ROLE_KEY_HERE with your actual key.';
    RETURN;
  END IF;
  
  -- Use pg_net to call the edge function
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

-- Step 4: Schedule cron job (every 30 seconds)
-- Note: This will fail if pg_cron is not available
SELECT cron.schedule(
  'check-stop-arrivals',
  '*/30 * * * * *', -- Every 30 seconds
  $$SELECT cron_check_stop_arrivals_v2();$$
);

-- Step 5: Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'check-stop-arrivals';


