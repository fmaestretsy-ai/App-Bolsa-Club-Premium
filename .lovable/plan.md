

## Verification Report: v2026.1 Template Adaptation

### What was requested
The v2026.1 template changes the projection of "Net Change in Cash" to be driven by **capital allocation** (CapEx Expansion, Acquisitions, Dividends, Buybacks, Debt Repayment as % of FCF), replacing the old manual Net Debt/EBITDA ratio. The Net Debt in sheet 4.Valoración now flows automatically from this calculation.

### Code review findings

**Correct implementations:**
1. `netCashChange = FCF × (1 - totalAllocPct)` — line 375 of tikrCalculations.ts
2. `netDebt = prevNetDebt - netCashChange` — line 378, correctly accumulates
3. Guidance overrides (CapEx total, Acquisitions, Buybacks) extracted from "Guidance directiva" section — lines 773-799 of tikrExtractor.ts
4. Allocation percentages use median of individual components (not median of total) — lines 302-306
5. Net Debt/EBITDA is now a pure output, no longer a manual input
6. Balance sheet items (Cash, Debt) derived from projected Net Debt — lines 382-387

**Potential issue found — CapEx Mant double-counting of saleIntangibles:**

Line 166-171 of tikrCalculations.ts:
```text
capexNeto = capexRaw + saleIntang + salePPE
capexMantBase = |capexNeto| < deprec ? capexNeto : -deprec
capexMant = capexMantBase + saleIntang   ← adds saleIntang again
```

When `|capexNeto| < depreciation` AND `saleIntangibles ≠ 0`, `saleIntangibles` gets counted twice. This path is not triggered in current test cases (AMZN has saleIntang=0, ASML always exceeds depreciation), but it is a latent bug that could affect other companies.

**Dead code:** `inputs.netCashChange` is extracted (line 735) but never used in projections — correct for v2026.1, but should be cleaned up.

### Plan

1. **Fix the saleIntangibles double-counting bug** in the historical CapEx Mant calculation (tikrCalculations.ts line 166-171). When `|capexNeto| < depreciation`, the result should be `capexNeto` directly (saleIntang is already included), not `capexNeto + saleIntang`.

2. **Remove dead `netCashChange` extraction** from `extractManualInputs` and `TikrModelInputs` interface, since projections now calculate it from allocation percentages.

3. **Run the CSU debug script** against the uploaded Excel to verify projected FCF, Net Change in Cash, Net Debt, and Net Debt/EBITDA match the workbook exactly for years 2026-2030.

4. **Add a regression test** for the saleIntangibles edge case (company where `|capexNeto| < depreciation` AND `saleIntangibles ≠ 0`).

### Technical details

**File changes:**
- `src/lib/tikrCalculations.ts`: Fix line 171 to `capexMantBase + (Math.abs(capexNeto) >= absDeprec ? saleIntang : 0)` — only add saleIntang separately when it wasn't already included via `capexNeto`
- `src/lib/tikrExtractor.ts`: Remove `netCashChange` from `TikrModelInputs` and its extraction logic
- `src/lib/__tests__/tikrCalculations.test.ts`: Add edge case test

