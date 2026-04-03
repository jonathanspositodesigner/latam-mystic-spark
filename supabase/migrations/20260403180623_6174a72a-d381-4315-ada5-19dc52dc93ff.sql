INSERT INTO public.user_pack_purchases (user_id, pack_slug, payment_status, gateway, plan_type, external_id)
SELECT 'a78dfff1-0e4a-4b46-ae83-c033296019a4', 'upscaller-arcano-v3', 'active', 'manual', 'v3', 'manual-admin-grant-v3-' || gen_random_uuid()::text
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_pack_purchases
  WHERE user_id = 'a78dfff1-0e4a-4b46-ae83-c033296019a4'
    AND pack_slug = 'upscaller-arcano-v3'
    AND payment_status = 'active'
);