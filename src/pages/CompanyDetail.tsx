import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, Pencil, Check, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useCompany, useFinancialPeriods, useCompanyAssumptions } from "@/hooks/useCompanyData";
import { calculateValuation, getRecommendation, calculateProjections } from "@/lib/valuationEngine";
import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TradeDialog } from "@/components/TradeDialog";
import { getCurrencySymbol, fmtCurrencyCompact } from "@/lib/currency";

export default function CompanyDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: company, isLoading: loadingCompany } = useCompany(id);
  const { data: periods = [], isLoading: loadingPeriods } = useFinancialPeriods(id);
  const { data: assumptions } = useCompanyAssumptions(id);
  const queryClient = useQueryClient();
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  const cs = getCurrencySymbol(company?.currency);

  const fmt = (n: number | null) => {
    if (n == null) return "—";
    if (Math.abs(n) >= 1e6) return `${cs}${(n / 1e6).toFixed(0)}M`;
    if (Math.abs(n) >= 1e3) return `${cs}${(n / 1e3).toFixed(1)}K`;
    return `${cs}${n.toFixed(2)}`;
  };

  const pct = (n: number | null) => (n != null ? `${(n * 100).toFixed(1)}%` : "—");

  const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

  const valuationResults = useMemo(() => {
    if (!lastPeriod || !company) return [];
    const a = assumptions || {
      target_pe: 25, fcf_multiple: 25, conservative_discount: 15, optimistic_premium: 15,
    };
    return calculateValuation(
      {
        eps: Number(lastPeriod.eps) || 0,
        fcfPerShare: Number(lastPeriod.fcf_per_share) || 0,
        ebitda: Number(lastPeriod.ebitda) || 0,
        ebit: Number(lastPeriod.ebit) || 0,
        netDebt: Number(lastPeriod.net_debt) || 0,
        dilutedShares: Number(lastPeriod.diluted_shares) || 0,
        currentPrice: Number(company.current_price) || 0,
      },
      {
        targetPe: Number(a.target_pe) || 25,
        fcfMultiple: Number(a.fcf_multiple) || 25,
        conservativeDiscount: Number(a.conservative_discount) || 15,
        optimisticPremium: Number(a.optimistic_premium) || 15,
      }
    );
  }, [lastPeriod, company, assumptions]);

  const baseResults = valuationResults.filter((r) => r.scenarioType === "base");
  const avgBaseIV = baseResults.length > 0
    ? baseResults.reduce((s, r) => s + r.intrinsicValue, 0) / baseResults.length
    : null;
  const avgBaseUpside = baseResults.length > 0
    ? baseResults.reduce((s, r) => s + r.upside, 0) / baseResults.length
    : null;

  const projections = useMemo(() => {
    if (!lastPeriod || !company) return [];
    const a = assumptions || { revenue_growth_rate: 10, net_margin_target: 25, discount_rate: 10, target_pe: 25 };
    const fcfMargin = lastPeriod.margin_fcf ? Number(lastPeriod.margin_fcf) * 100 : 25;
    return calculateProjections(
      {
        year: lastPeriod.fiscal_year,
        revenue: Number(lastPeriod.revenue) || 0,
        netIncome: Number(lastPeriod.net_income) || 0,
        fcf: Number(lastPeriod.fcf) || 0,
      },
      {
        revenueGrowthRate: Number(a.revenue_growth_rate) || 10,
        netMarginTarget: lastPeriod.margin_net ? Number(lastPeriod.margin_net) * 100 : Number(a.net_margin_target) || 25,
        fcfMarginTarget: fcfMargin,
        targetPe: Number(a.target_pe) || 25,
        discountRate: Number(a.discount_rate) || 10,
        dilutedShares: Number(lastPeriod.diluted_shares) || 1,
        currentPrice: Number(company.current_price) || 0,
      }
    );
  }, [lastPeriod, company, assumptions]);

  if (loadingCompany || loadingPeriods) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!company) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Empresa no encontrada</p>
      </DashboardLayout>
    );
  }

  const recommendation = avgBaseUpside != null ? getRecommendation(avgBaseUpside) : null;
  const recColors = { buy: "bg-green-600", hold: "bg-yellow-500", sell: "bg-red-500" };
  const recLabels = { buy: t("valuation.buy"), hold: t("valuation.hold"), sell: t("valuation.sell") };


  const savePrice = async () => {
    const price = parseFloat(priceInput);
    if (isNaN(price) || price <= 0) { toast.error("Precio inválido"); return; }
    const { error } = await supabase.from("companies").update({ current_price: price, last_price_update: new Date().toISOString() }).eq("id", company.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ["company", id] });
    queryClient.invalidateQueries({ queryKey: ["companies"] });
    setEditingPrice(false);
    toast.success("Precio actualizado");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/companies")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{company.name}</h1>
                <Badge variant="secondary">{company.ticker}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {company.sector || "—"} · {company.country} · {company.currency}
              </p>
            </div>
          </div>
          <TradeDialog defaultCompanyId={company.id} trigger={<Button size="sm">Registrar operación</Button>} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("companies.currentPrice")}</p>
            {editingPrice ? (
              <div className="flex items-center gap-1 mt-1">
                <Input value={priceInput} onChange={(e) => setPriceInput(e.target.value)} className="h-8 font-mono text-sm w-24" type="number" step="0.01" autoFocus />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={savePrice}><Check className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingPrice(false)}><X className="h-3 w-3" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xl font-bold text-card-foreground">
                  {company.current_price ? `${cs}${Number(company.current_price).toFixed(2)}` : "—"}
                </p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setPriceInput(String(company.current_price || "")); setEditingPrice(true); }}>
                  <Pencil className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("valuation.intrinsicValue")}</p>
            <p className="text-xl font-bold text-card-foreground mt-1">
              {avgBaseIV ? `$${avgBaseIV.toFixed(2)}` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">{t("valuation.base")} (promedio)</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("companies.upside")}</p>
            <p className={`text-xl font-bold mt-1 ${avgBaseUpside != null && avgBaseUpside >= 0 ? "text-green-500" : "text-red-500"}`}>
              {avgBaseUpside != null ? `${avgBaseUpside >= 0 ? "+" : ""}${avgBaseUpside.toFixed(1)}%` : "—"}
            </p>
            {recommendation && (
              <Badge className={`${recColors[recommendation]} text-primary-foreground mt-1`}>
                {recLabels[recommendation]}
              </Badge>
            )}
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Períodos</p>
            <p className="text-xl font-bold text-card-foreground mt-1">{periods.length}</p>
            <p className="text-xs text-muted-foreground">
              {periods.length > 0 ? `${periods[0].fiscal_year}–${periods[periods.length - 1].fiscal_year}` : "—"}
            </p>
          </Card>
        </div>

        <Tabs defaultValue="financials" className="w-full">
          <TabsList className="bg-muted">
            <TabsTrigger value="financials">{t("nav.financials")}</TabsTrigger>
            <TabsTrigger value="valuation">{t("nav.valuation")}</TabsTrigger>
            <TabsTrigger value="projection">{t("nav.projection")}</TabsTrigger>
          </TabsList>

          <TabsContent value="financials" className="mt-4">
            {periods.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Año</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">EBITDA</TableHead>
                        <TableHead className="text-right">EBIT</TableHead>
                        <TableHead className="text-right">Net Income</TableHead>
                        <TableHead className="text-right">FCF</TableHead>
                        <TableHead className="text-right">Mg EBITDA</TableHead>
                        <TableHead className="text-right">Mg Neto</TableHead>
                        <TableHead className="text-right">EPS</TableHead>
                        <TableHead className="text-right">ROE</TableHead>
                        <TableHead className="text-right">ROIC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {periods.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-semibold">{p.fiscal_year}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(Number(p.revenue))}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(Number(p.ebitda))}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(Number(p.ebit))}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(Number(p.net_income))}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(Number(p.fcf))}</TableCell>
                          <TableCell className="text-right font-mono">{pct(Number(p.margin_ebitda))}</TableCell>
                          <TableCell className="text-right font-mono">{pct(Number(p.margin_net))}</TableCell>
                          <TableCell className="text-right font-mono">
                            {p.eps != null ? `${cs}${Number(p.eps).toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{pct(Number(p.roe))}</TableCell>
                          <TableCell className="text-right font-mono">{pct(Number(p.roic))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="valuation" className="mt-4 space-y-4">
            {valuationResults.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground text-sm">Sube datos financieros para calcular la valoración</p>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {["conservative", "base", "optimistic"].map((scenario) => {
                    const results = valuationResults.filter((r) => r.scenarioType === scenario);
                    const avgIV = results.reduce((s, r) => s + r.intrinsicValue, 0) / results.length;
                    const avgUp = results.reduce((s, r) => s + r.upside, 0) / results.length;
                    const labels: Record<string, string> = {
                      conservative: t("valuation.conservative"),
                      base: t("valuation.base"),
                      optimistic: t("valuation.optimistic"),
                    };
                    return (
                      <Card key={scenario} className="p-5">
                        <p className="text-sm font-medium text-muted-foreground mb-2">{labels[scenario]}</p>
                        <p className="text-3xl font-bold text-card-foreground">${avgIV.toFixed(2)}</p>
                        <p className={`text-sm font-semibold mt-1 ${avgUp >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {avgUp >= 0 ? "+" : ""}{avgUp.toFixed(1)}% upside
                        </p>
                      </Card>
                    );
                  })}
                </div>

                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Método</TableHead>
                          <TableHead>Escenario</TableHead>
                          <TableHead className="text-right">Valor Intrínseco</TableHead>
                          <TableHead className="text-right">Upside</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {valuationResults.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-semibold">{r.method.toUpperCase()}</TableCell>
                            <TableCell>
                              <Badge variant="secondary">{r.scenarioType}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">${r.intrinsicValue.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-semibold ${r.upside >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {r.upside >= 0 ? "+" : ""}{r.upside.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="projection" className="mt-4 space-y-4">
            {projections.length === 0 ? (
              <Card className="p-6">
                <p className="text-muted-foreground text-sm">Sube datos financieros para generar proyecciones</p>
              </Card>
            ) : (
              <>
                <Card className="p-5">
                  <h3 className="text-sm font-semibold text-card-foreground mb-4">{t("projection.title")}</h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={projections}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${(v / 1e3).toFixed(0)}B`} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--card-foreground))",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="fcf" name="FCF" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("projection.year")}</TableHead>
                          <TableHead className="text-right">{t("projection.revenue")}</TableHead>
                          <TableHead className="text-right">{t("projection.netIncome")}</TableHead>
                          <TableHead className="text-right">{t("projection.fcf")}</TableHead>
                          <TableHead className="text-right">EPS</TableHead>
                          <TableHead className="text-right">{t("projection.targetPrice")}</TableHead>
                          <TableHead className="text-right">{t("projection.expectedReturn")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projections.map((row) => (
                          <TableRow key={row.year}>
                            <TableCell className="font-semibold">{row.year}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(row.revenue)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(row.netIncome)}</TableCell>
                            <TableCell className="text-right font-mono">{fmt(row.fcf)}</TableCell>
                            <TableCell className="text-right font-mono">${row.eps.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">${row.targetPrice.toFixed(2)}</TableCell>
                            <TableCell className={`text-right font-semibold ${row.expectedReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {row.expectedReturn >= 0 ? "+" : ""}{row.expectedReturn.toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
