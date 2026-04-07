import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Building2, TrendingUp, Briefcase, Eye, Loader2, DollarSign, PieChart as PieIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanyData";
import { calculateValuation, getRecommendation } from "@/lib/valuationEngine";
import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#f59e0b", "#10b981",
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: companies = [], isLoading } = useCompanies();
  const [exposureView, setExposureView] = useState<"sector" | "country" | "currency">("sector");

  const { data: allPeriods = [] } = useQuery({
    queryKey: ["all-financial-periods"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_periods").select("*").order("fiscal_year", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: watchlistItems = [] } = useQuery({
    queryKey: ["watchlist-items-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("watchlist_items").select("id");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["all-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_positions")
        .select("*, companies(name, ticker, current_price, currency, sector, country, asset_type)");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Dividends total
  const { data: dividendTrades = [] } = useQuery({
    queryKey: ["dashboard-dividends"],
    queryFn: async () => {
      const { data, error } = await supabase.from("trades").select("total, trade_date").eq("trade_type", "dividend");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totalDividends = dividendTrades.reduce((s: number, d: any) => s + Number(d.total), 0);

  const opportunities = useMemo(() => {
    return companies
      .map((company) => {
        const companyPeriods = allPeriods.filter((p) => p.company_id === company.id);
        if (companyPeriods.length === 0 || !company.current_price) return null;
        const last = companyPeriods[companyPeriods.length - 1];
        const results = calculateValuation(
          {
            eps: Number(last.eps) || 0,
            fcfPerShare: Number(last.fcf_per_share) || 0,
            ebitda: Number(last.ebitda) || 0,
            ebit: Number(last.ebit) || 0,
            netDebt: Number(last.net_debt) || 0,
            dilutedShares: Number(last.diluted_shares) || 0,
            currentPrice: Number(company.current_price),
          },
          { targetPe: 25, fcfMultiple: 25, conservativeDiscount: 15, optimisticPremium: 15 }
        );
        const baseResults = results.filter((r) => r.scenarioType === "base");
        if (baseResults.length === 0) return null;
        const avgUpside = baseResults.reduce((s, r) => s + r.upside, 0) / baseResults.length;
        return {
          id: company.id, ticker: company.ticker, name: company.name,
          price: Number(company.current_price), upside: Math.round(avgUpside * 10) / 10,
          recommendation: getRecommendation(avgUpside),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.upside - a!.upside) as Array<{ id: string; ticker: string; name: string; price: number; upside: number; recommendation: string }>;
  }, [companies, allPeriods]);

  // Portfolio calculations
  const positionsCalc = useMemo(() => {
    return positions.map((p: any) => {
      const price = Number(p.companies?.current_price) || 0;
      const shares = Number(p.shares);
      const avgCost = Number(p.avg_cost);
      const value = shares * price;
      return {
        ticker: p.companies?.ticker || "—",
        sector: p.companies?.sector || "Sin sector",
        country: p.companies?.country || "—",
        currency: p.companies?.currency || "USD",
        value,
        cost: shares * avgCost,
      };
    });
  }, [positions]);

  const totalPortfolioValue = positionsCalc.reduce((s, p) => s + p.value, 0);
  const totalCost = positionsCalc.reduce((s, p) => s + p.cost, 0);
  const totalGain = totalPortfolioValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Exposure data
  const exposureData = useMemo(() => {
    const map = new Map<string, number>();
    positionsCalc.forEach((p) => {
      const key = exposureView === "sector" ? p.sector : exposureView === "country" ? p.country : p.currency;
      map.set(key, (map.get(key) || 0) + p.value);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: totalPortfolioValue > 0 ? (value / totalPortfolioValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [positionsCalc, exposureView, totalPortfolioValue]);

  const avgUpside = opportunities.length > 0
    ? (opportunities.reduce((s, o) => s + o.upside, 0) / opportunities.length).toFixed(1) : "0";

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
        <h1 className="text-2xl font-bold text-foreground">{t("dashboard.title")}</h1>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title={t("dashboard.portfolioValue")}
            value={`$${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <StatCard
            title={t("portfolio.totalGain")}
            value={`${totalGain >= 0 ? "+" : ""}$${totalGain.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            change={`${totalGainPct >= 0 ? "+" : ""}${totalGainPct.toFixed(1)}%`}
            changeType={totalGain >= 0 ? "gain" : "loss"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title="Dividendos"
            value={`$${totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            title={t("dashboard.totalCompanies")}
            value={String(companies.length)}
            icon={<Building2 className="h-4 w-4" />}
          />
          <StatCard
            title={t("dashboard.avgUpside")}
            value={`${Number(avgUpside) >= 0 ? "+" : ""}${avgUpside}%`}
            changeType={Number(avgUpside) >= 0 ? "gain" : "loss"}
            icon={<Eye className="h-4 w-4" />}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Exposure pie */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                <PieIcon className="h-4 w-4" /> Exposición
              </h3>
              <Select value={exposureView} onValueChange={(v: any) => setExposureView(v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sector">Por sector</SelectItem>
                  <SelectItem value="country">Por país</SelectItem>
                  <SelectItem value="currency">Por divisa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {exposureData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos de cartera</p>
            ) : (
              <div className="flex items-center gap-4">
                <div className="h-48 w-48 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={exposureData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                        {exposureData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 flex-1 min-w-0">
                  {exposureData.slice(0, 6).map((entry, i) => (
                    <div key={entry.name} className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <div className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground truncate">{entry.name}</span>
                      </div>
                      <span className="font-mono text-foreground flex-shrink-0">{entry.pct.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Top positions bar */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-4">Top posiciones por valor</h3>
            {positionsCalc.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin posiciones</p>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...positionsCalc].sort((a, b) => b.value - a.value).slice(0, 8)}
                    layout="vertical"
                    margin={{ left: 50, right: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis type="category" dataKey="ticker" stroke="hsl(var(--muted-foreground))" fontSize={11} width={45} />
                    <Tooltip
                      formatter={(value: number) => `$${value.toLocaleString()}`}
                      contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>

        {/* Opportunities */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">{t("dashboard.topOpportunities")}</h3>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sube un Excel para ver oportunidades de inversión</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {opportunities.slice(0, 6).map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => navigate(`/companies/${opp.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{opp.ticker}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">{opp.name}</p>
                  </div>
                  <div className="text-right">
                    <Badge className={opp.upside >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                      {opp.upside >= 0 ? "+" : ""}{opp.upside}%
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">${opp.price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
