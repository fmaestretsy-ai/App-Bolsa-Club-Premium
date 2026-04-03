/**
 * Extracts raw financial data from TIKR Excel sheets (7-10)
 * and manual inputs from sheets 1.IS, 2.FCF, 4.Valoracion.
 */
import * as XLSX from "xlsx";

export interface TikrRawData {
  years: number[];
  revenues: number[];
  operatingIncome: number[];
  interestExpense: number[];
  interestIncome: number[];
  taxExpense: number[];
  minorityInterest: number[];
  dilutedShares: number[];
  basicShares: number[];
  assetWritedown: number[];
  impairmentGoodwill: number[];
  cashEquiv: number[];
  totalCashSTI: number[];
  inventory: number[];
  accountsReceivable: number[];
  accountsPayable: number[];
  unearnedRevCurrent: number[];
  unearnedRevNonCurrent: number[];
  stBorrowings: number[];
  currentLTD: number[];
  finDivDebtCurrent: number[];
  ltBorrowings: number[];
  ltDebt: number[];
  finDivDebtNC: number[];
  currentCapLeases: number[];
  ncCapLeases: number[];
  totalEquity: number[];
  depreciation: number[];
  amortGoodwill: number[];
  capex: number[];
  salePPE: number[];
  saleIntangibles: number[];
  cashAcquisitions: number[];
  divestitures: number[];
  sbc: number[];
  issuanceStock: number[];
  repurchaseStock: number[];
  dividendsPaid: number[];
  debtIssued: number[];
  debtRepaid: number[];
  netCashChangeHist: number[];
  marketCapMM: number[];
}

export interface TikrModelInputs {
  lastSales: number;
  lastDA: number;
  lastShares: number;
  growthRates: number[];
  ebitMarginEst: number[];
  shareDilutionRate: number;
  capexMantToSales: number;
  wcToSalesEst: number;
  netCashChange: number[];
  netDebtToEBITDA: number[];
  currentPrice: number;
  targetPER: number;
  targetEVFCF: number;
  targetEVEBITDA: number;
  targetEVEBIT: number;
  targetReturn: number;
}

function toSheet(wb: XLSX.WorkBook, name: string): unknown[][] {
  const s = wb.Sheets[name];
  return s ? (XLSX.utils.sheet_to_json(s, { header: 1, defval: null }) as unknown[][]) : [];
}

function findRow(data: unknown[][], term: string): unknown[] | null {
  return data.find(r => r?.[0] && String(r[0]).startsWith(term)) ?? null;
}

function n(v: unknown): number {
  if (v == null || v === "" || v === "-") return 0;
  if (typeof v === "number") return v;
  const p = parseFloat(String(v).replace(/[,$\s]/g, ""));
  return isNaN(p) ? 0 : p;
}

/** Convert Excel serial date number to year */
function serialToYear(serial: number): number {
  // Excel epoch: 1900-01-01 = 1 (with the Lotus 1-2-3 bug)
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.getFullYear();
}

function parseYears(row: unknown[]): { years: number[]; cols: number[] } {
  const years: number[] = [], cols: number[] = [];
  if (!row) return { years, cols };
  for (let c = 1; c < row.length; c++) {
    const cell = row[c];
    if (cell == null) continue;
    if (typeof cell === "object" && cell !== null && typeof (cell as any).getFullYear === "function") {
      years.push((cell as Date).getFullYear());
      cols.push(c);
    } else if (typeof cell === "number" && cell > 30000 && cell < 60000) {
      // Excel date serial number
      years.push(serialToYear(cell));
      cols.push(c);
    } else if (String(cell).toUpperCase() === "LTM") {
      years.push(years.length > 0 ? years[years.length - 1] + 1 : new Date().getFullYear());
      cols.push(c);
    }
  }
  return { years, cols };
}

function vals(row: unknown[] | null, cols: number[]): number[] {
  return cols.map(c => n(row?.[c]));
}

function findHeader(sheet: unknown[][]): { years: number[]; cols: number[] } {
  let best = { years: [] as number[], cols: [] as number[] };
  for (let r = 0; r < Math.min(5, sheet.length); r++) {
    const h = parseYears(sheet[r] || []);
    if (h.years.length > best.years.length) best = h;
  }
  return best;
}

