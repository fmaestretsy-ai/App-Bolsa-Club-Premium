import { supabase } from "@/integrations/supabase/client";

interface ValuationInput {
  eps: number;
  fcfPerShare: number;
  ebitda: number;
  ebit: number;
  netDebt: number;
  dilutedShares: number;
  currentPrice: number;
}

interface ScenarioResult {
  method: string;
  scenarioType: string;
  targetMultiple: number;
  intrinsicValue: number;
  upside: number;
  marginOfSafety: number;
}

const METHODS = [
  { key: "per", label: "PER", field: "eps" as const },
  { key: "ev_fcf", label: "EV/FCF", field: "fcfPerShare" as const },
  { key: "ev_ebitda", label: "EV/EBITDA", field: "ebitda" as const },
  { key: "ev_ebit", label: "EV/EBIT", field: "ebit" as const },
];

export function calculateValuation(
  input: ValuationInput,
  assumptions: {
    targetPe: number;
    fcfMultiple: number;
    evEbitdaMultiple?: number;
    evEbitMultiple?: number;
    conservativeDiscount: number;
    optimisticPremium: number;
  }
): ScenarioResult[] {
  const { eps, fcfPerShare, ebitda, ebit, netDebt, dilutedShares, currentPrice } = input;
  const cashPerShare = dilutedShares > 0 ? -netDebt / dilutedShares : 0;

  const methods: { key: string; baseValue: number }[] = [];

  // PER ex cash
  if (eps > 0) {
    methods.push({ key: "per", baseValue: eps * assumptions.targetPe + (cashPerShare > 0 ? cashPerShare : 0) });
  }

  // EV/FCF
  if (fcfPerShare > 0 && dilutedShares > 0) {
    const ev = fcfPerShare * assumptions.fcfMultiple * dilutedShares;
    const equityValue = ev + (netDebt < 0 ? Math.abs(netDebt) : -netDebt);
    methods.push({ key: "ev_fcf", baseValue: equityValue / dilutedShares });
  }

  // EV/EBITDA
  if (ebitda > 0 && dilutedShares > 0) {
    const mult = assumptions.evEbitdaMultiple || 17;
    const ev = ebitda * mult;
    const equityValue = ev + (netDebt < 0 ? Math.abs(netDebt) : -netDebt);
    methods.push({ key: "ev_ebitda", baseValue: equityValue / dilutedShares });
  }

  // EV/EBIT
  if (ebit > 0 && dilutedShares > 0) {
    const mult = assumptions.evEbitMultiple || 19;
    const ev = ebit * mult;
    const equityValue = ev + (netDebt < 0 ? Math.abs(netDebt) : -netDebt);
    methods.push({ key: "ev_ebit", baseValue: equityValue / dilutedShares });
  }

  const results: ScenarioResult[] = [];

  for (const m of methods) {
    const scenarios = [
      { type: "conservative", factor: 1 - assumptions.conservativeDiscount / 100 },
      { type: "base", factor: 1 },
      { type: "optimistic", factor: 1 + assumptions.optimisticPremium / 100 },
    ];

    for (const s of scenarios) {
      const iv = m.baseValue * s.factor;
      const upside = currentPrice > 0 ? ((iv - currentPrice) / currentPrice) * 100 : 0;
      results.push({
        method: m.key,
        scenarioType: s.type,
        targetMultiple: assumptions.targetPe,
        intrinsicValue: Math.round(iv * 100) / 100,
        upside: Math.round(upside * 10) / 10,
        marginOfSafety: Math.round(Math.max(0, upside) * 10) / 10,
      });
    }
  }

  return results;
}

export function getRecommendation(upside: number): "buy" | "hold" | "sell" {
  if (upside >= 15) return "buy";
  if (upside >= -10) return "hold";
  return "sell";
}

export function calculateProjections(
  lastYear: { year: number; revenue: number; netIncome: number; fcf: number },
  assumptions: {
    revenueGrowthRate: number;
    netMarginTarget: number;
    fcfMarginTarget: number;
    targetPe: number;
    discountRate: number;
    dilutedShares: number;
    currentPrice: number;
  },
  years: number = 5
) {
  const projections = [];
  let prevRevenue = lastYear.revenue;

  for (let i = 1; i <= years; i++) {
    const year = lastYear.year + i;
    const revenue = prevRevenue * (1 + assumptions.revenueGrowthRate / 100);
    const netIncome = revenue * (assumptions.netMarginTarget / 100);
    const fcf = revenue * (assumptions.fcfMarginTarget / 100);
    const eps = assumptions.dilutedShares > 0 ? netIncome / assumptions.dilutedShares : 0;
    const targetPrice = eps * assumptions.targetPe;
    const discountFactor = Math.pow(1 + assumptions.discountRate / 100, i);
    const intrinsicValue = targetPrice / discountFactor;
    const expectedReturn = assumptions.currentPrice > 0
      ? ((targetPrice - assumptions.currentPrice) / assumptions.currentPrice) * 100
      : 0;

    projections.push({
      year,
      revenue: Math.round(revenue),
      netIncome: Math.round(netIncome),
      fcf: Math.round(fcf),
      eps: Math.round(eps * 100) / 100,
      targetPrice: Math.round(targetPrice * 100) / 100,
      intrinsicValue: Math.round(intrinsicValue * 100) / 100,
      expectedReturn: Math.round(expectedReturn * 10) / 10,
    });

    prevRevenue = revenue;
  }

  return projections;
}
