import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

function pctOf52w(current: number | null, high: number | null, low: number | null) {
  if (!current || !high || !low || high === low) return null;
  return ((current - low) / (high - low)) * 100;
}

function PriceBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted-foreground text-xs">—</span>;
  // Color: green when low in range (cheap), yellow mid, orange/red near high (expensive)
  const getColor = (p: number) => {
    if (p <= 33) return "bg-green-500";
    if (p <= 66) return "bg-yellow-500";
    return "bg-orange-500";
  };
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="w-24 h-3 bg-muted rounded-sm overflow-hidden relative">
        <div
          className={`h-full rounded-sm ${getColor(pct)}`}
          style={{ width: `${Math.min(100, Math.max(2, pct))}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-foreground whitespace-nowrap">{pct.toFixed(0)}%</span>
    </div>
  );
}

export default function Tracking() {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const isEs = i18n.language === "es";

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["tracking-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const refreshPrice = async (company: any) => {
    setRefreshingId(company.id);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-stock-price", {
        body: { ticker: company.ticker },
      });
      if (error) throw error;
      if (data?.success && data.data?.price) {
        const updateFields: any = {
          current_price: data.data.price,
          week_52_high: data.data.week52High,
          week_52_low: data.data.week52Low,
          last_price_update: new Date().toISOString(),
        };
        if (data.data.sector && !company.sector) {
          updateFields.sector = data.data.sector;
        }
        await supabase.from("companies").update(updateFields).eq("id", company.id);
        queryClient.invalidateQueries({ queryKey: ["tracking-companies"] });
        toast.success(`${company.ticker}: $${data.data.price}`);
      } else {
        toast.error(`No se pudo obtener precio para ${company.ticker}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Error al obtener precio");
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshAll = async () => {
    for (const c of companies) {
      await refreshPrice(c);
      await new Promise(r => setTimeout(r, 1500)); // Rate limit
    }
  };

  const fmt = (val: number | null | undefined, decimals = 0) => {
    if (val == null) return "—";
    return val.toLocaleString(isEs ? "es-ES" : "en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const fmtPct = (val: number | null | undefined) => {
    if (val == null) return "—";
    const pct = val > 1 ? val : val * 100;
    return `${pct.toFixed(0)}%`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isEs ? "Seguimiento Empresas Pilares" : "Core Companies Tracking"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isEs ? "Empresas Pilares IDC : Seguimiento" : "IDC Core Companies : Tracking"}
            </p>
          </div>
          <Button onClick={refreshAll} variant="outline" size="sm" disabled={!!refreshingId}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshingId ? "animate-spin" : ""}`} />
            {isEs ? "Actualizar precios" : "Refresh prices"}
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5">
                  <TableHead className="font-semibold text-primary">{isEs ? "Empresa" : "Company"}</TableHead>
                  <TableHead className="font-semibold text-primary">Ticker</TableHead>
                  <TableHead className="font-semibold text-primary">{isEs ? "Industria" : "Industry"}</TableHead>
                  <TableHead className="font-semibold text-primary text-center">{isEs ? "% Cotización 52 sem" : "52W Range %"}</TableHead>
                  <TableHead className="font-semibold text-primary text-center">{isEs ? "% Retorno anual est." : "Est. Annual Return"}</TableHead>
                  <TableHead className="font-semibold text-primary text-right">{isEs ? "Precio 15% anual" : "Price for 15%"}</TableHead>
                  <TableHead className="font-semibold text-primary text-right">{isEs ? "Precio actual" : "Current Price"}</TableHead>
                  <TableHead className="font-semibold text-primary text-right">{isEs ? "Obj. 5 años" : "5Y Target"}</TableHead>
                  <TableHead className="font-semibold text-primary text-center">{isEs ? "Divisa" : "Currency"}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      {isEs ? "No hay empresas. Sube un Excel primero." : "No companies. Upload an Excel first."}
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((c: any) => {
                    const pct52 = pctOf52w(c.current_price, c.week_52_high, c.week_52_low);
                    const annualReturn = c.estimated_annual_return;
                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => navigate(`/companies/${c.id}`)}
                      >
                        <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{c.ticker}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.sector || "—"}</TableCell>
                        <TableCell className="text-center">
                          <PriceBar pct={pct52} />
                        </TableCell>
                        <TableCell className="text-center">
                          {annualReturn != null ? (
                            <Badge variant={annualReturn >= 15 ? "default" : annualReturn >= 10 ? "secondary" : "destructive"} className="text-xs">
                              {fmtPct(annualReturn)}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(c.price_for_15_return)}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-medium">{fmt(c.current_price)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmt(c.target_price_5y)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{c.currency}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); refreshPrice(c); }}
                            disabled={refreshingId === c.id}
                          >
                            {refreshingId === c.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground">
          {isEs
            ? "Fuente: Google Finance; Plantillas de valoración de los clubs de inversión"
            : "Source: Google Finance; Investment club valuation templates"}
        </p>
      </div>
    </DashboardLayout>
  );
}
