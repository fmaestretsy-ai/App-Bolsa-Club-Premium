import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useCompanies, useFinancialPeriods, useProjectionYears } from "@/hooks/useCompanyData";
import { getCurrencySymbol } from "@/lib/currency";

export default function Projection() {
  const { t } = useTranslation();
  const { data: companies = [], isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string>("");

  const companyId = selectedId || companies[0]?.id;
  const company = companies.find((c) => c.id === companyId);
  const { data: periods = [] } = useFinancialPeriods(companyId);
  const { data: storedProjections = [] } = useProjectionYears(companyId);

  const currentPrice = company?.current_price ? Number(company.current_price) : 0;

  const projections = useMemo(() => {
    if (storedProjections.length === 0) return [];

    return storedProjections
      .filter((p) => p.target_price != null && p.target_price > 0)
      .map((p) => {
        const targetPrice = Number(p.target_price);
        const year = p.projection_year;
        // CAGR from current year (base year = last completed fiscal year, i.e. previous year)
        const baseYear = new Date().getFullYear() - 1;
        const yearsOut = year - baseYear;
        const expectedReturn = currentPrice > 0
          ? ((targetPrice - currentPrice) / currentPrice) * 100
          : 0;
        const annualizedReturn = currentPrice > 0 && yearsOut > 0
          ? (Math.pow(targetPrice / currentPrice, 1 / yearsOut) - 1) * 100
          : expectedReturn;

        return {
          year,
          targetPrice,
          revenue: p.revenue ? Number(p.revenue) : null,
          netIncome: p.net_income ? Number(p.net_income) : null,
          fcf: p.fcf ? Number(p.fcf) : null,
          expectedReturn: Math.round(expectedReturn * 10) / 10,
          annualizedReturn: Math.round(annualizedReturn * 10) / 10,
        };
      })
      .sort((a, b) => a.year - b.year);
  }, [storedProjections, currentPrice, periods]);

  const lastProj = projections.length > 0 ? projections[projections.length - 1] : null;
  const firstProj = projections.length > 0 ? projections[0] : null;

  const cs = getCurrencySymbol(company?.currency);

  const fmt = (n: number | null) => {
    if (n == null) return "—";
    if (Math.abs(n) >= 1e6) return `${cs}${(n / 1e6).toFixed(0)}M`;
    if (Math.abs(n) >= 1e3) return `${cs}${(n / 1e3).toFixed(1)}K`;
    return `${cs}${n.toFixed(2)}`;
  };

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
                ? "Sube un Excel para ver proyecciones"
                : "Sin datos de proyección EV/FCF para esta empresa. Re-sube el Excel."}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Precio actual</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {currentPrice > 0 ? `${cs}${currentPrice.toFixed(0)}` : "—"}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("projection.targetPrice")} {firstProj?.year}</p>
                <p className="text-xl font-bold text-foreground mt-1">
                  {cs}{firstProj?.targetPrice.toFixed(2)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">{t("projection.targetPrice")} {lastProj?.year}</p>
                <p className="text-xl font-bold text-success mt-1">
                  {cs}{lastProj?.targetPrice.toFixed(2)}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground">Retorno anualizado {lastProj?.year}</p>
                <p className={`text-xl font-bold mt-1 ${(lastProj?.annualizedReturn ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                  {lastProj ? `${lastProj.annualizedReturn >= 0 ? "+" : ""}${lastProj.annualizedReturn.toFixed(1)}%` : "—"}
                </p>
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-card-foreground mb-4">Precio objetivo EV/FCF por año</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projections}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="year" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${cs}${v.toFixed(0)}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                      formatter={(value: number) => [`${cs}${value.toFixed(2)}`, "Precio objetivo"]}
                    />
                    <Legend />
                    <Bar dataKey="targetPrice" name="Precio objetivo EV/FCF" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
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
                      <TableHead className="text-right">Precio obj. EV/FCF</TableHead>
                      <TableHead className="text-right">{t("projection.expectedReturn")}</TableHead>
                      <TableHead className="text-right">Retorno anualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projections.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-semibold">{row.year}</TableCell>
                        <TableCell className="text-right font-mono">{cs}{row.targetPrice.toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-semibold ${row.expectedReturn >= 0 ? "text-success" : "text-destructive"}`}>
                          {row.expectedReturn >= 0 ? "+" : ""}{row.expectedReturn.toFixed(1)}%
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${row.annualizedReturn >= 0 ? "text-success" : "text-destructive"}`}>
                          {row.annualizedReturn >= 0 ? "+" : ""}{row.annualizedReturn.toFixed(1)}%
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