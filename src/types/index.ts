export interface Company {
  id: string;
  name: string;
  ticker: string;
  sector: string;
  country: string;
  currency: string;
  currentPrice: number | null;
  marketCap: number | null;
  intrinsicValue: number | null;
  upside: number | null;
  lastUpdated: string;
}

export interface FinancialPeriod {
  id: string;
  companyId: string;
  year: number;
  revenue: number;
  ebitda: number;
  ebit: number;
  netIncome: number;
  fcf: number;
  marginEbitda: number;
  marginNet: number;
  marginFcf: number;
  totalDebt: number;
  cash: number;
  netDebt: number;
  dilutedShares: number;
  capex: number;
  roe: number;
  roic: number;
  eps: number;
  bvps: number;
  fcfPerShare: number;
  peRatio: number;
  evEbitda: number;
  pFcf: number;
  revenueGrowth: number;
  netIncomeGrowth: number;
  fcfGrowth: number;
}

export interface ValuationScenario {
  id: string;
  companyId: string;
  name: string;
  method: "per" | "fcf";
  targetMultiple: number;
  growthRate: number;
  discountRate: number;
  intrinsicValue: number;
  upside: number;
  marginOfSafety: number;
}

export interface ProjectionYear {
  year: number;
  revenue: number;
  netIncome: number;
  fcf: number;
  intrinsicValue: number;
  targetPrice: number;
  expectedReturn: number;
}

export interface PortfolioPosition {
  id: string;
  companyId: string;
  companyName: string;
  ticker: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPercent: number;
  currency: string;
}

export interface Trade {
  id: string;
  companyName: string;
  ticker: string;
  type: "buy" | "sell";
  shares: number;
  price: number;
  total: number;
  date: string;
  currency: string;
}

export type Recommendation = "buy" | "hold" | "sell";
