import fs from 'fs';
import XLSX from 'xlsx';
import { parseExcelFile } from './src/lib/excelParser';
import { extractTikrData, extractManualInputs } from './src/lib/tikrExtractor';
import { calculateFullModel } from './src/lib/tikrCalculations';
const file='/tmp/csu.xlsx';
const buffer=fs.readFileSync(file);
const parsed=parseExcelFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset+buffer.byteLength),'Plantilla Constellation Software CSU actualizada 13 marzo 2026.xlsx');
const wb=XLSX.readFile(file);
const raw=extractTikrData(wb)!;
const inputs=extractManualInputs(wb)!;
const result=calculateFullModel(raw, inputs);
console.log(JSON.stringify({
parsed:{currency:parsed.currency,currentPrice:parsed.currentPrice,targetPrice5y:parsed.targetPrice5y,priceFor15Return:parsed.priceFor15Return,estimatedAnnualReturn:parsed.estimatedAnnualReturn},
inputs:{currentPrice:inputs.currentPrice,targetReturn:inputs.targetReturn,targetEVFCF:inputs.targetEVFCF,projectedCapexMant:inputs.projectedCapexMant,projectedWC:inputs.projectedWC,projectedCWC:inputs.projectedCWC,projectedInterestExpense:inputs.projectedInterestExpense,projectedInterestIncome:inputs.projectedInterestIncome,projectedTaxExpense:inputs.projectedTaxExpense,projectedNetDebt:inputs.projectedNetDebt},
proj:result.proj.map(p=>({year:p.year,totalInt:p.totalInt,tax:p.tax,capexMant:p.capexMant,wc:p.wc,cwc:p.cwc,fcf:p.fcf,netCashChange:p.netCashChange}))
}, null, 2));
