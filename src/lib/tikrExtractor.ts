/**
 * Extracts raw financial data from TIKR Excel sheets (7-10)
 * and manual inputs from sheets 1.IS, 2.FCF, 4.Valoracion.
 *
 * Designed to be robust across different TIKR template variations:
 *  - Flexible sheet name matching (fuzzy)
 *  - Label-based row search instead of fixed indices
 *  - Fallback search terms for TIKR row names
 *  - Handles Excel date serials, "LTM", and plain year numbers
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

// ─── Helpers ───

function toSheet(wb: XLSX.WorkBook, name: string): unknown[][] {
  const s = wb.Sheets[name];
  return s ? (XLSX.utils.sheet_to_json(s, { header: 1, defval: null }) as unknown[][]) : [];
}

/** Fuzzy find a sheet: matches if sheet name contains the key (case-insensitive) */
function findSheet(wb: XLSX.WorkBook, ...keys: string[]): unknown[][] {
  for (const key of keys) {
    const exact = wb.Sheets[key];
    if (exact) return XLSX.utils.sheet_to_json(exact, { header: 1, defval: null }) as unknown[][];
  }
  const lower = keys.map(k => k.toLowerCase());
  for (const name of wb.SheetNames) {
    const nl = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const k of lower) {
      const kn = k.replace(/[^a-z0-9]/g, "");
      if (nl.includes(kn) || nl === kn) {
        return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as unknown[][];
      }
    }
  }
  return [];
}

/** Find row by label: tries each term with startsWith, then includes as fallback */
function findRow(data: unknown[][], ...terms: string[]): unknown[] | null {
  for (const term of terms) {
    const t = term.toLowerCase();
    const exact = data.find(r => r?.[0] && String(r[0]).toLowerCase().startsWith(t));
    if (exact) return exact;
  }
  for (const term of terms) {
    const t = term.toLowerCase();
    const partial = data.find(r => r?.[0] && String(r[0]).toLowerCase().includes(t));
    if (partial) return partial;
  }
  return null;
}

/** Find row index by label */
function findRowIdx(data: unknown[][], ...terms: string[]): number {
  for (const term of terms) {
    const t = term.toLowerCase();
    const idx = data.findIndex(r => r?.[0] && String(r[0]).toLowerCase().startsWith(t));
    if (idx >= 0) return idx;
  }
  for (const term of terms) {
    const t = term.toLowerCase();
    const idx = data.findIndex(r => r?.[0] && String(r[0]).toLowerCase().includes(t));
    if (idx >= 0) return idx;
  }
  return -1;
}

function n(v: unknown): number {
  if (v == null || v === "" || v === "-") return 0;
  if (typeof v === "number") return v;
  const p = parseFloat(String(v).replace(/[,$\s]/g, ""));
  return isNaN(p) ? 0 : p;
}

