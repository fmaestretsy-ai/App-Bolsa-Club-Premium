import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useCompanies, useFinancialPeriods, useCompanyAssumptions } from "@/hooks/useCompanyData";
import { calculateValuation, getRecommendation } from "@/lib/valuationEngine";

export default function Valuation() {
  const { t } = useTranslation();
  const { data: companies = [], isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string>("");

  const companyId = selectedId || companies[0]?.id;
  const company = companies.find((c) => c.id === companyId);
  const { data: periods = [] } = useFinancialPeriods(companyId);
  const { data: assumptions } = useCompanyAssumptions(companyId);

  const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

  const results = useMemo(() => {
    if (!lastPeriod || !company) return [];
    const a = assumptions || { target_pe: 25, fcf_multiple: 25, conservative_discount: 15, optimistic_premium: 15 };
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

  const scenarios = ["conservative", "base", "optimistic"].map((scenario) => {
    const sr = results.filter((r) => r.scenarioType === scenario);
    const avg = sr.length > 0 ? sr.reduce((s, r) => s + r.intrinsicValue, 0) / sr.length : 0;
    const avgUp = sr.length > 0 ? sr.reduce((s, r) => s + r.upside, 0) / sr.length : 0;
    return { name: scenario, value: avg, upside: avgUp };
  });

  const baseScenario = scenarios.find((s) => s.name === "base");
  const recommendation = baseScenario ? getRecommendation(baseScenario.upside) : null;
  const recLabels = { buy: t("valuation.buy"), hold: t("valuation.hold"), sell: t("valuation.sell") };
  const recColors = { buy: "bg-green-600", hold: "bg-yellow-500", sell: "bg-red-500" };
  const scenarioLabels: Record<string, string> = {
    conservative: t("valuation.conservative"),
    base: t("valuation.base"),
    optimistic: t("valuation.optimistic"),
  };
  const scenarioColors = { conservative: "bg-yellow-500", base: "bg-primary", optimistic: "bg-green-500" };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("valuation.title")}</h1>
          <Select value={companyId || ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {results.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {companies.length === 0
                ? "Sube un Excel para calcular valoraciones"
                : "Sin datos financieros para esta empresa"}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {scenarios.map((s) => (
                <Card key={s.name} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-muted-foreground">{scenarioLabels[s.name]}</p>
                    <div className={`h-2 w-2 rounded-full ${scenarioColors[s.name as keyof typeof scenarioColors]}`} />
                  </div>
                  <p className="text-3xl font-bold text-card-foreground">${s.value.toFixed(2)}</p>
                  <p className={`text-sm font-semibold mt-1 ${s.upside >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {s.upside >= 0 ? "+" : ""}{s.upside.toFixed(1)}% upside
                  </p>
                </Card>
              ))}
            </div>

            {baseScenario && recommendation && company && (
              <Card className="p-6">
                <h3 className="font-semibold text-card-foreground mb-6">{t("valuation.recommendation")}</h3>
                <div className="flex flex-col items-center">
                  <Badge className={`${recColors[recommendation]} text-primary-foreground text-lg px-6 py-2 mb-4`}>
                    {recLabels[recommendation]}
                  </Badge>
                  <div className="w-full max-w-lg space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("companies.currentPrice")}</span>
                      <span className="font-mono text-foreground">${Number(company.current_price || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("valuation.intrinsicValue")} ({t("valuation.base")})</span>
                      <span className="font-mono text-foreground">${baseScenario.value.toFixed(2)}</span>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">{t("valuation.marginOfSafety")}</span>
                        <span className={`font-semibold ${baseScenario.upside >= 0 ? "text-green-500" : "text-red-500"}`}>
                          {baseScenario.upside.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={Math.min(100, Math.max(0, 50 + baseScenario.upside))} className="h-2" />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {["per", "ev_fcf", "ev_ebitda", "ev_ebit"].map((method) => {
                const methodResults = results.filter((r) => r.method === method && r.scenarioType === "base");
                if (methodResults.length === 0) return null;
                const r = methodResults[0];
                return (
                  <Card key={method} className="p-5">
                    <h3 className="text-sm font-semibold text-card-foreground mb-3">{method.toUpperCase()}</h3>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Valor intrínseco</span>
                      <span className="font-mono text-foreground">${r.intrinsicValue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Upside</span>
                      <span className={`font-semibold ${r.upside >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {r.upside >= 0 ? "+" : ""}{r.upside.toFixed(1)}%
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
