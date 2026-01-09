-- Fix empty stop_notifications field
-- Run this in Supabase SQL Editor

-- First, check what we have
SELECT 
  id,
  endpoint,
  stop_notifications,
  CASE 
    WHEN stop_notifications IS NULL THEN 'NULL'
    WHEN stop_notifications::text = '[]' THEN 'EMPTY ARRAY'
    WHEN jsonb_array_length(stop_notifications) = 0 THEN 'EMPTY ARRAY'
    ELSE 'HAS DATA'
  END as status
FROM public.stop_notification_subscriptions;

-- If you have a row with empty stop_notifications, you can manually update it:
-- Replace 'YOUR_ENDPOINT_HERE' with the actual endpoint from the table
-- Replace the stop_notifications JSON with your actual data

UPDATE public.stop_notification_subscriptions
SET 
  stop_notifications = '[
    {
      "stopId": "2877",
      "stopName": "Ave. Archiepiskopou Makariou C - Promitheos",
      "enabled": true,
      "sound": true,
      "vibration": true,
      "voice": false,
      "push": true,
      "beforeMinutes": 5
    }
  ]'::jsonb,
  updated_at = now()
WHERE endpoint = 'YOUR_ENDPOINT_HERE';

-- Or if you want to update all empty ones:
UPDATE public.stop_notification_subscriptions
SET 
  stop_notifications = '[]'::jsonb,
  updated_at = now()
WHERE stop_notifications IS NULL OR stop_notifications::text = '[]';

-- After update, verify:
SELECT 
  id,
  endpoint,
  stop_notifications,
  jsonb_array_length(stop_notifications) as notification_count
FROM public.stop_notification_subscriptions;

