ALTER TABLE public.financial_periods
  ADD COLUMN IF NOT EXISTS interest_expense numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interest_income numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tax_expense numeric DEFAULT NULL;