import * as XLSX from "xlsx";

export interface ProjectionTarget {
  year: number;
  targetPrice: number;
}

export interface ProjectionData {
  year: number;
  marketCap: number | null;
  netDebt: number | null;
  ev: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  fcf: number | null;
  dilutedShares: number | null;
}

export interface ValuationTargets {
  targetPer: number | null;
  targetEvFcf: number | null;
  targetEvEbitda: number | null;
  targetEvEbit: number | null;
  targetReturnRate: number | null;
}

export interface TargetPriceByMethod {
  year: number;
  perExCash: number | null;
  evFcf: number | null;
  evEbitda: number | null;
  evEbit: number | null;
  average: number | null;
}

export interface ParsedFinancialData {
  companyName: string | null;
  ticker: string | null;
  sector: string | null;
  currency: string | null;
  periods: ParsedPeriod[];
  projectedPeriods: ParsedPeriod[];
  targetPrice5y: number | null;
  priceFor15Return: number | null;
  estimatedAnnualReturn: number | null;
  currentPrice: number | null;
  projectionTargets: ProjectionTarget[];
  projectedData: ProjectionData[];
  valuationTargets: ValuationTargets;
  targetPricesByMethod: TargetPriceByMethod[];
}

export interface ParsedPeriod {
  fiscalYear: number;
  revenue: number | null;
  ebitda: number | null;
  ebit: number | null;
  netIncome: number | null;
  fcf: number | null;
  marginEbitda: number | null;
  marginNet: number | null;
  marginFcf: number | null;
  totalDebt: number | null;
  cash: number | null;
  netDebt: number | null;
  dilutedShares: number | null;
  capex: number | null;
  roe: number | null;
  roic: number | null;
  eps: number | null;
  bvps: number | null;
  fcfPerShare: number | null;
  peRatio: number | null;
  evEbitda: number | null;
  pFcf: number | null;
  revenueGrowth: number | null;
  netIncomeGrowth: number | null;
  fcfGrowth: number | null;
  dividendPerShare: number | null;
  interestExpense: number | null;
  interestIncome: number | null;
  taxExpense: number | null;
  inventories: number | null;
  accountsReceivable: number | null;
  accountsPayable: number | null;
  unearnedRevenue: number | null;
  isProjection: boolean;
}

// Row label patterns mapped to field names
const ROW_PATTERNS: [RegExp, keyof ParsedPeriod][] = [
  [/^Sales$|^Revenue[s]?$|^Total Revenue[s]?$/i, "revenue"],
  [/^EBITDA$/i, "ebitda"],
  [/^EBIT$|^Operating Income$/i, "ebit"],
  [/^Net Income$/i, "netIncome"],
  [/^Free Cash Flow$/i, "fcf"],
  [/^EBITDA margin/i, "marginEbitda"],
  [/^Net margin/i, "marginNet"],
  [/^FCF.*Margin|^FCF \/ Ventas/i, "marginFcf"],
  [/^EPS$|^Diluted EPS/i, "eps"],
  [/^Fully diluted shares|^Weighted Average Diluted/i, "dilutedShares"],
  [/^Free Cash Flow per share|^FCFPS/i, "fcfPerShare"],
  [/^PER$|^P\/E/i, "peRatio"],
  [/^EV \/ EBITDA$/i, "evEbitda"],
  [/^EV \/ FCF$/i, "pFcf"],
  [/^ROE$/i, "roe"],
  [/^ROIC$/i, "roic"],
  [/^CapEx( de mantenimiento)?$|^Capex( de mantenimiento)?$|^Maintenance CapEx$|^CapEx Mantenimiento/i, "capex"],
  [/^Short-Term Debt/i, "totalDebt"],
  [/^Cash and cash/i, "cash"],
  [/^Deuda Neta$|^Net Debt$/i, "netDebt"],
  [/^Dividend[s]?\s*(per\s*share)?$|^DPS$/i, "dividendPerShare"],
  [/^Book Value per Share|^BVPS$/i, "bvps"],
  [/^Interest Expense/i, "interestExpense"],
  [/^Interest Income/i, "interestIncome"],
  [/^Tax Expense/i, "taxExpense"],
  [/^Inventories$/i, "inventories"],
  [/^Accounts Receivable$/i, "accountsReceivable"],
  [/^Accounts Payable$/i, "accountsPayable"],
  [/^Unearned Revenue$/i, "unearnedRevenue"],
];

