import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { useCompanies, useFinancialPeriods, useCompanyAssumptions, useProjectionYears } from "@/hooks/useCompanyData";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export default function Valuation() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies = [], isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string>("");

  const companyId = selectedId || companies[0]?.id;
  const company = companies.find((c) => c.id === companyId);
  const { data: periods = [] } = useFinancialPeriods(companyId);
  const { data: assumptions } = useCompanyAssumptions(companyId);
  const { data: projections = [] } = useProjectionYears(companyId);

  // Editable state for target multiples
  const [localTargets, setLocalTargets] = useState<Record<string, number>>({});

  const targetPer = localTargets.targetPer ?? (Number(assumptions?.target_pe) || 25);
  const targetEvFcf = localTargets.targetEvFcf ?? (Number(assumptions?.fcf_multiple) || 25);
  const targetEvEbitda = localTargets.targetEvEbitda ?? (Number((assumptions as any)?.ev_ebitda_multiple) || 17);
  const targetEvEbit = localTargets.targetEvEbit ?? (Number((assumptions as any)?.ev_ebit_multiple) || 19);
  const targetReturnRate = localTargets.targetReturnRate ?? (Number((assumptions as any)?.target_return_rate) || 15);

  const currentPrice = Number(company?.current_price) || 0;

  const handleTargetChange = useCallback(async (field: string, dbField: string, value: number) => {
    setLocalTargets(prev => ({ ...prev, [field]: value }));
    if (!companyId || !user) return;

    const { data: existing } = await supabase
      .from("company_assumptions")
      .select("id")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .maybeSingle();

    const updateData = { [dbField]: value } as any;
    if (existing) {
      await supabase.from("company_assumptions").update(updateData).eq("id", existing.id);
    } else {
      await supabase.from("company_assumptions").insert({
        ...updateData,
        user_id: user.id,
        company_id: companyId,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["assumptions", companyId] });
  }, [companyId, user, queryClient]);

  // Historical + projected data for the top table
  const historicalYears = periods.map(p => ({
    year: p.fiscal_year,
    isProjection: false,
    marketCap: null as number | null,
    netDebt: Number(p.net_debt) || null,
    ev: null as number | null,
    ebitda: Number(p.ebitda) || null,
    ebit: Number(p.ebit) || null,
    netIncome: Number(p.net_income) || null,
    fcf: Number(p.fcf) || null,
  }));

  const projectionYears = projections
    .sort((a, b) => a.projection_year - b.projection_year)
    .map(p => ({
      year: p.projection_year,
      isProjection: true,
      marketCap: Number((p as any).market_cap) || null,
      netDebt: Number((p as any).net_debt) || null,
      ev: Number((p as any).ev) || null,
      ebitda: Number((p as any).ebitda) || null,
      ebit: Number((p as any).ebit) || null,
      netIncome: Number(p.net_income) || null,
      fcf: Number(p.fcf) || null,
      dilutedShares: Number(p.diluted_shares) || null,
    }));

  const allYears = [...historicalYears, ...projectionYears];

  // Valuation multiples (calculated)
  const multiplesData = useMemo(() => {
    return allYears.map(y => {
      const mc = y.marketCap;
      const nd = y.netDebt;
      const ev = y.ev ?? ((mc && nd) ? mc + nd : null);
      return {
        year: y.year,
        isProjection: y.isProjection,
        per: (mc && y.netIncome && y.netIncome > 0) ? mc / y.netIncome : null,
        evFcf: (ev && y.fcf && y.fcf > 0) ? ev / y.fcf : null,
        evEbitda: (ev && y.ebitda && y.ebitda > 0) ? ev / y.ebitda : null,
        evEbit: (ev && y.ebit && y.ebit > 0) ? ev / y.ebit : null,
      };
    });
  }, [allYears]);

  // Calculate target prices by method (matching Excel formulas exactly)
  const targetPrices = useMemo(() => {
    if (projectionYears.length === 0) return [];

    return projectionYears.map(py => {
      const nd = py.netDebt || 0;
      const shares = py.dilutedShares || 1;

      // PER ex Cash: (Net Income × PER) / shares — no net debt adjustment
      const perPrice = py.netIncome
        ? (py.netIncome * targetPer) / shares
        : null;

      // EV/FCF: (FCF × multiple - NetDebt) / shares
      const evFcfPrice = py.fcf
        ? (py.fcf * targetEvFcf - nd) / shares
        : null;

      // EV/EBITDA: (EBITDA × multiple - NetDebt) / shares
      const evEbitdaPrice = py.ebitda
        ? (py.ebitda * targetEvEbitda - nd) / shares
        : null;

      // EV/EBIT: (EBIT × multiple - NetDebt) / shares
      const evEbitPrice = py.ebit
        ? (py.ebit * targetEvEbit - nd) / shares
        : null;

      const prices = [perPrice, evFcfPrice, evEbitdaPrice, evEbitPrice].filter(v => v !== null) as number[];
      const average = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null;

      const cagrYears = py.year - (new Date().getFullYear() - 1);
      const cagrEvFcf = (evFcfPrice && currentPrice > 0 && cagrYears > 0)
        ? Math.pow(evFcfPrice / currentPrice, 1 / cagrYears) - 1
        : null;

      const marginSafety = (evFcfPrice && currentPrice > 0)
        ? evFcfPrice / currentPrice - 1
        : null;

      return {
        year: py.year,
        perExCash: perPrice,
        evFcf: evFcfPrice,
        evEbitda: evEbitdaPrice,
        evEbit: evEbitPrice,
        average,
        cagrEvFcf,
        marginSafety,
      };
    });
  }, [projectionYears, targetPer, targetEvFcf, targetEvEbitda, targetEvEbit, currentPrice]);

  // Price for target return
  const priceForTargetReturn = useMemo(() => {
    if (targetPrices.length === 0) return null;
    const last = targetPrices[targetPrices.length - 1];
    if (!last.evFcf || targetReturnRate <= 0) return null;
    const firstProjectionYear = targetPrices[0]?.year ?? last.year;
    const years = last.year - firstProjectionYear + 1;
    return last.evFcf / Math.pow(1 + targetReturnRate / 100, years);
  }, [targetPrices, targetReturnRate]);

  const fmt = (n: number | null | undefined, decimals = 0) => {
    if (n == null) return "—";
    if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(decimals)}M`;
    if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(decimals)}K`;
    return n.toFixed(decimals);
  };

  const fmtPrice = (n: number | null | undefined) => {
    if (n == null) return "—";
    return `$${n.toFixed(2)}`;
  };

  const pct = (n: number | null | undefined) => {
    if (n == null) return "—";
    return `${(n * 100).toFixed(1)}%`;
  };

  const fmtMultiple = (n: number | null | undefined) => {
    if (n == null) return "—";
    return `${n.toFixed(1)}x`;
  };

  // Chart data for target prices
  const chartData = targetPrices.map(tp => ({
    year: tp.year,
    "PER ex Cash": tp.perExCash,
    "EV/FCF": tp.evFcf,
    "EV/EBITDA": tp.evEbitda,
    "EV/EBIT": tp.evEbit,
    Promedio: tp.average,
  }));

  // Margin of safety chart
  const mosData = targetPrices.map(tp => ({
    year: tp.year,
    "Margen de Seguridad": tp.marginSafety ? tp.marginSafety * 100 : 0,
  }));

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  const hasData = allYears.length > 0 && projectionYears.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("valuation.title")}</h1>
          <Select value={companyId || ""} onValueChange={(v) => { setSelectedId(v); setLocalTargets({}); }}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!hasData ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {companies.length === 0
                ? "Sube un Excel para calcular valoraciones"
                : "Sin datos de valoración. Re-sube el Excel para extraer los datos."}
            </p>
          </Card>
        ) : (
          <>
            {/* Section 1: Valoración (millones) */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground">Valoración (millones)</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[140px]">Concepto</TableHead>
                      {allYears.map(y => (
                        <TableHead key={y.year} className={`text-right min-w-[90px] ${y.isProjection ? "text-orange-400" : ""}`}>
                          {y.year}{y.isProjection ? "e" : ""}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "Market cap", key: "marketCap" },
                      { label: "Deuda Neta", key: "netDebt" },
                      { label: "Enterprise Value (EV)", key: "ev" },
                      { label: "EBITDA", key: "ebitda" },
                      { label: "EBIT", key: "ebit" },
                      { label: "Net Income", key: "netIncome" },
                      { label: "FCF", key: "fcf" },
                    ].map(({ label, key }) => (
                      <TableRow key={key}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-foreground">{label}</TableCell>
                        {allYears.map(y => (
                          <TableCell key={y.year} className={`text-right font-mono text-sm ${y.isProjection ? "text-orange-400" : "text-foreground"}`}>
                            {fmt((y as any)[key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Section 2: Múltiplos de valoración */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground">Múltiplos de valoración</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[140px]">Múltiplo</TableHead>
                      {multiplesData.map(m => (
                        <TableHead key={m.year} className={`text-right min-w-[80px] ${m.isProjection ? "text-orange-400" : ""}`}>
                          {m.year}{m.isProjection ? "e" : ""}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "PER", key: "per" },
                      { label: "EV / FCF", key: "evFcf" },
                      { label: "EV / EBITDA", key: "evEbitda" },
                      { label: "EV / EBIT", key: "evEbit" },
                    ].map(({ label, key }) => (
                      <TableRow key={key}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-foreground">{label}</TableCell>
                        {multiplesData.map(m => (
                          <TableCell key={m.year} className={`text-right font-mono text-sm ${m.isProjection ? "text-orange-400" : "text-foreground"}`}>
                            {fmtMultiple((m as any)[key])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Section 3: Editable target multiples + Current price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-1">Precio por acción actual</h3>
                <p className="text-3xl font-bold text-foreground">{currentPrice > 0 ? `$${currentPrice.toFixed(0)}` : "—"}</p>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-3">
                  Múltiplos de valoración objetivo
                  <span className="ml-2 text-xs font-normal text-orange-400">▶ Ajustar manualmente</span>
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "PER", field: "targetPer", dbField: "target_pe", value: targetPer },
                    { label: "EV / FCF", field: "targetEvFcf", dbField: "fcf_multiple", value: targetEvFcf },
                    { label: "EV / EBITDA", field: "targetEvEbitda", dbField: "ev_ebitda_multiple", value: targetEvEbitda },
                    { label: "EV / EBIT", field: "targetEvEbit", dbField: "ev_ebit_multiple", value: targetEvEbit },
                  ].map(({ label, field, dbField, value }) => (
                    <div key={field}>
                      <label className="text-xs text-muted-foreground">{label}</label>
                      <Input
                        type="number"
                        value={value}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v)) handleTargetChange(field, dbField, v);
                        }}
                        className="mt-1 h-8 text-sm font-mono border-orange-400/50 text-orange-400 bg-orange-400/5"
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Section 4: Precio objetivo by method */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground">Precio objetivo</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[140px]">Método</TableHead>
                      {targetPrices.map(tp => (
                        <TableHead key={tp.year} className="text-right text-orange-400 min-w-[90px]">{tp.year}e</TableHead>
                      ))}
                      <TableHead className="text-right min-w-[90px]">CAGR 5 años</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "PER ex Cash", key: "perExCash" },
                      { label: "EV / FCF", key: "evFcf" },
                      { label: "EV / EBITDA", key: "evEbitda" },
                      { label: "EV / EBIT", key: "evEbit" },
                    ].map(({ label, key }) => {
                      // Calculate CAGR for each method
                      const lastTp = targetPrices[targetPrices.length - 1];
                      const lastVal = (lastTp as any)?.[key];
                      const cagrYears = lastTp ? lastTp.year - (new Date().getFullYear() - 1) : 0;
                      const cagr = (lastVal && currentPrice > 0 && cagrYears > 0)
                        ? Math.pow(lastVal / currentPrice, 1 / cagrYears) - 1
                        : null;

                      return (
                        <TableRow key={key}>
                          <TableCell className="sticky left-0 bg-card z-10 font-medium text-foreground">{label}</TableCell>
                          {targetPrices.map(tp => (
                            <TableCell key={tp.year} className="text-right font-mono text-sm text-foreground">
                              {(tp as any)[key] != null ? `$${Math.round((tp as any)[key])}` : "—"}
                            </TableCell>
                          ))}
                          <TableCell className={`text-right font-mono text-sm font-semibold ${cagr && cagr >= 0 ? "text-success" : "text-destructive"}`}>
                            {pct(cagr)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 border-border">
                      <TableCell className="sticky left-0 bg-card z-10 font-semibold text-foreground">Promedio</TableCell>
                      {targetPrices.map(tp => (
                        <TableCell key={tp.year} className="text-right font-mono text-sm font-semibold text-foreground">
                          {tp.average != null ? `$${Math.round(tp.average)}` : "—"}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {(() => {
                          const lastTp = targetPrices[targetPrices.length - 1];
                          const cagrYears = lastTp ? lastTp.year - (new Date().getFullYear() - 1) : 0;
                          const cagr = (lastTp?.average && currentPrice > 0 && years > 0)
                            ? Math.pow(lastTp.average / currentPrice, 1 / cagrYears) - 1
                            : null;
                          return <span className={cagr && cagr >= 0 ? "text-success" : "text-destructive"}>{pct(cagr)}</span>;
                        })()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Section 5: Margen de seguridad (EV/FCF) */}
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-border">
                <h3 className="text-sm font-semibold text-card-foreground">Margen de seguridad (EV/FCF)</h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="sticky left-0 bg-card z-10 font-medium text-foreground min-w-[140px]">MoS</TableCell>
                      {targetPrices.map(tp => (
                        <TableCell key={tp.year} className={`text-right font-mono text-sm font-semibold min-w-[90px] ${
                          (tp.marginSafety ?? 0) >= 0 ? "text-success" : "text-destructive"
                        }`}>
                          {tp.marginSafety != null ? `${Math.round(tp.marginSafety * 100)}%` : "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Section 6: Retorno anual objetivo */}
            <Card className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="text-xs text-muted-foreground">Retorno anual objetivo</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      type="number"
                      value={targetReturnRate}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v)) handleTargetChange("targetReturnRate", "target_return_rate", v);
                      }}
                      className="h-8 w-24 text-sm font-mono border-orange-400/50 text-orange-400 bg-orange-400/5"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Precio de compra para {targetReturnRate}% anual</p>
                  <p className="text-2xl font-bold text-foreground mt-1">
                    {priceForTargetReturn ? `$${Math.round(priceForTargetReturn)}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Diferencia vs precio actual</p>
                  <p className={`text-2xl font-bold mt-1 ${
                    priceForTargetReturn && currentPrice > 0
                      ? (priceForTargetReturn < currentPrice ? "text-red-500" : "text-green-500")
                      : "text-foreground"
                  }`}>
                    {priceForTargetReturn && currentPrice > 0
                      ? `${(((priceForTargetReturn - currentPrice) / currentPrice) * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
              </div>
            </Card>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Target price chart */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-4">Precio objetivo por método</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--card-foreground))",
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
                      />
                      <Legend />
                      <Bar dataKey="PER ex Cash" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="EV/FCF" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="EV/EBITDA" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="EV/EBIT" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Margin of safety chart */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-4">Margen de seguridad (EV/FCF)</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={mosData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--card-foreground))",
                        }}
                        formatter={(value: number) => [`${value.toFixed(1)}%`, "MoS"]}
                      />
                      <Bar
                        dataKey="Margen de Seguridad"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
