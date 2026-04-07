import XLSX from 'xlsx';
import { extractTikrData } from './src/lib/tikrExtractor';
const wb = XLSX.readFile('/tmp/csu.xlsx');
const raw = extractTikrData(wb)!;
console.log(JSON.stringify({years: raw.years, capexMantOverride: raw.capexMantOverride}, null, 2));
