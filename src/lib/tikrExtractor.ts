/**
 * Extracts raw financial data from TIKR Excel sheets (7-10)
 * and manual inputs from sheets 1.IS, 2.FCF, 4.Valoracion.
 *
 * Robust across different TIKR template variations:
 *  - Flexible sheet name matching (fuzzy)
 *  - Label-based row search with fallback terms
 *  - Skips TIKR "LTM" column; reads 2025 from summary sheets
 *  - Handles Excel date serials, plain year numbers, and string years
 */
import * as XLSX from "xlsx";

export interface TikrRawData {
  currency: string | null;
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
  mergerRestructuring: number[];
  legalSettlements: number[];
  otherUnusualItems: number[];
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
  capexMantToSales: number[];
  wcToSalesEst: number[];
  netCashChange: number[];
  netDebtToEBITDA: number[];
  currentPrice: number;
  targetPER: number;
  targetEVFCF: number;
  targetEVEBITDA: number;
  targetEVEBIT: number;
  taxRateEst: number[];
  targetReturn: number;
}

// ─── Helpers ───

function findSheet(wb: XLSX.WorkBook, ...keys: string[]): unknown[][] {
  for (const key of keys) {
    const s = wb.Sheets[key];
    if (s) return XLSX.utils.sheet_to_json(s, { header: 1, defval: null }) as unknown[][];
  }
  const lower = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const name of wb.SheetNames) {
    const nl = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const kn of lower) {
      if (nl.includes(kn) || nl === kn) {
        return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as unknown[][];
      }
    }
  }
  return [];
}

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

