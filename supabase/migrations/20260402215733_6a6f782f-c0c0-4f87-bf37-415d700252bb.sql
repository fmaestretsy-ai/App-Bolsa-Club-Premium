
-- Add projection financial columns to projection_years
ALTER TABLE public.projection_years 
  ADD COLUMN IF NOT EXISTS ebitda numeric,
  ADD COLUMN IF NOT EXISTS ebit numeric,
  ADD COLUMN IF NOT EXISTS net_debt numeric,
  ADD COLUMN IF NOT EXISTS market_cap numeric,
  ADD COLUMN IF NOT EXISTS ev numeric,
  ADD COLUMN IF NOT EXISTS diluted_shares numeric;

-- Add valuation multiple targets to company_assumptions
ALTER TABLE public.company_assumptions
  ADD COLUMN IF NOT EXISTS ev_ebitda_multiple numeric DEFAULT 17,
  ADD COLUMN IF NOT EXISTS ev_ebit_multiple numeric DEFAULT 19,
  ADD COLUMN IF NOT EXISTS target_return_rate numeric DEFAULT 15;
