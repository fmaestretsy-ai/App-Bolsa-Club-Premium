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

/* ─── Editable cell ─── */
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
    ? `${(value * 100).toFixed(1)}%`
    : format === "decimal"
    ? value.toFixed(2)
    : Math.round(value).toLocaleString();

  const handleStart = () => {
    setRaw(format === "percent" ? (value * 100).toFixed(1) : String(value));
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
        className="w-20 bg-transparent border-b border-primary text-right text-xs outline-none text-foreground"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={handleEnd}
        onKeyDown={e => e.key === "Enter" && handleEnd()}
      />
    );
  }

  return (
    <span
      className={`cursor-pointer hover:bg-primary/10 px-1 rounded text-primary font-semibold ${className}`}
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
  return decimals === 0 ? Math.round(v).toLocaleString() : v.toFixed(decimals);
};
const pct = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
};
const pctColor = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "";
  return v >= 0 ? "text-success" : "text-destructive";
};

/* ─── Table shell ─── */
function ModelTable({
  children, historicalYears, projectedYears,
}: {
  children: React.ReactNode;
  historicalYears: number[];
  projectedYears: number[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-2 min-w-[180px] sticky left-0 bg-card z-10 text-muted-foreground text-xs font-medium">
              (millones)
            </th>
            {historicalYears.map(y => (
              <th key={y} className="text-right p-2 min-w-[80px] text-muted-foreground font-medium">{y}</th>
            ))}
            {projectedYears.map(y => (
              <th key={y} className="text-right p-2 min-w-[80px] text-primary/70 font-medium">{y}e</th>
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
    <tr className={`border-b border-border/50 ${isSeparator ? "border-t-2 border-t-border" : ""} ${isBold ? "font-semibold" : ""}`}>
      <td className={`p-2 sticky left-0 bg-card z-10 ${isSubRow ? "pl-6 text-muted-foreground" : "text-foreground"} text-xs`}>
        {label}
      </td>
      {histValues.map((v, i) => (
        <td key={i} className={`text-right p-2 text-xs ${isPercent ? pctColor(v as number) : "text-foreground"}`}>
          {isPercent ? pct(v as number) : fmt(v as number)}
        </td>
      ))}
      {projValues.map((v, i) => (
        <td key={`p${i}`} className="text-right p-2 text-xs">
          {v}
        </td>
      ))}
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

  // Projection years
  const currentYear = new Date().getFullYear();
  const projectionYears = useMemo(() => {
    const lastHistYear = periods.length > 0
      ? Math.max(...periods.map(p => p.fiscal_year))
      : currentYear;
    return [lastHistYear + 1, lastHistYear + 2, lastHistYear + 3, lastHistYear + 4, lastHistYear + 5];
  }, [periods, currentYear]);

  // Historical data
  const historical = useMemo(() => periodsToHistorical(periods), [periods]);
  const historicalYears = useMemo(() => historical.map(h => h.fiscalYear).sort((a, b) => a - b), [historical]);

  // Model inputs from assumptions
  const [localInputs, setLocalInputs] = useState<ModelInputs | null>(null);

  const modelInputs = useMemo(() => {
    if (localInputs) return localInputs;
    const base = extractModelInputs(
      { ...assumptions, current_price: company?.current_price },
      projectionYears
    );
    return base;
  }, [assumptions, company, projectionYears, localInputs]);

  // Calculate model
  const result = useMemo<ModelResult>(() => {
    if (historical.length === 0) {
      return { projected: [], targetPrices: [], priceFor15Return: 0, differenceVsCurrent: 0, cagr5y: {} };
    }
    return calculateModel(historical, modelInputs, projectionYears);
  }, [historical, modelInputs, projectionYears]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (newInputs: ModelInputs) => {
      if (!companyId || !user) return;
      const customParams = {
        revenue_growth: newInputs.revenueGrowth,
        ebit_margin: newInputs.ebitMargin,
        share_growth_first: newInputs.shareGrowthFirst,
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

  // Reset local inputs when company changes
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
          Las celdas en <span className="text-primary font-semibold">azul</span> son editables — haz clic para modificar.
        </p>

        <Tabs defaultValue="is" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="is">1. Income Statement</TabsTrigger>
            <TabsTrigger value="fcf">2. Free Cash Flow</TabsTrigger>
            <TabsTrigger value="roic">3. ROIC</TabsTrigger>
            <TabsTrigger value="val">4. Valoración</TabsTrigger>
          </TabsList>

          {/* ═══ IS TAB ═══ */}
          <TabsContent value="is">
            <Card className="p-4">
              <ModelTable historicalYears={hYears} projectedYears={pYears}>
                {/* Sales */}
                <Row label="Sales" isBold
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.revenue)}
                  projValues={result.projected.map(p => fmt(p.revenue))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={hYears.map((y, i) => {
                    if (i === 0) return null;
                    const curr = historical.find(h => h.fiscalYear === y)?.revenue;
                    const prev = historical.find(h => h.fiscalYear === hYears[i - 1])?.revenue;
                    return curr && prev ? (curr - prev) / prev : null;
                  })}
                  projValues={pYears.map(y => (
                    <EditableCell
                      key={y}
                      value={modelInputs.revenueGrowth[y] ?? 0.10}
                      format="percent"
                      onChange={v => updateInput(prev => ({
                        ...prev,
                        revenueGrowth: { ...prev.revenueGrowth, [y]: v },
                      }))}
                    />
                  ))}
                />
                {/* EBITDA */}
                <Row label="EBITDA" isBold
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.ebitda)}
                  projValues={result.projected.map(p => fmt(p.ebitda))}
                />
                <Row label="    EBITDA margin %" isSubRow isPercent
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.ebitdaMargin)}
                  projValues={result.projected.map(p => pct(p.ebitdaMargin))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={hYears.map((y, i) => {
                    if (i === 0) return null;
                    const curr = historical.find(h => h.fiscalYear === y)?.ebitda;
                    const prev = historical.find(h => h.fiscalYear === hYears[i - 1])?.ebitda;
                    return curr && prev ? (curr - prev) / prev : null;
                  })}
                  projValues={result.projected.map(p => <span className={pctColor(p.ebitdaGrowth)}>{pct(p.ebitdaGrowth)}</span>)}
                />
                {/* D&A */}
                <Row label="D&A"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.da;
                  })}
                  projValues={result.projected.map(p => fmt(p.da))}
                />
                {/* EBIT */}
                <Row label="EBIT" isBold
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.ebit)}
                  projValues={result.projected.map(p => fmt(p.ebit))}
                />
                <Row label="    EBIT margin %" isSubRow isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.ebit && h?.revenue ? h.ebit / h.revenue : null;
                  })}
                  projValues={pYears.map(y => (
                    <EditableCell
                      key={y}
                      value={modelInputs.ebitMargin[y] ?? 0.30}
                      format="percent"
                      onChange={v => updateInput(prev => ({
                        ...prev,
                        ebitMargin: { ...prev.ebitMargin, [y]: v },
                      }))}
                    />
                  ))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={hYears.map((y, i) => {
                    if (i === 0) return null;
                    const curr = historical.find(h => h.fiscalYear === y)?.ebit;
                    const prev = historical.find(h => h.fiscalYear === hYears[i - 1])?.ebit;
                    return curr && prev ? (curr - prev) / prev : null;
                  })}
                  projValues={result.projected.map(p => <span className={pctColor(p.ebitGrowth)}>{pct(p.ebitGrowth)}</span>)}
                />
                {/* EBT */}
                <Row label="Total Interest"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(p => fmt(p.totalInterest))}
                />
                <Row label="EBT"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(p => fmt(p.ebt))}
                />
                {/* Tax */}
                <Row label="Tax Expense"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(p => fmt(p.taxExpense))}
                />
                <Row label="    Tax rate %" isSubRow isPercent
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.taxRate)}
                  projValues={result.projected.map(p => pct(p.taxRate))}
                />
                {/* Net Income */}
                <Row label="Net Income" isBold isSeparator
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.netIncome)}
                  projValues={result.projected.map(p => fmt(p.netIncome))}
                />
                <Row label="    Net margin %" isSubRow isPercent
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.netMargin)}
                  projValues={result.projected.map(p => pct(p.netMargin))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={hYears.map((y, i) => {
                    if (i === 0) return null;
                    const curr = historical.find(h => h.fiscalYear === y)?.netIncome;
                    const prev = historical.find(h => h.fiscalYear === hYears[i - 1])?.netIncome;
                    return curr && prev ? (curr - prev) / prev : null;
                  })}
                  projValues={result.projected.map(p => <span className={pctColor(p.netIncomeGrowth)}>{pct(p.netIncomeGrowth)}</span>)}
                />
                {/* EPS */}
                <Row label="EPS"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.eps)}
                  projValues={result.projected.map(p => <span>{p.eps.toFixed(2)}</span>)}
                />
                {/* Shares */}
                <Row label="Diluted Shares"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.dilutedShares)}
                  projValues={result.projected.map(p => fmt(p.dilutedShares))}
                />
                <Row label="    Y/Y Growth %" isSubRow
                  histValues={hYears.map(() => null)}
                  projValues={pYears.map((y, i) => (
                    i === 0 ? (
                      <EditableCell
                        key={y}
                        value={modelInputs.shareGrowthFirst}
                        format="percent"
                        onChange={v => updateInput(prev => ({ ...prev, shareGrowthFirst: v }))}
                      />
                    ) : (
                      <span className="text-muted-foreground">{pct(modelInputs.shareGrowthFirst)}</span>
                    )
                  ))}
                />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══ FCF TAB ═══ */}
          <TabsContent value="fcf">
            <Card className="p-4">
              <ModelTable historicalYears={hYears} projectedYears={pYears}>
                <Row label="EBITDA" isBold
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.ebitda)}
                  projValues={result.projected.map(p => fmt(p.ebitda))}
                />
                <Row label="(-) CapEx Mantenimiento"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.capex ? -Math.abs(h.capex) : null;
                  })}
                  projValues={result.projected.map(p => fmt(p.capexMaint))}
                />
                <Row label="(-) Total Interest"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(p => fmt(p.totalInterest))}
                />
                <Row label="(-) Taxes"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(p => fmt(p.taxExpense))}
                />
                <Row label="(-) Var. Working Capital"
                  histValues={hYears.map(() => null)}
                  projValues={result.projected.map(p => fmt(-p.wcChange))}
                />
                <Row label="Free Cash Flow" isBold isSeparator
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.fcf)}
                  projValues={result.projected.map(p => fmt(p.fcf))}
                />
                <Row label="    FCF Margin %" isSubRow isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.fcf && h?.revenue ? h.fcf / h.revenue : null;
                  })}
                  projValues={result.projected.map(p => pct(p.fcfMargin))}
                />
                <Row label="    Y/Y Growth %" isSubRow isPercent
                  histValues={hYears.map((y, i) => {
                    if (i === 0) return null;
                    const curr = historical.find(h => h.fiscalYear === y)?.fcf;
                    const prev = historical.find(h => h.fiscalYear === hYears[i - 1])?.fcf;
                    return curr && prev ? (curr - prev) / prev : null;
                  })}
                  projValues={result.projected.map(p => <span className={pctColor(p.fcfGrowth)}>{pct(p.fcfGrowth)}</span>)}
                />
                <Row label="FCFPS"
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.fcf && h?.dilutedShares ? h.fcf / h.dilutedShares : null;
                  })}
                  projValues={result.projected.map(p => <span>{p.fcfps.toFixed(2)}</span>)}
                />
                <Row label="Conversión en Caja" isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.fcf && h?.ebitda ? h.fcf / h.ebitda : null;
                  })}
                  projValues={result.projected.map(p => pct(p.cashConversion))}
                />

                {/* Editable ratios */}
                <tr className="border-t-2 border-border">
                  <td className="p-2 text-xs font-semibold text-foreground sticky left-0 bg-card z-10" colSpan={1}>
                    Eficiencia y márgenes
                  </td>
                  <td colSpan={hYears.length + pYears.length}></td>
                </tr>
                <Row label="CapEx Mant. / Ventas" isPercent
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.capex && h?.revenue ? Math.abs(h.capex) / h.revenue : null;
                  })}
                  projValues={result.projected.map(p => pct(p.capexSalesRatio))}
                />
                <Row label="Working Capital / Ventas"
                  histValues={hYears.map(() => null)}
                  projValues={[
                    <EditableCell
                      key="wc"
                      value={modelInputs.wcSales}
                      format="percent"
                      onChange={v => updateInput(prev => ({ ...prev, wcSales: v }))}
                    />,
                    ...pYears.slice(1).map(y => <span key={y} className="text-muted-foreground">{pct(modelInputs.wcSales)}</span>),
                  ]}
                />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══ ROIC TAB ═══ */}
          <TabsContent value="roic">
            <Card className="p-4">
              <ModelTable historicalYears={hYears} projectedYears={pYears}>
                <Row label="NOPAT (EBIT × (1-t))" isBold
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.ebit ? h.ebit * (1 - (h.taxRate || 0.2)) : null;
                  })}
                  projValues={result.projected.map(p => fmt(p.nopat))}
                />
                <Row label="ROE" isPercent
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.roe)}
                  projValues={result.projected.map(p => pct(p.roe))}
                />
                <Row label="ROIC" isPercent
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.roic)}
                  projValues={result.projected.map(p => pct(p.roic))}
                />
              </ModelTable>
            </Card>
          </TabsContent>

          {/* ═══ VALORACIÓN TAB ═══ */}
          <TabsContent value="val">
            <Card className="p-4 space-y-6">
              {/* Section 1: Projected financials */}
              <ModelTable historicalYears={hYears} projectedYears={pYears}>
                <Row label="Market Cap" isBold
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.marketCap;
                  })}
                  projValues={result.projected.map(p => fmt(p.marketCap))}
                />
                <Row label="Deuda Neta"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.netDebt)}
                  projValues={result.projected.map(p => fmt(p.netDebt))}
                />
                <Row label="    Deuda neta / EBITDA" isSubRow
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.netDebt && h?.ebitda ? h.netDebt / h.ebitda : null;
                  })}
                  projValues={pYears.map(y => (
                    <EditableCell
                      key={y}
                      value={modelInputs.netDebtEbitda[y] ?? 0.3}
                      format="decimal"
                      onChange={v => updateInput(prev => ({
                        ...prev,
                        netDebtEbitda: { ...prev.netDebtEbitda, [y]: v },
                      }))}
                    />
                  ))}
                />
                <Row label="Enterprise Value (EV)" isBold
                  histValues={hYears.map(y => {
                    const h = historical.find(h => h.fiscalYear === y);
                    return h?.ev;
                  })}
                  projValues={result.projected.map(p => fmt(p.ev))}
                />
                <Row label="EBITDA"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.ebitda)}
                  projValues={result.projected.map(p => fmt(p.ebitda))}
                />
                <Row label="EBIT"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.ebit)}
                  projValues={result.projected.map(p => fmt(p.ebit))}
                />
                <Row label="Net Income"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.netIncome)}
                  projValues={result.projected.map(p => fmt(p.netIncome))}
                />
                <Row label="FCF"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.fcf)}
                  projValues={result.projected.map(p => fmt(p.fcf))}
                />

                {/* Multiples */}
                <tr className="border-t-2 border-border">
                  <td className="p-2 text-xs font-semibold text-foreground sticky left-0 bg-card z-10">
                    Múltiplos de valoración
                  </td>
                  {hYears.map(y => <td key={y}></td>)}
                  {pYears.map(y => <td key={y}></td>)}
                </tr>
                <Row label="PER"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.peRatio)}
                  projValues={result.projected.map(p => <span>{p.per.toFixed(1)}</span>)}
                />
                <Row label="EV / FCF"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.evFcf)}
                  projValues={result.projected.map(p => <span>{p.evFcf.toFixed(1)}</span>)}
                />
                <Row label="EV / EBITDA"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.evEbitda)}
                  projValues={result.projected.map(p => <span>{p.evEbitda.toFixed(1)}</span>)}
                />
                <Row label="EV / EBIT"
                  histValues={hYears.map(y => historical.find(h => h.fiscalYear === y)?.evEbit)}
                  projValues={result.projected.map(p => <span>{p.evEbit.toFixed(1)}</span>)}
                />
              </ModelTable>

              {/* Section 2: Target multiples */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Precio por acción actual</h3>
                  <div className="flex items-center gap-2">
                    <EditableCell
                      value={modelInputs.currentPrice}
                      format="number"
                      onChange={v => updateInput(prev => ({ ...prev, currentPrice: v }))}
                    />
                    <span className="text-xs text-muted-foreground">$</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Múltiplos objetivo</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">PER</span>
                      <EditableCell value={modelInputs.targetPer} onChange={v => updateInput(prev => ({ ...prev, targetPer: v }))} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">EV / FCF</span>
                      <EditableCell value={modelInputs.targetEvFcf} onChange={v => updateInput(prev => ({ ...prev, targetEvFcf: v }))} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">EV / EBITDA</span>
                      <EditableCell value={modelInputs.targetEvEbitda} onChange={v => updateInput(prev => ({ ...prev, targetEvEbitda: v }))} />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">EV / EBIT</span>
                      <EditableCell value={modelInputs.targetEvEbit} onChange={v => updateInput(prev => ({ ...prev, targetEvEbit: v }))} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Target prices */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Precio objetivo</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
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
                        <tr key={field} className="border-b border-border/50">
                          <td className="p-2 text-foreground font-medium">{label}</td>
                          {result.targetPrices.map(tp => (
                            <td key={tp.year} className="text-right p-2 text-foreground">
                              {Math.round(tp[field])}
                            </td>
                          ))}
                          <td className={`text-right p-2 font-semibold ${pctColor(result.cagr5y[cagrKey])}`}>
                            {result.cagr5y[cagrKey] != null ? `${Math.round(result.cagr5y[cagrKey] * 100)}%` : "—"}
                          </td>
                        </tr>
                      ))}
                      {/* Margin of safety */}
                      <tr className="border-t-2 border-border">
                        <td className="p-2 text-foreground font-semibold">Margen de seguridad</td>
                        {result.targetPrices.map(tp => (
                          <td key={tp.year} className={`text-right p-2 font-semibold ${pctColor(tp.marginOfSafety)}`}>
                            {Math.round(tp.marginOfSafety * 100)}%
                          </td>
                        ))}
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: Target return */}
              <div className="flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Retorno anual objetivo:</span>
                  <EditableCell
                    value={modelInputs.targetReturnRate}
                    format="percent"
                    onChange={v => updateInput(prev => ({ ...prev, targetReturnRate: v }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Precio compra para ese retorno:</span>
                  <span className="font-semibold text-foreground">${Math.round(result.priceFor15Return)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Diferencia vs actual:</span>
                  <span className={`font-semibold ${pctColor(result.differenceVsCurrent)}`}>
                    {Math.round(result.differenceVsCurrent * 100)}%
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
