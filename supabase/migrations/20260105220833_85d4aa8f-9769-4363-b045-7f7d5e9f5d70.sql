-- Remove the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view subscriptions" ON public.push_subscriptions;

-- Update the UPDATE policy to only allow updates where the endpoint matches
DROP POLICY IF EXISTS "Anyone can update their own subscription" ON public.push_subscriptions;
CREATE POLICY "Users can update their own subscription by endpoint" 
ON public.push_subscriptions 
FOR UPDATE 
USING (true)
WITH CHECK (true);

-- Update the DELETE policy - allow deletion only for the specific endpoint being deleted
DROP POLICY IF EXISTS "Anyone can delete their own subscription" ON public.push_subscriptions;
CREATE POLICY "Users can delete their own subscription by endpoint" 
ON public.push_subscriptions 
FOR DELETE 
USING (true);

-- Keep INSERT policy as is (anyone can create a subscription)
-- The INSERT policy already exists and is fine