function normalizeLabel(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMetricLabel(value: unknown): string {
  return normalizeLabel(value)
    .replace(/\s+/g, "")
    .replace(/[()]/g, "");
}

function isNumericLike(value: unknown): boolean {
  if (typeof value === "number") return isFinite(value);
  if (typeof value !== "string") return false;
  const cleaned = value.replace(/[,$\s]/g, "").trim();
  return cleaned !== "" && !Number.isNaN(Number(cleaned));
}

function extractPrimaryPrice(row: unknown[] | null): number {
  if (!row) return 0;
  let lastNumeric = 0;
  let seenNumeric = false;

  for (let c = 1; c < row.length; c++) {
    const cell = row[c];
    if (cell == null || cell === "") continue;
    if (isNumericLike(cell)) {
      lastNumeric = n(cell);
      seenNumeric = true;
      continue;
    }
    if (seenNumeric) break;
  }

  return lastNumeric;
}

function findExactLabelRow(data: unknown[][], ...labels: string[]): unknown[] | null {
  const wanted = labels.map(normalizeLabel);
  return data.find((row) => wanted.includes(normalizeLabel(row?.[0]))) ?? null;
}

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

function serialToYear(serial: number): number {
  const epoch = new Date(1899, 11, 30);
  const d = new Date(epoch.getTime() + serial * 86400000);
  return d.getFullYear();
}

/**
 * Parse years from a header row, SKIPPING "LTM" columns.
 * Only keeps fiscal year columns (date serials or plain year numbers).
 */
function parseYears(row: unknown[]): { years: number[]; cols: number[] } {
  const years: number[] = [], cols: number[] = [];
  if (!row) return { years, cols };
  for (let c = 1; c < row.length; c++) {
    const cell = row[c];
    if (cell == null) continue;
    // Skip LTM
    if (typeof cell === "string" && cell.toUpperCase() === "LTM") continue;
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

function findSaleIntangiblesValues(sheet: unknown[][], cols: number[]): number[] {
  const row = sheet.find(r => {
    const label = String(r?.[0] || "").toLowerCase().trim();
    return (label.startsWith("sale") || label.startsWith("venta")) && label.includes("intang");
  }) ?? null;

  return vals(row, cols);
}

function findDepreciationValues(sheet: unknown[][], cols: number[]): number[] {
  const row =
    findExactLabelRow(sheet, "Depreciation", "Depreciation*", "Depreciación") ??
    sheet.find((r) => {
      const label = normalizeLabel(r?.[0]);
      return label.startsWith("depreciation") && !label.includes("amort");
    }) ??
    findRow(sheet, "Depreciation", "Depreciación");

  return vals(row, cols);
}

function findAmortizationValues(sheet: unknown[][], cols: number[]): number[] {
  const row =
    findExactLabelRow(
      sheet,
      "Amortization of Goodwill and Intangible Assets",
      "Amortization of Goodwill",
      "Amortización fondo de comercio",
    ) ??
    findRow(
      sheet,
      "Amortization of Goodwill and Intangible Assets",
      "Amortization of Goodwill",
      "Amortización fondo de comercio",
    );

  return vals(row, cols);
}

// ─── Currency detection ───

const CURRENCY_CODES = "USD|EUR|GBP|JPY|CHF|SEK|NOK|DKK|CAD|AUD|CNY|KRW|INR|HKD|SGD|TWD|MXN|BRL|PLN|ZAR|TRY|CLP|COP|PEN|ARS|ILS|RUB|NZD|THB|IDR|PHP|MYR|VND|CZK|HUF|RON";
const CURRENCY_PATTERN = new RegExp(`(?:amounts?|values?|currency|moneda|reported)\\s+(?:in\\s+)?(${CURRENCY_CODES})`, "i");
const UNIT_PATTERN = new RegExp(`(${CURRENCY_CODES})\\s*(?:millions?|thousands?|billions?|MM|M|K|B)`, "i");

export function detectCurrency(wb: XLSX.WorkBook): string | null {
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    for (let r = 0; r < Math.min(6, data.length); r++) {
      const row = data[r];
      if (!row) continue;
      for (const cell of row) {
        const s = String(cell ?? "");
        const m = s.match(CURRENCY_PATTERN) || s.match(UNIT_PATTERN);
        if (m) return m[1].toUpperCase();
      }
    }
  }
  return null;
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

  const raw: TikrRawData = {
    currency: detectCurrency(wb),
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
    mergerRestructuring: g(is, hdr, "Merger & Restructuring", "Merger and Restructuring", "Restructuring Charges"),
    legalSettlements: g(is, hdr, "Legal Settlements", "Acuerdos legales"),
    otherUnusualItems: g(is, hdr, "Other Unusual Items", "Otros elementos inusuales"),
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
    depreciation: findDepreciationValues(cf, cfH.cols),
    amortGoodwill: findAmortizationValues(cf, cfH.cols),
    capex: g(cf, cfH, "Capital Expenditure", "CapEx", "Inversión en capital"),
    salePPE: g(cf, cfH, "Sale of Property, Plant, and Equipment", "Sale of PPE", "Venta de PPE"),
    saleIntangibles: findSaleIntangiblesValues(cf, cfH.cols),
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

  // ─── Append 2025 from summary sheets (replacing LTM) ───
  appendLTMFromSummary(wb, raw);

  return raw;
}

/**
 * Read computed 2025 values from 1.IS, 2.FCF, 3.ROIC, 4.Valoracion
 * and CF items from TIKR CF LTM column.
 */
function appendLTMFromSummary(wb: XLSX.WorkBook, raw: TikrRawData): void {
  const is1 = findSheet(wb, "1.IS");
  const fcf2 = findSheet(wb, "2.FCF");
  const roic3 = findSheet(wb, "3.ROIC");
  const val4 = findSheet(wb, "4.Valoracion", "4.Valoración");

  if (is1.length < 10) return;

  // Find the last historical year column in 1.IS (the one right before projected cols)
  const headerRow = is1[1];
  if (!headerRow) return;
  const { lastHistCol } = findProjectedCols(headerRow);
  const lastHistCellVal = headerRow[lastHistCol];
  let summaryLastYear = 0;
  if (typeof lastHistCellVal === "number") {
    summaryLastYear = lastHistCellVal >= 1990 && lastHistCellVal <= 2060
      ? lastHistCellVal
      : lastHistCellVal > 30000 ? serialToYear(lastHistCellVal) : 0;
  } else {
    const p = parseInt(String(lastHistCellVal), 10);
    if (p >= 1990 && p <= 2060) summaryLastYear = p;
  }
  if (summaryLastYear === 0) return;
  const col2025 = lastHistCol;

  const lastTikrYear = raw.years[raw.years.length - 1] || 0;
  // If the TIKR data already includes this year, don't append again
  if (lastTikrYear >= summaryLastYear) return;
  const year2025 = summaryLastYear;

  // Read key IS values
  const salesRow = findRowIdx(is1, "sales", "ventas");
  const daRow = findRowIdx(is1, "depreciation & amortization", "d&a");
  const ebitRow = findRowIdx(is1, "ebit ");
  const intExpRow = findRowIdx(is1, "interest expense");
  const intIncRow = findRowIdx(is1, "interest income");
  const taxRow = findRowIdx(is1, "tax expense", "impuesto");
  const miRow = findRowIdx(is1, "minority interest");
  const sharesRow = findRowIdx(is1, "fully diluted shares", "diluted shares");

  const sales2025 = n(is1[salesRow >= 0 ? salesRow : 2]?.[col2025]);
  const ebit2025 = n(is1[ebitRow >= 0 ? ebitRow : 8]?.[col2025]);
  const intExp2025 = n(is1[intExpRow >= 0 ? intExpRow : 11]?.[col2025]);
  const intInc2025 = n(is1[intIncRow >= 0 ? intIncRow : 12]?.[col2025]);
  const tax2025 = n(is1[taxRow >= 0 ? taxRow : 15]?.[col2025]);
  const mi2025 = n(is1[miRow >= 0 ? miRow : 18]?.[col2025]);
  const shares2025 = n(is1[sharesRow >= 0 ? sharesRow : 24]?.[col2025]);

  // Read FCF-related values
  const arRow = findRowIdx(fcf2, "accounts receivable");
  const apRow = findRowIdx(fcf2, "accounts payable");
  const invRow = findRowIdx(fcf2, "inventories", "+) inventories");
  const urRow = findRowIdx(fcf2, "unearned revenue");
  const ncRow = findRowIdx(fcf2, "net change in cash", "cambio neto");

  const ar2025 = n(fcf2[arRow >= 0 ? arRow : 7]?.[col2025]);
  const ap2025 = n(fcf2[apRow >= 0 ? apRow : 8]?.[col2025]);
  const inv2025 = n(fcf2[invRow >= 0 ? invRow : 6]?.[col2025]);
  const ur2025 = n(fcf2[urRow >= 0 ? urRow : 9]?.[col2025]);
  const nc2025 = n(fcf2[ncRow >= 0 ? ncRow : 18]?.[col2025]);

  // Read ROIC BS values
  const cashRow3 = findRowIdx(roic3, "cash and cash equivalents", "efectivo");
  const mktSecRow3 = findRowIdx(roic3, "marketable securities");
  const stDebtRow3 = findRowIdx(roic3, "short-term debt");
  const ltDebtRow3 = findRowIdx(roic3, "long-term debt");
  const curLeaseRow3 = findRowIdx(roic3, "current operating lease", "current portion of capital lease");
  const ncLeaseRow3 = findRowIdx(roic3, "non-current operating lease", "capital leases");
  const equityRow3 = findRowIdx(roic3, "equity");

  const cash2025 = n(roic3[cashRow3 >= 0 ? cashRow3 : 3]?.[col2025]);
  const mktSec2025 = n(roic3[mktSecRow3 >= 0 ? mktSecRow3 : 4]?.[col2025]);
  const stDebt2025 = n(roic3[stDebtRow3 >= 0 ? stDebtRow3 : 5]?.[col2025]);
  const ltDebt2025 = n(roic3[ltDebtRow3 >= 0 ? ltDebtRow3 : 6]?.[col2025]);
  const curLease2025 = n(roic3[curLeaseRow3 >= 0 ? curLeaseRow3 : 7]?.[col2025]);
  const ncLease2025 = n(roic3[ncLeaseRow3 >= 0 ? ncLeaseRow3 : 8]?.[col2025]);
  const equity2025 = n(roic3[equityRow3 >= 0 ? equityRow3 : 9]?.[col2025]);

  // Read Market Cap from 4.Valoracion
  const mktCapRow4 = findRowIdx(val4, "market cap");
  const mktCap2025 = n(val4[mktCapRow4 >= 0 ? mktCapRow4 : 2]?.[col2025]);

  // ─── Read CF items from TIKR CF LTM column ───
  const cfSheet = findSheet(wb, "9.TIKR_CF", "TIKR_CF", "tikr_cf");
  let ltmCol = -1;
  for (let r = 0; r < Math.min(5, cfSheet.length); r++) {
    const row = cfSheet[r];
    if (!row) continue;
    for (let c = 1; c < row.length; c++) {
      if (typeof row[c] === "string" && (row[c] as string).toUpperCase() === "LTM") { ltmCol = c; break; }
    }
    if (ltmCol >= 0) break;
  }

  const cfVal = (...terms: string[]) => {
    const row = findRow(cfSheet, ...terms);
    return row && ltmCol >= 0 ? n(row[ltmCol]) : 0;
  };

  const cfExactVal = (...terms: string[]) => {
    const row = findExactLabelRow(cfSheet, ...terms);
    return row && ltmCol >= 0 ? n(row[ltmCol]) : 0;
  };

  const capex2025 = cfVal("Capital Expenditure", "CapEx");
  const depreciation2025 = cfExactVal("Depreciation", "Depreciation*");
  const amortGoodwill2025 = cfExactVal(
    "Amortization of Goodwill and Intangible Assets",
    "Amortization of Goodwill",
  );
  const salePPE2025 = cfVal("Sale of Property, Plant, and Equipment", "Sale of PPE");
  const saleIntang2025 = cfVal("Sale (Purchase) of Intangible", "Intangible assets");
  const acq2025 = cfVal("Cash Acquisitions", "Acquisitions");
  const divest2025 = cfVal("Divestitures", "Divestiture");
  const sbc2025 = cfVal("Stock-Based Compensation", "SBC");
  const issueStock2025 = cfVal("Issuance of Common Stock", "Stock Issuance");
  const repurchase2025 = cfVal("Repurchase of Common Stock", "Buyback");
  const divPaid2025 = cfVal("Common & Preferred Stock Dividends Paid", "Dividends Paid");
  const debtIssued2025 = cfVal("Total Debt Issued", "Debt Issued");
  const debtRepaid2025 = cfVal("Total Debt Repaid", "Debt Repaid");
  const assetWD2025 = cfVal("Asset Writedown", "Restructuring Costs");
  const impGW2025 = cfVal("Impairment of Goodwill");

  // ─── Read extraordinary items from IS LTM column ───
  const isSheet = findSheet(wb, "7.TIKR_IS", "TIKR_IS", "tikr_is");
  let isLtmCol = -1;
  for (let r = 0; r < Math.min(5, isSheet.length); r++) {
    const row = isSheet[r];
    if (!row) continue;
    for (let c = 1; c < row.length; c++) {
      if (typeof row[c] === "string" && (row[c] as string).toUpperCase() === "LTM") { isLtmCol = c; break; }
    }
    if (isLtmCol >= 0) break;
  }
  const isLtmVal = (...terms: string[]) => {
    const row = findRow(isSheet, ...terms);
    return row && isLtmCol >= 0 ? n(row[isLtmCol]) : 0;
  };
  const mergerRestr2025 = isLtmVal("Merger & Restructuring", "Merger and Restructuring", "Restructuring Charges");
  const legalSettl2025 = isLtmVal("Legal Settlements", "Acuerdos legales");
  const otherUnusual2025 = isLtmVal("Other Unusual Items", "Otros elementos inusuales");

  // Append to raw data
  raw.years.push(year2025);
  raw.revenues.push(sales2025);
  raw.operatingIncome.push(ebit2025);
  raw.interestExpense.push(intExp2025);
  raw.interestIncome.push(intInc2025);
  raw.taxExpense.push(tax2025);
  raw.minorityInterest.push(mi2025);
  raw.dilutedShares.push(shares2025);
  raw.basicShares.push(shares2025);
  raw.assetWritedown.push(assetWD2025);
  raw.impairmentGoodwill.push(impGW2025);
  raw.cashEquiv.push(cash2025);
  raw.totalCashSTI.push(cash2025 + mktSec2025);
  raw.inventory.push(inv2025);
  raw.accountsReceivable.push(ar2025);
  raw.accountsPayable.push(ap2025);
  raw.unearnedRevCurrent.push(ur2025);
  raw.unearnedRevNonCurrent.push(0);
  raw.stBorrowings.push(0);
  raw.currentLTD.push(stDebt2025);
  raw.finDivDebtCurrent.push(0);
  raw.ltBorrowings.push(0);
  raw.ltDebt.push(ltDebt2025);
  raw.finDivDebtNC.push(0);
  raw.currentCapLeases.push(curLease2025);
  raw.ncCapLeases.push(ncLease2025);
  raw.totalEquity.push(equity2025);
  raw.depreciation.push(depreciation2025);
  raw.amortGoodwill.push(amortGoodwill2025);
  raw.capex.push(capex2025);
  raw.salePPE.push(salePPE2025);
  raw.saleIntangibles.push(saleIntang2025);
  raw.cashAcquisitions.push(acq2025);
  raw.divestitures.push(divest2025);
  raw.sbc.push(sbc2025);
  raw.issuanceStock.push(issueStock2025);
  raw.repurchaseStock.push(repurchase2025);
  raw.dividendsPaid.push(divPaid2025);
  raw.debtIssued.push(debtIssued2025);
  raw.debtRepaid.push(debtRepaid2025);
  raw.netCashChangeHist.push(nc2025);
  raw.marketCapMM.push(mktCap2025);
  raw.mergerRestructuring.push(mergerRestr2025);
  raw.legalSettlements.push(legalSettl2025);
  raw.otherUnusualItems.push(otherUnusual2025);
}

// ─── Manual inputs extraction (label-based) ───

function findProjectedCols(headerRow: unknown[]): { lastHistCol: number; projCols: number[] } {
  const projCols: number[] = [];
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
  const totalYears = yearCols.length;
  let lastHistCol: number;
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

  const salesRow = findRowIdx(is, "sales", "ventas", "total revenues");
  const growthRow = salesRow >= 0 && salesRow + 1 < is.length ? salesRow + 1 : -1;
  const daRow = findRowIdx(is, "depreciation & amortization", "d&a", "deprec");
  const ebitRow = findRowIdx(is, "ebit ");
  const ebitMarginRow = ebitRow >= 0 && ebitRow + 1 < is.length ? ebitRow + 1 : -1;
  const sharesRow = findRowIdx(is, "fully diluted shares", "diluted shares", "acciones diluidas");
  const shareGrowthRow = sharesRow >= 0 && sharesRow + 1 < is.length ? sharesRow + 1 : -1;

  const lastSales = n(is[salesRow >= 0 ? salesRow : 2]?.[lastHistCol]);
  const lastDA = n(is[daRow >= 0 ? daRow : 7]?.[lastHistCol]);
  const lastShares = n(is[sharesRow >= 0 ? sharesRow : 24]?.[lastHistCol]);
  const growthRates = projCols.map(c => n(is[growthRow >= 0 ? growthRow : 3]?.[c]));
  const ebitMarginEst = projCols.map(c => n(is[ebitMarginRow >= 0 ? ebitMarginRow : 9]?.[c]));
  const shareDilutionRate = n(is[shareGrowthRow >= 0 ? shareGrowthRow : 25]?.[projCols[0]]);

  const capexSalesRow = findRowIdx(fcf, "capex mantenimiento / ventas", "capex mant", "maintenance capex / sales");
  const wcSalesRow = findRowIdx(fcf, "working capital / ventas", "wc / ventas", "wc / sales");
  const netCashRow = findRowIdx(fcf, "net change in cash", "cambio neto en efectivo", "net cash change");

  let fcfProjCols = projCols;
  if (fcf.length > 0) {
    for (let r = 0; r < Math.min(5, fcf.length); r++) {
      const row = fcf[r];
      if (!row) continue;
      const hasYear = row.some((cell: unknown) => {
        if (typeof cell === "number") return (cell >= 2000 && cell <= 2060) || (cell > 30000 && cell < 60000);
        return false;
      });
      if (hasYear) {
        fcfProjCols = findProjectedCols(fcf[r]).projCols;
        break;
      }
    }
  }

  const capexMantToSales = fcfProjCols.map(c => n(fcf[capexSalesRow >= 0 ? capexSalesRow : 21]?.[c]));
  const wcToSalesEst = fcfProjCols.map(c => n(fcf[wcSalesRow >= 0 ? wcSalesRow : 22]?.[c]));
  const netCashChange = fcfProjCols.map(c => n(fcf[netCashRow >= 0 ? netCashRow : 18]?.[c]));

  const priceRow = findRowIdx(val, "precio por acción actual", "current price", "precio actual");
  const targetReturnRow = findRowIdx(val, "retorno anual objetivo", "target return", "rendimiento objetivo");

  let targetMultiplesStart = -1;
  for (let r = 0; r < val.length; r++) {
    const label = String(val[r]?.[0] || "").toLowerCase();
    const col1 = String(val[r]?.[1] || "").toLowerCase();
    if (label.includes("múltiplos de valoración") && col1.includes("objetivo")) {
      targetMultiplesStart = r;
      break;
    }
  }
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
    for (let r = targetMultiplesStart + 1; r < Math.min(targetMultiplesStart + 6, val.length); r++) {
      const label = normalizeMetricLabel(val[r]?.[0]);
      const v = n(val[r]?.[1]);
      if (label === "per") targetPER = v;
      else if (label === "ev/fcf") targetEVFCF = v;
      else if (label === "ev/ebitda") targetEVEBITDA = v;
      else if (label === "ev/ebit") targetEVEBIT = v;
    }
  }

  let valProjCols = projCols;
  if (val.length > 0) {
    for (let r = 0; r < Math.min(5, val.length); r++) {
      const row = val[r];
      if (!row) continue;
      const hasYear = row.some((cell: unknown) => {
        if (typeof cell === "number") return (cell >= 2000 && cell <= 2060) || (cell > 30000 && cell < 60000);
        return false;
      });
      if (hasYear) {
        valProjCols = findProjectedCols(val[r]).projCols;
        break;
      }
    }
  }
  const ndEbitdaRow = findRowIdx(val, "deuda neta / ebitda", "net debt / ebitda", "nd/ebitda");
  const netDebtToEBITDA = valProjCols.map(c => n(val[ndEbitdaRow >= 0 ? ndEbitdaRow : 4]?.[c]));

  // Extract projected tax rates from IS sheet
  const taxRateRow = findRowIdx(is, "tax rate", "tasa impositiva");
  const taxRateEst = projCols.map(c => {
    if (taxRateRow >= 0) return n(is[taxRateRow]?.[c]);
    return 0; // will be filled by engine median
  });

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
    taxRateEst,
    currentPrice: extractPrimaryPrice(val[priceRow >= 0 ? priceRow : 18]),
    targetPER,
    targetEVFCF,
    targetEVEBITDA,
    targetEVEBIT,
    targetReturn: n(val[targetReturnRow >= 0 ? targetReturnRow : 50]?.[1]) || 0.15,
  };
}
