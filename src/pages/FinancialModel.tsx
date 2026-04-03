import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCompanies, useFinancialPeriods, useCompanyAssumptions } from "@/hooks/useCompanyData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  calculateModel, extractModelInputs, periodsToHistorical,
  type ModelInputs, type ModelResult,
} from "@/lib/financialModelEngine";
import { EmptyState } from "@/components/EmptyState";
import { Calculator } from "lucide-react";

/* ─── Editable cell (orange) ─── */
function EditableCell({
  value, onChange, format = "number", className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  format?: "number" | "percent" | "decimal";
  className?: string;
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
      className={`cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 px-1 rounded text-orange-600 dark:text-orange-400 font-semibold ${className}`}
      onClick={handleStart}
      title="Click para editar"
    >
      {display}
    </span>
  );
}

/* ─── Format helpers ─── */
const fmt = (v: number | null | undefined, decimals = 0) => {
  if (v == null || isNaN(v)) return "—";
  if (v < 0) {
    const abs = decimals === 0 ? Math.round(Math.abs(v)).toLocaleString() : Math.abs(v).toFixed(decimals);
    return `(${abs})`;
  }
  if (decimals === 0) return Math.round(v).toLocaleString();
  return v.toFixed(decimals);
};
// Projected value with red color for negatives
const fmtP = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "—";
  if (v < 0) return <span className="text-red-500 dark:text-red-400">({Math.round(Math.abs(v)).toLocaleString()})</span>;
  return Math.round(v).toLocaleString();
};
const pct = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "—";
  return `${Math.round(v * 100)}%`;
};
const pctColor = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "";
  return v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400";
};
const fmtX = (v: number | null | undefined) => {
  if (v == null || isNaN(v) || !isFinite(v)) return "—";
  return v.toFixed(1) + "x";
};

