
-- device_signups: no direct access, managed via RPC
CREATE POLICY "No direct access to device_signups"
  ON public.device_signups
  FOR ALL
  TO authenticated
  USING (false);

-- blacklisted_emails: no direct access, managed via service role
CREATE POLICY "No direct access to blacklisted_emails"
  ON public.blacklisted_emails
  FOR ALL
  TO authenticated
  USING (false);
