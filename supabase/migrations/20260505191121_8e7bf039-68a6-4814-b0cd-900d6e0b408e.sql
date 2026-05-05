CREATE TABLE IF NOT EXISTS public.ai_tool_library_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_slug text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_tool_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_slug text NOT NULL,
  category_id uuid REFERENCES public.ai_tool_library_categories(id),
  source_id text NOT NULL,
  is_visible boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_tool_library_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tool_library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on library categories" ON public.ai_tool_library_categories FOR SELECT USING (true);
CREATE POLICY "Allow public read on library items" ON public.ai_tool_library_items FOR SELECT USING (true);
