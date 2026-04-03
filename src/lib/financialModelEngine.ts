/**
 * Financial Model Calculation Engine
 * Replicates the Excel template formulas for IS, FCF, ROIC, and Valuation sheets.
 */

export interface ModelInputs {
  // IS inputs (per projected year)
  revenueGrowth: Record<number, number>;      // e.g. {2026: 0.15, 2027: 0.13, ...}
  ebitMargin: Record<number, number>;          // e.g. {2026: 0.34, ...}
  taxRate: number;                             // e.g. 0.14
  shareGrowthFirst: number;                    // e.g. -0.03 (applied to first year, then formula)
  // FCF inputs
  wcSales: number;                             // Working Capital / Sales ratio
  // Valoracion inputs
  netDebtEbitda: Record<number, number>;       // Net Debt / EBITDA ratio per year
  currentPrice: number;
  targetPer: number;
  targetEvFcf: number;
  targetEvEbitda: number;
  targetEvEbit: number;
  targetReturnRate: number;                    // e.g. 0.15
}

export interface HistoricalData {
  fiscalYear: number;
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  fcf: number | null;
  dilutedShares: number | null;
  da: number | null;           // D&A (negative in Excel)
  interestExpense: number | null;
  interestIncome: number | null;
  taxExpense: number | null;
  taxRate: number | null;
  minorityInterests: number | null;
  eps: number | null;
  ebitdaMargin: number | null;
  ebitMargin: number | null;
  netMargin: number | null;
  // FCF components
  capex: number | null;
  workingCapital: number | null;
  // Balance sheet
  totalDebt: number | null;
  cash: number | null;
  netDebt: number | null;
  equity: number | null;
  shortTermDebt: number | null;
  longTermDebt: number | null;
  operatingLeasesCurrent: number | null;
  operatingLeasesNonCurrent: number | null;
  marketableSecurities: number | null;
  // Ratios
  roe: number | null;
  roic: number | null;
  peRatio: number | null;
  evEbitda: number | null;
  evFcf: number | null;
  evEbit: number | null;
  marketCap: number | null;
  ev: number | null;
  // Allocation %
  capexExpansionPct: number | null;
  acquisitionsPct: number | null;
  dividendsPct: number | null;
  buybacksPct: number | null;
  debtRepaymentPct: number | null;
}

export interface ProjectedYear {
  year: number;
  // IS
  revenue: number;
  revenueGrowth: number;
  da: number;
  ebit: number;
  ebitMargin: number;
  ebitda: number;
  ebitdaMargin: number;
  ebitdaGrowth: number;
  ebitGrowth: number;
  interestExpense: number;
  interestIncome: number;
  totalInterest: number;
  ebt: number;
  taxExpense: number;
  taxRate: number;
  consolidatedNetIncome: number;
  minorityInterests: number;
  netIncome: number;
  netMargin: number;
  netIncomeGrowth: number;
  eps: number;
  epsGrowth: number;
  dilutedShares: number;
  sharesGrowth: number;
  // FCF
  capexMaint: number;
  capexSalesRatio: number;
  wc: number;
  wcChange: number;
  fcf: number;
  fcfMargin: number;
  fcfGrowth: number;
  fcfps: number;
  fcfpsGrowth: number;
  cashConversion: number;
  // Valoracion
  marketCap: number;
  netDebt: number;
  netDebtEbitda: number;
  ev: number;
  per: number;
  evFcf: number;
  evEbitda: number;
  evEbit: number;
  // ROIC
  nopat: number;
  roe: number;
  roic: number;
}

export interface TargetPrices {
  year: number;
  perExCash: number;
  evFcf: number;
  evEbitda: number;
  evEbit: number;
  average: number;
  marginOfSafety: number;
}

export interface ModelResult {
  projected: ProjectedYear[];
  targetPrices: TargetPrices[];
  priceFor15Return: number;
  differenceVsCurrent: number;
  cagr5y: Record<string, number>; // method -> CAGR
}

