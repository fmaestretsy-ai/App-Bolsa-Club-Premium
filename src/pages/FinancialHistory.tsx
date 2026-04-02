import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useCompanies, useFinancialPeriods } from "@/hooks/useCompanyData";

export default function FinancialHistory() {
  const { t } = useTranslation();
  const { data: companies = [], isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string>("");

  const companyId = selectedId || companies[0]?.id;
  const { data: periods = [] } = useFinancialPeriods(companyId);

  const fmt = (n: number | null) => {
    if (n == null) return "—";
    const v = Number(n);
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
    if (Math.abs(v) >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
    return `$${v.toFixed(2)}`;
  };

  const pct = (n: number | null) => (n != null ? `${(Number(n) * 100).toFixed(1)}%` : "—");

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
          <h1 className="text-2xl font-bold text-foreground">{t("nav.financials")}</h1>
          <Select value={companyId || ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {periods.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {companies.length === 0
                ? "Sube un Excel para ver el historial financiero"
                : "Sin datos financieros para esta empresa"}
            </p>
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
                    <TableHead className="text-right">Net Income</TableHead>
                    <TableHead className="text-right">FCF</TableHead>
                    <TableHead className="text-right">Mg Neto</TableHead>
                    <TableHead className="text-right">EPS</TableHead>
                    <TableHead className="text-right">ROE</TableHead>
                    <TableHead className="text-right">ROIC</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periods.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-semibold">{row.fiscal_year}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(row.revenue))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(row.ebitda))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(row.net_income))}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(Number(row.fcf))}</TableCell>
                      <TableCell className="text-right font-mono">{pct(Number(row.margin_net))}</TableCell>
                      <TableCell className="text-right font-mono">
                        {row.eps != null ? `$${Number(row.eps).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">{pct(Number(row.roe))}</TableCell>
                      <TableCell className="text-right font-mono">{pct(Number(row.roic))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
