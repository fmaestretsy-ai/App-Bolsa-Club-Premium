import XLSX from 'xlsx';
import { extractTikrData, extractManualInputs } from './src/lib/tikrExtractor';
import { calculateFullModel } from './src/lib/tikrCalculations';
const wb = XLSX.readFile('/tmp/csu.xlsx');
const raw = extractTikrData(wb)!;
const inputs = extractManualInputs(wb)!;
const result = calculateFullModel(raw, inputs);
console.log(JSON.stringify(result.hist.map(h => ({year:h.year, capexMant:h.capexMant, totalInt:h.totalInt, tax:h.tax, wc:h.wc, cwc:h.cwc, fcf:h.fcf, netCashChange:h.netCashChange})), null, 2));
