ALTER TABLE public.financial_periods
  ADD COLUMN IF NOT EXISTS inventories numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accounts_receivable numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS accounts_payable numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unearned_revenue numeric DEFAULT NULL;