const GROWTH_CONTEXT: Record<string, keyof ParsedPeriod> = {
  revenue: "revenueGrowth",
  netIncome: "netIncomeGrowth",
  fcf: "fcfGrowth",
};

function parseNumericValue(val: unknown): number | null {
  if (val == null || val === "" || val === "-") return null;
  if (typeof val === "number") return val;
  const s = String(val).replace(/[()$,]/g, "").replace(/\s/g, "").trim();
  if (s === "" || s === "-") return null;
  if (s.endsWith("%")) {
    const n = parseFloat(s);
    return isNaN(n) ? null : n / 100;
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function detectYearColumns(row: unknown[]): { indices: number[]; years: number[]; projectionStart: number | null } {
  const indices: number[] = [];
  const years: number[] = [];
  let projectionStart: number | null = null;

  for (let i = 1; i < row.length; i++) {
    const cell = String(row[i] ?? "").trim();
    const yearMatch = cell.match(/^(\d{4})[eE]?$/) || cell.match(/\d{1,2}\/\d{1,2}\/(\d{2,4})/);
    if (yearMatch) {
      let year = parseInt(yearMatch[1]);
      if (year < 100) year += 2000;
      if (year >= 2000 && year <= 2040) {
        indices.push(i);
        years.push(year);
        if (cell.toLowerCase().endsWith("e") && projectionStart === null) {
          projectionStart = year;
        }
      }
    }
  }
  return { indices, years, projectionStart };
}

function detectCompanyFromFileName(fileName: string): { name: string | null; ticker: string | null } {
  const parts = fileName.replace(/\.[^.]+$/, "").split(/[_\-\s]+/);
  const tickerCandidate = parts.find(p => /^[A-Z]{1,5}$/.test(p));
  const tickerIdx = parts.indexOf(tickerCandidate || "");
  const nameCandidate = tickerIdx > 0 ? parts.slice(1, tickerIdx).join(" ") : null;
  return { name: nameCandidate, ticker: tickerCandidate || null };
}

// Valuation sheet row labels for projected data
const VALUATION_ROW_MAP: [RegExp, keyof ProjectionData][] = [
  [/^Market cap$/i, "marketCap"],
  [/^Deuda Neta$/i, "netDebt"],
  [/^Enterprise Value/i, "ev"],
  [/^EBITDA$/i, "ebitda"],
  [/^EBIT$/i, "ebit"],
  [/^Net income$/i, "netIncome"],
  [/^FCF$/i, "fcf"],
];

// Row pattern to extract projected diluted shares from IS sheet
const DILUTED_SHARES_PATTERN = /^Fully diluted shares|^Weighted Average Diluted|^Diluted shares/i;

function extractSummaryData(wb: XLSX.WorkBook): {
  sector: string | null;
  targetPrice5y: number | null;
  priceFor15Return: number | null;
  estimatedAnnualReturn: number | null;
  currentPrice: number | null;
  projectionTargets: ProjectionTarget[];
  projectedData: ProjectionData[];
  valuationTargets: ValuationTargets;
  targetPricesByMethod: TargetPriceByMethod[];
} {
  let sector: string | null = null;
  let targetPrice5y: number | null = null;
  let priceFor15Return: number | null = null;
  let estimatedAnnualReturn: number | null = null;
  let currentPrice: number | null = null;
  const projectionTargets: ProjectionTarget[] = [];
  const projectedData: ProjectionData[] = [];
  const valuationTargets: ValuationTargets = {
    targetPer: null,
    targetEvFcf: null,
    targetEvEbitda: null,
    targetEvEbit: null,
    targetReturnRate: null,
  };
  const targetPricesByMethod: TargetPriceByMethod[] = [];

  const valSheetName = wb.SheetNames.find(s => /valoraci[oó]n|valuation/i.test(s));
  if (valSheetName) {
    const sheet = wb.Sheets[valSheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Detect year columns from row 1 (the header row with years)
    let mainYearInfo: ReturnType<typeof detectYearColumns> | null = null;
    for (let r = 0; r < Math.min(data.length, 5); r++) {
      const row = data[r];
      if (!row) continue;
      const detected = detectYearColumns(row);
      if (detected.years.length >= 5) {
        mainYearInfo = detected;
        break;
      }
    }

    // Build projection year indices (only "e" years)
    const projYears: number[] = [];
    const projIndices: number[] = [];
    if (mainYearInfo) {
      for (let i = 0; i < mainYearInfo.years.length; i++) {
        if (mainYearInfo.projectionStart != null && mainYearInfo.years[i] >= mainYearInfo.projectionStart) {
          projYears.push(mainYearInfo.years[i]);
          projIndices.push(mainYearInfo.indices[i]);
        }
      }
    }

    // Initialize projectedData
    for (const year of projYears) {
      projectedData.push({
        year,
        marketCap: null, netDebt: null, ev: null,
        ebitda: null, ebit: null, netIncome: null, fcf: null,
        dilutedShares: null,
      });
    }

    let inPrecioObjetivoSection = false;
    let precioObjetivoYears: number[] = [];
    let precioObjetivoColIndices: number[] = [];
    let inMultiplosObjetivoSection = false;

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      const label = String(row[0] ?? "").trim();

      // Extract projected financial data (rows 2-9 in valuation sheet)
      if (mainYearInfo && projYears.length > 0) {
        for (const [pattern, field] of VALUATION_ROW_MAP) {
          if (pattern.test(label)) {
            for (let i = 0; i < projIndices.length; i++) {
              const val = parseNumericValue(row[projIndices[i]]);
              if (val !== null) {
                const pd = projectedData.find(p => p.year === projYears[i]);
                if (pd) (pd as any)[field] = val;
              }
            }
            break;
          }
        }
      }

      // Current price
      if (/precio por acci[oó]n actual|current.*price/i.test(label)) {
        currentPrice = parseNumericValue(row[1]);
      }

      // "Múltiplos de valoración" with "Objetivo" in col B
      if (/^M[uú]ltiplos de valoraci[oó]n/i.test(label) && String(row[1] ?? "").trim().toLowerCase() === "objetivo") {
        inMultiplosObjetivoSection = true;
        continue;
      }

      // Extract target multiples (editable orange cells)
      if (inMultiplosObjetivoSection) {
        if (/^PER$/i.test(label)) {
          valuationTargets.targetPer = parseNumericValue(row[1]);
        } else if (/^EV\s*\/\s*FCF/i.test(label)) {
          valuationTargets.targetEvFcf = parseNumericValue(row[1]);
        } else if (/^EV\s*\/\s*EBITDA/i.test(label)) {
          valuationTargets.targetEvEbitda = parseNumericValue(row[1]);
        } else if (/^EV\s*\/\s*EBIT/i.test(label)) {
          valuationTargets.targetEvEbit = parseNumericValue(row[1]);
          inMultiplosObjetivoSection = false;
        }
        continue;
      }

      // "Precio objetivo" section
      if (/^Precio objetivo$/i.test(label)) {
        inPrecioObjetivoSection = true;
        for (let scanR = r; scanR < Math.min(r + 3, data.length); scanR++) {
          const scanRow = data[scanR];
          if (!scanRow) continue;
          const detected = detectYearColumns(scanRow);
          if (detected.years.length >= 3) {
            precioObjetivoYears = detected.years;
            precioObjetivoColIndices = detected.indices;
            break;
          }
        }
        continue;
      }

      // Extract target prices by method
      if (inPrecioObjetivoSection && precioObjetivoYears.length > 0) {
        const methodMap: Record<string, keyof TargetPriceByMethod> = {
          "per ex cash": "perExCash",
          "ev / fcf": "evFcf",
          "ev / ebitda": "evEbitda",
          "ev / ebit": "evEbit",
          "promedio": "average",
        };

        const lowerLabel = label.toLowerCase().trim();
        for (const [key, field] of Object.entries(methodMap)) {
          if (lowerLabel.startsWith(key)) {
            for (let i = 0; i < precioObjetivoYears.length; i++) {
              const val = parseNumericValue(row[precioObjetivoColIndices[i]]);
              let existing = targetPricesByMethod.find(t => t.year === precioObjetivoYears[i]);
              if (!existing) {
                existing = { year: precioObjetivoYears[i], perExCash: null, evFcf: null, evEbitda: null, evEbit: null, average: null };
                targetPricesByMethod.push(existing);
              }
              if (val !== null && val > 1) {
                (existing as any)[field] = val;
              }
            }

            // For EV/FCF row, also extract CAGR and projection targets
            if (field === "evFcf") {
              for (let i = 0; i < precioObjetivoYears.length; i++) {
                const val = parseNumericValue(row[precioObjetivoColIndices[i]]);
                if (val && val > 1) {
                  projectionTargets.push({ year: precioObjetivoYears[i], targetPrice: val });
                }
              }
              // CAGR
              for (let c = row.length - 1; c >= 6; c--) {
                const val = parseNumericValue(row[c]);
                if (val !== null && Math.abs(val) < 1) {
                  estimatedAnnualReturn = val;
                  break;
                }
              }
            }

            if (field === "average" || field === "evEbit") {
              // Check if we've processed all methods
            }
            break;
          }
        }

        // Margin of safety row ends the section
        if (/^Margen de seguridad/i.test(label)) {
          inPrecioObjetivoSection = false;
        }
      }

      // "Retorno anual objetivo"
      if (/retorno anual objetivo/i.test(label)) {
        valuationTargets.targetReturnRate = parseNumericValue(row[1]);
        priceFor15Return = parseNumericValue(row[2]);
      }
    }

    // Set 5Y target from last projection
    if (projectionTargets.length > 0) {
      targetPrice5y = projectionTargets[projectionTargets.length - 1]?.targetPrice ?? null;
    }
  }

  // Detect sector from any sheet
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const sheetData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    for (let r = 0; r < Math.min(sheetData.length, 60); r++) {
      const row = sheetData[r];
      if (!row) continue;
      const label = String(row[0] ?? "").trim();
      if (!sector && /^Sector$|^Industry$|^Industria$/i.test(label) && row[1]) {
        sector = String(row[1]).trim();
      }
    }
    if (sector) break;
  }

  return { sector, targetPrice5y, priceFor15Return, estimatedAnnualReturn, currentPrice, projectionTargets, projectedData, valuationTargets, targetPricesByMethod };
}

export function parseExcelFile(buffer: ArrayBuffer, fileName: string): ParsedFinancialData {
  const wb = XLSX.read(buffer, { type: "array" });
  const { name: detectedName, ticker: detectedTicker } = detectCompanyFromFileName(fileName);
  const summaryData = extractSummaryData(wb);

  // Detect currency from TIKR sheets or summary headers
  let detectedCurrency: string | null = null;
  try {
    const { detectCurrency } = require("./tikrExtractor");
    detectedCurrency = detectCurrency(wb);
  } catch { /* ignore */ }
  if (!detectedCurrency) {
    // Fallback: scan first rows of summary sheets
    const CURRENCY_CODES = "USD|EUR|GBP|JPY|CHF|SEK|NOK|DKK|CAD|AUD|CNY|KRW|INR|HKD|SGD|TWD|MXN|BRL|PLN|ZAR|TRY|CLP|COP|PEN|ARS";
    const pattern = new RegExp(`(?:amounts?|values?|currency|reported)\\s+(?:in\\s+)?(${CURRENCY_CODES})|(${CURRENCY_CODES})\\s*(?:millions?|thousands?|MM|M)`, "i");
    outer: for (const sheetName of wb.SheetNames.slice(0, 4)) {
      const sheet = wb.Sheets[sheetName];
      if (!sheet) continue;
      const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      for (let r = 0; r < Math.min(6, data.length); r++) {
        const row = data[r];
        if (!row) continue;
        for (const cell of row) {
          const m = String(cell ?? "").match(pattern);
          if (m) { detectedCurrency = (m[1] || m[2]).toUpperCase(); break outer; }
        }
      }
    }
  }

  const allPeriods = new Map<number, ParsedPeriod>();
  const sheetsToProcess = wb.SheetNames.slice(0, 4);

  for (const sheetName of sheetsToProcess) {
    const sheet = wb.Sheets[sheetName];
    const sheetData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (sheetData.length < 3) continue;

    let yearInfo: ReturnType<typeof detectYearColumns> | null = null;
    let yearRowIdx = -1;

    for (let r = 0; r < Math.min(sheetData.length, 10); r++) {
      const row = sheetData[r];
      if (!row) continue;
      const detected = detectYearColumns(row);
      if (detected.years.length >= 3) {
        yearInfo = detected;
        yearRowIdx = r;
        break;
      }
    }

    if (!yearInfo || yearInfo.years.length === 0) continue;

    for (let i = 0; i < yearInfo.years.length; i++) {
      const year = yearInfo.years[i];
      if (!allPeriods.has(year)) {
        allPeriods.set(year, {
          fiscalYear: year,
          revenue: null, ebitda: null, ebit: null, netIncome: null, fcf: null,
          marginEbitda: null, marginNet: null, marginFcf: null,
          totalDebt: null, cash: null, netDebt: null,
          dilutedShares: null, capex: null,
          roe: null, roic: null, eps: null, bvps: null, fcfPerShare: null,
          peRatio: null, evEbitda: null, pFcf: null,
          revenueGrowth: null, netIncomeGrowth: null, fcfGrowth: null,
          dividendPerShare: null,
          interestExpense: null, interestIncome: null, taxExpense: null,
          inventories: null, accountsReceivable: null, accountsPayable: null, unearnedRevenue: null,
          isProjection: yearInfo!.projectionStart != null && year >= yearInfo!.projectionStart,
        });
      }
    }

    let lastMatchedMetric: string | null = null;

    for (let r = yearRowIdx + 1; r < sheetData.length; r++) {
      const row = sheetData[r];
      if (!row || !row[0]) continue;
      const label = String(row[0]).trim();
      if (!label) continue;

      if (/Y\/Y Growth|% Change YoY/i.test(label) && lastMatchedMetric) {
        const growthField = GROWTH_CONTEXT[lastMatchedMetric];
        if (growthField) {
          for (let i = 0; i < yearInfo.indices.length; i++) {
            const val = parseNumericValue(row[yearInfo.indices[i]]);
            if (val !== null) {
              const period = allPeriods.get(yearInfo.years[i])!;
              (period as any)[growthField] = val;
            }
          }
        }
        continue;
      }

      for (const [pattern, field] of ROW_PATTERNS) {
        if (pattern.test(label)) {
          lastMatchedMetric = field;
          for (let i = 0; i < yearInfo.indices.length; i++) {
            const val = parseNumericValue(row[yearInfo.indices[i]]);
            if (val !== null) {
              const period = allPeriods.get(yearInfo.years[i])!;
              if (field === "capex" && val < 0) {
                (period as any)[field] = Math.abs(val);
              } else {
                (period as any)[field] = val;
              }
            }
          }
          break;
        }
      }
    }
  }

  // Populate projected diluted shares from IS sheet into projectedData
  for (const pd of summaryData.projectedData) {
    const period = allPeriods.get(pd.year);
    if (period && period.dilutedShares != null) {
      pd.dilutedShares = period.dilutedShares;
    }
  }

  const periods = Array.from(allPeriods.values())
    .filter(p => !p.isProjection)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  const projectedPeriods = Array.from(allPeriods.values())
    .filter(p => p.isProjection)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  return {
    companyName: detectedName,
    ticker: detectedTicker,
    sector: summaryData.sector,
    periods,
    projectedPeriods,
    targetPrice5y: summaryData.targetPrice5y,
    priceFor15Return: summaryData.priceFor15Return,
    estimatedAnnualReturn: summaryData.estimatedAnnualReturn,
    currentPrice: summaryData.currentPrice,
    projectionTargets: summaryData.projectionTargets,
    projectedData: summaryData.projectedData,
    valuationTargets: summaryData.valuationTargets,
    targetPricesByMethod: summaryData.targetPricesByMethod,
  };
}

export async function computeFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
