
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can insert installations" ON public.app_installations;

-- Create a more restrictive insert policy
-- Allow inserts but only for new user_agents (deduplicated)
CREATE POLICY "Tracked installs insert" ON public.app_installations FOR INSERT TO anon, authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1 FROM public.app_installations ai
    WHERE ai.user_agent = user_agent
    AND ai.created_at > now() - interval '1 hour'
  )
);
