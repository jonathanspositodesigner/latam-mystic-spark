
-- Grant 80k credits and Upscaler V3 access to jonathan@admin.com
INSERT INTO public.upscaler_credit_transactions (user_id, amount, transaction_type, description)
VALUES ('a78dfff1-0e4a-4b46-ae83-c033296019a4', 80000, 'admin_grant', 'Crédito manual de admin (80.000)');

INSERT INTO public.user_pack_purchases (user_id, pack_slug, payment_status, gateway, plan_type, external_id)
SELECT 'a78dfff1-0e4a-4b46-ae83-c033296019a4', 'upscaller-arcano-v3', 'active', 'manual', 'v3', gen_random_uuid()::text
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_pack_purchases
  WHERE user_id = 'a78dfff1-0e4a-4b46-ae83-c033296019a4'
    AND pack_slug = 'upscaller-arcano-v3'
    AND payment_status = 'active'
);
