CREATE TABLE IF NOT EXISTS public.bug_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  error_key text NOT NULL,
  error_type text,
  error_message text,
  context jsonb,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bug_notif_key_sent ON public.bug_notification_log(error_key, sent_at DESC);
ALTER TABLE public.bug_notification_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bug_notification_log" ON public.bug_notification_log
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete bug_notification_log" ON public.bug_notification_log
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));