import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatCard } from "@/components/StatCard";
import { Building2, TrendingUp, Briefcase, Eye, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useCompanies, useFinancialPeriods } from "@/hooks/useCompanyData";
import { calculateValuation, getRecommendation } from "@/lib/valuationEngine";
import { useMemo } from "react";

export default function Dashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: companies = [], isLoading } = useCompanies();

  // Get all financial periods for all companies
  const { data: allPeriods = [] } = useQuery({
    queryKey: ["all-financial-periods"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_periods")
        .select("*")
        .order("fiscal_year", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get watchlist items count
  const { data: watchlistItems = [] } = useQuery({
    queryKey: ["watchlist-items-count"],
    queryFn: async () => {
      const { data, error } = await supabase.from("watchlist_items").select("id");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get portfolio positions for total value
  const { data: positions = [] } = useQuery({
    queryKey: ["all-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_positions")
        .select("*, companies(current_price)");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Calculate opportunities (companies with valuation upside)
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
          id: company.id,
          ticker: company.ticker,
          name: company.name,
          price: Number(company.current_price),
          upside: Math.round(avgUpside * 10) / 10,
          recommendation: getRecommendation(avgUpside),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.upside - a!.upside) as Array<{
        id: string; ticker: string; name: string; price: number; upside: number; recommendation: string;
      }>;
  }, [companies, allPeriods]);

  const totalPortfolioValue = positions.reduce((sum, p: any) => {
    const price = Number(p.companies?.current_price) || 0;
    return sum + Number(p.shares) * price;
  }, 0);

  const avgUpside = opportunities.length > 0
    ? (opportunities.reduce((s, o) => s + o.upside, 0) / opportunities.length).toFixed(1)
    : "0";

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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t("dashboard.totalCompanies")}
            value={String(companies.length)}
            icon={<Building2 className="h-4 w-4" />}
          />
          <StatCard
            title={t("dashboard.avgUpside")}
            value={`${Number(avgUpside) >= 0 ? "+" : ""}${avgUpside}%`}
            changeType={Number(avgUpside) >= 0 ? "gain" : "loss"}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <StatCard
            title={t("dashboard.portfolioValue")}
            value={`$${totalPortfolioValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<Briefcase className="h-4 w-4" />}
          />
          <StatCard
            title={t("dashboard.watchlistAlerts")}
            value={String(watchlistItems.length)}
            icon={<Eye className="h-4 w-4" />}
          />
        </div>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">{t("dashboard.topOpportunities")}</h3>
          {opportunities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sube un Excel para ver oportunidades de inversión</p>
          ) : (
            <div className="space-y-3">
              {opportunities.slice(0, 6).map((opp) => (
                <div
                  key={opp.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                  onClick={() => navigate(`/companies/${opp.id}`)}
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{opp.ticker}</p>
                    <p className="text-xs text-muted-foreground">{opp.name}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${opp.upside >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {opp.upside >= 0 ? "+" : ""}{opp.upside}%
                    </p>
                    <p className="text-xs text-muted-foreground">${opp.price.toFixed(2)}</p>
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
