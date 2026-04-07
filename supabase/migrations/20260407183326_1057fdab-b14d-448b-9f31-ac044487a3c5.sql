
-- Journal notes
CREATE TABLE IF NOT EXISTS public.journal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid,
  trade_id uuid,
  title text NOT NULL,
  content text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.journal_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own journal_notes" ON public.journal_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal_notes" ON public.journal_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal_notes" ON public.journal_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal_notes" ON public.journal_notes FOR DELETE USING (auth.uid() = user_id);

-- Risk snapshots
CREATE TABLE IF NOT EXISTS public.risk_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  total_value numeric NOT NULL DEFAULT 0,
  top1_weight numeric,
  top5_weight numeric,
  sector_concentration jsonb DEFAULT '{}',
  country_concentration jsonb DEFAULT '{}',
  currency_concentration jsonb DEFAULT '{}',
  liquidity_ratio numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.risk_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own risk_snapshots" ON public.risk_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own risk_snapshots" ON public.risk_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
