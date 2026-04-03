
-- Table: admin_artes
CREATE TABLE public.admin_artes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  pack TEXT,
  image_url TEXT NOT NULL,
  download_url TEXT,
  is_premium BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  tutorial_url TEXT,
  bonus_clicks INTEGER DEFAULT 0,
  canva_link TEXT,
  drive_link TEXT,
  motion_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage admin_artes" ON public.admin_artes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active admin_artes" ON public.admin_artes FOR SELECT TO anon, authenticated USING (is_active = true);

-- Table: partner_artes
CREATE TABLE public.partner_artes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  image_url TEXT NOT NULL,
  partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE,
  approved BOOLEAN DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  rejected BOOLEAN DEFAULT false,
  rejected_at TIMESTAMPTZ,
  rejected_by UUID,
  deletion_requested BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  tutorial_url TEXT,
  bonus_clicks INTEGER DEFAULT 0,
  canva_link TEXT,
  drive_link TEXT,
  pack TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage partner_artes" ON public.partner_artes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read approved partner_artes" ON public.partner_artes FOR SELECT TO anon, authenticated USING (approved = true);

-- Table: artes_banners
CREATE TABLE public.artes_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  button_text TEXT DEFAULT 'Saiba mais',
  button_link TEXT NOT NULL,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage artes_banners" ON public.artes_banners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active banners" ON public.artes_banners FOR SELECT TO anon, authenticated USING (is_active = true);

-- Table: artes_categories
CREATE TABLE public.artes_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  platform TEXT DEFAULT 'artes-eventos',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage artes_categories" ON public.artes_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active categories" ON public.artes_categories FOR SELECT TO anon, authenticated USING (is_active = true);

-- Table: artes_packs
CREATE TABLE public.artes_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  cover_url TEXT,
  display_order INTEGER DEFAULT 0,
  type TEXT DEFAULT 'pack',
  is_visible BOOLEAN DEFAULT true,
  price_6_meses INTEGER,
  price_1_ano INTEGER,
  price_vitalicio INTEGER,
  enabled_6_meses BOOLEAN DEFAULT true,
  enabled_1_ano BOOLEAN DEFAULT true,
  enabled_vitalicio BOOLEAN DEFAULT true,
  checkout_link_6_meses TEXT,
  checkout_link_1_ano TEXT,
  checkout_link_vitalicio TEXT,
  checkout_link_renovacao_6_meses TEXT,
  checkout_link_renovacao_1_ano TEXT,
  checkout_link_renovacao_vitalicio TEXT,
  checkout_link_membro_6_meses TEXT,
  checkout_link_membro_1_ano TEXT,
  checkout_link_membro_vitalicio TEXT,
  download_url TEXT,
  tutorial_lessons JSONB,
  greenn_product_id_6_meses INTEGER,
  greenn_product_id_1_ano INTEGER,
  greenn_product_id_order_bump INTEGER,
  greenn_product_id_vitalicio INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage artes_packs" ON public.artes_packs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read visible packs" ON public.artes_packs FOR SELECT TO anon, authenticated USING (is_visible = true);

-- Table: user_pack_purchases
CREATE TABLE public.user_pack_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pack_id UUID REFERENCES public.artes_packs(id) ON DELETE SET NULL,
  pack_slug TEXT,
  amount NUMERIC,
  payment_status TEXT DEFAULT 'active',
  gateway TEXT,
  plan_type TEXT,
  expires_at TIMESTAMPTZ,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage user_pack_purchases" ON public.user_pack_purchases FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own purchases" ON public.user_pack_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Table: premium_artes_users
CREATE TABLE public.premium_artes_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_type TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  payment_gateway TEXT,
  external_id TEXT,
  pack_slug TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage premium_artes_users" ON public.premium_artes_users FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own premium status" ON public.premium_artes_users FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Table: webhook_logs
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  status TEXT,
  payload JSONB,
  source TEXT,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage webhook_logs" ON public.webhook_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Service insert webhook_logs" ON public.webhook_logs FOR INSERT TO anon WITH CHECK (true);

-- Table: leads
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  notes TEXT,
  status TEXT DEFAULT 'new',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE POLICY "Admins manage leads" ON public.leads FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public insert leads" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-artes', 'admin-artes', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('partner-artes', 'partner-artes', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('pack-covers', 'pack-covers', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Public read admin-artes" ON storage.objects FOR SELECT USING (bucket_id = 'admin-artes');
CREATE POLICY "Admin upload admin-artes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'admin-artes');
CREATE POLICY "Admin update admin-artes" ON storage.objects FOR UPDATE USING (bucket_id = 'admin-artes');
CREATE POLICY "Admin delete admin-artes" ON storage.objects FOR DELETE USING (bucket_id = 'admin-artes');

CREATE POLICY "Public read partner-artes" ON storage.objects FOR SELECT USING (bucket_id = 'partner-artes');
CREATE POLICY "Auth upload partner-artes" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'partner-artes');
CREATE POLICY "Auth update partner-artes" ON storage.objects FOR UPDATE USING (bucket_id = 'partner-artes');
CREATE POLICY "Auth delete partner-artes" ON storage.objects FOR DELETE USING (bucket_id = 'partner-artes');

CREATE POLICY "Public read pack-covers" ON storage.objects FOR SELECT USING (bucket_id = 'pack-covers');
CREATE POLICY "Admin upload pack-covers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pack-covers');
CREATE POLICY "Admin update pack-covers" ON storage.objects FOR UPDATE USING (bucket_id = 'pack-covers');
CREATE POLICY "Admin delete pack-covers" ON storage.objects FOR DELETE USING (bucket_id = 'pack-covers');
