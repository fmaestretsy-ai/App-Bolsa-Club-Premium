import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getCurrencySymbol } from "@/lib/currency";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type TrackingCompany = Database["public"]["Tables"]["companies"]["Row"];

function pctOf52w(current: number | null, high: number | null, low: number | null) {
  if (!current || !high || !low || high === low) return null;
  return ((current - low) / (high - low)) * 100;
}

function PriceBar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;

  const width = Math.min(100, Math.max(4, pct));
  const fillClass = pct <= 35 ? "bg-success" : "bg-warning";

  return (
    <div className="mx-auto w-24" aria-label={`${pct.toFixed(0)}% del rango de 52 semanas`}>
      <div className="h-4 w-full overflow-hidden rounded-sm border border-border bg-accent">
        <div className={`h-full rounded-r-sm ${fillClass}`} style={{ width: `${width}%` }} />
      </div>
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

  const { data: companies = [], isLoading } = useQuery<TrackingCompany[]>({
    queryKey: ["tracking-companies"],
    queryFn: async () => {
      const [{ data, error }, { data: uploads, error: uploadsError }] = await Promise.all([
        supabase
          .from("companies")
          .select("*")
          .order("name"),
        supabase
          .from("excel_uploads")
          .select("company_id")
          .not("company_id", "is", null),
      ]);
      if (error) throw error;
      if (uploadsError) throw uploadsError;

      const activeCompanyIds = new Set((uploads ?? []).map((upload) => upload.company_id).filter(Boolean));
      return (data ?? []).filter((company) => activeCompanyIds.has(company.id));
    },
    enabled: !!user,
  });

  const refreshPrice = async (company: TrackingCompany) => {
    setRefreshingId(company.id);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-stock-price", {
        body: { ticker: company.ticker, currency: company.currency },
      });
      if (error) throw error;
      if (data?.success && data.data?.price) {
        const newPrice = data.data.price;
        const sym = getCurrencySymbol(company.currency);
        const updateFields: Database["public"]["Tables"]["companies"]["Update"] = {
          current_price: newPrice,
          week_52_high: data.data.week52High,
          week_52_low: data.data.week52Low,
          sector: data.data.sector || company.sector || null,
          last_price_update: new Date().toISOString(),
        };

        // Recalculate estimated_annual_return based on new price and target_price_5y
        if (company.target_price_5y && newPrice > 0) {
          const years = 5;
          const newReturn = Math.pow(company.target_price_5y / newPrice, 1 / years) - 1;
          updateFields.estimated_annual_return = newReturn;

          // Recalculate price_for_15_return (discount target by 15% CAGR)
          const targetReturn = 0.15;
          updateFields.price_for_15_return = company.target_price_5y / Math.pow(1 + targetReturn, years);
        }

        const { error: updateError } = await supabase
          .from("companies")
          .update(updateFields)
          .eq("id", company.id);

        if (updateError) throw updateError;

        queryClient.invalidateQueries({ queryKey: ["tracking-companies"] });
        toast.success(`${company.ticker}: ${sym}${newPrice}`);
      } else {
        toast.error(`No se pudo obtener precio para ${company.ticker}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al obtener precio");
    } finally {
      setRefreshingId(null);
    }
  };

  const refreshAll = async () => {
    for (const company of companies) {
      await refreshPrice(company);
      await new Promise((resolve) => setTimeout(resolve, 1500));
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
            <p className="mt-1 text-sm text-muted-foreground">
              {isEs ? "Empresas Pilares IDC : Seguimiento" : "IDC Core Companies : Tracking"}
            </p>
          </div>
          <Button onClick={refreshAll} variant="outline" size="sm" disabled={!!refreshingId}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshingId ? "animate-spin" : ""}`} />
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
                  <TableHead className="text-center font-semibold text-primary">{isEs ? "% Cotización últimas 52 sem" : "52W Range %"}</TableHead>
                  <TableHead className="text-center font-semibold text-primary">{isEs ? "% Retorno anual est." : "Est. Annual Return"}</TableHead>
                  <TableHead className="text-right font-semibold text-primary">{isEs ? "Precio 15% anual" : "Price for 15%"}</TableHead>
                  <TableHead className="text-right font-semibold text-primary">{isEs ? "Precio actual" : "Current Price"}</TableHead>
                  <TableHead className="text-right font-semibold text-primary">{isEs ? "Obj. 5 años" : "5Y Target"}</TableHead>
                  <TableHead className="text-center font-semibold text-primary">{isEs ? "Divisa" : "Currency"}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-12 text-center text-muted-foreground">
                      {isEs ? "No hay empresas. Sube un Excel primero." : "No companies. Upload an Excel first."}
                    </TableCell>
                  </TableRow>
                ) : (
                  [...companies]
                    .sort((a, b) => (b.estimated_annual_return ?? -999) - (a.estimated_annual_return ?? -999))
                    .map((company) => {
                      const pct52 = pctOf52w(company.current_price, company.week_52_high, company.week_52_low);
                      return (
                        <TableRow
                          key={company.id}
                          className="cursor-pointer transition-colors hover:bg-accent/50"
                          onClick={() => navigate(`/companies/${company.id}`)}
                        >
                          <TableCell className="font-medium text-foreground">{company.name}</TableCell>
                          <TableCell className="font-mono text-sm text-muted-foreground">{company.ticker}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{company.sector || "—"}</TableCell>
                          <TableCell className="text-center">
                            <PriceBar pct={pct52} />
                          </TableCell>
                          <TableCell className="text-center">
                            {company.estimated_annual_return != null ? (
                              <Badge
                                variant={company.estimated_annual_return >= 0.15 ? "default" : company.estimated_annual_return >= 0.1 ? "secondary" : "destructive"}
                                className="text-xs"
                              >
                                {fmtPct(company.estimated_annual_return)}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmt(company.price_for_15_return)}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-medium">{fmt(company.current_price)}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{fmt(company.target_price_5y)}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-xs">{company.currency}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation();
                                refreshPrice(company);
                              }}
                              disabled={refreshingId === company.id}
                            >
                              {refreshingId === company.id ? (
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
