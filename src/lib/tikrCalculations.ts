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
  const hist: YC[] = [];

  // ═══ STEPS 1-9: Historical ═══
  for (let i = 0; i < N; i++) {
    const sales = raw.revenues[i];
    const ebit = raw.operatingIncome[i];
    const deprec = raw.depreciation[i] || 0;
    const amortGW = raw.amortGoodwill[i] || 0;
    const da = -(deprec + amortGW);
    const ebitda = ebit - da;
    const intExp = raw.interestExpense[i];
    const intInc = raw.interestIncome[i];
    const totalInt = intExp + intInc;
    const ebt = ebit + totalInt;
    const tax = raw.taxExpense[i];
    const taxRate = ebt !== 0 ? Math.abs(tax) / ebt : 0;
    const consolNI = ebt + tax;
    const mi = raw.minorityInterest[i];
    const netIncome = consolNI + mi;
    const shares = raw.dilutedShares[i] || 1;
    const eps = netIncome / shares;

    // Step 2: WC
    const inv = raw.inventory[i] || 0;
    const ar = raw.accountsReceivable[i];
    const ap = raw.accountsPayable[i];
    const urC = raw.unearnedRevCurrent[i] || 0;
    const urNC = raw.unearnedRevNonCurrent[i] || 0;
    const wc = inv + ar - ap - urC - urNC;
    let cwc = 0;
    if (i > 0 && raw.accountsPayable[i - 1] > 0) {
      const pInv = raw.inventory[i - 1] || 0;
      const pAR = raw.accountsReceivable[i - 1];
      const pAP = raw.accountsPayable[i - 1];
      const pURC = raw.unearnedRevCurrent[i - 1] || 0;
      const pURNC = raw.unearnedRevNonCurrent[i - 1] || 0;
      cwc = wc - (pInv + pAR - pAP - pURC - pURNC);
    }

    // Step 3: CapEx Maint
    const capexRaw = raw.capex[i];
    const salePPE = raw.salePPE[i] || 0;
    const saleIntang = raw.saleIntangibles[i] || 0;
    const capexNeto = capexRaw + saleIntang + salePPE;
    const capexMant = Math.abs(capexNeto) < deprec
      ? capexNeto + saleIntang
      : -deprec + saleIntang;

    // Step 4: FCF
    const fcf = ebitda + capexMant + totalInt + tax - cwc + mi;
    const fcfps = fcf / shares;

    // Step 5: Invested Capital & ROIC
    const cashEq = raw.cashEquiv[i];
    const mktSec = raw.totalCashSTI[i] - cashEq;
    const stBorrow = raw.stBorrowings[i] || 0;
    const curLTD = raw.currentLTD[i] || 0;
    const finDivCur = raw.finDivDebtCurrent[i] || 0;
    const stDebt = stBorrow + curLTD + finDivCur;
    const ltBorrow = raw.ltBorrowings[i] || 0;
    const ltDebtVal = raw.ltDebt[i] || 0;
    const finDivNC = raw.finDivDebtNC[i] || 0;
    const ltDebt = ltBorrow + ltDebtVal + finDivNC;
    const curLeases = raw.currentCapLeases[i] || 0;
    const ncLeases = raw.ncCapLeases[i] || 0;
    const equity = raw.totalEquity[i];
    const ic = equity + stDebt + ltDebt + curLeases + ncLeases - mktSec;
    const nopat = ebit * (1 - taxRate);
    const roic = s(nopat, ic);
    const roe = s(netIncome, equity);

    // Step 6: Valuation
    const basicSh = raw.basicShares[i] || shares;
    const mktCap = raw.marketCapMM[i] * (shares / basicSh);
    const netDebt = (ltDebt + stDebt) - (cashEq + mktSec);
    const ev = mktCap + netDebt;

    // Step 7: Ratios (computed inline)
    // Step 8: Capital allocation
    const capexExp = capexNeto - capexMant;
    const acq = raw.cashAcquisitions[i];
    const divPaid = Math.abs(raw.dividendsPaid[i] || 0);
    const buyback = Math.abs(raw.repurchaseStock[i] || 0);
    const debtRep = Math.max(0, Math.abs(raw.debtRepaid[i] || 0) - (raw.debtIssued[i] || 0));
    const fcfAbs = Math.abs(fcf);
    const fcfPos = fcf > 0 ? fcf : 0;

    // Step 9: Red flags
    const aw = Math.abs(raw.assetWritedown[i] || 0);
    const ig = Math.abs(raw.impairmentGoodwill[i] || 0);
    const ebtExcl = raw.ebtExclUnusual?.[i] || 0;
    const ebtIncl = raw.ebtInclUnusual?.[i] || 0;
    const unusualItems = Math.abs(ebtExcl - ebtIncl);

    // Reinvestment rate: (|total capex| - total D&A + cwc) / NOPAT
    const reinvRate = nopat !== 0 ? (Math.abs(capexRaw) - (deprec + amortGW) + cwc) / nopat : 0;

    hist.push({
      year: raw.years[i], sales, ebitda, da, ebit,
      intExp, intInc, totalInt, ebt, tax, taxRate,
      consolNI, mi, netIncome, eps, shares,
      capexMant, wc, cwc, fcf, fcfps,
      netCashChange: raw.netCashChangeHist[i],
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
      impPct: s(aw + ig, sales), sbcPct: s(raw.sbc[i] || 0, sales),
      divstPct: s(raw.divestitures[i] || 0, sales),
      issuancePct: s(raw.issuanceStock[i] || 0, sales),
      extraPct: s(unusualItems, sales),
    });
    const h = hist[hist.length - 1];
    h.totalAllocPct = h.capexExpPct + h.acqPct + h.divPct + h.buybackPct + h.debtRepayPct;
  }

  // ═══ STEPS 10-17: Projections ═══
  const last = hist[N - 1];
  if (!last) return emptyResult();

  // Projected tax rate = median of last 3 valid rates
  const validTaxRates = hist.slice(-3).map(h => h.taxRate).filter(t => t > 0 && t < 1);
  const projTaxRate = med(validTaxRates);

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

  const proj: YC[] = [];
  let prevSales = inputs.lastSales;
  let prevDA = inputs.lastDA;
  let prevShares = inputs.lastShares;
  let prevWC = last.wc;
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
    const tax = -(ebt * projTaxRate);
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
    const cwc = j === 0 ? wc - prevWC : wc - ((inputs.wcToSalesEst[j - 1] ?? wcRate) * prevSales);
    const fcf = ebitda + capexMant + totalInt + tax - cwc + mi;
    const fcfps = fcf / shares;

    // Valuation at current price
    const mktCap = inputs.currentPrice * shares;
    const ev = mktCap + netDebt;

    const nopat = ebit * (1 - projTaxRate);

    // Projected equity & IC (simplified growth)
    const equityGrowth = 1 + gr;
    const projEquity = (j === 0 ? last.equity : proj[j - 1].equity) * equityGrowth + netIncome * 0.3;
    const curLeases = last.curLeases * (1 + gr) ** (j + 1);
    const ncLeases = last.ncLeases * (1 + gr) ** (j + 1);
    const ic = projEquity + projStDebt + projLtDebt + curLeases + ncLeases - projMktSec;

    const projYear = last.year + j + 1;

    proj.push({
      year: projYear, sales, ebitda, da, ebit,
      intExp, intInc, totalInt, ebt, tax, taxRate: projTaxRate,
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
    prevWC = wc;
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
    const perExCash = (p.netIncome * inputs.targetPER - p.netDebt) / p.shares;
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
    capexExpPct: med(hist.map(h => h.capexExpPct)),
    acqPct: med(hist.map(h => h.acqPct)),
    divPct: med(hist.map(h => h.divPct)),
    buybackPct: med(hist.map(h => h.buybackPct)),
    debtRepayPct: med(hist.map(h => h.debtRepayPct)),
    totalAllocPct: med(hist.map(h => h.totalAllocPct)),
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
