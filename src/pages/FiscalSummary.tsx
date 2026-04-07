import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, TrendingUp, TrendingDown, DollarSign, Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 10 }, (_, i) => currentYear - i);

export default function FiscalSummary() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [year, setYear] = useState(String(currentYear));

  // Realized gains
  const { data: gains = [], isLoading: loadingGains } = useQuery({
    queryKey: ["realized-gains", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("realized_gains")
        .select("*, companies(name, ticker)")
        .gte("sell_date", `${year}-01-01`)
        .lte("sell_date", `${year}-12-31`)
        .order("sell_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Dividends
  const { data: dividends = [], isLoading: loadingDiv } = useQuery({
    queryKey: ["fiscal-dividends", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("total, amount_base, trade_date, companies(ticker)")
        .eq("trade_type", "dividend")
        .gte("trade_date", `${year}-01-01`)
        .lte("trade_date", `${year}-12-31`);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Withholdings
  const { data: withholdings = [] } = useQuery({
    queryKey: ["fiscal-withholdings", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("total, amount_base")
        .eq("trade_type", "withholding")
        .gte("trade_date", `${year}-01-01`)
        .lte("trade_date", `${year}-12-31`);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Commissions
  const { data: commissions = [] } = useQuery({
    queryKey: ["fiscal-commissions", year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("total, amount_base")
        .eq("trade_type", "commission")
        .gte("trade_date", `${year}-01-01`)
        .lte("trade_date", `${year}-12-31`);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totalRealizedGains = gains.filter((g: any) => g.gain_loss_base > 0).reduce((s: number, g: any) => s + Number(g.gain_loss_base), 0);
  const totalRealizedLosses = gains.filter((g: any) => g.gain_loss_base < 0).reduce((s: number, g: any) => s + Number(g.gain_loss_base), 0);
  const netGains = totalRealizedGains + totalRealizedLosses;
  const totalDividends = dividends.reduce((s: number, d: any) => s + Number(d.amount_base || d.total), 0);
  const totalWithholdings = withholdings.reduce((s: number, w: any) => s + Number(w.amount_base || w.total), 0);
  const totalCommissions = commissions.reduce((s: number, c: any) => s + Number(c.amount_base || c.total), 0);

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: new Date(2000, i).toLocaleString("es", { month: "short" }),
      gains: 0,
      losses: 0,
      dividends: 0,
    }));
    gains.forEach((g: any) => {
      const m = new Date(g.sell_date).getMonth();
      const val = Number(g.gain_loss_base);
      if (val >= 0) months[m].gains += val;
      else months[m].losses += Math.abs(val);
    });
    dividends.forEach((d: any) => {
      const m = new Date(d.trade_date).getMonth();
      months[m].dividends += Number(d.amount_base || d.total);
    });
    return months;
  }, [gains, dividends]);

  const isLoading = loadingGains || loadingDiv;

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
          <h1 className="text-2xl font-bold text-foreground">Resumen Fiscal</h1>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Plusvalías realizadas"
            value={`+€${totalRealizedGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            changeType="gain"
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="Minusvalías realizadas"
            value={`€${totalRealizedLosses.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            changeType="loss"
            icon={<TrendingDown className="h-4 w-4" />}
          />
          <StatCard
            title="Dividendos brutos"
            value={`€${totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            title="Retenciones"
            value={`€${totalWithholdings.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<Receipt className="h-4 w-4" />}
          />
        </div>

        {/* Summary card */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-3">Resumen anual {year}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Neto plusvalías</p>
              <p className={`font-mono font-semibold ${netGains >= 0 ? "text-green-500" : "text-red-500"}`}>
                €{netGains.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Dividendos netos</p>
              <p className="font-mono font-semibold text-foreground">
                €{(totalDividends - totalWithholdings).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Comisiones totales</p>
              <p className="font-mono font-semibold text-foreground">
                €{totalCommissions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Operaciones de venta</p>
              <p className="font-mono font-semibold text-foreground">{gains.length}</p>
            </div>
          </div>
        </Card>

        {/* Monthly chart */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Evolución mensual</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis tickFormatter={(v) => `€${(v / 1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }}
                  formatter={(value: number, name: string) => [`€${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, name === "gains" ? "Plusvalías" : name === "losses" ? "Minusvalías" : "Dividendos"]}
                />
                <Legend formatter={(value) => value === "gains" ? "Plusvalías" : value === "losses" ? "Minusvalías" : "Dividendos"} />
                <Bar dataKey="gains" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="losses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dividends" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Realized gains table */}
        {gains.length > 0 && (
          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-card-foreground">Detalle de plusvalías/minusvalías</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha venta</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                  <TableHead className="text-right">Importe venta</TableHead>
                  <TableHead className="text-right">Coste FIFO</TableHead>
                  <TableHead className="text-right">+/- (€)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gains.map((g: any) => (
                  <TableRow key={g.id}>
                    <TableCell className="text-muted-foreground">{g.sell_date}</TableCell>
                    <TableCell className="font-semibold">{g.companies?.ticker || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{Number(g.shares_sold)}</TableCell>
                    <TableCell className="text-right font-mono">{Number(g.proceeds_base).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className="text-right font-mono">{Number(g.cost_basis_base).toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${Number(g.gain_loss_base) >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {Number(g.gain_loss_base) >= 0 ? "+" : ""}{Number(g.gain_loss_base).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
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
