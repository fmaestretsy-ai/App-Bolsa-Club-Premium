import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Briefcase, Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const positions = [
  { ticker: "AAPL", name: "Apple Inc.", shares: 50, avgCost: 155.0, currentPrice: 182.5, currency: "USD" },
  { ticker: "MSFT", name: "Microsoft", shares: 20, avgCost: 310.0, currentPrice: 378.9, currency: "USD" },
  { ticker: "ASML", name: "ASML Holding", shares: 5, avgCost: 580.0, currentPrice: 680.0, currency: "EUR" },
];

const pieData = positions.map((p) => ({ name: p.ticker, value: p.shares * p.currentPrice }));
const COLORS = ["hsl(217, 91%, 60%)", "hsl(152, 69%, 45%)", "hsl(38, 92%, 55%)"];

export default function Portfolio() {
  const { t } = useTranslation();
  const totalValue = positions.reduce((s, p) => s + p.shares * p.currentPrice, 0);
  const totalCost = positions.reduce((s, p) => s + p.shares * p.avgCost, 0);
  const totalGain = totalValue - totalCost;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("portfolio.title")}</h1>
          <Button><Plus className="h-4 w-4 mr-2" />{t("portfolio.addPosition")}</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title={t("portfolio.totalValue")} value={`$${totalValue.toLocaleString()}`} icon={<Briefcase className="h-4 w-4" />} />
          <StatCard title={t("portfolio.totalGain")} value={`$${totalGain.toLocaleString()}`} change={`${((totalGain / totalCost) * 100).toFixed(1)}%`} changeType={totalGain >= 0 ? "gain" : "loss"} icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard title={t("portfolio.dividends")} value="$1,240" change="TTM" changeType="neutral" icon={<DollarSign className="h-4 w-4" />} />
        </div>

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
                {positions.map((p) => {
                  const gl = (p.currentPrice - p.avgCost) * p.shares;
                  const glPct = ((p.currentPrice - p.avgCost) / p.avgCost) * 100;
                  return (
                    <TableRow key={p.ticker}>
                      <TableCell className="font-semibold">{p.ticker}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{p.name}</TableCell>
                      <TableCell className="text-right font-mono">{p.shares}</TableCell>
                      <TableCell className="text-right font-mono">${p.avgCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${p.currentPrice.toFixed(2)}</TableCell>
                      <TableCell className={`text-right font-semibold ${gl >= 0 ? "text-gain" : "text-loss"}`}>
                        {gl >= 0 ? "+" : ""}${gl.toFixed(0)} ({glPct.toFixed(1)}%)
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <Card className="p-5 flex flex-col items-center">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Allocation</h3>
            <div className="h-48 w-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(222, 25%, 11%)", border: "1px solid hsl(222, 20%, 18%)", borderRadius: "8px", color: "hsl(220, 15%, 90%)" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2 w-full">
              {pieData.map((entry, i) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-mono text-foreground">{((entry.value / totalValue) * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
