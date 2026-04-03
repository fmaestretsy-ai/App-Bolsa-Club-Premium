import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { extractTikrData } from "../tikrExtractor";

function makeWorkbook(includeSaleRow = false) {
  const wb = XLSX.utils.book_new();

  const isSheet = XLSX.utils.aoa_to_sheet([
    ["Income Statement"],
    [null, 2016, 2017, 2018],
    ["Total Revenues", 100, 110, 120],
    ["Operating Income", 20, 22, 24],
    ["Weighted Average Diluted Shares Outstanding", 10, 10, 10],
  ]);

  const bsSheet = XLSX.utils.aoa_to_sheet([
    ["Balance Sheet"],
    [null, 2016, 2017, 2018],
  ]);

  const cfRows = [
    ["Cash Flow Statement"],
    [null, 2016, 2017, 2018],
    ["Depreciation & Amortization", 7829, 8000, 8200],
    ["Amortization of Goodwill and Intangible Assets", 287, 300, 310],
    ["Capital Expenditure", -7804, -8000, -8200],
  ];

  if (includeSaleRow) {
    cfRows.push(["Sale (Purchase) of Intangible Assets", -125, -150, -175]);
  }

  const cfSheet = XLSX.utils.aoa_to_sheet(cfRows);
  const valSheet = XLSX.utils.aoa_to_sheet([
    ["Valuation"],
    [null, 2016, 2017, 2018],
    ["Market Cap (MM)", 1000, 1100, 1200],
  ]);

  XLSX.utils.book_append_sheet(wb, isSheet, "7.TIKR_IS");
  XLSX.utils.book_append_sheet(wb, bsSheet, "8.TIKR_BS");
  XLSX.utils.book_append_sheet(wb, cfSheet, "9.TIKR_CF");
  XLSX.utils.book_append_sheet(wb, valSheet, "10.TIKR_Val");

  return wb;
}

describe("extractTikrData saleIntangibles", () => {
  it("does not confuse amortization rows with sale of intangibles", () => {
    const raw = extractTikrData(makeWorkbook(false));
    expect(raw).not.toBeNull();
    expect(raw?.saleIntangibles).toEqual([0, 0, 0]);
    expect(raw?.capex).toEqual([-7804, -8000, -8200]);
    expect(raw?.amortGoodwill).toEqual([287, 300, 310]);
  });

  it("extracts sale of intangibles only from the explicit sale row", () => {
    const raw = extractTikrData(makeWorkbook(true));
    expect(raw).not.toBeNull();
    expect(raw?.saleIntangibles).toEqual([-125, -150, -175]);
  });
});
