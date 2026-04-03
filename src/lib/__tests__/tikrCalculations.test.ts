import { describe, it, expect } from "vitest";
import { calculateFullModel } from "../tikrCalculations";
import type { TikrRawData, TikrModelInputs } from "../tikrExtractor";

function makeRaw(overrides: Partial<TikrRawData> = {}): TikrRawData {
  const zeros = [0, 0, 0];
  return {
    years: [2016, 2017, 2020],
    revenues: [135987, 177866, 386064],
    operatingIncome: [4186, 4106, 22899],
    interestExpense: [-484, -848, -1647],
    interestIncome: [100, 202, 555],
    taxExpense: [-1425, -769, -2863],
    minorityInterest: zeros,
    dilutedShares: [500, 507, 526],
    basicShares: [484, 487, 504],
    depreciation: [7829, 11112, 24671],
    amortGoodwill: [287, 366, 509],
    capex: [-7804, -11955, -40140],
    salePPE: [0, 0, 5096],
    saleIntangibles: zeros,
    cashAcquisitions: [-116, -13972, -2325],
    divestitures: zeros,
    sbc: [2975, 4215, 9208],
    issuanceStock: zeros,
    repurchaseStock: zeros,
    dividendsPaid: zeros,
    debtIssued: [6200, 16000, 10525],
    debtRepaid: [-327, -9200, -1553],
    netCashChangeHist: [3444, 2062, 10076],
    cashEquiv: [19334, 20522, 42122],
    totalCashSTI: [25981, 30986, 84261],
    inventory: [11461, 16047, 23795],
    accountsReceivable: [8339, 9000, 19600],
    accountsPayable: [25309, 34616, 72539],
    unearnedRevCurrent: [4768, 5097, 9708],
    unearnedRevNonCurrent: [2400, 3000, 6600],
    stBorrowings: zeros,
    currentLTD: [1056, 100, 1155],
    finDivDebtCurrent: zeros,
    ltBorrowings: [7694, 24743, 31816],
    ltDebt: zeros,
    finDivDebtNC: zeros,
    currentCapLeases: zeros,
    ncCapLeases: zeros,
    totalEquity: [19285, 27709, 93404],
    assetWritedown: zeros,
    impairmentGoodwill: zeros,
    mergerRestructuring: zeros,
    legalSettlements: zeros,
    otherUnusualItems: zeros,
    marketCapMM: [356313, 563519, 1634179],
    ...overrides,
  };
}

function makeInputs(): TikrModelInputs {
  return {
    lastSales: 386064, lastDA: -24671, lastShares: 526,
    growthRates: [0.1, 0.1, 0.1, 0.1, 0.1],
    ebitMarginEst: [0.12, 0.12, 0.12, 0.12, 0.12],
    shareDilutionRate: 0.01,
    capexMantToSales: [0.06, 0.06, 0.06, 0.06, 0.06],
    wcToSalesEst: [-0.08, -0.08, -0.08, -0.08, -0.08],
    netCashChange: [0, 0, 0, 0, 0],
    netDebtToEBITDA: [0.3, 0.3, 0.3, 0.3, 0.3],
    currentPrice: 220, targetPER: 50, targetEVFCF: 40,
    targetEVEBITDA: 25, targetEVEBIT: 30,
    taxRateEst: [], targetReturn: 0.15,
  };
}

describe("tikrCalculations – CapEx Mant uses Depreciation only (not Total D&A)", () => {
  it("2016: |capexNeto| < deprec → uses capexNeto", () => {
    // capexNeto = -7804, deprec = 7829 → |7804| < 7829 → capexMant = -7804
    const result = calculateFullModel(makeRaw(), makeInputs());
    expect(result.hist[0].capexMant).toBe(-7804);
  });

  it("2017: |capexNeto| > deprec → cap at -deprec (NOT -totalDA)", () => {
    // capexNeto = -11955, deprec = 11112, amortGW = 366, totalDA = 11478
    // |11955| > 11112 → capexMant = -11112 (NOT -11478)
    const result = calculateFullModel(makeRaw(), makeInputs());
    expect(result.hist[1].capexMant).toBe(-11112);
  });

  it("2020: capexNeto with salePPE, capped at -deprec", () => {
    // capexNeto = -40140 + 5096 = -35044, deprec = 24671
    // |35044| > 24671 → capexMant = -24671
    const result = calculateFullModel(makeRaw(), makeInputs());
    expect(result.hist[2].capexMant).toBe(-24671);
  });
});
