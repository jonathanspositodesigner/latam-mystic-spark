
-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- RLS for user_roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- partners table
CREATE TABLE public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage partners" ON public.partners FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- partner_platforms table
CREATE TABLE public.partner_platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.partners(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.partner_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage partner_platforms" ON public.partner_platforms FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- abandoned_checkouts table
CREATE TABLE public.abandoned_checkouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    cpf TEXT,
    product_id INTEGER,
    product_name TEXT,
    offer_name TEXT,
    amount NUMERIC,
    checkout_link TEXT,
    checkout_step INTEGER,
    remarketing_status TEXT DEFAULT 'pending',
    remarketing_email_sent_at TIMESTAMPTZ,
    contacted_at TIMESTAMPTZ,
    notes TEXT,
    abandoned_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.abandoned_checkouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage abandoned_checkouts" ON public.abandoned_checkouts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- push_subscriptions table
CREATE TABLE public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage push_subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- push_notification_templates table
CREATE TABLE public.push_notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.push_notification_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage push_templates" ON public.push_notification_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- app_installations table
CREATE TABLE public.app_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_type TEXT NOT NULL DEFAULT 'unknown',
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.app_installations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read app_installations" ON public.app_installations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can insert installations" ON public.app_installations FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- admin_goals table
CREATE TABLE public.admin_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.admin_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage goals" ON public.admin_goals FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- email_templates table
CREATE TABLE public.email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    sender_name TEXT,
    sender_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage email_templates" ON public.email_templates FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add recovery_email to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recovery_email TEXT;