function median(arr: number[]): number {
  const sorted = arr.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function calculateModel(
  historical: HistoricalData[],
  inputs: ModelInputs,
  projectionYears: number[] // e.g. [2026, 2027, 2028, 2029, 2030]
): ModelResult {
  const sorted = [...historical].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const lastHist = sorted[sorted.length - 1];
  if (!lastHist) {
    return { projected: [], targetPrices: [], priceFor15Return: 0, differenceVsCurrent: 0, cagr5y: {} };
  }

  // Tax rate from inputs (user-editable) or median of last 3 years as default
  const medianTaxRate = inputs.taxRate;

  // Interest rates (simplified: use averages from historical)
  const histInterestExpenses = sorted.map(h => h.interestExpense).filter(v => v != null) as number[];
  const histDebt = sorted.map(h => (h.shortTermDebt || 0) + (h.longTermDebt || 0)).filter(v => v > 0);
  const avgInterestRate = histDebt.length > 0 && histInterestExpenses.length > 0
    ? Math.abs(histInterestExpenses.reduce((a, b) => a + b, 0)) / histDebt.reduce((a, b) => a + b, 0) * (histDebt.length / histInterestExpenses.length)
    : 0.03;

  const histInterestIncome = sorted.map(h => h.interestIncome).filter(v => v != null) as number[];
  const histCash = sorted.map(h => h.cash || 0).filter(v => v > 0);
  const avgIncomeRate = histCash.length > 0 && histInterestIncome.length > 0
    ? histInterestIncome.reduce((a, b) => a + b, 0) / histCash.reduce((a, b) => a + b, 0) * (histCash.length / histInterestIncome.length)
    : 0.02;

  // CapEx/Sales ratio from last historical
  const lastCapexSales = lastHist.capex && lastHist.revenue
    ? Math.abs(lastHist.capex) / lastHist.revenue : 0.05;

  const projected: ProjectedYear[] = [];
  let prevRevenue = lastHist.revenue || 0;
  let prevDA = lastHist.da || -(lastHist.ebitda || 0) + (lastHist.ebit || 0);
  let prevShares = lastHist.dilutedShares || 1;
  let prevCapexMaint = lastHist.capex ? Math.abs(lastHist.capex) : 0;
  let prevNetIncome = lastHist.netIncome || 0;
  let prevFcf = lastHist.fcf || 0;
  let prevEbitda = lastHist.ebitda || 0;
  let prevEbit = lastHist.ebit || 0;
  let prevEps = lastHist.eps || 0;
  let prevFcfps = lastHist.fcf && lastHist.dilutedShares ? lastHist.fcf / lastHist.dilutedShares : 0;
  let prevWc = lastHist.workingCapital || 0;

  for (let i = 0; i < projectionYears.length; i++) {
    const year = projectionYears[i];
    const revGrowth = inputs.revenueGrowth[year] ?? 0.10;
    const ebitMarg = inputs.ebitMargin[year] ?? 0.30;
    const shareGrowth = i === 0 ? inputs.shareGrowthFirst : inputs.shareGrowthFirst;

    const revenue = prevRevenue * (1 + revGrowth);
    const da = prevDA * (1 + revGrowth); // D&A grows with revenue (negative value)
    const ebit = revenue * ebitMarg;
    const ebitda = ebit - da; // da is negative, so ebit - (-|da|) = ebit + |da|

    // Net Debt for this year
    const ndEbitdaRatio = inputs.netDebtEbitda[year] ?? inputs.netDebtEbitda[projectionYears[0]] ?? 0.3;
    const netDebt = ndEbitdaRatio * ebitda;

    // Simplified interest calc
    const interestExpense = -avgInterestRate * Math.abs(netDebt > 0 ? netDebt : 0);
    const interestIncome = avgIncomeRate * (netDebt < 0 ? Math.abs(netDebt) : 0);
    const totalInterest = interestExpense + interestIncome;

    const ebt = ebit + totalInterest;
    const taxExpense = -Math.abs(ebt * medianTaxRate);
    const consolidatedNetIncome = ebt + taxExpense;
    const minorityInterests = 0;
    const netIncome = consolidatedNetIncome + minorityInterests;

    const shares = prevShares * (1 + shareGrowth);
    const eps = netIncome / shares;

    // FCF
    const capexSalesRatio = lastCapexSales; // Keep constant
    const capexMaint = -capexSalesRatio * revenue;
    const wc = inputs.wcSales * revenue;
    const wcChange = wc - prevWc;
    const fcf = ebitda + capexMaint + totalInterest + taxExpense - wcChange;
    const fcfps = fcf / shares;

    // Market cap from current price
    const marketCap = inputs.currentPrice * shares;
    const ev = marketCap + netDebt;

    // Multiples
    const per = marketCap / netIncome;
    const evFcfVal = ev / fcf;
    const evEbitdaVal = ev / ebitda;
    const evEbitVal = ev / ebit;

    // ROIC
    const nopat = ebit * (1 - medianTaxRate);
    const equity = lastHist.equity || marketCap * 0.5; // fallback
    const roe = netIncome / equity;
    const roic = nopat / (equity + Math.abs(netDebt));

    const py: ProjectedYear = {
      year,
      revenue,
      revenueGrowth: revGrowth,
      da,
      ebit,
      ebitMargin: ebitMarg,
      ebitda,
      ebitdaMargin: ebitda / revenue,
      ebitdaGrowth: (ebitda - prevEbitda) / Math.abs(prevEbitda),
      ebitGrowth: (ebit - prevEbit) / Math.abs(prevEbit),
      interestExpense,
      interestIncome,
      totalInterest,
      ebt,
      taxExpense,
      taxRate: medianTaxRate,
      consolidatedNetIncome,
      minorityInterests,
      netIncome,
      netMargin: netIncome / revenue,
      netIncomeGrowth: (netIncome - prevNetIncome) / Math.abs(prevNetIncome),
      eps,
      epsGrowth: (eps - prevEps) / Math.abs(prevEps),
      dilutedShares: shares,
      sharesGrowth: shareGrowth,
      capexMaint,
      capexSalesRatio,
      wc,
      wcChange,
      fcf,
      fcfMargin: fcf / revenue,
      fcfGrowth: (fcf - prevFcf) / Math.abs(prevFcf),
      fcfps,
      fcfpsGrowth: (fcfps - prevFcfps) / Math.abs(prevFcfps),
      cashConversion: fcf / ebitda,
      marketCap,
      netDebt,
      netDebtEbitda: ndEbitdaRatio,
      ev,
      per,
      evFcf: evFcfVal,
      evEbitda: evEbitdaVal,
      evEbit: evEbitVal,
      nopat,
      roe,
      roic,
    };

    projected.push(py);
    prevRevenue = revenue;
    prevDA = da;
    prevShares = shares;
    prevCapexMaint = Math.abs(capexMaint);
    prevNetIncome = netIncome;
    prevFcf = fcf;
    prevEbitda = ebitda;
    prevEbit = ebit;
    prevEps = eps;
    prevFcfps = fcfps;
    prevWc = wc;
  }

  // Target prices
  const targetPrices: TargetPrices[] = projected.map(py => {
    // PER ex Cash: if net_debt < 0 (net cash), add |net_debt| to market cap
    const perExCash = py.netDebt < 0
      ? (py.netIncome * inputs.targetPer + Math.abs(py.netDebt)) / py.dilutedShares
      : (py.netIncome * inputs.targetPer) / py.dilutedShares;

    // EV/FCF: (FCF * target - netDebt) / shares
    const evFcfPrice = (py.fcf * inputs.targetEvFcf - py.netDebt) / py.dilutedShares;
    // EV/EBITDA
    const evEbitdaPrice = (py.ebitda * inputs.targetEvEbitda - py.netDebt) / py.dilutedShares;
    // EV/EBIT
    const evEbitPrice = (py.ebit * inputs.targetEvEbit - py.netDebt) / py.dilutedShares;

    const average = (perExCash + evFcfPrice + evEbitdaPrice + evEbitPrice) / 4;
    const marginOfSafety = (evFcfPrice / inputs.currentPrice) - 1;

    return {
      year: py.year,
      perExCash,
      evFcf: evFcfPrice,
      evEbitda: evEbitdaPrice,
      evEbit: evEbitPrice,
      average,
      marginOfSafety,
    };
  });

  // CAGR 5y (from last target price year to current)
  const lastTP = targetPrices[targetPrices.length - 1];
  const baseYear = new Date().getFullYear() - 1;
  const cagr5y: Record<string, number> = {};
  if (lastTP && inputs.currentPrice > 0) {
    const years = lastTP.year - baseYear;
    if (years > 0) {
      cagr5y["PER ex Cash"] = Math.pow(lastTP.perExCash / inputs.currentPrice, 1 / years) - 1;
      cagr5y["EV / FCF"] = Math.pow(lastTP.evFcf / inputs.currentPrice, 1 / years) - 1;
      cagr5y["EV / EBITDA"] = Math.pow(lastTP.evEbitda / inputs.currentPrice, 1 / years) - 1;
      cagr5y["EV / EBIT"] = Math.pow(lastTP.evEbit / inputs.currentPrice, 1 / years) - 1;
      cagr5y["Promedio"] = Math.pow(lastTP.average / inputs.currentPrice, 1 / years) - 1;
    }
  }

  // Price for target return
  const lastEvFcfPrice = lastTP?.evFcf ?? 0;
  const priceFor15Return = lastEvFcfPrice / Math.pow(1 + inputs.targetReturnRate, projectionYears.length);
  const differenceVsCurrent = inputs.currentPrice > 0
    ? (priceFor15Return - inputs.currentPrice) / inputs.currentPrice : 0;

  return { projected, targetPrices, priceFor15Return, differenceVsCurrent, cagr5y };
}

/** Extract model inputs from company_assumptions custom_params */
export function extractModelInputs(
  assumptions: any,
  projectionYears: number[]
): ModelInputs {
  const cp = assumptions?.custom_params || {};

  const defaultGrowths: Record<number, number> = {};
  const defaultMargins: Record<number, number> = {};
  const defaultNdEbitda: Record<number, number> = {};

  projectionYears.forEach((y, i) => {
    defaultGrowths[y] = 0.10 - i * 0.01;
    defaultMargins[y] = 0.30;
    defaultNdEbitda[y] = 0.30;
  });

  return {
    revenueGrowth: cp.revenue_growth || defaultGrowths,
    ebitMargin: cp.ebit_margin || defaultMargins,
    taxRate: cp.tax_rate ?? 0.14,
    shareGrowthFirst: cp.share_growth_first ?? -0.02,
    wcSales: cp.wc_sales ?? 0,
    netDebtEbitda: cp.net_debt_ebitda || defaultNdEbitda,
    currentPrice: assumptions?.current_price ?? 0,
    targetPer: assumptions?.target_pe ?? 20,
    targetEvFcf: assumptions?.fcf_multiple ?? 20,
    targetEvEbitda: assumptions?.ev_ebitda_multiple ?? 17,
    targetEvEbit: assumptions?.ev_ebit_multiple ?? 19,
    targetReturnRate: (assumptions?.target_return_rate ?? 15) / 100,
  };
}

/** Convert financial_periods data to HistoricalData */
export function periodsToHistorical(periods: any[]): HistoricalData[] {
  return periods.map(p => {
    const ebit = p.ebit as number | null;
    const netIncome = p.net_income as number | null;
    // Derive tax expense: Tax = Net Income - EBIT (negative value, since tax reduces income)
    // This assumes interest ≈ 0 when not available; EBT ≈ EBIT
    const taxExpense = ebit != null && netIncome != null ? netIncome - ebit : null;
    const taxRate = ebit != null && netIncome != null && ebit !== 0
      ? 1 - (netIncome / ebit) : null;

    return {
      fiscalYear: p.fiscal_year,
      revenue: p.revenue,
      ebitda: p.ebitda,
      ebit,
      netIncome,
      fcf: p.fcf,
      dilutedShares: p.diluted_shares,
      da: p.ebitda && ebit ? -(p.ebitda - ebit) : null,
      interestExpense: 0,
      interestIncome: 0,
      taxExpense,
      taxRate,
      minorityInterests: null,
      eps: p.eps,
      ebitdaMargin: p.margin_ebitda,
      ebitMargin: ebit && p.revenue ? ebit / p.revenue : null,
      netMargin: p.margin_net,
      capex: p.capex,
      workingCapital: null,
      totalDebt: p.total_debt,
      cash: p.cash,
      netDebt: p.net_debt,
      equity: null,
      shortTermDebt: p.total_debt,
      longTermDebt: null,
      operatingLeasesCurrent: null,
      operatingLeasesNonCurrent: null,
      marketableSecurities: null,
      roe: p.roe,
      roic: p.roic,
      peRatio: p.pe_ratio,
      evEbitda: p.ev_ebitda,
      evFcf: p.p_fcf,
      evEbit: null,
      marketCap: null,
      ev: null,
      capexExpansionPct: null,
      acquisitionsPct: null,
      dividendsPct: null,
      buybacksPct: null,
      debtRepaymentPct: null,
    };
  });
}
