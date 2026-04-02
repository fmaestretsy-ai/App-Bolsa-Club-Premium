-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. USER_SETTINGS
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'es',
  currency TEXT NOT NULL DEFAULT 'USD',
  theme TEXT NOT NULL DEFAULT 'dark',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. COMPANIES
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT NOT NULL,
  sector TEXT,
  country TEXT NOT NULL DEFAULT 'USA',
  currency TEXT NOT NULL DEFAULT 'USD',
  exchange TEXT,
  current_price NUMERIC,
  market_cap NUMERIC,
  shares_outstanding NUMERIC,
  last_price_update TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own companies" ON public.companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own companies" ON public.companies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own companies" ON public.companies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own companies" ON public.companies FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_companies_user_ticker ON public.companies(user_id, ticker);

-- 4. MARKET_SNAPSHOTS
CREATE TABLE public.market_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL,
  market_cap NUMERIC,
  volume NUMERIC,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.market_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own snapshots" ON public.market_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own snapshots" ON public.market_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. EXCEL_UPLOADS
CREATE TABLE public.excel_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  detected_ticker TEXT,
  detected_company TEXT,
  periods_extracted INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.excel_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own uploads" ON public.excel_uploads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own uploads" ON public.excel_uploads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own uploads" ON public.excel_uploads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own uploads" ON public.excel_uploads FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_excel_uploads_updated_at BEFORE UPDATE ON public.excel_uploads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_excel_uploads_hash ON public.excel_uploads(user_id, file_hash);

-- 6. FINANCIAL_PERIODS
CREATE TABLE public.financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES public.excel_uploads(id) ON DELETE SET NULL,
  fiscal_year INTEGER NOT NULL,
  revenue NUMERIC, ebitda NUMERIC, ebit NUMERIC, net_income NUMERIC, fcf NUMERIC,
  margin_ebitda NUMERIC, margin_net NUMERIC, margin_fcf NUMERIC,
  total_debt NUMERIC, cash NUMERIC, net_debt NUMERIC,
  diluted_shares NUMERIC, capex NUMERIC,
  roe NUMERIC, roic NUMERIC,
  eps NUMERIC, bvps NUMERIC, fcf_per_share NUMERIC,
  pe_ratio NUMERIC, ev_ebitda NUMERIC, p_fcf NUMERIC,
  revenue_growth NUMERIC, net_income_growth NUMERIC, fcf_growth NUMERIC,
  dividend_per_share NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own periods" ON public.financial_periods FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own periods" ON public.financial_periods FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own periods" ON public.financial_periods FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own periods" ON public.financial_periods FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_financial_periods_updated_at BEFORE UPDATE ON public.financial_periods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_financial_periods_year ON public.financial_periods(company_id, fiscal_year);

-- 7. COMPANY_ASSUMPTIONS
CREATE TABLE public.company_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_pe NUMERIC DEFAULT 20,
  fcf_multiple NUMERIC DEFAULT 15,
  revenue_growth_rate NUMERIC DEFAULT 5,
  net_margin_target NUMERIC DEFAULT 15,
  discount_rate NUMERIC DEFAULT 10,
  terminal_growth_rate NUMERIC DEFAULT 3,
  conservative_discount NUMERIC DEFAULT 15,
  optimistic_premium NUMERIC DEFAULT 15,
  custom_params JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own assumptions" ON public.company_assumptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own assumptions" ON public.company_assumptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assumptions" ON public.company_assumptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assumptions" ON public.company_assumptions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_assumptions_updated_at BEFORE UPDATE ON public.company_assumptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_assumptions_company ON public.company_assumptions(company_id);

-- 8. VALUATION_SCENARIOS
CREATE TABLE public.valuation_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_type TEXT NOT NULL CHECK (scenario_type IN ('conservative', 'base', 'optimistic')),
  method TEXT NOT NULL CHECK (method IN ('per', 'fcf', 'blended')),
  target_multiple NUMERIC NOT NULL,
  growth_rate NUMERIC,
  discount_rate NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.valuation_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own scenarios" ON public.valuation_scenarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scenarios" ON public.valuation_scenarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scenarios" ON public.valuation_scenarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scenarios" ON public.valuation_scenarios FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_valuation_scenarios_updated_at BEFORE UPDATE ON public.valuation_scenarios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. VALUATION_RESULTS
CREATE TABLE public.valuation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES public.valuation_scenarios(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  intrinsic_value NUMERIC NOT NULL,
  current_price NUMERIC,
  upside_percent NUMERIC,
  margin_of_safety NUMERIC,
  recommendation TEXT CHECK (recommendation IN ('buy', 'hold', 'sell')),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.valuation_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own results" ON public.valuation_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own results" ON public.valuation_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own results" ON public.valuation_results FOR DELETE USING (auth.uid() = user_id);

-- 10. PROJECTION_YEARS
CREATE TABLE public.projection_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projection_year INTEGER NOT NULL,
  revenue NUMERIC, net_income NUMERIC, fcf NUMERIC,
  intrinsic_value NUMERIC, target_price NUMERIC,
  expected_return NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projection_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projections" ON public.projection_years FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projections" ON public.projection_years FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projections" ON public.projection_years FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projections" ON public.projection_years FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_projection_years_updated_at BEFORE UPDATE ON public.projection_years FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_projection_company_year ON public.projection_years(company_id, projection_year);

-- 11. WATCHLISTS
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own watchlists" ON public.watchlists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlists" ON public.watchlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own watchlists" ON public.watchlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlists" ON public.watchlists FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_watchlists_updated_at BEFORE UPDATE ON public.watchlists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. WATCHLIST_ITEMS
CREATE TABLE public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_below NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own watchlist items" ON public.watchlist_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own watchlist items" ON public.watchlist_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own watchlist items" ON public.watchlist_items FOR DELETE USING (auth.uid() = user_id);
CREATE UNIQUE INDEX idx_watchlist_item ON public.watchlist_items(watchlist_id, company_id);

-- 13. PORTFOLIOS
CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Main',
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own portfolios" ON public.portfolios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolios" ON public.portfolios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolios" ON public.portfolios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolios" ON public.portfolios FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_portfolios_updated_at BEFORE UPDATE ON public.portfolios FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 14. PORTFOLIO_POSITIONS
CREATE TABLE public.portfolio_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shares NUMERIC NOT NULL DEFAULT 0,
  avg_cost NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own positions" ON public.portfolio_positions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own positions" ON public.portfolio_positions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own positions" ON public.portfolio_positions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own positions" ON public.portfolio_positions FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON public.portfolio_positions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_position_portfolio_company ON public.portfolio_positions(portfolio_id, company_id);

-- 15. TRADES
CREATE TABLE public.trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trade_type TEXT NOT NULL CHECK (trade_type IN ('buy', 'sell')),
  shares NUMERIC NOT NULL,
  price NUMERIC NOT NULL,
  total NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  commission NUMERIC DEFAULT 0,
  trade_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

-- 16. DIVIDENDS
CREATE TABLE public.dividends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  ex_date DATE,
  payment_date DATE NOT NULL,
  shares_held NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.dividends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own dividends" ON public.dividends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own dividends" ON public.dividends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own dividends" ON public.dividends FOR DELETE USING (auth.uid() = user_id);

-- Storage bucket for Excel files
INSERT INTO storage.buckets (id, name, public) VALUES ('excel-uploads', 'excel-uploads', false);
CREATE POLICY "Users can upload own Excel files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'excel-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view own Excel files" ON storage.objects FOR SELECT USING (bucket_id = 'excel-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own Excel files" ON storage.objects FOR DELETE USING (bucket_id = 'excel-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);