import XLSX from 'xlsx';
import { extractTikrData, extractManualInputs } from './src/lib/tikrExtractor';
import { calculateFullModel } from './src/lib/tikrCalculations';

const wb = XLSX.readFile('/tmp/csu.xlsx');
const raw = extractTikrData(wb)!;
const inputs = extractManualInputs(wb)!;
const result = calculateFullModel(raw, inputs);
console.log(JSON.stringify({
  inputs,
  proj: result.proj.map(p => ({
    year: p.year,
    sales: p.sales,
    da: p.da,
    ebit: p.ebit,
    ebitda: p.ebitda,
    totalInt: p.totalInt,
    tax: p.tax,
    mi: p.mi,
    capexMant: p.capexMant,
    wc: p.wc,
    cwc: p.cwc,
    fcf: p.fcf,
    cashEq: p.cashEq,
    mktSec: p.mktSec,
    stDebt: p.stDebt,
    ltDebt: p.ltDebt,
    curLeases: p.curLeases,
    ncLeases: p.ncLeases,
    equity: p.equity,
    ic: p.ic,
    netDebt: p.netDebt,
    roic: p.roic,
  }))
}, null, 2));
