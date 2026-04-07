import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, DollarSign, TrendingUp, Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function Dividends() {
  const { user } = useAuth();
  const [year, setYear] = useState(String(currentYear));

  const { data: allDividends = [], isLoading } = useQuery({
    queryKey: ["dividend-trades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("total, amount_base, trade_date, currency, companies(ticker, name)")
        .eq("trade_type", "dividend")
        .order("trade_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: withholdings = [] } = useQuery({
    queryKey: ["withholding-trades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("total, amount_base, trade_date")
        .eq("trade_type", "withholding")
        .order("trade_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const yearDividends = allDividends.filter((d: any) => d.trade_date?.startsWith(year));
  const yearWithholdings = withholdings.filter((w: any) => w.trade_date?.startsWith(year));

  const totalBruto = yearDividends.reduce((s: number, d: any) => s + Number(d.amount_base || d.total), 0);
  const totalRetenciones = yearWithholdings.reduce((s: number, w: any) => s + Number(w.amount_base || w.total), 0);
  const totalNeto = totalBruto - totalRetenciones;
  const allTimeBruto = allDividends.reduce((s: number, d: any) => s + Number(d.amount_base || d.total), 0);

  // Monthly evolution
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i).toLocaleString("es", { month: "short" }),
      bruto: 0,
      neto: 0,
    }));
    yearDividends.forEach((d: any) => {
      const m = new Date(d.trade_date).getMonth();
      months[m].bruto += Number(d.amount_base || d.total);
    });
    yearWithholdings.forEach((w: any) => {
      const m = new Date(w.trade_date).getMonth();
      months[m].bruto -= 0; // withholdings don't reduce bruto
    });
    // For neto, subtract withholdings proportionally by month
    yearWithholdings.forEach((w: any) => {
      const m = new Date(w.trade_date).getMonth();
      months[m].neto -= Number(w.amount_base || w.total);
    });
    months.forEach((m) => { m.neto = m.bruto + m.neto; });
    return months;
  }, [yearDividends, yearWithholdings]);

  // Annual evolution
  const annualData = useMemo(() => {
    const map = new Map<number, number>();
    allDividends.forEach((d: any) => {
      const y = new Date(d.trade_date).getFullYear();
      map.set(y, (map.get(y) || 0) + Number(d.amount_base || d.total));
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([y, total]) => ({ year: String(y), total }));
  }, [allDividends]);

  // Per-asset breakdown
  const perAsset = useMemo(() => {
    const map = new Map<string, { ticker: string; name: string; total: number; count: number }>();
    yearDividends.forEach((d: any) => {
      const ticker = d.companies?.ticker || "—";
      const existing = map.get(ticker) || { ticker, name: d.companies?.name || "—", total: 0, count: 0 };
      existing.total += Number(d.amount_base || d.total);
      existing.count += 1;
      map.set(ticker, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [yearDividends]);

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Dividendos</h1>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={`Bruto ${year}`} value={`€${totalBruto.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<DollarSign className="h-4 w-4" />} />
          <StatCard title={`Neto ${year}`} value={`€${totalNeto.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard title="Cobros del año" value={String(yearDividends.length)} icon={<Calendar className="h-4 w-4" />} />
          <StatCard title="Acumulado total" value={`€${allTimeBruto.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<DollarSign className="h-4 w-4" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly chart */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Evolución mensual {year}</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis tickFormatter={(v) => `€${v}`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }} />
                  <Legend formatter={(v) => v === "bruto" ? "Bruto" : "Neto"} />
                  <Bar dataKey="bruto" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="neto" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Annual chart */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Evolución anual</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={annualData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis tickFormatter={(v) => `€${v}`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }} />
                  <Bar dataKey="total" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Dividendos" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Per-asset table */}
        {perAsset.length > 0 && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">Desglose por activo — {year}</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="hidden sm:table-cell">Nombre</TableHead>
                  <TableHead className="text-right">Cobros</TableHead>
                  <TableHead className="text-right">Total (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {perAsset.map((a) => (
                  <TableRow key={a.ticker}>
                    <TableCell className="font-semibold">{a.ticker}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{a.name}</TableCell>
                    <TableCell className="text-right font-mono">{a.count}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">€{a.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
