-- ============================================
-- Background Notifications – Safe Setup Script
-- Compatible with Supabase Free Tier
-- ============================================

-- 1. Enable pg_net (συνήθως διαθέσιμο)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net;
  RAISE NOTICE 'pg_net extension enabled successfully.';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_net not available on this tier.';
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_net error: %', SQLERRM;
END $$;

-- 2. Try to enable pg_cron (may fail on Free tier)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  RAISE NOTICE 'pg_cron extension enabled successfully.';
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'pg_cron not available – use external scheduler (GitHub Actions).';
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron error: %', SQLERRM;
END $$;

-- 3. Grant permissions (if pg_cron exists)
DO $$
BEGIN
  GRANT USAGE ON SCHEMA cron TO postgres;
  RAISE NOTICE 'Cron schema permissions granted.';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cron schema does not exist or permission error: %', SQLERRM;
END $$;

-- 4. Check if pg_cron exists and schedule job
DO $$
DECLARE
  cron_available BOOLEAN;
  service_role_key text := 'sb_secret_aF18WmQ0BRDKhIYwj_-b9w_AEu4V2R0';
  supabase_url text := 'https://jftthfniwfarxyisszjh.supabase.co';
BEGIN
  -- Check if pg_cron extension exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) INTO cron_available;

  IF cron_available THEN
    RAISE NOTICE '✅ pg_cron is available – scheduling job.';

    -- Check if service role key is configured
    IF service_role_key = 'YOUR_SERVICE_ROLE_KEY_HERE' THEN
      RAISE WARNING '⚠️ Service role key not configured. Please replace YOUR_SERVICE_ROLE_KEY_HERE with your actual key from Settings > API.';
    END IF;

    -- Remove existing job if exists
    BEGIN
      PERFORM cron.unschedule(jobid)
      FROM cron.job
      WHERE jobname = 'check-stop-arrivals';
      RAISE NOTICE 'Removed existing check-stop-arrivals job (if any).';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'No existing job to remove.';
    END;

    -- Schedule job (every 1 minute)
    -- Note: Free tier may not support second-level cron, so we use minute-level
    BEGIN
      PERFORM cron.schedule(
        'check-stop-arrivals',
        '* * * * *', -- Every 1 minute (cron format: minute hour day month weekday)
        'SELECT net.http_post(
          url := ''' || supabase_url || '/functions/v1/check-stop-arrivals'',
          headers := jsonb_build_object(
            ''Authorization'', ''Bearer ' || service_role_key || ''',
            ''Content-Type'', ''application/json''
          ),
          body := ''{}''::jsonb
        );'
      );
      RAISE NOTICE '✅ Cron job scheduled successfully: check-stop-arrivals (every 1 minute)';
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to schedule cron job: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE '❌ pg_cron NOT available – external cron required.';
    RAISE NOTICE '💡 Use GitHub Actions workflow (already configured) or external scheduler.';
  END IF;
END $$;

-- 5. Verify setup
DO $$
DECLARE
  cron_available BOOLEAN;
  job_count INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_extension
    WHERE extname = 'pg_cron'
  ) INTO cron_available;

  IF cron_available THEN
    SELECT COUNT(*) INTO job_count
    FROM cron.job
    WHERE jobname = 'check-stop-arrivals';

    IF job_count > 0 THEN
      RAISE NOTICE '✅ Setup complete! Cron job is scheduled.';
      RAISE NOTICE '📊 Job details:';
      -- Note: Cannot display job details directly in DO block, but job exists
    ELSE
      RAISE WARNING '⚠️ Cron job not found. Check errors above.';
    END IF;
  ELSE
    RAISE NOTICE 'ℹ️ pg_cron not available. Background notifications will use GitHub Actions (every 5 minutes).';
  END IF;
END $$;

