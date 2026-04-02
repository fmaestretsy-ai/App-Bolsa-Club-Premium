ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS target_price_5y numeric,
  ADD COLUMN IF NOT EXISTS price_for_15_return numeric,
  ADD COLUMN IF NOT EXISTS estimated_annual_return numeric,
  ADD COLUMN IF NOT EXISTS next_earnings_date date,
  ADD COLUMN IF NOT EXISTS week_52_high numeric,
  ADD COLUMN IF NOT EXISTS week_52_low numeric;