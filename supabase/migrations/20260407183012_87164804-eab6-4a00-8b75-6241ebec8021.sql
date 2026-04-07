
-- Investment theses
CREATE TABLE IF NOT EXISTS public.investment_theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  buy_rationale text,
  risks text,
  catalysts text,
  target_price numeric,
  status text NOT NULL DEFAULT 'active',
  next_review_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.investment_theses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own theses" ON public.investment_theses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own theses" ON public.investment_theses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own theses" ON public.investment_theses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own theses" ON public.investment_theses FOR DELETE USING (auth.uid() = user_id);

-- Thesis versions for history
CREATE TABLE IF NOT EXISTS public.thesis_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thesis_id uuid NOT NULL,
  user_id uuid NOT NULL,
  buy_rationale text,
  risks text,
  catalysts text,
  target_price numeric,
  status text,
  version_date timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.thesis_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own thesis_versions" ON public.thesis_versions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own thesis_versions" ON public.thesis_versions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User alerts
CREATE TABLE IF NOT EXISTS public.user_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  alert_type text NOT NULL,
  threshold numeric NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  is_triggered boolean NOT NULL DEFAULT false,
  last_triggered_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.user_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own alerts" ON public.user_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own alerts" ON public.user_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alerts" ON public.user_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alerts" ON public.user_alerts FOR DELETE USING (auth.uid() = user_id);

-- Add UPDATE policy to watchlist_items (was missing)
CREATE POLICY "Users can update own watchlist items" ON public.watchlist_items FOR UPDATE USING (auth.uid() = user_id);
