import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { extractTikrData, extractManualInputs } from "@/lib/tikrExtractor";
import { calculateFullModel } from "@/lib/tikrCalculations";

describe("CSU FCF audit", () => {
  it("matches Excel FCF values", () => {
    const wb = XLSX.readFile("/tmp/csu.xlsx");
    const raw = extractTikrData(wb);
    expect(raw).not.toBeNull();
    if (!raw) return;

    console.log("Years:", raw.years);
    console.log("Depreciation:", raw.depreciation);
    console.log("AmortGW:", raw.amortGoodwill);
    console.log("CapEx:", raw.capex);
    console.log("MI:", raw.minorityInterest);
    console.log("URC:", raw.unearnedRevCurrent);
    console.log("URNC:", raw.unearnedRevNonCurrent);

    const inputs = extractManualInputs(wb);
    expect(inputs).not.toBeNull();
    if (!inputs) return;

    const result = calculateFullModel(raw, inputs);

    const expected: Record<number, number> = {
      2016: 286.59, 2017: 419.29, 2018: 596.6, 2019: 626, 2020: 967,
      2021: 1250, 2022: 1539, 2023: 2443, 2024: 2130, 2025: 2618.46,
    };

    for (const h of result.hist) {
      const exp = expected[h.year];
      if (exp !== undefined) {
        console.log(`${h.year}: EBITDA=${h.ebitda.toFixed(1)}, CapexMant=${h.capexMant.toFixed(1)}, TotalInt=${h.totalInt.toFixed(1)}, Tax=${h.tax.toFixed(1)}, CWC=${h.cwc.toFixed(1)}, MI=${h.mi.toFixed(1)}, FCF=${h.fcf.toFixed(1)}, expected=${exp}`);
      }
    }
  });
});
