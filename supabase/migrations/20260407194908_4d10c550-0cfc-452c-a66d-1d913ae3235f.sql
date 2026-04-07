
-- Add welcome email tracking column
ALTER TABLE public.user_pack_purchases 
ADD COLUMN IF NOT EXISTS welcome_email_sent boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamp with time zone DEFAULT NULL;
