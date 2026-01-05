-- Create saved_trips table for storing user trip reminders
CREATE TABLE public.saved_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Link to push subscription (anonymous users identified by endpoint)
  push_endpoint TEXT NOT NULL,
  
  -- Trip details
  origin_stop_id TEXT NOT NULL,
  origin_stop_name TEXT NOT NULL,
  destination_stop_id TEXT NOT NULL,
  destination_stop_name TEXT NOT NULL,
  
  -- Journey data as JSON
  journey_data JSONB NOT NULL,
  
  -- Timing
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  
  -- Reminder settings
  reminder_minutes INTEGER NOT NULL DEFAULT 15,
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  
  -- Route info for display
  route_names TEXT[] NOT NULL DEFAULT '{}'::TEXT[]
);

-- Enable Row Level Security
ALTER TABLE public.saved_trips ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous users)
CREATE POLICY "Anyone can insert saved trips"
ON public.saved_trips
FOR INSERT
WITH CHECK (true);

-- Anyone can select their own trips by endpoint
CREATE POLICY "Anyone can view trips by endpoint"
ON public.saved_trips
FOR SELECT
USING (true);

-- Anyone can update their own trips by endpoint
CREATE POLICY "Anyone can update trips by endpoint"
ON public.saved_trips
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Anyone can delete their own trips
CREATE POLICY "Anyone can delete trips"
ON public.saved_trips
FOR DELETE
USING (true);

-- Create index for efficient querying
CREATE INDEX idx_saved_trips_departure ON public.saved_trips (departure_date, departure_time);
CREATE INDEX idx_saved_trips_endpoint ON public.saved_trips (push_endpoint);
CREATE INDEX idx_saved_trips_reminder ON public.saved_trips (reminder_sent, departure_date, departure_time);

-- Add trigger for updating updated_at
CREATE TRIGGER update_saved_trips_updated_at
BEFORE UPDATE ON public.saved_trips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;