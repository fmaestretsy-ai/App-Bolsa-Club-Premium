import { useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Loader2, Shield, PieChart as PieIcon, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#f59e0b", "#10b981",
];

export default function RiskControl() {
  const { user } = useAuth();

  const { data: positions = [], isLoading } = useQuery({
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

  const posCalc = useMemo(() => {
    return positions.map((p: any) => {
      const price = Number(p.companies?.current_price) || 0;
      const value = Number(p.shares) * price;
      return {
        ticker: p.companies?.ticker || "—",
        sector: p.companies?.sector || "Sin sector",
        country: p.companies?.country || "—",
        currency: p.companies?.currency || "USD",
        assetType: p.companies?.asset_type || "stock",
        value,
      };
    }).sort((a, b) => b.value - a.value);
  }, [positions]);

  const totalValue = posCalc.reduce((s, p) => s + p.value, 0);

  // Concentration metrics
  const top1Weight = totalValue > 0 && posCalc.length > 0 ? (posCalc[0].value / totalValue) * 100 : 0;
  const top5Value = posCalc.slice(0, 5).reduce((s, p) => s + p.value, 0);
  const top5Weight = totalValue > 0 ? (top5Value / totalValue) * 100 : 0;

  // Liquidity (cash/money market positions)
  const liquidityValue = posCalc.filter((p) => p.assetType === "cash").reduce((s, p) => s + p.value, 0);
  const liquidityRatio = totalValue > 0 ? (liquidityValue / totalValue) * 100 : 0;

  // Build exposure maps
  const buildExposure = (key: "sector" | "country" | "currency") => {
    const map = new Map<string, number>();
    posCalc.forEach((p) => {
      const k = p[key];
      map.set(k, (map.get(k) || 0) + p.value);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  };

  const sectorData = buildExposure("sector");
  const countryData = buildExposure("country");
  const currencyData = buildExposure("currency");

  // Risk level
  const riskLevel = top1Weight > 30 ? "Alto" : top1Weight > 20 ? "Medio" : "Bajo";
  const riskColor = top1Weight > 30 ? "text-red-500" : top1Weight > 20 ? "text-yellow-500" : "text-green-500";

  const ExposurePie = ({ data, title }: { data: typeof sectorData; title: string }) => (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
        <PieIcon className="h-4 w-4" /> {title}
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Sin datos</p>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-40 w-40 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(v: number) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            {data.slice(0, 6).map((entry, i) => (
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
  );

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
        <h1 className="text-2xl font-bold text-foreground">Control de Riesgo</h1>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Concentración top 1"
            value={`${top1Weight.toFixed(1)}%`}
            change={posCalc[0]?.ticker || "—"}
            icon={<Shield className="h-4 w-4" />}
          />
          <StatCard
            title="Concentración top 5"
            value={`${top5Weight.toFixed(1)}%`}
            icon={<Shield className="h-4 w-4" />}
          />
          <StatCard
            title="Liquidez"
            value={`${liquidityRatio.toFixed(1)}%`}
            icon={<Shield className="h-4 w-4" />}
          />
          <Card className="p-4 flex items-center gap-3">
            <AlertTriangle className={`h-6 w-6 ${riskColor}`} />
            <div>
              <p className="text-xs text-muted-foreground">Nivel de riesgo</p>
              <p className={`text-lg font-bold ${riskColor}`}>{riskLevel}</p>
            </div>
          </Card>
        </div>

        {/* Top positions bar */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">Concentración por posición</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={posCalc.slice(0, 10)} layout="vertical" margin={{ left: 50, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tickFormatter={(v) => `${((v / totalValue) * 100).toFixed(0)}%`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="ticker" stroke="hsl(var(--muted-foreground))" fontSize={11} width={50} />
                <Tooltip
                  formatter={(v: number) => [`${((v / totalValue) * 100).toFixed(1)}%`, "Peso"]}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }}
                />
                <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Exposure pies */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ExposurePie data={sectorData} title="Exposición sectorial" />
          <ExposurePie data={countryData} title="Exposición geográfica" />
          <ExposurePie data={currencyData} title="Exposición divisa" />
        </div>
      </div>
    </DashboardLayout>
  );
}
