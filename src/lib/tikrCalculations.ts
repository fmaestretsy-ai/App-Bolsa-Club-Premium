/**
 * 17-step financial model calculation chain.
 * Takes raw TIKR data + manual inputs → full model result.
 */
import type { TikrRawData, TikrModelInputs } from "./tikrExtractor";

export interface YC {
  year: number;
  sales: number;
  ebitda: number;
  da: number;
  ebit: number;
  intExp: number;
  intInc: number;
  totalInt: number;
  ebt: number;
  tax: number;
  taxRate: number;
  consolNI: number;
  mi: number;
  netIncome: number;
  eps: number;
  shares: number;
  capexMant: number;
  wc: number;
  cwc: number;
  fcf: number;
  fcfps: number;
  netCashChange: number;
  inv: number;
  ar: number;
  ap: number;
  urC: number;
  urNC: number;
  nopat: number;
  cashEq: number;
  mktSec: number;
  stDebt: number;
  ltDebt: number;
  curLeases: number;
  ncLeases: number;
  equity: number;
  ic: number;
  roe: number;
  roic: number;
  reinvRate: number;
  mktCap: number;
  netDebt: number;
  ev: number;
  per: number;
  evFcf: number;
  evEbitda: number;
  evEbit: number;
  capexExpPct: number;
  acqPct: number;
  divPct: number;
  buybackPct: number;
  debtRepayPct: number;
  totalAllocPct: number;
  impPct: number;
  sbcPct: number;
  divstPct: number;
  issuancePct: number;
  extraPct: number;
}

export interface TargetPriceYear {
  year: number;
  perExCash: number;
  evFcf: number;
  evEbitda: number;
  evEbit: number;
  average: number;
}

export interface RedFlagCounts {
  salesDecline: number;
  marginDecline: number;
  negativeFCF: number;
  poorROIC: number;
  highDebt: number;
}

export interface FullModelResult {
  hist: YC[];
  proj: YC[];
  medians: Record<string, number>;
  targetPrices: TargetPriceYear[];
  cagr5y: Record<string, number>;
  safetyMargins: number[];
  buyPrice: number;
  buyPriceVsCurrent: number;
  redFlagCounts: RedFlagCounts;
  projTaxRate: number;
}

function s(num: number, den: number): number {
  return den !== 0 && isFinite(den) ? num / den : 0;
}

