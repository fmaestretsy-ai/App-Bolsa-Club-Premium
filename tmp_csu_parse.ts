import fs from 'fs';
import { parseExcelFile } from './src/lib/excelParser';
const buffer = fs.readFileSync('/tmp/csu.xlsx');
const parsed = parseExcelFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), 'Plantilla Constellation Software CSU actualizada 13 marzo 2026.xlsx');
console.log(JSON.stringify({currency: parsed.currency, currentPrice: parsed.currentPrice, targetPrice5y: parsed.targetPrice5y, priceFor15Return: parsed.priceFor15Return, estimatedAnnualReturn: parsed.estimatedAnnualReturn}, null, 2));
