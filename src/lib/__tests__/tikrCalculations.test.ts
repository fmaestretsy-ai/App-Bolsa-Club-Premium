import { describe, it, expect } from "vitest";
import { calculateFullModel } from "../tikrCalculations";
import type { TikrRawData, TikrModelInputs } from "../tikrExtractor";

function makeRaw(overrides: Partial<TikrRawData> = {}): TikrRawData {
  const zeros = [0, 0, 0];
  return {
    totalDA: [],
    currency: null,
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
    
    currentPrice: 220, targetPER: 50, targetEVFCF: 40,
    targetEVEBITDA: 25, targetEVEBIT: 30,
    taxRateEst: [], targetReturn: 0.15, projectedMinorityInterest: [],
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

  it("includes intangible purchases in maintenance CapEx and uses growth investment over FCF for reinvestment", () => {
    const result = calculateFullModel(
      makeRaw({
        years: [2024, 2025],
        revenues: [28262.9, 32470],
        operatingIncome: [9022.6, 10950],
        interestExpense: [-162.6, -162.6],
        interestIncome: [182.4, 242.1],
        taxExpense: [-1680.6, -2117.5],
        minorityInterest: [0, 0],
        dilutedShares: [393.6, 392],
        basicShares: [393.6, 392],
        depreciation: [787.3, 841.6],
        amortGoodwill: [51.5, 51.5],
        capex: [-2067.2, -1948.7],
        salePPE: [0, 0],
        saleIntangibles: [-15.9, -18],
        cashAcquisitions: [0, 0],
        divestitures: [0, 0],
        sbc: [172.6, 195.3],
        issuanceStock: [0, 0],
        repurchaseStock: [0, 0],
        dividendsPaid: [0, 0],
        debtIssued: [0, 0],
        debtRepaid: [0, 0],
        netCashChangeHist: [5731.2, 2429.9],
        cashEquiv: [12735.9, 12916],
        totalCashSTI: [12750.6, 13322],
        inventory: [10891.5, 12485.788790251532],
        accountsReceivable: [4880.7, 4079.1],
        accountsPayable: [3500.4, 4012.785666014457],
        unearnedRevCurrent: [18196.2, 20859.744753723076],
        unearnedRevNonCurrent: [0, 0],
        stBorrowings: [1051.9, 0],
        currentLTD: [0, 0],
        finDivDebtCurrent: [0, 0],
        ltBorrowings: [3706.6, 2709],
        ltDebt: [0, 0],
        finDivDebtNC: [0, 0],
        currentCapLeases: [68.6, 80],
        ncCapLeases: [237.4, 280],
        totalEquity: [18476.8, 19612.2],
        assetWritedown: [0, 0],
        impairmentGoodwill: [0, 0],
        mergerRestructuring: [0, 0],
        legalSettlements: [0, 0],
        otherUnusualItems: [0, 0],
        marketCapMM: [266951.5791914569, 328104.4002552649],
      }),
      makeInputs(),
    );

    expect(result.hist[1].capexMant).toBeCloseTo(-859.6, 6);
    expect(result.hist[1].fcf).toBeCloseTo(11328.741629486007, 6);
    expect(result.hist[1].roic).toBeCloseTo(0.39720239629262394, 10);
    expect(result.hist[1].reinvRate).toBeCloseTo(0.09772488738894734, 10);
  });

  it("no double-counting saleIntangibles when |capexNeto| < depreciation", () => {
    // capex=-500, saleIntang=-100, salePPE=0 → capexNeto=-600, deprec=1000
    // |600| < 1000 → capexMant = capexNeto = -600 (NOT -600 + (-100) = -700)
    const result = calculateFullModel(
      makeRaw({
        years: [2024],
        revenues: [10000],
        operatingIncome: [2000],
        interestExpense: [-50],
        interestIncome: [10],
        taxExpense: [-400],
        minorityInterest: [0],
        dilutedShares: [100],
        basicShares: [100],
        depreciation: [1000],
        amortGoodwill: [200],
        capex: [-500],
        salePPE: [0],
        saleIntangibles: [-100],
        cashAcquisitions: [0],
        divestitures: [0],
        sbc: [50],
        issuanceStock: [0],
        repurchaseStock: [0],
        dividendsPaid: [0],
        debtIssued: [0],
        debtRepaid: [0],
        netCashChangeHist: [500],
        cashEquiv: [2000],
        totalCashSTI: [2500],
        inventory: [500],
        accountsReceivable: [300],
        accountsPayable: [400],
        unearnedRevCurrent: [100],
        unearnedRevNonCurrent: [0],
        stBorrowings: [0],
        currentLTD: [0],
        finDivDebtCurrent: [0],
        ltBorrowings: [1000],
        ltDebt: [0],
        finDivDebtNC: [0],
        currentCapLeases: [0],
        ncCapLeases: [0],
        totalEquity: [5000],
        assetWritedown: [0],
        impairmentGoodwill: [0],
        mergerRestructuring: [0],
        legalSettlements: [0],
        otherUnusualItems: [0],
        marketCapMM: [50000],
      }),
      makeInputs(),
    );

    expect(result.hist[0].capexMant).toBe(-600);
  });
});
