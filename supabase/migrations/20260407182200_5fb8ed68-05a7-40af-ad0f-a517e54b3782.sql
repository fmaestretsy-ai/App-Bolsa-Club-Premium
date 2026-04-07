
-- Add new columns to trades table
ALTER TABLE public.trades 
  ADD COLUMN IF NOT EXISTS currency_original text,
  ADD COLUMN IF NOT EXISTS fx_rate_to_base numeric DEFAULT 1,
  ADD COLUMN IF NOT EXISTS amount_base numeric;

-- Make company_id nullable for cash_in/cash_out/fx_exchange trades
ALTER TABLE public.trades ALTER COLUMN company_id DROP NOT NULL;

-- Make shares nullable (not needed for dividend, commission, withholding, cash, fx)
ALTER TABLE public.trades ALTER COLUMN shares DROP NOT NULL;

-- Make price nullable
ALTER TABLE public.trades ALTER COLUMN price DROP NOT NULL;

-- Add UPDATE policy on trades (currently missing)
CREATE POLICY "Users can update own trades" ON public.trades
  FOR UPDATE USING (auth.uid() = user_id);

-- Add base_currency to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_currency text DEFAULT 'EUR';

-- Add asset_type to companies  
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS asset_type text DEFAULT 'stock';

-- Create fx_rates table
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate_date date NOT NULL,
  rate numeric NOT NULL,
  source text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency, rate_date)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read fx_rates" ON public.fx_rates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert fx_rates" ON public.fx_rates
  FOR INSERT TO authenticated WITH CHECK (true);
