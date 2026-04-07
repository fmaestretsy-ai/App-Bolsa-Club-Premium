import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Briefcase, TrendingUp, DollarSign, Loader2, ArrowUpDown, Search } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TradeDialog } from "@/components/TradeDialog";

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))", "#6366f1", "#f59e0b", "#10b981",
];

type SortKey = "ticker" | "currentValue" | "gl" | "glPct" | "weight";
type SortDir = "asc" | "desc";

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
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("currentValue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [exposureView, setExposureView] = useState<"ticker" | "sector" | "country" | "currency">("ticker");

  const portfolioId = selectedPortfolio || portfolios[0]?.id;

  const { data: positions = [] } = useQuery({
    queryKey: ["portfolio-positions", portfolioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_positions")
        .select("*, companies(name, ticker, current_price, currency, sector, country, asset_type)")
        .eq("portfolio_id", portfolioId!);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!portfolioId,
  });

  // Dividends received
  const { data: dividends = [] } = useQuery({
    queryKey: ["portfolio-dividends", portfolioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("total")
        .eq("portfolio_id", portfolioId!)
        .eq("trade_type", "dividend");
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!portfolioId,
  });

  const totalDividends = dividends.reduce((s: number, d: any) => s + Number(d.total), 0);

  const positionsWithCalc = useMemo(() => {
    return positions.map((p: any) => {
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
        sector: p.companies?.sector || "Sin sector",
        country: p.companies?.country || "—",
        assetCurrency: p.companies?.currency || "USD",
        assetType: p.companies?.asset_type || "stock",
        currentPrice,
        shares,
        avgCost,
        currentValue,
        costBasis,
        gl,
        glPct,
        weight: 0, // calculated below
      };
    });
  }, [positions]);

  const totalValue = positionsWithCalc.reduce((s, p) => s + p.currentValue, 0);
  const totalCost = positionsWithCalc.reduce((s, p) => s + p.costBasis, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  // Assign weights
  positionsWithCalc.forEach((p) => {
    p.weight = totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0;
  });

  // Filter and sort
  const filtered = useMemo(() => {
    let result = [...positionsWithCalc];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((p) => p.ticker.toLowerCase().includes(q) || p.name.toLowerCase().includes(q));
    }
    result.sort((a, b) => {
      const va = a[sortKey] as number | string;
      const vb = b[sortKey] as number | string;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [positionsWithCalc, search, sortKey, sortDir]);

  // Exposure charts data
  const exposureData = useMemo(() => {
    const map = new Map<string, number>();
    positionsWithCalc.forEach((p) => {
      let key: string;
      switch (exposureView) {
        case "sector": key = p.sector; break;
        case "country": key = p.country; break;
        case "currency": key = p.assetCurrency; break;
        default: key = p.ticker;
      }
      map.set(key, (map.get(key) || 0) + p.currentValue);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: totalValue > 0 ? (value / totalValue) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [positionsWithCalc, exposureView, totalValue]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortHeader = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <TableHead className={`cursor-pointer select-none ${className}`} onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("portfolio.title")}</h1>
          <div className="flex gap-2">
            {portfolios.length > 1 && (
              <Select value={portfolioId || ""} onValueChange={setSelectedPortfolio}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <TradeDialog />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title={t("portfolio.totalValue")}
            value={`$${totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
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
            title="Posiciones"
            value={String(positionsWithCalc.length)}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <StatCard
            title="Dividendos cobrados"
            value={`$${totalDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            icon={<DollarSign className="h-4 w-4" />}
          />
        </div>

        {positionsWithCalc.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Sin posiciones. Registra una operación para comenzar.</p>
          </Card>
        ) : (
          <>
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar ticker o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Positions Table */}
            <Card className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortHeader k="ticker">Ticker</SortHeader>
                    <TableHead className="hidden sm:table-cell">{t("companies.name")}</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Sector</TableHead>
                    <TableHead className="text-right">{t("portfolio.shares")}</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">{t("portfolio.avgCost")}</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Precio</TableHead>
                    <SortHeader k="currentValue" className="text-right">Valor</SortHeader>
                    <SortHeader k="weight" className="text-right">Peso</SortHeader>
                    <SortHeader k="gl" className="text-right">P&L</SortHeader>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.ticker}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground truncate max-w-[140px]">{p.name}</TableCell>
                      <TableCell className="text-right hidden md:table-cell text-muted-foreground text-xs">{p.sector}</TableCell>
                      <TableCell className="text-right font-mono">{p.shares}</TableCell>
                      <TableCell className="text-right font-mono hidden sm:table-cell">${p.avgCost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono hidden sm:table-cell">${p.currentPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">${p.currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</TableCell>
                      <TableCell className="text-right font-mono">{p.weight.toFixed(1)}%</TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${p.gl >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {p.gl >= 0 ? "+" : ""}{p.gl.toFixed(0)} ({p.glPct.toFixed(1)}%)
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* Exposure Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-card-foreground">Exposición</h3>
                  <Select value={exposureView} onValueChange={(v: any) => setExposureView(v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ticker">Por activo</SelectItem>
                      <SelectItem value="sector">Por sector</SelectItem>
                      <SelectItem value="country">Por país</SelectItem>
                      <SelectItem value="currency">Por divisa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-52 w-52 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={exposureData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2} dataKey="value">
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
                    {exposureData.slice(0, 8).map((entry, i) => (
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
              </Card>

              {/* Bar Chart */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold text-card-foreground mb-4">Valor por posición</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filtered.slice(0, 10)} layout="vertical" margin={{ left: 50, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis type="category" dataKey="ticker" stroke="hsl(var(--muted-foreground))" fontSize={11} width={45} />
                      <Tooltip
                        formatter={(value: number) => `$${value.toLocaleString()}`}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--card-foreground))" }}
                      />
                      <Bar dataKey="currentValue" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
