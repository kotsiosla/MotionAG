-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create table for push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  route_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can insert push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can update their own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can delete their own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anyone can view subscriptions" ON public.push_subscriptions;

-- Allow anyone to manage subscriptions (identified by unique endpoint)
CREATE POLICY "Anyone can insert push subscriptions" 
ON public.push_subscriptions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can update their own subscription" 
ON public.push_subscriptions 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete their own subscription" 
ON public.push_subscriptions 
FOR DELETE 
USING (true);

CREATE POLICY "Anyone can view subscriptions" 
ON public.push_subscriptions 
FOR SELECT 
USING (true);

-- Create trigger for automatic timestamp updates
DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for stop notification subscriptions
CREATE TABLE IF NOT EXISTS public.stop_notification_subscriptions (
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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can manage their push subscription" ON public.stop_notification_subscriptions;

-- Allow anyone to insert/update their own subscription (identified by endpoint)
CREATE POLICY "Anyone can manage their push subscription"
ON public.stop_notification_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_stop_notification_subscriptions_endpoint ON public.stop_notification_subscriptions(endpoint);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.stop_notification_subscriptions;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_stop_notification_subscriptions_updated_at ON public.stop_notification_subscriptions;
CREATE TRIGGER update_stop_notification_subscriptions_updated_at
BEFORE UPDATE ON public.stop_notification_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

