import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanies } from "@/hooks/useCompanyData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/EmptyState";
import { Calculator } from "lucide-react";
import * as XLSX from "xlsx";
import { extractTikrData, extractManualInputs, type TikrModelInputs } from "@/lib/tikrExtractor";
import { calculateFullModel, type FullModelResult, type YC } from "@/lib/tikrCalculations";
import { Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from "recharts";

/* ─── Editable cell (orange) ─── */
function EditableCell({
  value, onChange, format = "number",
}: {
  value: number;
  onChange: (v: number) => void;
  format?: "number" | "percent" | "decimal";
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");

  const display = format === "percent"
    ? `${Math.round(value * 100)}%`
    : format === "decimal"
    ? value.toFixed(1)
    : Math.round(value).toLocaleString();

  const handleStart = () => {
    setRaw(format === "percent" ? String(Math.round(value * 100)) : String(value));
    setEditing(true);
  };

  const handleEnd = () => {
    setEditing(false);
    let parsed = parseFloat(raw);
    if (isNaN(parsed)) return;
    if (format === "percent") parsed /= 100;
    onChange(parsed);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="w-20 bg-transparent border-b-2 border-orange-400 text-right text-xs outline-none text-orange-600 dark:text-orange-400 font-semibold"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={handleEnd}
        onKeyDown={e => e.key === "Enter" && handleEnd()}
      />
    );
  }

  return (
    <span
      className="cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 px-1 rounded text-orange-600 dark:text-orange-400 font-semibold"
      onClick={handleStart}
      title="Click para editar"
    >
      {display}
    </span>
  );
}

/* ─── Format helpers ─── */
const fmt = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "—";
  if (!isFinite(v)) return "—";
  if (v < 0) return `(${Math.round(Math.abs(v)).toLocaleString()})`;
  return Math.round(v).toLocaleString();
};
const pct = (v: number | null | undefined) => {
  if (v == null || isNaN(v) || !isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
};
const pctC = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "";
  return v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400";
};
const fmtX = (v: number | null | undefined) => {
  if (v == null || isNaN(v) || !isFinite(v)) return "—";
  return v.toFixed(1) + "x";
};
const s = (n: number, d: number) => d !== 0 && isFinite(d) ? n / d : 0;

