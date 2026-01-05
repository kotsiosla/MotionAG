-- Remove the permissive SELECT policy that exposes all subscriptions
DROP POLICY IF EXISTS "Anyone can view subscriptions" ON public.push_subscriptions;