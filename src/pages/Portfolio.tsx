import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, TrendingUp, DollarSign, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

export default function Portfolio() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: portfolios = [], isLoading } = useQuery({
    queryKey: ["portfolios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("portfolios").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const portfolioId = selectedPortfolio || portfolios[0]?.id;

  const { data: positions = [] } = useQuery({
    queryKey: ["portfolio-positions", portfolioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_positions")
        .select("*, companies(name, ticker, current_price, currency)")
        .eq("portfolio_id", portfolioId!);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!portfolioId,
  });

  const positionsWithCalc = positions.map((p: any) => {
    const currentPrice = Number(p.companies?.current_price) || 0;
    const shares = Number(p.shares);
    const avgCost = Number(p.avg_cost);
    const currentValue = shares * currentPrice;
    const costBasis = shares * avgCost;
    const gl = currentValue - costBasis;
    const glPct = costBasis > 0 ? (gl / costBasis) * 100 : 0;
    return {
      ...p,
      ticker: p.companies?.ticker || "—",
      name: p.companies?.name || "—",
      currentPrice,
      shares,
      avgCost,
      currentValue,
      gl,
      glPct,
    };
  });

  const totalValue = positionsWithCalc.reduce((s, p) => s + p.currentValue, 0);
  const totalCost = positionsWithCalc.reduce((s, p) => s + p.shares * p.avgCost, 0);
  const totalGain = totalValue - totalCost;

  const pieData = positionsWithCalc
    .filter((p) => p.currentValue > 0)
    .map((p) => ({ name: p.ticker, value: p.currentValue }));

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
          <h1 className="text-2xl font-bold text-foreground">{t("portfolio.title")}</h1>
          {portfolios.length > 1 && (
            <Select value={portfolioId || ""} onValueChange={setSelectedPortfolio}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {portfolios.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title={t("portfolio.totalValue")} value={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} icon={<Briefcase className="h-4 w-4" />} />
          <StatCard
            title={t("portfolio.totalGain")}
            value={`${totalGain >= 0 ? "+" : ""}$${totalGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            change={totalCost > 0 ? `${((totalGain / totalCost) * 100).toFixed(1)}%` : undefined}
            changeType={totalGain >= 0 ? "gain" : "loss"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard title="Posiciones" value={String(positionsWithCalc.length)} icon={<DollarSign className="h-4 w-4" />} />
        </div>

        {positionsWithCalc.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Sin posiciones. Registra operaciones para verlas aquí.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="col-span-1 lg:col-span-2 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("companies.ticker")}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t("companies.name")}</TableHead>
                    <TableHead className="text-right">{t("portfolio.shares")}</TableHead>
                    <TableHead className="text-right">{t("portfolio.avgCost")}</TableHead>
                    <TableHead className="text-right">{t("companies.currentPrice")}</TableHead>
                    <TableHead className="text-right">P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positionsWithCalc.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.ticker}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{p.name}</TableCell>
                      <TableCell className="text-right font-mono">{p.shares}</TableCell>
                      <TableCell className="text-right font-mono">${p.avgCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${p.currentPrice.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-semibold ${p.gl >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {p.gl >= 0 ? "+" : ""}${p.gl.toFixed(0)} ({p.glPct.toFixed(1)}%)
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
            {pieData.length > 0 && (
              <Card className="p-5 flex flex-col items-center">
                <h3 className="text-sm font-semibold text-card-foreground mb-4">Allocation</h3>
                <div className="h-48 w-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2 w-full">
                  {pieData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground">{entry.name}</span>
                      </div>
                      <span className="font-mono text-foreground">
                        {totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
