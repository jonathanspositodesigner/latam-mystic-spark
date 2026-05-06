ALTER TABLE public.upscaler_credit_transactions 
ADD COLUMN IF NOT EXISTS balance_after INTEGER,
ADD COLUMN IF NOT EXISTS credit_type TEXT;

-- Update existing records if possible (not much we can do for balance_after retrospectively)
UPDATE public.upscaler_credit_transactions SET credit_type = 'lifetime' WHERE credit_type IS NULL;
