import * as XLSX from 'xlsx';
import { extractTikrData, extractManualInputs } from './src/lib/tikrExtractor';
import { calculateFullModel } from './src/lib/tikrCalculations';

const wb = XLSX.readFile('/tmp/csu.xlsx');
const raw = extractTikrData(wb)!;
const inputs = extractManualInputs(wb)!;
const result = calculateFullModel(raw, inputs);
console.log(JSON.stringify({
  inputs: {
    lastSales: inputs.lastSales,
    lastDA: inputs.lastDA,
    growthRates: inputs.growthRates,
    ebitMarginEst: inputs.ebitMarginEst,
    capexMantToSales: inputs.capexMantToSales,
    wcToSalesEst: inputs.wcToSalesEst,
    netDebtToEBITDA: inputs.netDebtToEBITDA,
    taxRateEst: inputs.taxRateEst,
    currentPrice: inputs.currentPrice,
  },
  proj: result.proj.map(p => ({
    year: p.year,
    sales: p.sales,
    da: p.da,
    ebit: p.ebit,
    ebitda: p.ebitda,
    capexMant: p.capexMant,
    wc: p.wc,
    cwc: p.cwc,
    intExp: p.intExp,
    intInc: p.intInc,
    totalInt: p.totalInt,
    tax: p.tax,
    mi: p.mi,
    fcf: p.fcf,
    cashEq: p.cashEq,
    mktSec: p.mktSec,
    stDebt: p.stDebt,
    ltDebt: p.ltDebt,
    netDebt: p.netDebt,
  }))
}, null, 2));