function med(arr: number[]): number {
  const v = arr.filter(x => x != null && !isNaN(x) && isFinite(x));
  if (!v.length) return 0;
  v.sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 !== 0 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function medPositive(arr: number[]): number {
  return med(arr.filter(x => x > 0 && isFinite(x)));
}

export function calculateFullModel(raw: TikrRawData, inputs: TikrModelInputs): FullModelResult {
  const N = raw.years.length;
  if (N === 0) return emptyResult();
  const hist: YC[] = [];

  // Safe array accessor — returns 0 for out-of-bounds or undefined
  const sa = (arr: number[] | undefined, i: number): number => (arr && i < arr.length ? (arr[i] ?? 0) : 0);

  // ═══ STEPS 1-9: Historical ═══
  for (let i = 0; i < N; i++) {
    const sales = sa(raw.revenues, i);
    const ebit = sa(raw.operatingIncome, i);
    const deprec = sa(raw.depreciation, i);
    const amortGW = sa(raw.amortGoodwill, i);
    const da = -(deprec + amortGW);
    const ebitda = ebit - da;
    const intExp = sa(raw.interestExpense, i);
    const intInc = sa(raw.interestIncome, i);
    const totalInt = intExp + intInc;
    const ebt = ebit + totalInt;
    const tax = sa(raw.taxExpense, i);
    const taxRate = ebt !== 0 ? Math.abs(tax) / ebt : 0;
    const consolNI = ebt + tax;
    const mi = sa(raw.minorityInterest, i);
    const netIncome = consolNI + mi;
    const shares = sa(raw.dilutedShares, i) || 1;
    const eps = netIncome / shares;

    // Step 2: WC
    const inv = sa(raw.inventory, i);
    const ar = sa(raw.accountsReceivable, i);
    const ap = sa(raw.accountsPayable, i);
    const urC = sa(raw.unearnedRevCurrent, i);
    const urNC = sa(raw.unearnedRevNonCurrent, i);
    const wc = inv + ar - ap - urC - urNC;
    let cwc = 0;
    if (i > 0 && sa(raw.accountsPayable, i - 1) > 0) {
      const pInv = sa(raw.inventory, i - 1);
      const pAR = sa(raw.accountsReceivable, i - 1);
      const pAP = sa(raw.accountsPayable, i - 1);
      const pURC = sa(raw.unearnedRevCurrent, i - 1);
      const pURNC = sa(raw.unearnedRevNonCurrent, i - 1);
      cwc = wc - (pInv + pAR - pAP - pURC - pURNC);
    }

    // Step 3: CapEx Maint
    const capexRaw = sa(raw.capex, i);
    const salePPE = sa(raw.salePPE, i);
    const saleIntang = sa(raw.saleIntangibles, i);
    const capexNeto = capexRaw + saleIntang + salePPE;
    const absDeprec = Math.abs(deprec);
    const capexMant = Math.abs(capexNeto) < absDeprec
      ? capexNeto
      : -absDeprec;

    // Step 4: FCF
    const fcf = ebitda + capexMant + totalInt + tax - cwc + mi;
    const fcfps = fcf / shares;

    // Step 5: Invested Capital & ROIC
    const cashEq = sa(raw.cashEquiv, i);
    const mktSec = sa(raw.totalCashSTI, i) - cashEq;
    const stBorrow = sa(raw.stBorrowings, i);
    const curLTD = sa(raw.currentLTD, i);
    const finDivCur = sa(raw.finDivDebtCurrent, i);
    const stDebt = stBorrow + curLTD + finDivCur;
    const ltBorrow = sa(raw.ltBorrowings, i);
    const ltDebtVal = sa(raw.ltDebt, i);
    const finDivNC = sa(raw.finDivDebtNC, i);
    const ltDebt = ltBorrow + ltDebtVal + finDivNC;
    const curLeases = sa(raw.currentCapLeases, i);
    const ncLeases = sa(raw.ncCapLeases, i);
    const equity = sa(raw.totalEquity, i);
    const ic = equity + stDebt + ltDebt + curLeases + ncLeases - mktSec;
    const nopat = ebit * (1 - taxRate);
    const roic = s(nopat, ic);
    const roe = s(netIncome, equity);

    // Step 6: Valuation
    const basicSh = sa(raw.basicShares, i) || shares;
    const mktCap = sa(raw.marketCapMM, i) * (shares / basicSh);
    const netDebt = (ltDebt + stDebt) - (cashEq + mktSec);
    const ev = mktCap + netDebt;

    // Step 7: Ratios (computed inline)
    // Step 8: Capital allocation
    const capexExp = capexNeto - capexMant;
    const acq = sa(raw.cashAcquisitions, i);
    const divPaid = Math.abs(sa(raw.dividendsPaid, i));
    const buyback = Math.abs(sa(raw.repurchaseStock, i));
    const debtRep = Math.max(0, Math.abs(sa(raw.debtRepaid, i)) - sa(raw.debtIssued, i));
    const fcfAbs = Math.abs(fcf);
    const fcfPos = fcf > 0 ? fcf : 0;

    // Step 9: Red flags — sum specific extraordinary items
    const aw = Math.abs(sa(raw.assetWritedown, i));
    const ig = Math.abs(sa(raw.impairmentGoodwill, i));
    const mr = Math.abs(sa(raw.mergerRestructuring, i));
    const ls = Math.abs(sa(raw.legalSettlements, i));
    const oui = Math.abs(sa(raw.otherUnusualItems, i));
    const unusualItems = mr + ls + aw + oui;

    // Reinvestment rate: (|total capex| - total D&A + cwc) / NOPAT
    const reinvRate = nopat !== 0 ? (Math.abs(capexRaw) - (deprec + amortGW) + cwc) / nopat : 0;

    hist.push({
      year: raw.years[i], sales, ebitda, da, ebit,
      intExp, intInc, totalInt, ebt, tax, taxRate,
      consolNI, mi, netIncome, eps, shares,
      capexMant, wc, cwc, fcf, fcfps,
      netCashChange: sa(raw.netCashChangeHist, i),
      inv, ar, ap, urC, urNC,
      nopat, cashEq, mktSec, stDebt, ltDebt: ltDebt,
      curLeases, ncLeases, equity, ic, roe, roic, reinvRate,
      mktCap, netDebt, ev,
      per: s(mktCap, netIncome), evFcf: s(ev, fcf),
      evEbitda: s(ev, ebitda), evEbit: s(ev, ebit),
      capexExpPct: fcfPos > 0 ? Math.abs(capexExp) / fcfPos : 0,
      acqPct: fcfPos > 0 ? Math.abs(acq) / fcfPos : 0,
      divPct: fcfPos > 0 ? divPaid / fcfPos : 0,
      buybackPct: fcfPos > 0 ? buyback / fcfPos : 0,
      debtRepayPct: fcfPos > 0 ? debtRep / fcfPos : 0,
      totalAllocPct: 0,
      impPct: s(aw + ig, sales), sbcPct: s(sa(raw.sbc, i), sales),
      divstPct: s(sa(raw.divestitures, i), sales),
      issuancePct: s(sa(raw.issuanceStock, i), sales),
      extraPct: s(unusualItems, sales),
    });
    const h = hist[hist.length - 1];
    h.totalAllocPct = h.capexExpPct + h.acqPct + h.divPct + h.buybackPct + h.debtRepayPct;
  }

  // ═══ STEPS 10-17: Projections ═══
  const last = hist[N - 1];
  if (!last) return emptyResult();

  // Projected tax rate: use per-year inputs if available, else median of last 3
  const validTaxRates = hist.slice(-3).map(h => h.taxRate).filter(t => t > 0 && t < 1);
  const defaultTaxRate = med(validTaxRates);
  const getProjTaxRate = (j: number) => {
    const v = inputs.taxRateEst?.[j];
    return (v != null && v > 0) ? v : defaultTaxRate;
  };
  const projTaxRate = defaultTaxRate;

  // Interest rates from historical workbook logic
  const totalHistDebt = hist.reduce((sum, h) => sum + h.stDebt + h.ltDebt, 0);
  const totalHistMktSec = hist.reduce((sum, h) => sum + h.mktSec, 0);
  const totalHistIntExp = hist.reduce((sum, h) => sum + Math.abs(h.intExp), 0);
  const totalHistIntInc = hist.reduce((sum, h) => sum + h.intInc, 0);
  const avgIntExpRate = totalHistDebt > 0 ? totalHistIntExp / totalHistDebt : 0.03;
  const avgIntIncRate = totalHistMktSec > 0 ? totalHistIntInc / totalHistMktSec : 0.02;

  // Minority interest ratio
  const miRatio = last.consolNI !== 0 ? last.mi / last.consolNI : 0;

  // Debt and liquidity structure from last year
  const lastTotalDebt = last.stDebt + last.ltDebt;
  const lastCashPlusSec = last.cashEq + last.mktSec;
  const stPct = lastTotalDebt > 0 ? last.stDebt / lastTotalDebt : 0;
  const ltPct = lastTotalDebt > 0 ? last.ltDebt / lastTotalDebt : 1;
  const cashPct = lastCashPlusSec > 0 ? last.cashEq / lastCashPlusSec : 0.5;
  const secPct = lastCashPlusSec > 0 ? last.mktSec / lastCashPlusSec : 0.5;
  const histCashSecRatios = hist
    .map(h => s(h.cashEq + h.mktSec, h.sales))
    .filter(r => r > 0 && isFinite(r));
  const minCashSecToSales = histCashSecRatios.length > 0
    ? Math.min(...histCashSecRatios)
    : s(lastCashPlusSec, last.sales);

  // ─── Equity projection: retained earnings model ───
  // Capital return ratio = median of (buybacks + dividends) / net income
  const capitalReturnRatios = hist
    .map((h, idx) => {
      if (h.netIncome <= 0) return null;
      const buyback = Math.abs(sa(raw.repurchaseStock, idx));
      const divPaid = Math.abs(sa(raw.dividendsPaid, idx));
      return (buyback + divPaid) / h.netIncome;
    })
    .filter((r): r is number => r != null && r >= 0 && r < 2 && isFinite(r));
  const medianCapitalReturnRatio = capitalReturnRatios.length > 0 ? med(capitalReturnRatios) : 0;

  const proj: YC[] = [];
  let prevSales = inputs.lastSales;
  let prevDA = inputs.lastDA;
  let prevShares = inputs.lastShares;
  let _prevWC = last.wc;
  let prevCashEq = last.cashEq;
  let prevMktSec = last.mktSec;
  let prevNetDebt = last.netDebt;
  let prevTotalDebt = lastTotalDebt;
  let prevStDebt = last.stDebt;
  let prevLtDebt = last.ltDebt;

  for (let j = 0; j < 5; j++) {
    const gr = inputs.growthRates[j] ?? 0.10;
    const sales = prevSales * (1 + gr);
    const da = prevDA * (1 + gr);
    const ebit = sales * (inputs.ebitMarginEst[j] ?? 0.30);
    const ebitda = ebit - da;

    const ndRatio = inputs.netDebtToEBITDA[j] ?? 0.3;
    const netDebt = ndRatio * ebitda;

    let projCashEq = 0;
    let projMktSec = 0;
    let projTotalDebt = 0;

    if (j === 0) {
      const totalCashSec = netDebt > 0
        ? minCashSecToSales * sales
        : Math.abs(prevNetDebt) > 0
          ? ((prevCashEq + prevMktSec) / Math.abs(prevNetDebt)) * Math.abs(netDebt)
          : (prevCashEq + prevMktSec);

      projCashEq = totalCashSec * cashPct;
      projMktSec = totalCashSec * secPct;
      projTotalDebt = netDebt > 0
        ? netDebt + totalCashSec
        : Math.abs(prevNetDebt) > 0
          ? (prevTotalDebt / Math.abs(prevNetDebt)) * Math.abs(netDebt)
          : prevTotalDebt;
    } else {
      projCashEq = prevSales > 0 ? (prevCashEq / prevSales) * sales : prevCashEq;
      projMktSec = prevSales > 0 ? (prevMktSec / prevSales) * sales : prevMktSec;
      projTotalDebt = Math.abs(prevNetDebt) > 0
        ? (prevTotalDebt / Math.abs(prevNetDebt)) * Math.abs(netDebt)
        : netDebt > 0
          ? netDebt + projCashEq + projMktSec
          : prevTotalDebt;
    }

    const projStDebt = prevTotalDebt > 0 ? (prevStDebt / prevTotalDebt) * projTotalDebt : stPct * projTotalDebt;
    const projLtDebt = prevTotalDebt > 0 ? (prevLtDebt / prevTotalDebt) * projTotalDebt : ltPct * projTotalDebt;

    const intExp = -(avgIntExpRate * projTotalDebt);
    const intInc = avgIntIncRate * projMktSec;
    const totalInt = intExp + intInc;

    const ebt = ebit + totalInt;
    const yearTaxRate = getProjTaxRate(j);
    const tax = -(ebt * yearTaxRate);
    const consolNI = ebt + tax;
    const mi = miRatio * consolNI;
    const netIncome = consolNI + mi;

    const shares = prevShares * (1 + inputs.shareDilutionRate);
    const eps = netIncome / shares;

    // FCF
    const capexMantRate = inputs.capexMantToSales[j] ?? inputs.capexMantToSales[0] ?? 0;
    const wcRate = inputs.wcToSalesEst[j] ?? inputs.wcToSalesEst[0] ?? 0;
    const capexMant = -(capexMantRate * sales);
    const wc = wcRate * sales;
    // First projection year: no ΔWC (matches Excel template)
    const cwc = j === 0 ? 0 : wc - ((inputs.wcToSalesEst[j - 1] ?? wcRate) * prevSales);
    const fcf = ebitda + capexMant + totalInt + tax - cwc + mi;
    const fcfps = fcf / shares;

    // Valuation at current price
    const mktCap = inputs.currentPrice * shares;
    const ev = mktCap + netDebt;

    const nopat = ebit * (1 - yearTaxRate);

    // Projected equity: retained earnings model
    // Equity = prevEquity + NetIncome × (1 - capitalReturnRatio)
    const prevEquity = j === 0 ? last.equity : proj[j - 1].equity;
    const retainedEarnings = netIncome * (1 - medianCapitalReturnRatio);
    const projEquity = prevEquity + retainedEarnings;
    const curLeases = last.curLeases * (1 + gr) ** (j + 1);
    const ncLeases = last.ncLeases * (1 + gr) ** (j + 1);
    const ic = projEquity + projStDebt + projLtDebt + curLeases + ncLeases - projMktSec;

    const projYear = last.year + j + 1;

    proj.push({
      year: projYear, sales, ebitda, da, ebit,
      intExp, intInc, totalInt, ebt, tax, taxRate: yearTaxRate,
      consolNI, mi, netIncome, eps, shares,
      capexMant, wc, cwc, fcf, fcfps,
      netCashChange: inputs.netCashChange[j] ?? 0,
      inv: 0, ar: 0, ap: 0, urC: 0, urNC: 0,
      nopat, cashEq: projCashEq, mktSec: projMktSec,
      stDebt: projStDebt, ltDebt: projLtDebt,
      curLeases, ncLeases, equity: projEquity, ic,
      roe: s(netIncome, projEquity), roic: s(nopat, ic),
      reinvRate: 0,
      mktCap, netDebt, ev,
      per: s(mktCap, netIncome), evFcf: s(ev, fcf),
      evEbitda: s(ev, ebitda), evEbit: s(ev, ebit),
      capexExpPct: 0, acqPct: 0, divPct: 0, buybackPct: 0, debtRepayPct: 0, totalAllocPct: 0,
      impPct: 0, sbcPct: 0, divstPct: 0, issuancePct: 0, extraPct: 0,
    });

    prevSales = sales;
    prevDA = da;
    prevShares = shares;
    _prevWC = wc;
    prevCashEq = projCashEq;
    prevMktSec = projMktSec;
    prevNetDebt = netDebt;
    prevTotalDebt = projTotalDebt;
    prevStDebt = projStDebt;
    prevLtDebt = projLtDebt;
  }

  // ═══ STEP 16-17: Target prices, CAGR, Safety margin ═══
  const targetPrices: TargetPriceYear[] = proj.map(p => {
    // PER ex Cash: always (NI × PER - NetDebt) / shares
    // When netDebt < 0 (net cash), subtracting negative adds value
    const perExCash = (p.netIncome * inputs.targetPER) / p.shares;
    const evFcfP = (p.fcf * inputs.targetEVFCF - p.netDebt) / p.shares;
    const evEbitdaP = (p.ebitda * inputs.targetEVEBITDA - p.netDebt) / p.shares;
    const evEbitP = (p.ebit * inputs.targetEVEBIT - p.netDebt) / p.shares;
    const avg = (perExCash + evFcfP + evEbitdaP + evEbitP) / 4;
    return { year: p.year, perExCash, evFcf: evFcfP, evEbitda: evEbitdaP, evEbit: evEbitP, average: avg };
  });

  const cagr5y: Record<string, number> = {};
  const lastTP = targetPrices[targetPrices.length - 1];
  const cp = inputs.currentPrice;
  if (lastTP && cp > 0) {
    const yrs = 5;
    cagr5y["PER ex Cash"] = Math.pow(lastTP.perExCash / cp, 1 / yrs) - 1;
    cagr5y["EV / FCF"] = Math.pow(lastTP.evFcf / cp, 1 / yrs) - 1;
    cagr5y["EV / EBITDA"] = Math.pow(lastTP.evEbitda / cp, 1 / yrs) - 1;
    cagr5y["EV / EBIT"] = Math.pow(lastTP.evEbit / cp, 1 / yrs) - 1;
    cagr5y["Promedio"] = Math.pow(lastTP.average / cp, 1 / yrs) - 1;
  }

  const safetyMargins = targetPrices.map(tp => cp > 0 ? (tp.evFcf / cp) - 1 : 0);

  const lastEvFcfPrice = lastTP?.evFcf ?? 0;
  const buyPrice = lastEvFcfPrice / Math.pow(1 + inputs.targetReturn, 5);
  const buyPriceVsCurrent = cp > 0 ? (buyPrice - cp) / cp : 0;

  // ═══ Medians ═══
  // Exclude years with incomplete CF data (e.g. appended 2025 with capex=0)
  const histWithCF = hist.filter((h, i) => !(sa(raw.capex, i) === 0 && sa(raw.repurchaseStock, i) === 0 && i === N - 1));
  const medians: Record<string, number> = {
    per: medPositive(hist.map(h => h.per)),
    evFcf: medPositive(hist.map(h => h.evFcf)),
    evEbitda: medPositive(hist.map(h => h.evEbitda)),
    evEbit: medPositive(hist.map(h => h.evEbit)),
    roic: med(hist.map(h => h.roic)),
    roe: med(hist.map(h => h.roe)),
    capexMantToSales: med(hist.map(h => s(Math.abs(h.capexMant), h.sales))),
    wcToSales: med(hist.map(h => s(h.wc, h.sales))),
    fcfMargin: med(hist.map(h => s(h.fcf, h.sales))),
    cashConversion: med(hist.map(h => s(h.fcf, h.ebitda))),
    capexExpPct: med(histWithCF.map(h => h.capexExpPct)),
    acqPct: med(histWithCF.map(h => h.acqPct)),
    divPct: med(histWithCF.map(h => h.divPct)),
    buybackPct: med(histWithCF.map(h => h.buybackPct)),
    debtRepayPct: med(histWithCF.map(h => h.debtRepayPct)),
    totalAllocPct: med(histWithCF.map(h => h.totalAllocPct)),
    netDebtToEBITDA: med(hist.map(h => s(h.netDebt, h.ebitda))),
  };

  // ═══ Red flag counts ═══
  let salesDecline = 0, marginDecline = 0, negativeFCF = 0, poorROIC = 0, highDebt = 0;
  for (let i = 0; i < N; i++) {
    if (i > 0 && hist[i].sales < hist[i - 1].sales) salesDecline++;
    if (i > 0 && s(hist[i].ebit, hist[i].sales) < s(hist[i - 1].ebit, hist[i - 1].sales)) marginDecline++;
    if (hist[i].fcf < 0) negativeFCF++;
    if (hist[i].roic < 0.10) poorROIC++;
    if (s(hist[i].netDebt, hist[i].ebitda) > 2.5) highDebt++;
  }

  return {
    hist, proj, medians, targetPrices, cagr5y, safetyMargins,
    buyPrice, buyPriceVsCurrent,
    redFlagCounts: { salesDecline, marginDecline, negativeFCF, poorROIC, highDebt },
    projTaxRate,
  };
}

function emptyResult(): FullModelResult {
  return {
    hist: [], proj: [], medians: {}, targetPrices: [], cagr5y: {},
    safetyMargins: [], buyPrice: 0, buyPriceVsCurrent: 0,
    redFlagCounts: { salesDecline: 0, marginDecline: 0, negativeFCF: 0, poorROIC: 0, highDebt: 0 },
    projTaxRate: 0,
  };
}
