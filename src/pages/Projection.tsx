import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useCompanies, useFinancialPeriods, useCompanyAssumptions } from "@/hooks/useCompanyData";
import { calculateProjections } from "@/lib/valuationEngine";

export default function Projection() {
  const { t } = useTranslation();
  const { data: companies = [], isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string>("");

  const companyId = selectedId || companies[0]?.id;
  const company = companies.find((c) => c.id === companyId);
  const { data: periods = [] } = useFinancialPeriods(companyId);
  const { data: assumptions } = useCompanyAssumptions(companyId);

  const lastPeriod = periods.length > 0 ? periods[periods.length - 1] : null;

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

  const fmt = (n: number) => {
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  };

  const lastProj = projections.length > 0 ? projections[projections.length - 1] : null;
  const firstProj = projections.length > 0 ? projections[0] : null;

  // Revenue CAGR over projection period
  const revenueCagr = lastProj && lastPeriod && Number(lastPeriod.revenue) > 0
    ? (Math.pow(lastProj.revenue / Number(lastPeriod.revenue), 1 / projections.length) - 1) * 100
    : null;

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
          <h1 className="text-2xl font-bold text-foreground">{t("projection.title")}</h1>
          <Select value={companyId || ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {projections.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {companies.length === 0
                ? "Sube un Excel para generar proyecciones"
                : "Sin datos financieros para esta empresa"}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("projection.cagr")} Revenue</p>
                <p className="text-xl font-bold text-card-foreground mt-1">
                  {revenueCagr != null ? `${revenueCagr.toFixed(1)}%` : "—"}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("projection.targetPrice")} {lastProj?.year}</p>
                <p className="text-xl font-bold text-green-500 mt-1">
                  ${lastProj?.targetPrice.toFixed(2)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("projection.expectedReturn")} {lastProj?.year}</p>
                <p className={`text-xl font-bold mt-1 ${(lastProj?.expectedReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {lastProj ? `${lastProj.expectedReturn >= 0 ? "+" : ""}${lastProj.expectedReturn.toFixed(1)}%` : "—"}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Retorno anualizado</p>
                <p className={`text-xl font-bold mt-1 ${(lastProj?.expectedReturn || 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {lastProj
                    ? `${((Math.pow(1 + lastProj.expectedReturn / 100, 1 / projections.length) - 1) * 100).toFixed(1)}%`
                    : "—"}
                </p>
              </Card>
            </div>

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
                    <Bar dataKey="revenue" name={t("projection.revenue")} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fcf" name={t("projection.fcf")} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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
      </div>
    </DashboardLayout>
  );
}