/* ─── Table shell ─── */
function ModelTable({
  children, historicalYears, projectedYears, subtitle,
}: {
  children: React.ReactNode;
  historicalYears: number[];
  projectedYears: number[];
  subtitle?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b-2 border-border bg-muted/50">
            <th className="text-left p-2 min-w-[220px] sticky left-0 bg-muted/50 z-10 text-muted-foreground text-xs font-medium">
              {subtitle || "(millones)"}
            </th>
            {historicalYears.map(y => (
              <th key={y} className="text-right p-2 min-w-[85px] text-muted-foreground font-medium">{y}</th>
            ))}
            {projectedYears.map(y => (
              <th key={y} className="text-right p-2 min-w-[85px] font-medium bg-blue-50/50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400">{y}e</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Row({
  label, histValues, projValues, isSubRow = false, isBold = false, isPercent = false, isSeparator = false,
}: {
  label: string;
  histValues: (number | null | undefined)[];
  projValues: (React.ReactNode)[];
  isSubRow?: boolean;
  isBold?: boolean;
  isPercent?: boolean;
  isSeparator?: boolean;
}) {
  return (
    <tr className={`border-b border-border/30 ${isSeparator ? "border-t-2 border-t-border" : ""} ${isBold ? "font-semibold bg-muted/20" : ""}`}>
      <td className={`p-1.5 sticky left-0 bg-card z-10 ${isSubRow ? "pl-6 text-muted-foreground italic" : "text-foreground"} text-xs`}>
        {label}
      </td>
      {histValues.map((v, i) => {
        const val = v as number;
        const isNeg = val != null && !isNaN(val) && val < 0;
        return (
          <td key={i} className={`text-right p-1.5 text-xs ${isPercent ? pctColor(val) : isNeg ? "text-red-500 dark:text-red-400" : "text-foreground"}`}>
            {isPercent ? pct(val) : fmt(val)}
          </td>
        );
      })}
      {projValues.map((v, i) => (
        <td key={`p${i}`} className="text-right p-1.5 text-xs bg-blue-50/20 dark:bg-blue-950/10">
          {v}
        </td>
      ))}
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
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");

  const companyId = selectedCompanyId || companies[0]?.id || "";
  const { data: periods = [] } = useFinancialPeriods(companyId || undefined);
  const { data: assumptions } = useCompanyAssumptions(companyId || undefined);
  const company = companies.find(c => c.id === companyId);

  const currentYear = new Date().getFullYear();
  const projectionYears = useMemo(() => {
    const lastHistYear = periods.length > 0
      ? Math.max(...periods.map(p => p.fiscal_year))
      : currentYear;
    return [lastHistYear + 1, lastHistYear + 2, lastHistYear + 3, lastHistYear + 4, lastHistYear + 5];
  }, [periods, currentYear]);

  const historical = useMemo(() => periodsToHistorical(periods), [periods]);
  const historicalYears = useMemo(() => historical.map(h => h.fiscalYear).sort((a, b) => a - b), [historical]);

  const [localInputs, setLocalInputs] = useState<ModelInputs | null>(null);

  const modelInputs = useMemo(() => {
    if (localInputs) return localInputs;
    return extractModelInputs(
      { ...assumptions, current_price: company?.current_price },
      projectionYears
    );
  }, [assumptions, company, projectionYears, localInputs]);

  const result = useMemo<ModelResult>(() => {
    if (historical.length === 0) {
      return { projected: [], targetPrices: [], priceFor15Return: 0, differenceVsCurrent: 0, cagr5y: {} };
    }
    return calculateModel(historical, modelInputs, projectionYears);
  }, [historical, modelInputs, projectionYears]);

  const saveMutation = useMutation({
    mutationFn: async (newInputs: ModelInputs) => {
      if (!companyId || !user) return;
      const customParams = {
        revenue_growth: newInputs.revenueGrowth,
        ebit_margin: newInputs.ebitMargin,
        tax_rate: newInputs.taxRate,
        share_growth: newInputs.shareGrowth,
        minority_interests_pct: newInputs.minorityInterestsPct,
        capex_sales_ratio: newInputs.capexSalesRatio,
        wc_sales: newInputs.wcSales,
        net_debt_ebitda: newInputs.netDebtEbitda,
      };

      const { data: existing } = await supabase
        .from("company_assumptions")
        .select("id")
        .eq("company_id", companyId)
        .eq("user_id", user.id)
        .maybeSingle();

      const payload = {
        custom_params: customParams,
        target_pe: newInputs.targetPer,
        fcf_multiple: newInputs.targetEvFcf,
        ev_ebitda_multiple: newInputs.targetEvEbitda,
        ev_ebit_multiple: newInputs.targetEvEbit,
        target_return_rate: newInputs.targetReturnRate * 100,
      };

      if (existing) {
        await supabase.from("company_assumptions").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("company_assumptions").insert({
          ...payload,
          company_id: companyId,
          user_id: user.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assumptions", companyId] });
      toast.success("Modelo guardado");
    },
  });

  const updateInput = useCallback((updater: (prev: ModelInputs) => ModelInputs) => {
    const newInputs = updater(modelInputs);
    setLocalInputs(newInputs);
    saveMutation.mutate(newInputs);
  }, [modelInputs, saveMutation]);

  /** Update a per-year Record field: sets the edited year + all subsequent years to the new value */
  const updatePerYear = useCallback((
    field: 'revenueGrowth' | 'ebitMargin' | 'taxRate' | 'shareGrowth' | 'netDebtEbitda' | 'minorityInterestsPct' | 'capexSalesRatio' | 'wcSales',
    editedYear: number,
    value: number,
  ) => {
    updateInput(prev => {
      const updated = { ...prev[field] };
      pYearsRef.forEach(y => {
        if (y >= editedYear) updated[y] = value;
      });
      return { ...prev, [field]: updated };
    });
  }, [updateInput]);

  // Stable ref for pYears to avoid stale closures
  const pYearsRef = projectionYears;

  const handleCompanyChange = (id: string) => {
    setSelectedCompanyId(id);
    setLocalInputs(null);
  };

  if (companies.length === 0) {
    return (
      <DashboardLayout>
        <EmptyState
          icon={<Calculator className="h-7 w-7" />}
          title="Sin datos"
          description="Sube un Excel para ver el modelo financiero"
        />
      </DashboardLayout>
    );
  }

  const hYears = historicalYears;
  const pYears = projectionYears;
  const totalCols = 1 + hYears.length + pYears.length;

  // Helper to get historical growth
  const histGrowth = (field: keyof ReturnType<typeof periodsToHistorical>[0]) => {
    return hYears.map((y, i) => {
      if (i === 0) return null;
      const curr = historical.find(h => h.fiscalYear === y)?.[field] as number | null;
      const prev = historical.find(h => h.fiscalYear === hYears[i - 1])?.[field] as number | null;
      return curr != null && prev != null && prev !== 0 ? (curr - prev) / Math.abs(prev) : null;
    });
  };

  const getHist = (field: keyof ReturnType<typeof periodsToHistorical>[0]) => {
    return hYears.map(y => historical.find(h => h.fiscalYear === y)?.[field] as number | null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Modelo Financiero</h1>
          <Select value={companyId} onValueChange={handleCompanyChange}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selecciona empresa" />
            </SelectTrigger>
            <SelectContent>
              {companies.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.ticker} — {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <p className="text-xs text-muted-foreground">
          Las celdas en <span className="text-orange-500 font-semibold">naranja</span> son editables (ajustes manuales) — haz clic para modificar.
        </p>

        <Tabs defaultValue="is" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="is">1. IS</TabsTrigger>
            <TabsTrigger value="fcf">2. FCF</TabsTrigger>
            <TabsTrigger value="roic">3. ROIC</TabsTrigger>
            <TabsTrigger value="val">4. Valoración</TabsTrigger>
          </TabsList>

          {/* ═══════════════ 1. INCOME STATEMENT ═══════════════ */}
          <TabsContent value="is">
            <Card className="p-4">
              <ModelTable historicalYears={hYears} projectedYears={pYears} subtitle="(millones, excepto EPS)">
                {/* Sales */}
                <Row label="Sales" isBold
                  histValues={getHist("revenue")}
                  projValues={result.projected.map(p => fmt(p.revenue))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={histGrowth("revenue")}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.revenueGrowth[y] ?? 0.10} format="percent"
                      onChange={v => updatePerYear('revenueGrowth', y, v)}
                    />
                  ))}
                />
                {/* EBITDA */}
                <Row label="EBITDA" isBold
                  histValues={getHist("ebitda")}
                  projValues={result.projected.map(p => fmt(p.ebitda))}
                />
                <Row label="    EBITDA margin %" isSubRow isPercent
                  histValues={getHist("ebitdaMargin")}
                  projValues={result.projected.map(p => pct(p.ebitdaMargin))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={histGrowth("ebitda")}
                  projValues={result.projected.map(p => <span className={pctColor(p.ebitdaGrowth)}>{pct(p.ebitdaGrowth)}</span>)}
                />
                {/* D&A - negative */}
                <Row label="Depreciation & Amortization"
                  histValues={getHist("da")}
                  projValues={result.projected.map(p => fmtP(p.da))}
                />
                {/* EBIT */}
                <Row label="EBIT" isBold
                  histValues={getHist("ebit")}
                  projValues={result.projected.map(p => fmt(p.ebit))}
                />
                <Row label="    EBIT margin %" isSubRow isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.ebit && h?.revenue ? h.ebit / h.revenue : null;
                  })}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.ebitMargin[y] ?? 0.30} format="percent"
                      onChange={v => updatePerYear('ebitMargin', y, v)}
                    />
                  ))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={histGrowth("ebit")}
                  projValues={result.projected.map(p => <span className={pctColor(p.ebitGrowth)}>{pct(p.ebitGrowth)}</span>)}
                />
                {/* Interest Expense */}
                <Row label="Interest Expense"
                  histValues={getHist("interestExpense")}
                  projValues={result.projected.map(p => fmtP(p.interestExpense))}
                />
                {/* Interest Income */}
                <Row label="Interest Income"
                  histValues={getHist("interestIncome")}
                  projValues={result.projected.map(p => fmt(p.interestIncome))}
                />
                {/* Total Interest */}
                <Row label="Total Interest expense"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    if (!h) return null;
                    return (h.interestExpense ?? 0) + (h.interestIncome ?? 0);
                  })}
                  projValues={result.projected.map(p => fmtP(p.totalInterest))}
                />
                {/* EBT */}
                <Row label="EBT" isBold
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    if (!h?.ebit) return null;
                    const totalInt = (h.interestExpense ?? 0) + (h.interestIncome ?? 0);
                    return h.ebit + totalInt;
                  })}
                  projValues={result.projected.map(p => fmt(p.ebt))}
                />
                {/* Tax Expense */}
                <Row label="Tax Expense - en negativo"
                  histValues={getHist("taxExpense")}
                  projValues={result.projected.map(p => fmtP(p.taxExpense))}
                />
                {/* Tax Rate - ORANGE */}
                <Row label="    Tax rate %" isSubRow isPercent
                  histValues={getHist("taxRate")}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.taxRate[y] ?? 0.14} format="percent"
                      onChange={v => updatePerYear('taxRate', y, v)}
                    />
                  ))}
                />
                {/* Consolidated Net Income */}
                <Row label="Consolidated Net Income"
                  histValues={getHist("netIncome")}
                  projValues={result.projected.map(p => fmt(p.consolidatedNetIncome))}
                />
                {/* Minority Interests - ORANGE */}
                <Row label="Minority Interests"
                  histValues={getHist("minorityInterests")}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.minorityInterestsPct[y] ?? 0} format="percent"
                      onChange={v => updatePerYear('minorityInterestsPct', y, v)}
                    />
                  ))}
                />
                {/* Net Income */}
                <Row label="Net Income" isBold isSeparator
                  histValues={getHist("netIncome")}
                  projValues={result.projected.map(p => fmt(p.netIncome))}
                />
                <Row label="    Net margin %" isSubRow isPercent
                  histValues={getHist("netMargin")}
                  projValues={result.projected.map(p => pct(p.netMargin))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={histGrowth("netIncome")}
                  projValues={result.projected.map(p => <span className={pctColor(p.netIncomeGrowth)}>{pct(p.netIncomeGrowth)}</span>)}
                />
                {/* EPS */}
                <Row label="EPS"
                  histValues={getHist("eps")}
                  projValues={result.projected.map(p => <span>{p.eps.toFixed(2)}</span>)}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={histGrowth("eps")}
                  projValues={result.projected.map(p => <span className={pctColor(p.epsGrowth)}>{pct(p.epsGrowth)}</span>)}
                />
                {/* Diluted Shares */}
                <Row label="Fully diluted shares - millones"
                  histValues={getHist("dilutedShares")}
                  projValues={result.projected.map(p => fmt(p.dilutedShares))}
                />
                {/* Shares Growth - ORANGE */}
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={histGrowth("dilutedShares")}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.shareGrowth[y] ?? -0.02} format="percent"
                      onChange={v => updatePerYear('shareGrowth', y, v)}
                    />
                  ))}
                />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══════════════ 2. FREE CASH FLOW ═══════════════ */}
          <TabsContent value="fcf">
            <Card className="p-4">
              <ModelTable historicalYears={hYears} projectedYears={pYears} subtitle="(millones, excepto FCF per share)">
                {/* EBITDA */}
                <Row label="EBITDA" isBold
                  histValues={getHist("ebitda")}
                  projValues={result.projected.map(p => fmt(p.ebitda))}
                />
                {/* (-) CapEx Mantenimiento */}
                <Row label="(-) CapEx Mantenimiento - en negativo"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.capex ? -Math.abs(h.capex) : null;
                  })}
                  projValues={result.projected.map(p => fmtP(p.capexMaint))}
                />
                {/* CapEx / Sales - ORANGE */}
                <Row label="    CapEx / Sales %" isSubRow isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.capex && h?.revenue ? Math.abs(h.capex) / h.revenue : null;
                  })}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.capexSalesRatio[y] ?? 0.05} format="percent"
                      onChange={v => updatePerYear('capexSalesRatio', y, v)}
                    />
                  ))}
                />
                {/* (-) Total interest expense */}
                <Row label="(-) Total interest expense"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    const ie = h?.interestExpense ?? 0;
                    const ii = h?.interestIncome ?? 0;
                    return (ie !== 0 || ii !== 0) ? ie + ii : null;
                  })}
                  projValues={result.projected.map(p => fmtP(p.totalInterest))}
                />
                {/* (-) Taxes paid */}
                <Row label="(-) Taxes paid"
                  histValues={getHist("taxExpense")}
                  projValues={result.projected.map(p => fmtP(p.taxExpense))}
                />

                {/* Working Capital components */}
                <SectionHeader label="Working Capital" colSpan={totalCols} />
                <Row label="Inventories"
                  histValues={getHist("inventories")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="Accounts Receivable"
                  histValues={getHist("accountsReceivable")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(-) Accounts Payable"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.accountsPayable != null ? -Math.abs(h.accountsPayable) : null;
                  })}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(-) Unearned Revenue"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.unearnedRevenue != null ? -Math.abs(h.unearnedRevenue) : null;
                  })}
                  projValues={result.projected.map(() => "—")}
                />
                {/* Working Capital total */}
                <Row label="Working Capital - WC" isBold
                  histValues={getHist("workingCapital")}
                  projValues={result.projected.map(p => fmt(p.wc))}
                />
                {/* WC / Sales - ORANGE */}
                <Row label="    WC / Sales %" isSubRow isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.workingCapital && h?.revenue ? h.workingCapital / h.revenue : null;
                  })}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.wcSales[y] ?? 0} format="percent"
                      onChange={v => updatePerYear('wcSales', y, v)}
                    />
                  ))}
                />
                {/* (-) Variación WC */}
                <Row label="(-) Variación de Working Capital - CWC"
                  histValues={hYears.map((y, i) => {
                    if (i === 0) return null;
                    const curr = historical.find(h => h.fiscalYear === y)?.workingCapital;
                    const prev = historical.find(h => h.fiscalYear === hYears[i - 1])?.workingCapital;
                    return curr != null && prev != null ? curr - prev : null;
                  })}
                  projValues={result.projected.map(p => fmtP(p.wcChange))}
                />
                {/* (-) Otros ajustes */}
                <Row label="(-) Otros ajustes"
                  histValues={hYears.map(() => 0)}
                  projValues={result.projected.map(() => fmt(0))}
                />
                {/* FCF */}
                <Row label="Free Cash Flow" isBold isSeparator
                  histValues={getHist("fcf")}
                  projValues={result.projected.map(p => fmt(p.fcf))}
                />
                <Row label="FCF Margin %" isSubRow isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.fcf && h?.revenue ? h.fcf / h.revenue : null;
                  })}
                  projValues={result.projected.map(p => pct(p.fcfMargin))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={histGrowth("fcf")}
                  projValues={result.projected.map(p => <span className={pctColor(p.fcfGrowth)}>{pct(p.fcfGrowth)}</span>)}
                />

                {/* Net Change in Cash */}
                <SectionHeader label="Net Change in Cash" colSpan={totalCols} />
                <Row label="Free Cash Flow"
                  histValues={getHist("fcf")}
                  projValues={result.projected.map(p => fmt(p.fcf))}
                />
                <Row label="(-) CapEx Expansión"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(-) Acquisitions"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(-) Dividends"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(-) Share Buybacks"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(-) Debt Repayment"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="Net Change in Cash" isBold isSeparator
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(() => "—")}
                />

                {/* FCFPS */}
                <SectionHeader label="Free Cash Flow per share" colSpan={totalCols} />
                <Row label="Free Cash Flow per share - FCFPS"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.fcf && h?.dilutedShares ? h.fcf / h.dilutedShares : null;
                  })}
                  projValues={result.projected.map(p => <span>{p.fcfps.toFixed(2)}</span>)}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={hYears.map((y, i) => {
                    if (i === 0) return null;
                    const curr = historical.find(h => h.fiscalYear === y);
                    const prev = historical.find(h => h.fiscalYear === hYears[i - 1]);
                    const c = curr?.fcf && curr?.dilutedShares ? curr.fcf / curr.dilutedShares : null;
                    const p = prev?.fcf && prev?.dilutedShares ? prev.fcf / prev.dilutedShares : null;
                    return c != null && p != null && p !== 0 ? (c - p) / Math.abs(p) : null;
                  })}
                  projValues={result.projected.map(p => <span className={pctColor(p.fcfpsGrowth)}>{pct(p.fcfpsGrowth)}</span>)}
                />

                {/* Efficiency section */}
                <SectionHeader label="Eficiencia y márgenes" colSpan={totalCols} />
                {/* FCF/Sales */}
                <Row label="FCF / Ventas (FCF Margin)" isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.fcf && h?.revenue ? h.fcf / h.revenue : null;
                  })}
                  projValues={result.projected.map(p => pct(p.fcfMargin))}
                />
                {/* Cash Conversion */}
                <Row label="Conversión en Caja (EBITDA → FCF)" isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.fcf && h?.ebitda ? h.fcf / h.ebitda : null;
                  })}
                  projValues={result.projected.map(p => pct(p.cashConversion))}
                />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══════════════ 3. ROIC ═══════════════ */}
          <TabsContent value="roic">
            <Card className="p-4">
              <ModelTable historicalYears={hYears} projectedYears={pYears}>
                <Row label="EBIT × (1-t) = NOPAT" isBold
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.ebit ? h.ebit * (1 - (h.taxRate || 0.2)) : null;
                  })}
                  projValues={result.projected.map(p => fmt(p.nopat))}
                />
                <Row label="Cash and cash equivalents"
                  histValues={getHist("cash")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(-) Marketable Securities"
                  histValues={getHist("marketableSecurities")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(+) Short-Term Debt"
                  histValues={getHist("shortTermDebt")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(+) Long-Term Debt"
                  histValues={getHist("longTermDebt")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(+) Current Operating Leases"
                  histValues={getHist("operatingLeasesCurrent")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(+) Non-Current Operating Leases"
                  histValues={getHist("operatingLeasesNonCurrent")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="(+) Equity"
                  histValues={getHist("equity")}
                  projValues={result.projected.map(() => "—")}
                />
                <Row label="Invested Capital" isBold isSeparator
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    if (!h) return null;
                    const cash = h.cash ?? 0;
                    const mktSec = h.marketableSecurities ?? 0;
                    const std = h.shortTermDebt ?? 0;
                    const ltd = h.longTermDebt ?? 0;
                    const olc = h.operatingLeasesCurrent ?? 0;
                    const olnc = h.operatingLeasesNonCurrent ?? 0;
                    const eq = h.equity ?? 0;
                    return -cash - mktSec + std + ltd + olc + olnc + eq;
                  })}
                  projValues={result.projected.map(() => "—")}
                />

                <SectionHeader label="Ratios de rentabilidad" colSpan={totalCols} />
                <Row label="ROE" isPercent
                  histValues={getHist("roe")}
                  projValues={result.projected.map(p => pct(p.roe))}
                />
                <Row label="ROIC" isPercent
                  histValues={getHist("roic")}
                  projValues={result.projected.map(p => pct(p.roic))}
                />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══════════════ 4. VALORACIÓN ═══════════════ */}
          <TabsContent value="val">
            <Card className="p-4 space-y-6">
              {/* Valoración table */}
              <ModelTable historicalYears={hYears} projectedYears={pYears} subtitle="Valoración (millones)">
                <Row label="Market cap" isBold
                  histValues={getHist("marketCap")}
                  projValues={result.projected.map(p => fmt(p.marketCap))}
                />
                <Row label="Deuda Neta"
                  histValues={getHist("netDebt")}
                  projValues={result.projected.map(p => fmt(p.netDebt))}
                />
                {/* Deuda neta / EBITDA - ORANGE */}
                <Row label="    Deuda neta / EBITDA" isSubRow
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.netDebt && h?.ebitda ? h.netDebt / h.ebitda : null;
                  })}
                  projValues={pYears.map(y => (
                    <EditableCell key={y} value={modelInputs.netDebtEbitda[y] ?? 0.3} format="decimal"
                      onChange={v => updateInput(prev => {
                        const updated: Record<number, number> = {};
                        pYears.forEach(yr => { updated[yr] = v; });
                        return { ...prev, netDebtEbitda: updated };
                      })}
                    />
                  ))}
                />
                <Row label="Enterprise Value (EV)" isBold
                  histValues={getHist("ev")}
                  projValues={result.projected.map(p => fmt(p.ev))}
                />
                <Row label="EBITDA"
                  histValues={getHist("ebitda")}
                  projValues={result.projected.map(p => fmt(p.ebitda))}
                />
                <Row label="EBIT"
                  histValues={getHist("ebit")}
                  projValues={result.projected.map(p => fmt(p.ebit))}
                />
                <Row label="Net income"
                  histValues={getHist("netIncome")}
                  projValues={result.projected.map(p => fmt(p.netIncome))}
                />
                <Row label="FCF"
                  histValues={getHist("fcf")}
                  projValues={result.projected.map(p => fmt(p.fcf))}
                />

                {/* Multiples section */}
                <SectionHeader label="Múltiplos de valoración" colSpan={totalCols} />
                <Row label="PER"
                  histValues={getHist("peRatio")}
                  projValues={result.projected.map(p => fmtX(p.per))}
                />
                <Row label="EV / FCF"
                  histValues={getHist("evFcf")}
                  projValues={result.projected.map(p => fmtX(p.evFcf))}
                />
                <Row label="EV / EBITDA"
                  histValues={getHist("evEbitda")}
                  projValues={result.projected.map(p => fmtX(p.evEbitda))}
                />
                <Row label="EV / EBIT"
                  histValues={getHist("evEbit")}
                  projValues={result.projected.map(p => fmtX(p.evEbit))}
                />
              </ModelTable>

              {/* Current price & Target multiples - ORANGE */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-border pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Precio por acción actual</h3>
                  <div className="flex items-center gap-2">
                    <EditableCell value={modelInputs.currentPrice} format="number"
                      onChange={v => updateInput(prev => ({ ...prev, currentPrice: v }))}
                    />
                    <span className="text-xs text-muted-foreground">$</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Múltiplos objetivo</h3>
                  <div className="space-y-2 text-xs">
                    {[
                      { label: "PER", key: "targetPer" as const },
                      { label: "EV / FCF", key: "targetEvFcf" as const },
                      { label: "EV / EBITDA", key: "targetEvEbitda" as const },
                      { label: "EV / EBIT", key: "targetEvEbit" as const },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-muted-foreground">{label}</span>
                        <EditableCell value={modelInputs[key]} onChange={v => updateInput(prev => ({ ...prev, [key]: v }))} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Target prices table */}
              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Precio objetivo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-border bg-muted/50">
                        <th className="text-left p-2 min-w-[140px] text-muted-foreground">Método</th>
                        {pYears.map(y => (
                          <th key={y} className="text-right p-2 min-w-[80px] text-muted-foreground">{y}e</th>
                        ))}
                        <th className="text-right p-2 min-w-[80px] text-muted-foreground">CAGR 5y</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "PER ex Cash", field: "perExCash" as const, cagrKey: "PER ex Cash" },
                        { label: "EV / FCF", field: "evFcf" as const, cagrKey: "EV / FCF" },
                        { label: "EV / EBITDA", field: "evEbitda" as const, cagrKey: "EV / EBITDA" },
                        { label: "EV / EBIT", field: "evEbit" as const, cagrKey: "EV / EBIT" },
                        { label: "Promedio", field: "average" as const, cagrKey: "Promedio" },
                      ].map(({ label, field, cagrKey }) => (
                        <tr key={field} className={`border-b border-border/30 ${field === "average" ? "font-semibold bg-muted/20" : ""}`}>
                          <td className="p-2 text-foreground">{label}</td>
                          {result.targetPrices.map(tp => (
                            <td key={tp.year} className="text-right p-2 text-foreground">
                              {fmt(tp[field])}
                            </td>
                          ))}
                          <td className={`text-right p-2 font-semibold ${pctColor(result.cagr5y[cagrKey])}`}>
                            {result.cagr5y[cagrKey] != null ? pct(result.cagr5y[cagrKey]) : "—"}
                          </td>
                        </tr>
                      ))}
                      {/* Margin of safety */}
                      <tr className="border-t-2 border-border font-semibold">
                        <td className="p-2 text-foreground">Margen de seguridad (EV/FCF)</td>
                        {result.targetPrices.map(tp => (
                          <td key={tp.year} className={`text-right p-2 ${pctColor(tp.marginOfSafety)}`}>
                            {pct(tp.marginOfSafety)}
                          </td>
                        ))}
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Target return - ORANGE */}
              <div className="border-t border-border pt-4 flex flex-wrap items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Retorno anual objetivo:</span>
                  <EditableCell value={modelInputs.targetReturnRate} format="percent"
                    onChange={v => updateInput(prev => ({ ...prev, targetReturnRate: v }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Precio compra para ese retorno:</span>
                  <span className="font-semibold text-foreground">${fmt(result.priceFor15Return)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Diferencia vs precio actual:</span>
                  <span className={`font-semibold ${pctColor(result.differenceVsCurrent)}`}>
                    {pct(result.differenceVsCurrent)}
                  </span>
                </div>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
