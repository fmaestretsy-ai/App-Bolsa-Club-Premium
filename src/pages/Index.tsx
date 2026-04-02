import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Building2, TrendingUp, Briefcase, Eye } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const mockChartData = [
  { month: "Jan", value: 45000 }, { month: "Feb", value: 52000 }, { month: "Mar", value: 48000 },
  { month: "Apr", value: 61000 }, { month: "May", value: 55000 }, { month: "Jun", value: 67000 },
  { month: "Jul", value: 72000 }, { month: "Aug", value: 69000 }, { month: "Sep", value: 78000 },
];

const mockOpportunities = [
  { name: "Apple Inc.", ticker: "AAPL", upside: 24.5, price: "$182.50" },
  { name: "Microsoft", ticker: "MSFT", upside: 18.2, price: "$378.90" },
  { name: "Alphabet", ticker: "GOOGL", upside: 31.0, price: "$141.20" },
  { name: "Amazon", ticker: "AMZN", upside: 15.8, price: "$178.30" },
];

export default function Dashboard() {
  const { t } = useTranslation();

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title={t("dashboard.totalCompanies")} value="12" change="+2 this month" changeType="gain" icon={<Building2 className="h-4 w-4" />} />
          <StatCard title={t("dashboard.avgUpside")} value="+22.4%" change="+3.1% vs last month" changeType="gain" icon={<TrendingUp className="h-4 w-4" />} />
          <StatCard title={t("dashboard.portfolioValue")} value="$128,450" change="+$12,340 (10.6%)" changeType="gain" icon={<Briefcase className="h-4 w-4" />} />
          <StatCard title={t("dashboard.watchlistAlerts")} value="3" change="2 undervalued" changeType="neutral" icon={<Eye className="h-4 w-4" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="col-span-1 lg:col-span-2 p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">{t("dashboard.portfolioOverview")}</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={mockChartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(220, 10%, 46%)" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(220, 10%, 46%)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(222, 25%, 11%)", border: "1px solid hsl(222, 20%, 18%)", borderRadius: "8px", color: "hsl(220, 15%, 90%)" }} />
                  <Area type="monotone" dataKey="value" stroke="hsl(217, 91%, 60%)" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">{t("dashboard.topOpportunities")}</h3>
            <div className="space-y-3">
              {mockOpportunities.map((opp) => (
                <div key={opp.ticker} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-foreground">{opp.ticker}</p>
                    <p className="text-xs text-muted-foreground">{opp.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gain">+{opp.upside}%</p>
                    <p className="text-xs text-muted-foreground">{opp.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
