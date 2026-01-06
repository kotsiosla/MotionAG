-- Create table for stop notification subscriptions
-- This stores push subscriptions with their stop notification settings
CREATE TABLE public.stop_notification_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  stop_notifications JSONB DEFAULT '[]'::jsonb,
  last_notified JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.stop_notification_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert/update their own subscription (identified by endpoint)
CREATE POLICY "Anyone can manage their push subscription"
ON public.stop_notification_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX idx_stop_notification_subscriptions_endpoint ON public.stop_notification_subscriptions(endpoint);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.stop_notification_subscriptions;

-- Create trigger for updated_at
CREATE TRIGGER update_stop_notification_subscriptions_updated_at
BEFORE UPDATE ON public.stop_notification_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();