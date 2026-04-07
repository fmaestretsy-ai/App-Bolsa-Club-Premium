
-- Tax lots for FIFO tracking
CREATE TABLE IF NOT EXISTS public.tax_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  portfolio_id uuid NOT NULL,
  trade_id uuid,
  purchase_date date NOT NULL,
  shares_remaining numeric NOT NULL,
  shares_original numeric NOT NULL,
  cost_per_share numeric NOT NULL,
  cost_per_share_base numeric NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  fx_rate_to_base numeric NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tax_lots" ON public.tax_lots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tax_lots" ON public.tax_lots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tax_lots" ON public.tax_lots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tax_lots" ON public.tax_lots FOR DELETE USING (auth.uid() = user_id);

-- Realized gains from FIFO sales
CREATE TABLE IF NOT EXISTS public.realized_gains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL,
  portfolio_id uuid NOT NULL,
  sell_trade_id uuid,
  sell_date date NOT NULL,
  shares_sold numeric NOT NULL,
  proceeds_base numeric NOT NULL,
  cost_basis_base numeric NOT NULL,
  gain_loss_base numeric NOT NULL,
  lots_consumed jsonb NOT NULL DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.realized_gains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own realized_gains" ON public.realized_gains FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own realized_gains" ON public.realized_gains FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own realized_gains" ON public.realized_gains FOR DELETE USING (auth.uid() = user_id);
