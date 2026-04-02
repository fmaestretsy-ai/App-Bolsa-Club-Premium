import * as XLSX from "xlsx";

export interface ProjectionTarget {
  year: number;
  targetPrice: number;
}

export interface ParsedFinancialData {
  companyName: string | null;
  ticker: string | null;
  sector: string | null;
  periods: ParsedPeriod[];
  targetPrice5y: number | null;
  priceFor15Return: number | null;
  estimatedAnnualReturn: number | null;
  currentPrice: number | null;
  projectionTargets: ProjectionTarget[];
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
  [/^Depreciation|^D&A/i, "capex"],
  [/^Short-Term Debt/i, "totalDebt"],
  [/^Cash and cash/i, "cash"],
  [/^Deuda Neta$|^Net Debt$/i, "netDebt"],
  [/^Dividend[s]?\s*(per\s*share)?$|^DPS$/i, "dividendPerShare"],
  [/^Book Value per Share|^BVPS$/i, "bvps"],
];

// Growth row patterns (Y/Y Growth lines depend on context)
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
  // Handle percentage
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
    // Match year patterns: 2024, 2025e, 12/31/24
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

function extractSummaryData(wb: XLSX.WorkBook): { sector: string | null; targetPrice5y: number | null; priceFor15Return: number | null; estimatedAnnualReturn: number | null; currentPrice: number | null } {
  let sector: string | null = null;
  let targetPrice5y: number | null = null;
  let priceFor15Return: number | null = null;
  let estimatedAnnualReturn: number | null = null;
  let currentPrice: number | null = null;

  // Find valuation sheet (commonly named "4.Valoracion", "Valoracion", "Valuation")
  const valSheetName = wb.SheetNames.find(s => /valoraci[oó]n|valuation/i.test(s));
  if (valSheetName) {
    const sheet = wb.Sheets[valSheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Track whether we're in "Precio objetivo" section
    let inPrecioObjetivoSection = false;

    for (let r = 0; r < data.length; r++) {
      const row = data[r];
      if (!row) continue;
      const label = String(row[0] ?? "").trim();

      // "Precio por acción actual" → col B (index 1) has current price
      if (/precio por acci[oó]n actual|current.*price/i.test(label)) {
        currentPrice = parseNumericValue(row[1]);
      }

      // Detect "Precio objetivo" section header
      if (/^Precio objetivo$/i.test(label)) {
        inPrecioObjetivoSection = true;
        continue;
      }

      // In the "Precio objetivo" section, find the "EV / FCF" row
      // This row has: col 5 = 2030e target price, col 10 = CAGR 5 años
      if (inPrecioObjetivoSection && /^EV\s*\/\s*FCF/i.test(label)) {
        const target = parseNumericValue(row[5]);
        if (target && target > 1) targetPrice5y = target;
        const cagr = parseNumericValue(row[10]);
        if (cagr !== null) estimatedAnnualReturn = cagr;
        inPrecioObjetivoSection = false; // found what we need
      }

      // "Retorno anual objetivo" → col C (index 2) = price for 15% return
      if (/retorno anual objetivo/i.test(label)) {
        priceFor15Return = parseNumericValue(row[2]);
      }
    }
  }

  // Try to detect sector from any sheet
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    for (let r = 0; r < Math.min(data.length, 60); r++) {
      const row = data[r];
      if (!row) continue;
      const label = String(row[0] ?? "").trim();
      if (!sector && /^Sector$|^Industry$|^Industria$/i.test(label) && row[1]) {
        sector = String(row[1]).trim();
      }
    }
    if (sector) break;
  }

  return { sector, targetPrice5y, priceFor15Return, estimatedAnnualReturn, currentPrice };
}

export function parseExcelFile(buffer: ArrayBuffer, fileName: string): ParsedFinancialData {
  const wb = XLSX.read(buffer, { type: "array" });
  const { name: detectedName, ticker: detectedTicker } = detectCompanyFromFileName(fileName);
  const summaryData = extractSummaryData(wb);

  const allPeriods = new Map<number, ParsedPeriod>();

  const sheetsToProcess = wb.SheetNames.slice(0, 4);

  for (const sheetName of sheetsToProcess) {
    const sheet = wb.Sheets[sheetName];
    const data: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (data.length < 3) continue;

    let yearInfo: ReturnType<typeof detectYearColumns> | null = null;
    let yearRowIdx = -1;

    for (let r = 0; r < Math.min(data.length, 10); r++) {
      const row = data[r];
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
          isProjection: yearInfo!.projectionStart != null && year >= yearInfo!.projectionStart,
        });
      }
    }

    let lastMatchedMetric: string | null = null;

    for (let r = yearRowIdx + 1; r < data.length; r++) {
      const row = data[r];
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

  const periods = Array.from(allPeriods.values())
    .filter(p => !p.isProjection)
    .sort((a, b) => a.fiscalYear - b.fiscalYear);

  return {
    companyName: detectedName,
    ticker: detectedTicker,
    sector: summaryData.sector,
    periods,
    targetPrice5y: summaryData.targetPrice5y,
    priceFor15Return: summaryData.priceFor15Return,
    estimatedAnnualReturn: summaryData.estimatedAnnualReturn,
    currentPrice: summaryData.currentPrice,
  };
}

export async function computeFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
