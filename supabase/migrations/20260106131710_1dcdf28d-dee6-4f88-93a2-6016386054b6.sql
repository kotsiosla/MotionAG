-- Drop existing policies and recreate with proper permissions
DROP POLICY IF EXISTS "Anyone can insert push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscription by endpoint" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscription by endpoint" ON public.push_subscriptions;

-- Create a single ALL policy for simplicity (public table, no auth required)
CREATE POLICY "Anyone can manage push subscriptions"
ON public.push_subscriptions
FOR ALL
USING (true)
WITH CHECK (true);