/* ─── Table shell with optional median col ─── */
function ModelTable({
  children, histYears, projYears, showMedian = false, subtitle,
}: {
  children: React.ReactNode;
  histYears: number[];
  projYears: number[];
  showMedian?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-border bg-muted/50">
            <th className="text-left p-2 min-w-[200px] sticky left-0 bg-muted/50 z-10 text-muted-foreground text-xs font-medium">
              {subtitle || "(millones)"}
            </th>
            {histYears.map(y => (
              <th key={y} className="text-right p-2 min-w-[80px] text-muted-foreground font-medium">{y}</th>
            ))}
            {projYears.map(y => (
              <th key={y} className="text-right p-2 min-w-[80px] font-medium bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400">{y}e</th>
            ))}
            {showMedian && <th className="text-right p-2 min-w-[70px] font-medium bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400">Med.</th>}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({
  label, values, isPercent = false, isBold = false, isSubRow = false, isSeparator = false,
  projStart = 0, medianVal, isMultiple = false, renderCell,
}: {
  label: string;
  values: (number | null | undefined | React.ReactNode)[];
  isPercent?: boolean;
  isBold?: boolean;
  isSubRow?: boolean;
  isSeparator?: boolean;
  projStart?: number;
  medianVal?: number | null;
  isMultiple?: boolean;
  renderCell?: (val: unknown, idx: number) => React.ReactNode;
}) {
  return (
    <tr className={`border-b border-border/30 ${isSeparator ? "border-t-2 border-t-border" : ""} ${isBold ? "font-semibold bg-muted/20" : ""}`}>
      <td className={`p-1.5 sticky left-0 bg-card z-10 ${isSubRow ? "pl-6 text-muted-foreground italic" : "text-foreground"} text-xs`}>
        {label}
      </td>
      {values.map((v, i) => {
        if (renderCell) return <td key={i} className={`text-right p-1.5 text-xs ${i >= projStart ? "bg-blue-50/20 dark:bg-blue-950/10" : ""}`}>{renderCell(v, i)}</td>;
        // React elements (EditableCell etc)
        if (v != null && typeof v === "object") return <td key={i} className={`text-right p-1.5 text-xs ${i >= projStart ? "bg-blue-50/20 dark:bg-blue-950/10" : ""}`}>{v}</td>;
        const num = v as number | null | undefined;
        const isNeg = num != null && typeof num === "number" && num < 0;
        const cl = isPercent ? pctC(num) : isNeg ? "text-red-500 dark:text-red-400" : "";
        const display = isMultiple ? fmtX(num) : isPercent ? pct(num) : fmt(num);
        return (
          <td key={i} className={`text-right p-1.5 text-xs ${cl} ${i >= projStart ? "bg-blue-50/20 dark:bg-blue-950/10" : ""}`}>
            {display}
          </td>
        );
      })}
      {medianVal !== undefined && (
        <td className="text-right p-1.5 text-xs bg-amber-50/20 dark:bg-amber-950/10 font-semibold">
          {isMultiple ? fmtX(medianVal) : isPercent ? pct(medianVal) : fmt(medianVal)}
        </td>
      )}
    </tr>
  );
}

function SectionHeader({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="border-t-2 border-border bg-muted/40">
      <td className="p-2 text-xs font-bold text-foreground sticky left-0 bg-muted/40 z-10" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

/* ─── Main component ─── */
export default function FinancialModel() {
  useTranslation();
  const { user } = useAuth();
  const { data: companies = [] } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const companyId = selectedCompanyId || companies[0]?.id || "";

  // Load Excel and extract TIKR data
  const { data: tikrBundle } = useQuery({
    queryKey: ["tikr-model", companyId],
    enabled: !!user && !!companyId,
    queryFn: async () => {
      const { data: upload, error } = await supabase
        .from("excel_uploads")
        .select("file_path, file_name")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!upload?.file_path) return null;

      const { data: file, error: dlErr } = await supabase.storage
        .from("excel-uploads")
        .download(upload.file_path);
      if (dlErr) throw dlErr;

      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const raw = extractTikrData(wb);
      const inputs = extractManualInputs(wb);
      if (!raw || !inputs) return null;
      return { raw, inputs };
    },
  });

  const [localInputs, setLocalInputs] = useState<TikrModelInputs | null>(null);

  // When company changes, reset local inputs
  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    setLocalInputs(null);
  };

  const inputs = localInputs || tikrBundle?.inputs || null;
  const raw = tikrBundle?.raw || null;

  const result = useMemo<FullModelResult | null>(() => {
    if (!raw || !inputs) return null;
    return calculateFullModel(raw, inputs);
  }, [raw, inputs]);

  const updateInput = useCallback((updater: (prev: TikrModelInputs) => TikrModelInputs) => {
    if (!inputs) return;
    setLocalInputs(updater(inputs));
  }, [inputs]);

  if (companies.length === 0 || !result) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Modelo Financiero</h1>
            {companies.length > 0 && (
              <Select value={companyId} onValueChange={handleCompanyChange}>
                <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
                <SelectContent>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.ticker} — {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <EmptyState icon={<Calculator className="h-7 w-7" />} title="Sin datos" description="Sube un Excel con datos TIKR para ver el modelo financiero" />
        </div>
      </DashboardLayout>
    );
  }

  const { hist, proj, medians, targetPrices, cagr5y, safetyMargins, buyPrice, buyPriceVsCurrent, redFlagCounts } = result;
  const hYears = hist.map(h => h.year);
  const pYears = proj.map(p => p.year);
  const N = hist.length;
  const totalCols = 1 + N + pYears.length + 1; // +1 for median

  // Helper: hist values for a field
  const hv = (field: keyof YC) => hist.map(h => h[field] as number);
  const pv = (field: keyof YC) => proj.map(p => p[field] as number);
  const all = (field: keyof YC) => [...hv(field), ...pv(field)];

  // Growth helper
  const histGrowth = (field: keyof YC) => hist.map((h, i) => {
    if (i === 0) return null;
    const prev = hist[i - 1][field] as number;
    const curr = h[field] as number;
    return prev !== 0 ? (curr - prev) / Math.abs(prev) : null;
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Modelo Financiero</h1>
          <Select value={companyId} onValueChange={handleCompanyChange}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.ticker} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          Las celdas en <span className="text-orange-500 font-semibold">naranja</span> son editables — haz clic para modificar.
        </p>

        <Tabs defaultValue="is" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="is">1. IS</TabsTrigger>
            <TabsTrigger value="fcf">2. FCF</TabsTrigger>
            <TabsTrigger value="roic">3. ROIC</TabsTrigger>
            <TabsTrigger value="val">4. Valoración</TabsTrigger>
            <TabsTrigger value="rf">5. Red Flags</TabsTrigger>
            <TabsTrigger value="charts">6. Gráficos</TabsTrigger>
          </TabsList>

          {/* ═══════════════ 1. INCOME STATEMENT ═══════════════ */}
          <TabsContent value="is">
            <Card className="p-4">
              <ModelTable histYears={hYears} projYears={pYears} subtitle="(millones, excepto EPS)">
                <Row label="Sales" isBold values={all("sales")} projStart={N} />
                <Row label="    Y/Y Growth %" isSubRow isPercent projStart={N}
                  values={[
                    ...histGrowth("sales"),
                    ...pYears.map((_, j) => (
                      <EditableCell key={j} value={inputs!.growthRates[j] ?? 0.10} format="percent"
                        onChange={v => updateInput(p => {
                          const gr = [...p.growthRates]; gr[j] = v;
                          for (let k = j + 1; k < 5; k++) gr[k] = v;
                          return { ...p, growthRates: gr };
                        })}
                      />
                    )),
                  ]}
                />
                <Row label="EBITDA" isBold values={all("ebitda")} projStart={N} />
                <Row label="    EBITDA margin %" isSubRow isPercent projStart={N}
                  values={[...hist.map(h => s(h.ebitda, h.sales)), ...proj.map(p => s(p.ebitda, p.sales))]}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent projStart={N}
                  values={[...histGrowth("ebitda"), ...proj.map((p, j) => {
                    const prev = j === 0 ? hist[N - 1]?.ebitda : proj[j - 1]?.ebitda;
                    return prev ? (p.ebitda - prev) / Math.abs(prev) : null;
                  })]}
                />
                <Row label="D&A" values={all("da")} projStart={N} />
                <Row label="EBIT" isBold values={all("ebit")} projStart={N} />
                <Row label="    EBIT margin %" isSubRow isPercent projStart={N}
                  values={[
                    ...hist.map(h => s(h.ebit, h.sales)),
                    ...pYears.map((_, j) => (
                      <EditableCell key={j} value={inputs!.ebitMarginEst[j] ?? 0.30} format="percent"
                        onChange={v => updateInput(p => {
                          const em = [...p.ebitMarginEst]; em[j] = v;
                          for (let k = j + 1; k < 5; k++) em[k] = v;
                          return { ...p, ebitMarginEst: em };
                        })}
                      />
                    )),
                  ]}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent projStart={N}
                  values={[...histGrowth("ebit"), ...proj.map((p, j) => {
                    const prev = j === 0 ? hist[N - 1]?.ebit : proj[j - 1]?.ebit;
                    return prev ? (p.ebit - prev) / Math.abs(prev) : null;
                  })]}
                />
                <Row label="Interest Expense" values={all("intExp")} projStart={N} />
                <Row label="Interest Income" values={all("intInc")} projStart={N} />
                <Row label="Total Interest" values={all("totalInt")} projStart={N} />
                <Row label="EBT" isBold values={all("ebt")} projStart={N} />
                <Row label="Tax Expense" values={all("tax")} projStart={N} />
                <Row label="    Tax rate %" isSubRow isPercent values={all("taxRate")} projStart={N} />
                <Row label="Consol. Net Income" values={all("consolNI")} projStart={N} />
                <Row label="Minority Interest" values={all("mi")} projStart={N} />
                <Row label="Net Income" isBold isSeparator values={all("netIncome")} projStart={N} />
                <Row label="    Net margin %" isSubRow isPercent projStart={N}
                  values={[...hist.map(h => s(h.netIncome, h.sales)), ...proj.map(p => s(p.netIncome, p.sales))]}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent projStart={N}
                  values={[...histGrowth("netIncome"), ...proj.map((p, j) => {
                    const prev = j === 0 ? hist[N - 1]?.netIncome : proj[j - 1]?.netIncome;
                    return prev ? (p.netIncome - prev) / Math.abs(prev) : null;
                  })]}
                />
                <Row label="EPS" values={all("eps")} projStart={N} />
                <Row label="    Y/Y Growth %" isSubRow isPercent projStart={N}
                  values={[...histGrowth("eps"), ...proj.map((p, j) => {
                    const prev = j === 0 ? hist[N - 1]?.eps : proj[j - 1]?.eps;
                    return prev ? (p.eps - prev) / Math.abs(prev) : null;
                  })]}
                />
                <Row label="Diluted Shares" values={all("shares")} projStart={N} />
                <Row label="    Share growth %" isSubRow isPercent projStart={N}
                  values={[
                    ...histGrowth("shares"),
                    ...pYears.map((_, j) => (
                      <EditableCell key={j} value={inputs!.shareDilutionRate} format="percent"
                        onChange={v => updateInput(p => ({ ...p, shareDilutionRate: v }))}
                      />
                    )),
                  ]}
                />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══════════════ 2. FREE CASH FLOW ═══════════════ */}
          <TabsContent value="fcf">
            <Card className="p-4">
              <ModelTable histYears={hYears} projYears={pYears} showMedian subtitle="(millones, excepto FCFPS)">
                <Row label="EBITDA" isBold values={all("ebitda")} projStart={N} />
                <Row label="(-) CapEx Mantenimiento" values={all("capexMant")} projStart={N} />
                <Row label="(-) Total Interest" values={all("totalInt")} projStart={N} />
                <Row label="(-) Taxes" values={all("tax")} projStart={N} />
                <Row label="Working Capital" values={all("wc")} projStart={N} />
                <Row label="(-) Variación WC" values={all("cwc")} projStart={N} />
                <Row label="Minority Interest" values={all("mi")} projStart={N} />
                <Row label="Free Cash Flow" isBold isSeparator values={all("fcf")} projStart={N} />
                <Row label="    FCF margin %" isSubRow isPercent projStart={N}
                  values={[...hist.map(h => s(h.fcf, h.sales)), ...proj.map(p => s(p.fcf, p.sales))]}
                  medianVal={medians.fcfMargin}
                />
                <Row label="FCFPS" values={all("fcfps")} projStart={N} />
                <Row label="Net Change in Cash" values={all("netCashChange")} projStart={N} />

                <SectionHeader label="Eficiencia" colSpan={totalCols} />
                <Row label="CapEx Mant. / Ventas" isPercent projStart={N}
                  values={[
                    ...hist.map(h => s(Math.abs(h.capexMant), h.sales)),
                    ...pYears.map((_, j) => (
                      <EditableCell key={j} value={inputs!.capexMantToSales[j] ?? inputs!.capexMantToSales[0] ?? 0} format="percent"
                        onChange={v => updateInput(p => {
                          const arr = [...p.capexMantToSales]; arr[j] = v;
                          for (let k = j + 1; k < 5; k++) arr[k] = v;
                          return { ...p, capexMantToSales: arr };
                        })}
                      />
                    )),
                  ]}
                  medianVal={medians.capexMantToSales}
                />
                <Row label="WC / Ventas" isPercent projStart={N}
                  values={[
                    ...hist.map(h => s(h.wc, h.sales)),
                    ...pYears.map((_, j) => (
                      <EditableCell key={j} value={inputs!.wcToSalesEst[j] ?? inputs!.wcToSalesEst[0] ?? 0} format="percent"
                        onChange={v => updateInput(p => {
                          const arr = [...p.wcToSalesEst]; arr[j] = v;
                          for (let k = j + 1; k < 5; k++) arr[k] = v;
                          return { ...p, wcToSalesEst: arr };
                        })}
                      />
                    )),
                  ]}
                  medianVal={medians.wcToSales}
                />
                <Row label="FCF / Ventas" isPercent projStart={N}
                  values={[...hist.map(h => s(h.fcf, h.sales)), ...proj.map(p => s(p.fcf, p.sales))]}
                  medianVal={medians.fcfMargin}
                />
                <Row label="Cash Conversion (FCF/EBITDA)" isPercent projStart={N}
                  values={[...hist.map(h => s(h.fcf, h.ebitda)), ...proj.map(p => s(p.fcf, p.ebitda))]}
                  medianVal={medians.cashConversion}
                />

                <SectionHeader label="Asignación de capital (% FCF)" colSpan={totalCols} />
                <Row label="CapEx Expansión" isPercent values={hv("capexExpPct")} projStart={N} medianVal={medians.capexExpPct} />
                <Row label="Adquisiciones" isPercent values={hv("acqPct")} projStart={N} medianVal={medians.acqPct} />
                <Row label="Dividendos" isPercent values={hv("divPct")} projStart={N} medianVal={medians.divPct} />
                <Row label="Recompras" isPercent values={hv("buybackPct")} projStart={N} medianVal={medians.buybackPct} />
                <Row label="Amort. Deuda" isPercent values={hv("debtRepayPct")} projStart={N} medianVal={medians.debtRepayPct} />
                <Row label="Total" isBold isPercent values={hv("totalAllocPct")} projStart={N} medianVal={medians.totalAllocPct} />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══════════════ 3. ROIC ═══════════════ */}
          <TabsContent value="roic">
            <Card className="p-4">
              <ModelTable histYears={hYears} projYears={pYears} showMedian>
                <Row label="EBIT × (1-t) = NOPAT" isBold values={all("nopat")} projStart={N} />
                <Row label="Cash & Equivalents" values={all("cashEq")} projStart={N} />
                <Row label="Marketable Securities" values={all("mktSec")} projStart={N} />
                <Row label="ST Debt" values={all("stDebt")} projStart={N} />
                <Row label="LT Debt" values={all("ltDebt")} projStart={N} />
                <Row label="Current Leases" values={all("curLeases")} projStart={N} />
                <Row label="NC Leases" values={all("ncLeases")} projStart={N} />
                <Row label="Equity" values={all("equity")} projStart={N} />
                <Row label="Invested Capital" isBold isSeparator values={all("ic")} projStart={N} />

                <SectionHeader label="Ratios de rentabilidad" colSpan={totalCols} />
                <Row label="ROE" isPercent values={all("roe")} projStart={N} medianVal={medians.roe} />
                <Row label="ROIC" isPercent values={all("roic")} projStart={N} medianVal={medians.roic} />
                <Row label="Tasa reinversión" isPercent values={[...hv("reinvRate"), ...pYears.map(() => null)]} projStart={N} />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══════════════ 4. VALORACIÓN ═══════════════ */}
          <TabsContent value="val">
            <Card className="p-4 space-y-6">
              <ModelTable histYears={hYears} projYears={pYears} showMedian subtitle="Valoración (millones)">
                <Row label="Market Cap" isBold values={all("mktCap")} projStart={N} />
                <Row label="Deuda Neta" values={all("netDebt")} projStart={N} medianVal={null} />
                <Row label="    Deuda / EBITDA" isSubRow isMultiple values={[...hist.map(h => s(h.netDebt, h.ebitda)), ...proj.map(p => s(p.netDebt, p.ebitda))]} projStart={N} medianVal={medians.netDebtToEBITDA} />
                <Row label="Enterprise Value" isBold values={all("ev")} projStart={N} />
                <Row label="EBITDA" values={all("ebitda")} projStart={N} />
                <Row label="EBIT" values={all("ebit")} projStart={N} />
                <Row label="Net Income" values={all("netIncome")} projStart={N} />
                <Row label="FCF" values={all("fcf")} projStart={N} />

                <SectionHeader label="Múltiplos" colSpan={totalCols} />
                <Row label="PER" isMultiple values={all("per")} projStart={N} medianVal={medians.per} />
                <Row label="EV / FCF" isMultiple values={all("evFcf")} projStart={N} medianVal={medians.evFcf} />
                <Row label="EV / EBITDA" isMultiple values={all("evEbitda")} projStart={N} medianVal={medians.evEbitda} />
                <Row label="EV / EBIT" isMultiple values={all("evEbit")} projStart={N} medianVal={medians.evEbit} />
              </ModelTable>

              {/* Price & target multiples */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Precio por acción actual</h3>
                  <EditableCell value={inputs!.currentPrice} format="number"
                    onChange={v => updateInput(p => ({ ...p, currentPrice: v }))}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Múltiplos objetivo</h3>
                  <div className="space-y-2 text-xs">
                    {([
                      ["PER", "targetPER"],
                      ["EV / FCF", "targetEVFCF"],
                      ["EV / EBITDA", "targetEVEBITDA"],
                      ["EV / EBIT", "targetEVEBIT"],
                    ] as const).map(([label, key]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{label}</span>
                        <EditableCell value={inputs![key]} onChange={v => updateInput(p => ({ ...p, [key]: v }))} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target prices */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Precio objetivo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/50">
                        <th className="text-left p-2 min-w-[140px] text-muted-foreground">Método</th>
                        {pYears.map(y => <th key={y} className="text-right p-2 min-w-[80px] text-muted-foreground">{y}e</th>)}
                        <th className="text-right p-2 min-w-[80px] text-muted-foreground">CAGR 5y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {([
                        ["PER ex Cash", "perExCash", "PER ex Cash"],
                        ["EV / FCF", "evFcf", "EV / FCF"],
                        ["EV / EBITDA", "evEbitda", "EV / EBITDA"],
                        ["EV / EBIT", "evEbit", "EV / EBIT"],
                        ["Promedio", "average", "Promedio"],
                      ] as [string, keyof typeof targetPrices[0], string][]).map(([label, field, cagrKey]) => (
                        <tr key={field} className={`border-b border-border/30 ${field === "average" ? "font-semibold bg-muted/20" : ""}`}>
                          <td className="p-2 text-foreground">{label}</td>
                          {targetPrices.map(tp => <td key={tp.year} className="text-right p-2">{fmt(tp[field] as number)}</td>)}
                          <td className={`text-right p-2 font-semibold ${pctC(cagr5y[cagrKey])}`}>
                            {cagr5y[cagrKey] != null ? pct(cagr5y[cagrKey]) : "—"}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border font-semibold">
                        <td className="p-2 text-foreground">Margen de seguridad</td>
                        {safetyMargins.map((sm, i) => <td key={i} className={`text-right p-2 ${pctC(sm)}`}>{pct(sm)}</td>)}
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Buy price */}
              <div className="border-t border-border pt-4 flex flex-wrap items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Retorno anual objetivo:</span>
                  <EditableCell value={inputs!.targetReturn} format="percent"
                    onChange={v => updateInput(p => ({ ...p, targetReturn: v }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Precio compra:</span>
                  <span className="font-semibold text-foreground">${fmt(buyPrice)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">vs precio actual:</span>
                  <span className={`font-semibold ${pctC(buyPriceVsCurrent)}`}>{pct(buyPriceVsCurrent)}</span>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* ═══════════════ 5. RED FLAGS ═══════════════ */}
          <TabsContent value="rf">
            <Card className="p-4 space-y-6">
              {/* Section 1: Red Flags as % of sales */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Posibles "Red Flags" (1)</h3>
                <ModelTable histYears={hYears} projYears={[]} subtitle="Como % de ventas...">
                  {([
                    ["Impairments", "impPct"],
                    ["Desinversiones", "divstPct"],
                    ["Pagos en acciones", "sbcPct"],
                    ["Emisión de acciones", "issuancePct"],
                    ["Cargos \"extraordinarios\"", "extraPct"],
                  ] as [string, keyof YC][]).map(([label, field]) => (
                    <tr key={field} className="border-b border-border/30">
                      <td className="p-1.5 sticky left-0 bg-card z-10 text-foreground text-xs">{label}</td>
                      {hist.map((h, i) => {
                        const v = h[field] as number;
                        const isBad = field === "sbcPct" ? v > 0.05 : v > 0.01;
                        return (
                          <td key={i} className={`text-right p-1.5 text-xs ${isBad ? "text-red-500 dark:text-red-400 font-semibold" : ""}`}>
                            {pct(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </ModelTable>
              </div>

              {/* Section 2: Red Flags counts */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Posibles "Red Flags" (2)</h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-border bg-muted/50">
                      <th className="text-left p-2 min-w-[250px] text-muted-foreground font-medium">
                        # de años con...
                      </th>
                      <th className="text-right p-2 min-w-[80px] text-muted-foreground font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {([
                      ["Decrecimiento de ventas", redFlagCounts.salesDecline],
                      ["Decrecimiento de margen operativo", redFlagCounts.marginDecline],
                      ["FCF negativo", redFlagCounts.negativeFCF],
                      ["ROIC \"Pobre\" (<10%)", redFlagCounts.poorROIC],
                      ["Ratio Deuda Neta / EBITDA elevado (>2,5x)", redFlagCounts.highDebt],
                    ] as [string, number][]).map(([label, count]) => (
                      <tr key={label} className="border-b border-border/30">
                        <td className="p-2 text-foreground text-xs">{label}</td>
                        <td className={`text-right p-2 text-xs font-semibold ${count > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>

          {/* ═══════════════ 6. GRÁFICOS ═══════════════ */}
          <TabsContent value="charts">
            <Card className="p-4 space-y-8">
              <h2 className="text-sm font-semibold text-foreground">Evolución histórica</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sales + Growth */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Ventas y Crecimiento</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={[...hist, ...proj].map((h, i) => ({
                      year: h.year, sales: Math.round(h.sales),
                      growth: i > 0 ? ((h.sales - [...hist, ...proj][i - 1].sales) / Math.abs([...hist, ...proj][i - 1].sales)) * 100 : null,
                      isProj: i >= N,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
                      <Tooltip formatter={(v: number, name: string) => [name === "growth" ? `${v.toFixed(1)}%` : Math.round(v).toLocaleString(), name === "growth" ? "Crecimiento" : "Ventas"]} />
                      <Bar yAxisId="left" dataKey="sales" fill="hsl(var(--primary))" opacity={0.7} />
                      <Line yAxisId="right" dataKey="growth" stroke="hsl(var(--destructive))" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Margins */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Márgenes (%)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={[...hist, ...proj].map(h => ({
                      year: h.year,
                      ebitda: s(h.ebitda, h.sales) * 100,
                      ebit: s(h.ebit, h.sales) * 100,
                      net: s(h.netIncome, h.sales) * 100,
                      fcf: s(h.fcf, h.sales) * 100,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line dataKey="ebitda" name="EBITDA" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
                      <Line dataKey="ebit" name="EBIT" stroke="#16a34a" strokeWidth={2} dot={{ r: 2 }} />
                      <Line dataKey="net" name="Net Income" stroke="#9333ea" strokeWidth={2} dot={{ r: 2 }} />
                      <Line dataKey="fcf" name="FCF" stroke="#ea580c" strokeWidth={2} dot={{ r: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* EPS */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">EPS</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={[...hist, ...proj].map(h => ({ year: h.year, eps: h.eps }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                      <Bar dataKey="eps" name="EPS" fill="#2563eb" opacity={0.7} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* FCF per share */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">FCF por acción</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={[...hist, ...proj].map(h => ({ year: h.year, fcfps: h.fcfps }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                      <Bar dataKey="fcfps" name="FCF/Share" fill="#16a34a" opacity={0.7} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* ROIC & ROE */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">ROIC & ROE (%)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={[...hist, ...proj].map(h => ({ year: h.year, roic: h.roic * 100, roe: h.roe * 100 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line dataKey="roic" name="ROIC" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      <Line dataKey="roe" name="ROE" stroke="#ea580c" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Valuation Multiples */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Múltiplos de Valoración</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={hist.map(h => ({
                      year: h.year,
                      per: h.per > 0 && h.per < 100 ? h.per : null,
                      evFcf: h.evFcf > 0 && h.evFcf < 100 ? h.evFcf : null,
                      evEbitda: h.evEbitda > 0 && h.evEbitda < 100 ? h.evEbitda : null,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}x`} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}x`} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Line dataKey="per" name="PER" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                      <Line dataKey="evFcf" name="EV/FCF" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                      <Line dataKey="evEbitda" name="EV/EBITDA" stroke="#9333ea" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Capital Allocation */}
                <div className="lg:col-span-2">
                  <h3 className="text-xs font-medium text-muted-foreground mb-2">Asignación de Capital (% FCF)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={hist.map(h => ({
                      year: h.year,
                      capex: h.capexExpPct * 100,
                      acq: h.acqPct * 100,
                      div: h.divPct * 100,
                      buyback: h.buybackPct * 100,
                      debtRepay: h.debtRepayPct * 100,
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} />
                      <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="capex" name="CapEx Exp." fill="#2563eb" stackId="a" />
                      <Bar dataKey="acq" name="Adquisiciones" fill="#16a34a" stackId="a" />
                      <Bar dataKey="div" name="Dividendos" fill="#9333ea" stackId="a" />
                      <Bar dataKey="buyback" name="Recompra" fill="#ea580c" stackId="a" />
                      <Bar dataKey="debtRepay" name="Pago deuda" fill="#64748b" stackId="a" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
