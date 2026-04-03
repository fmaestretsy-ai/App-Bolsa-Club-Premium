import { describe, it, expect } from "vitest";
import { calculateFullModel } from "../tikrCalculations";
import type { TikrRawData, TikrModelInputs } from "../tikrExtractor";

function makeRaw(overrides: Partial<TikrRawData> = {}): TikrRawData {
  const zeros = [0, 0, 0];
  return {
    years: [2022, 2023, 2024],
    revenues: [1000, 1100, 1200],
    operatingIncome: [300, 330, 360],
    interestExpense: [-10, -12, -14],
    interestIncome: [5, 6, 7],
    taxExpense: [-60, -65, -70],
    minorityInterest: zeros,
    dilutedShares: [100, 100, 100],
    basicShares: [100, 100, 100],
    depreciation: [50, 55, 60],
    amortGoodwill: zeros,
    capex: [-80, -90, -100],
    salePPE: [5, 5, 5],
    saleIntangibles: [-10, -10, -10],
    cashAcquisitions: zeros,
    divestitures: zeros,
    sbc: zeros,
    issuanceStock: zeros,
    repurchaseStock: zeros,
    dividendsPaid: zeros,
    debtIssued: zeros,
    debtRepaid: zeros,
    netCashChangeHist: zeros,
    cashEquiv: [200, 220, 240],
    totalCashSTI: [250, 270, 290],
    inventory: [50, 55, 60],
    accountsReceivable: [80, 88, 96],
    accountsPayable: [40, 44, 48],
    unearnedRevCurrent: zeros,
    unearnedRevNonCurrent: zeros,
    stBorrowings: zeros,
    currentLTD: zeros,
    finDivDebtCurrent: zeros,
    ltBorrowings: [100, 100, 100],
    ltDebt: zeros,
    finDivDebtNC: zeros,
    currentCapLeases: zeros,
    ncCapLeases: zeros,
    totalEquity: [500, 550, 600],
    assetWritedown: zeros,
    impairmentGoodwill: zeros,
    mergerRestructuring: zeros,
    legalSettlements: zeros,
    otherUnusualItems: zeros,
    marketCapMM: [2000, 2200, 2400],
    ...overrides,
  };
}

function makeInputs(): TikrModelInputs {
  return {
    lastSales: 1200,
    lastDA: -60,
    lastShares: 100,
    growthRates: [0.1, 0.1, 0.1, 0.1, 0.1],
    ebitMarginEst: [0.3, 0.3, 0.3, 0.3, 0.3],
    shareDilutionRate: 0.01,
    capexMantToSales: [0.05, 0.05, 0.05, 0.05, 0.05],
    wcToSalesEst: [0.08, 0.08, 0.08, 0.08, 0.08],
    netCashChange: [0, 0, 0, 0, 0],
    netDebtToEBITDA: [0.3, 0.3, 0.3, 0.3, 0.3],
    currentPrice: 24,
    targetPER: 20,
    targetEVFCF: 18,
    targetEVEBITDA: 14,
    targetEVEBIT: 16,
    taxRateEst: [],
    targetReturn: 0.15,
  };
}

describe("tikrCalculations – Capex de Mantenimiento", () => {
  it("uses D&A absolute as the maintenance capex ceiling", () => {
    const raw = makeRaw();
    const result = calculateFullModel(raw, makeInputs());

    result.hist.forEach((h, i) => {
      const daAbs = [50, 55, 60][i];
      const capexNeto = [-80, -90, -100][i] + (-10) + 5;
      const expected = Math.abs(capexNeto) < daAbs ? capexNeto : -daAbs;
      expect(h.capexMant).toBe(expected);
    });
  });

  it("uses negative D&A when |capexNeto| is above D&A", () => {
    const raw = makeRaw({
      capex: [-200, -200, -200],
      salePPE: [0, 0, 0],
      saleIntangibles: [0, 0, 0],
    });
    const result = calculateFullModel(raw, makeInputs());

    result.hist.forEach((h, i) => {
      expect(h.capexMant).toBe(-[50, 55, 60][i]);
    });
  });

  it("uses capexNeto when |capexNeto| is below D&A", () => {
    const raw = makeRaw({
      capex: [-30, -35, -40],
      salePPE: [0, 0, 0],
      saleIntangibles: [0, 0, 0],
    });
    const result = calculateFullModel(raw, makeInputs());

    result.hist.forEach((h, i) => {
      expect(h.capexMant).toBe([-30, -35, -40][i]);
    });
  });
});