export function extractTikrData(wb: XLSX.WorkBook): TikrRawData | null {
  const is = toSheet(wb, "7.TIKR_IS");
  const bs = toSheet(wb, "8.TIKR_BS");
  const cf = toSheet(wb, "9.TIKR_CF");
  const vl = toSheet(wb, "10.TIKR_Val");
  if (is.length < 5) return null;

  const hdr = findHeader(is);
  if (hdr.years.length < 3) return null;
  const bsH = findHeader(bs);
  const cfH = findHeader(cf);
  const vlH = findHeader(vl);

  const g = (sheet: unknown[][], term: string, h = hdr) => vals(findRow(sheet, term), h.cols);

  return {
    years: hdr.years,
    revenues: g(is, "Total Revenues"),
    operatingIncome: g(is, "Operating Income"),
    interestExpense: g(is, "Interest Expense"),
    interestIncome: g(is, "Interest And Investment Income"),
    taxExpense: g(is, "Income Tax Expense"),
    minorityInterest: g(is, "Minority Interest"),
    dilutedShares: g(is, "Weighted Average Diluted Shares Outstanding"),
    basicShares: g(is, "Weighted Average Basic Shares Outstanding"),
    assetWritedown: g(is, "Asset Writedown"),
    impairmentGoodwill: g(is, "Impairment of Goodwill"),
    cashEquiv: g(bs, "Cash And Equivalents", bsH),
    totalCashSTI: g(bs, "Total Cash And Short Term Investments", bsH),
    inventory: g(bs, "Inventory", bsH),
    accountsReceivable: g(bs, "Accounts Receivable", bsH),
    accountsPayable: g(bs, "Accounts Payable", bsH),
    unearnedRevCurrent: g(bs, "Unearned Revenue Current", bsH),
    unearnedRevNonCurrent: g(bs, "Unearned Revenue Non Current", bsH),
    stBorrowings: g(bs, "Short-term Borrowings", bsH),
    currentLTD: g(bs, "Current Portion of Long-Term Debt", bsH),
    finDivDebtCurrent: g(bs, "Finance Division Debt Current", bsH),
    ltBorrowings: g(bs, "Long-term Borrowings", bsH),
    ltDebt: g(bs, "Long-Term Debt", bsH),
    finDivDebtNC: g(bs, "Finance Division Debt Non Current", bsH),
    currentCapLeases: g(bs, "Current Portion of Capital Lease Obligations", bsH),
    ncCapLeases: g(bs, "Capital Leases", bsH),
    totalEquity: g(bs, "Total Equity", bsH),
    depreciation: g(cf, "Depreciation", cfH),
    amortGoodwill: g(cf, "Amortization of Goodwill", cfH),
    capex: g(cf, "Capital Expenditure", cfH),
    salePPE: g(cf, "Sale of Property, Plant, and Equipment", cfH),
    saleIntangibles: g(cf, "Sale (Purchase) of Intangible assets", cfH),
    cashAcquisitions: g(cf, "Cash Acquisitions", cfH),
    divestitures: g(cf, "Divestitures", cfH),
    sbc: g(cf, "Stock-Based Compensation", cfH),
    issuanceStock: g(cf, "Issuance of Common Stock", cfH),
    repurchaseStock: g(cf, "Repurchase of Common Stock", cfH),
    dividendsPaid: g(cf, "Common & Preferred Stock Dividends Paid", cfH),
    debtIssued: g(cf, "Total Debt Issued", cfH),
    debtRepaid: g(cf, "Total Debt Repaid", cfH),
    netCashChangeHist: g(cf, "Net Change in Cash", cfH),
    marketCapMM: g(vl, "Market Cap (MM)", vlH),
  };
}

export function extractManualInputs(wb: XLSX.WorkBook): TikrModelInputs | null {
  const is = toSheet(wb, "1.IS");
  const fcf = toSheet(wb, "2.FCF");
  const val = toSheet(wb, "4.Valoracion");
  if (is.length < 26) return null;

  return {
    lastSales: n(is[2]?.[10]),
    lastDA: n(is[7]?.[10]),
    lastShares: n(is[24]?.[10]),
    growthRates: [11, 12, 13, 14, 15].map(c => n(is[3]?.[c])),
    ebitMarginEst: [11, 12, 13, 14, 15].map(c => n(is[9]?.[c])),
    shareDilutionRate: n(is[25]?.[11]),
    capexMantToSales: n(fcf?.[21]?.[11]),
    wcToSalesEst: n(fcf?.[22]?.[11]),
    netCashChange: [11, 12, 13, 14, 15].map(c => n(fcf?.[18]?.[c])),
    netDebtToEBITDA: [11, 12, 13, 14, 15].map(c => n(val?.[4]?.[c])),
    currentPrice: n(val?.[18]?.[1]),
    targetPER: n(val?.[21]?.[1]),
    targetEVFCF: n(val?.[22]?.[1]),
    targetEVEBITDA: n(val?.[23]?.[1]),
    targetEVEBIT: n(val?.[24]?.[1]),
    targetReturn: n(val?.[50]?.[1]),
  };
}