/** Convert Excel serial date number to year */
function serialToYear(serial: number): number {
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
    } else if (typeof cell === "number") {
      if (cell > 30000 && cell < 60000) {
        years.push(serialToYear(cell));
        cols.push(c);
      } else if (cell >= 1990 && cell <= 2060) {
        years.push(cell);
        cols.push(c);
      }
    } else if (String(cell).toUpperCase() === "LTM") {
      years.push(years.length > 0 ? years[years.length - 1] + 1 : new Date().getFullYear());
      cols.push(c);
    } else {
      const yr = parseInt(String(cell), 10);
      if (yr >= 1990 && yr <= 2060) {
        years.push(yr);
        cols.push(c);
      }
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

// ─── TIKR raw data extraction ───

export function extractTikrData(wb: XLSX.WorkBook): TikrRawData | null {
  const is = findSheet(wb, "7.TIKR_IS", "TIKR_IS", "tikr_is");
  const bs = findSheet(wb, "8.TIKR_BS", "TIKR_BS", "tikr_bs");
  const cf = findSheet(wb, "9.TIKR_CF", "TIKR_CF", "tikr_cf");
  const vl = findSheet(wb, "10.TIKR_Val", "TIKR_Val", "tikr_val");
  if (is.length < 5) return null;

  const hdr = findHeader(is);
  if (hdr.years.length < 3) return null;
  const bsH = findHeader(bs);
  const cfH = findHeader(cf);
  const vlH = findHeader(vl);

  const g = (sheet: unknown[][], h: { cols: number[] }, ...terms: string[]) =>
    vals(findRow(sheet, ...terms), h.cols);

  return {
    years: hdr.years,
    revenues: g(is, hdr, "Total Revenues", "Revenue", "Ventas"),
    operatingIncome: g(is, hdr, "Operating Income", "EBIT"),
    interestExpense: g(is, hdr, "Interest Expense", "Gastos por intereses"),
    interestIncome: g(is, hdr, "Interest And Investment Income", "Interest Income", "Ingresos por intereses"),
    taxExpense: g(is, hdr, "Income Tax Expense", "Tax Expense", "Impuestos"),
    minorityInterest: g(is, hdr, "Minority Interest", "Non-Controlling Interest", "Interés minoritario"),
    dilutedShares: g(is, hdr, "Weighted Average Diluted Shares Outstanding", "Diluted Shares", "Acciones diluidas"),
    basicShares: g(is, hdr, "Weighted Average Basic Shares Outstanding", "Basic Shares", "Acciones básicas"),
    assetWritedown: g(is, hdr, "Asset Writedown", "Deterioro de activos"),
    impairmentGoodwill: g(is, hdr, "Impairment of Goodwill", "Deterioro fondo de comercio"),
    cashEquiv: g(bs, bsH, "Cash And Equivalents", "Cash & Equivalents", "Efectivo"),
    totalCashSTI: g(bs, bsH, "Total Cash And Short Term Investments", "Total Cash & STI", "Total efectivo"),
    inventory: g(bs, bsH, "Inventory", "Inventories", "Inventario"),
    accountsReceivable: g(bs, bsH, "Accounts Receivable", "Trade Receivables", "Cuentas por cobrar"),
    accountsPayable: g(bs, bsH, "Accounts Payable", "Trade Payables", "Cuentas por pagar"),
    unearnedRevCurrent: g(bs, bsH, "Unearned Revenue Current", "Deferred Revenue Current", "Ingresos diferidos corriente"),
    unearnedRevNonCurrent: g(bs, bsH, "Unearned Revenue Non Current", "Deferred Revenue Non Current", "Ingresos diferidos no corriente"),
    stBorrowings: g(bs, bsH, "Short-term Borrowings", "Short Term Borrowings", "Préstamos CP"),
    currentLTD: g(bs, bsH, "Current Portion of Long-Term Debt", "Current LTD", "Porción corriente deuda LP"),
    finDivDebtCurrent: g(bs, bsH, "Finance Division Debt Current"),
    ltBorrowings: g(bs, bsH, "Long-term Borrowings", "Long Term Borrowings", "Préstamos LP"),
    ltDebt: g(bs, bsH, "Long-Term Debt", "LT Debt", "Deuda LP"),
    finDivDebtNC: g(bs, bsH, "Finance Division Debt Non Current"),
    currentCapLeases: g(bs, bsH, "Current Portion of Capital Lease", "Current Operating Lease", "Arrendamientos corriente"),
    ncCapLeases: g(bs, bsH, "Capital Leases", "Operating Lease Liabilities", "Arrendamientos no corriente"),
    totalEquity: g(bs, bsH, "Total Equity", "Total Stockholders Equity", "Patrimonio total"),
    depreciation: g(cf, cfH, "Depreciation", "Depreciación"),
    amortGoodwill: g(cf, cfH, "Amortization of Goodwill", "Amortización fondo de comercio"),
    capex: g(cf, cfH, "Capital Expenditure", "CapEx", "Inversión en capital"),
    salePPE: g(cf, cfH, "Sale of Property, Plant, and Equipment", "Sale of PPE", "Venta de PPE"),
    saleIntangibles: g(cf, cfH, "Sale (Purchase) of Intangible", "Intangible assets", "Intangibles"),
    cashAcquisitions: g(cf, cfH, "Cash Acquisitions", "Acquisitions", "Adquisiciones"),
    divestitures: g(cf, cfH, "Divestitures", "Divestiture", "Desinversiones"),
    sbc: g(cf, cfH, "Stock-Based Compensation", "SBC", "Compensación en acciones"),
    issuanceStock: g(cf, cfH, "Issuance of Common Stock", "Stock Issuance", "Emisión de acciones"),
    repurchaseStock: g(cf, cfH, "Repurchase of Common Stock", "Buyback", "Recompra de acciones"),
    dividendsPaid: g(cf, cfH, "Common & Preferred Stock Dividends Paid", "Dividends Paid", "Dividendos pagados"),
    debtIssued: g(cf, cfH, "Total Debt Issued", "Debt Issued", "Deuda emitida"),
    debtRepaid: g(cf, cfH, "Total Debt Repaid", "Debt Repaid", "Deuda pagada"),
    netCashChangeHist: g(cf, cfH, "Net Change in Cash", "Cambio neto en efectivo"),
    marketCapMM: g(vl, vlH, "Market Cap (MM)", "Market Cap", "Capitalización"),
  };
}

// ─── Manual inputs extraction (label-based) ───

/**
 * Finds the projected columns: columns after the last historical year.
 * In sheet 1.IS, row 1 has years. Historical years are in cols ~1-10,
 * projected cols follow (typically 5 years).
 */
function findProjectedCols(headerRow: unknown[]): { lastHistCol: number; projCols: number[] } {
  const projCols: number[] = [];
  let lastHistCol = 0;

  // Parse all year-like values to find historical vs projected boundary
  const yearCols: { col: number; year: number }[] = [];
  for (let c = 1; c < headerRow.length; c++) {
    const cell = headerRow[c];
    if (cell == null) continue;
    let yr = 0;
    if (typeof cell === "number") {
      if (cell >= 1990 && cell <= 2060) yr = cell;
      else if (cell > 30000 && cell < 60000) yr = serialToYear(cell);
    } else {
      const p = parseInt(String(cell), 10);
      if (p >= 1990 && p <= 2060) yr = p;
    }
    if (yr > 0) yearCols.push({ col: c, year: yr });
  }

  if (yearCols.length === 0) return { lastHistCol: 10, projCols: [11, 12, 13, 14, 15] };

  // The last historical col is the last one before values jump to future / or
  // we detect a gap. For our templates, projected years follow sequentially.
  // Use heuristic: the last 5 consecutive years at the end are projected.
  const totalYears = yearCols.length;
  if (totalYears > 5) {
    lastHistCol = yearCols[totalYears - 6].col;
    projCols.push(...yearCols.slice(totalYears - 5).map(yc => yc.col));
  } else {
    lastHistCol = yearCols[0].col;
    projCols.push(...yearCols.slice(1).map(yc => yc.col));
  }

  return { lastHistCol, projCols };
}

export function extractManualInputs(wb: XLSX.WorkBook): TikrModelInputs | null {
  const is = findSheet(wb, "1.IS");
  const fcf = findSheet(wb, "2.FCF");
  const val = findSheet(wb, "4.Valoracion", "4.Valoración");
  if (is.length < 10) return null;

  // Find header row (the one with years, typically row 1)
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(5, is.length); r++) {
    const row = is[r];
    if (!row) continue;
    const hasYear = row.some((cell: unknown) => {
      if (typeof cell === "number") return (cell >= 2000 && cell <= 2060) || (cell > 30000 && cell < 60000);
      return false;
    });
    if (hasYear) { headerRowIdx = r; break; }
  }
  if (headerRowIdx < 0) headerRowIdx = 1;

  const { lastHistCol, projCols } = findProjectedCols(is[headerRowIdx] || []);

  // Find rows by label in 1.IS
  const salesRow = findRowIdx(is, "sales", "ventas", "total revenues");
  const growthRow = salesRow >= 0 && salesRow + 1 < is.length ? salesRow + 1 : -1;
  const daRow = findRowIdx(is, "depreciation & amortization", "d&a", "deprec");
  const ebitRow = findRowIdx(is, "ebit ");
  const ebitMarginRow = ebitRow >= 0 && ebitRow + 1 < is.length ? ebitRow + 1 : -1;
  const sharesRow = findRowIdx(is, "fully diluted shares", "diluted shares", "acciones diluidas");
  const shareGrowthRow = sharesRow >= 0 && sharesRow + 1 < is.length ? sharesRow + 1 : -1;

  // Extract values
  const lastSales = n(is[salesRow]?.[lastHistCol]);
  const lastDA = n(is[daRow >= 0 ? daRow : 7]?.[lastHistCol]);
  const lastShares = n(is[sharesRow >= 0 ? sharesRow : 24]?.[lastHistCol]);

  const growthRates = projCols.map(c => n(is[growthRow >= 0 ? growthRow : 3]?.[c]));
  const ebitMarginEst = projCols.map(c => n(is[ebitMarginRow >= 0 ? ebitMarginRow : 9]?.[c]));
  const shareDilutionRate = n(is[shareGrowthRow >= 0 ? shareGrowthRow : 25]?.[projCols[0]]);

  // Find rows by label in 2.FCF
  const capexSalesRow = findRowIdx(fcf, "capex mantenimiento / ventas", "capex mant", "maintenance capex / sales");
  const wcSalesRow = findRowIdx(fcf, "working capital / ventas", "wc / ventas", "wc / sales");
  const netCashRow = findRowIdx(fcf, "net change in cash", "cambio neto en efectivo", "net cash change");

  // For FCF, find its own header and projected columns
  let fcfProjCols = projCols;
  if (fcf.length > 0) {
    let fcfHeaderIdx = -1;
    for (let r = 0; r < Math.min(5, fcf.length); r++) {
      const row = fcf[r];
      if (!row) continue;
      const hasYear = row.some((cell: unknown) => {
        if (typeof cell === "number") return (cell >= 2000 && cell <= 2060) || (cell > 30000 && cell < 60000);
        return false;
      });
      if (hasYear) { fcfHeaderIdx = r; break; }
    }
    if (fcfHeaderIdx >= 0) {
      const fcfLayout = findProjectedCols(fcf[fcfHeaderIdx]);
      fcfProjCols = fcfLayout.projCols;
    }
  }

  const capexMantToSales = n(fcf[capexSalesRow >= 0 ? capexSalesRow : 21]?.[fcfProjCols[0]]);
  const wcToSalesEst = n(fcf[wcSalesRow >= 0 ? wcSalesRow : 22]?.[fcfProjCols[0]]);
  const netCashChange = fcfProjCols.map(c => n(fcf[netCashRow >= 0 ? netCashRow : 18]?.[c]));

  // Find rows by label in 4.Valoracion
  const priceRow = findRowIdx(val, "precio por acción actual", "current price", "precio actual");
  const targetReturnRow = findRowIdx(val, "retorno anual objetivo", "target return", "rendimiento objetivo");

  // Target multiples: look for "Múltiplos de valoración" section with "Objetivo" in col 1
  let targetMultiplesStart = -1;
  for (let r = 0; r < val.length; r++) {
    const label = String(val[r]?.[0] || "").toLowerCase();
    const col1 = String(val[r]?.[1] || "").toLowerCase();
    if (label.includes("múltiplos de valoración") && col1.includes("objetivo")) {
      targetMultiplesStart = r;
      break;
    }
  }
  // If not found with "Objetivo", try the second "Múltiplos" section
  if (targetMultiplesStart < 0) {
    let count = 0;
    for (let r = 0; r < val.length; r++) {
      if (String(val[r]?.[0] || "").toLowerCase().includes("múltiplos")) {
        count++;
        if (count === 2) { targetMultiplesStart = r; break; }
      }
    }
  }

  let targetPER = 20, targetEVFCF = 20, targetEVEBITDA = 15, targetEVEBIT = 15;
  if (targetMultiplesStart >= 0) {
    // Scan rows after the header for PER, EV/FCF, EV/EBITDA, EV/EBIT
    for (let r = targetMultiplesStart + 1; r < Math.min(targetMultiplesStart + 6, val.length); r++) {
      const label = String(val[r]?.[0] || "").toLowerCase().trim();
      const v = n(val[r]?.[1]);
      if (label === "per") targetPER = v;
      else if (label.includes("ev / fcf") || label.includes("ev/fcf")) targetEVFCF = v;
      else if (label.includes("ev / ebitda") || label.includes("ev/ebitda")) targetEVEBITDA = v;
      else if (label.includes("ev / ebit") || label.includes("ev/ebit")) targetEVEBIT = v;
    }
  }

  // Net debt / EBITDA from 4.Valoracion
  let valProjCols = projCols;
  if (val.length > 0) {
    let valHeaderIdx = -1;
    for (let r = 0; r < Math.min(5, val.length); r++) {
      const row = val[r];
      if (!row) continue;
      const hasYear = row.some((cell: unknown) => {
        if (typeof cell === "number") return (cell >= 2000 && cell <= 2060) || (cell > 30000 && cell < 60000);
        return false;
      });
      if (hasYear) { valHeaderIdx = r; break; }
    }
    if (valHeaderIdx >= 0) {
      const vl = findProjectedCols(val[valHeaderIdx]);
      valProjCols = vl.projCols;
    }
  }
  const ndEbitdaRow = findRowIdx(val, "deuda neta / ebitda", "net debt / ebitda", "nd/ebitda");
  const netDebtToEBITDA = valProjCols.map(c => n(val[ndEbitdaRow >= 0 ? ndEbitdaRow : 4]?.[c]));

  return {
    lastSales,
    lastDA,
    lastShares,
    growthRates,
    ebitMarginEst,
    shareDilutionRate,
    capexMantToSales,
    wcToSalesEst,
    netCashChange,
    netDebtToEBITDA,
    currentPrice: n(val[priceRow >= 0 ? priceRow : 18]?.[1]),
    targetPER,
    targetEVFCF,
    targetEVEBITDA,
    targetEVEBIT,
    targetReturn: n(val[targetReturnRow >= 0 ? targetReturnRow : 50]?.[1]) || 0.15,
  };
}
