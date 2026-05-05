-- ==========================================
-- AI TOOL SETTINGS & LIBRARY TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.ai_tool_settings (
  tool_name TEXT PRIMARY KEY,
  credit_cost INTEGER NOT NULL DEFAULT 60,
  has_api_cost BOOLEAN NOT NULL DEFAULT false,
  api_cost NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_tool_settings ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Settings are publicly viewable') THEN
    CREATE POLICY "Settings are publicly viewable" 
      ON public.ai_tool_settings FOR SELECT 
      USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.ai_tool_library_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tool_slug TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tool_slug, slug)
);

ALTER TABLE public.ai_tool_library_categories ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Categories are publicly viewable') THEN
    CREATE POLICY "Categories are publicly viewable" 
      ON public.ai_tool_library_categories FOR SELECT 
      USING (true);
  END IF;
END $$;

-- ==========================================
-- SEED DATA FOR FLYER MAKER
-- ==========================================

INSERT INTO ai_tool_settings (tool_name, credit_cost, has_api_cost, api_cost) 
VALUES ('Flyer Maker', 100, false, 0)
ON CONFLICT (tool_name) DO UPDATE SET credit_cost = 100;

INSERT INTO ai_tool_library_categories (tool_slug, slug, name)
VALUES 
  ('flyer_maker', 'evento', 'Eventos / Fiestas'),
  ('flyer_maker', 'agenda-de-artista', 'Agenda de Artista'),
  ('flyer_maker', 'contrate', 'Contratá Artista'),
  ('flyer_maker', 'outros-modelos', 'Otros Modelos')
ON CONFLICT (tool_slug, slug) DO UPDATE SET name = EXCLUDED.name;
