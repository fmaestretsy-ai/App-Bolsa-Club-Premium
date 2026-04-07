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

export const TRADE_TYPES = ["buy", "sell", "dividend", "commission", "withholding", "split", "cash_in", "cash_out", "fx_exchange"] as const;
export type TradeType = typeof TRADE_TYPES[number];

export const TRADE_TYPE_LABELS: Record<TradeType, string> = {
  buy: "Compra",
  sell: "Venta",
  dividend: "Dividendo",
  commission: "Comisión",
  withholding: "Retención",
  split: "Split",
  cash_in: "Ingreso",
  cash_out: "Retirada",
  fx_exchange: "Cambio divisa",
};

export const TRADE_TYPE_COLORS: Record<TradeType, string> = {
  buy: "bg-green-600 text-white",
  sell: "bg-red-600 text-white",
  dividend: "bg-blue-600 text-white",
  commission: "bg-orange-500 text-white",
  withholding: "bg-yellow-600 text-white",
  split: "bg-purple-600 text-white",
  cash_in: "bg-emerald-500 text-white",
  cash_out: "bg-rose-500 text-white",
  fx_exchange: "bg-cyan-600 text-white",
};

/** Trade types that require a company selection */
export const TRADE_NEEDS_COMPANY: TradeType[] = ["buy", "sell", "dividend", "commission", "withholding", "split"];
/** Trade types that require shares + price fields */
export const TRADE_NEEDS_SHARES: TradeType[] = ["buy", "sell"];
/** Trade types that require an amount (total) */
export const TRADE_NEEDS_AMOUNT: TradeType[] = ["dividend", "commission", "withholding", "cash_in", "cash_out", "fx_exchange"];
/** Trade types that need a split ratio */
export const TRADE_NEEDS_RATIO: TradeType[] = ["split"];

export interface Trade {
  id: string;
  companyName: string;
  ticker: string;
  type: TradeType;
  shares: number | null;
  price: number | null;
  total: number;
  date: string;
  currency: string;
  currencyOriginal?: string;
  fxRateToBase?: number;
  amountBase?: number;
}

export type Recommendation = "buy" | "hold" | "sell";
