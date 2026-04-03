import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Trash2 } from "lucide-react";
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseExcelFile, computeFileHash, type ParsedFinancialData } from "@/lib/excelParser";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

export default function ExcelUpload() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: uploads = [] } = useQuery({
    queryKey: ["excel-uploads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excel_uploads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (upload: { id: string; file_path: string | null }) => {
      if (upload.file_path) {
        await supabase.storage.from("excel-uploads").remove([upload.file_path]);
      }

      const { error } = await supabase.from("excel_uploads").delete().eq("id", upload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excel-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["tracking-companies"] });
      queryClient.invalidateQueries({ queryKey: ["version-history"] });
      toast.success("Archivo eliminado");
    },
  });

  const processFile = useCallback(async (file: File) => {
    if (!user) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error("Formato no soportado. Usa .xlsx o .xls");
      return;
    }

    setIsProcessing(true);
    try {
      const buffer = await file.arrayBuffer();
      const fileHash = await computeFileHash(buffer);

      const { data: existing } = await supabase
        .from("excel_uploads")
        .select("id")
        .eq("file_hash", fileHash)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        toast.warning(t("upload.duplicate"));
        setIsProcessing(false);
        return;
      }

      let parsed: ParsedFinancialData;
      try {
        parsed = parseExcelFile(buffer, file.name);
      } catch (e) {
        toast.error("Error al parsear el archivo Excel");
        setIsProcessing(false);
        return;
      }

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("excel-uploads")
        .upload(filePath, file);

      if (storageError) throw storageError;

      let companyId: string | null = null;
      if (parsed.ticker) {
        const { data: existingCompany } = await supabase
          .from("companies")
          .select("id")
          .eq("ticker", parsed.ticker)
          .eq("user_id", user.id)
          .maybeSingle();

        if (existingCompany) {
          companyId = existingCompany.id;
          await supabase.from("companies").update({
            sector: parsed.sector || undefined,
            currency: parsed.currency ?? undefined,
            target_price_5y: parsed.targetPrice5y,
            price_for_15_return: parsed.priceFor15Return,
            estimated_annual_return: parsed.estimatedAnnualReturn,
            current_price: parsed.currentPrice,
          } as any).eq("id", existingCompany.id);
        } else {
          const { data: newCompany, error: companyError } = await supabase
            .from("companies")
            .insert({
              user_id: user.id,
              ticker: parsed.ticker,
              name: parsed.companyName || parsed.ticker,
              sector: parsed.sector,
              currency: parsed.currency ?? 'USD',
              target_price_5y: parsed.targetPrice5y,
              price_for_15_return: parsed.priceFor15Return,
              estimated_annual_return: parsed.estimatedAnnualReturn,
              current_price: parsed.currentPrice,
            } as any)
            .select("id")
            .single();
          if (companyError) throw companyError;
          companyId = newCompany.id;
        }
      }

      const { data: uploadRecord, error: uploadError } = await supabase
        .from("excel_uploads")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_hash: fileHash,
          detected_company: parsed.companyName,
          detected_ticker: parsed.ticker,
          company_id: companyId,
          status: parsed.periods.length > 0 ? "success" : "no_data",
          periods_extracted: parsed.periods.length,
        })
        .select("id")
        .single();

      if (uploadError) throw uploadError;

      // Insert financial periods (historical)
      if (companyId && parsed.periods.length > 0) {
        await supabase
          .from("financial_periods")
          .delete()
          .eq("company_id", companyId)
          .eq("user_id", user.id);

        const periodsToInsert = parsed.periods.map((p) => ({
          user_id: user.id,
          company_id: companyId!,
          upload_id: uploadRecord.id,
          fiscal_year: p.fiscalYear,
          revenue: p.revenue,
          ebitda: p.ebitda,
          ebit: p.ebit,
          net_income: p.netIncome,
          fcf: p.fcf,
          margin_ebitda: p.marginEbitda,
          margin_net: p.marginNet,
          margin_fcf: p.marginFcf,
          total_debt: p.totalDebt,
          cash: p.cash,
          net_debt: p.netDebt,
          diluted_shares: p.dilutedShares,
          capex: p.capex,
          roe: p.roe,
          roic: p.roic,
          eps: p.eps,
          bvps: p.bvps,
          fcf_per_share: p.fcfPerShare,
          pe_ratio: p.peRatio,
          ev_ebitda: p.evEbitda,
          p_fcf: p.pFcf,
          revenue_growth: p.revenueGrowth,
          net_income_growth: p.netIncomeGrowth,
          fcf_growth: p.fcfGrowth,
          dividend_per_share: p.dividendPerShare,
          interest_expense: p.interestExpense,
          interest_income: p.interestIncome,
          tax_expense: p.taxExpense,
          inventories: p.inventories,
          accounts_receivable: p.accountsReceivable,
          accounts_payable: p.accountsPayable,
          unearned_revenue: p.unearnedRevenue,
        }));

        const { error: periodsError } = await supabase
          .from("financial_periods")
          .insert(periodsToInsert);

        if (periodsError) throw periodsError;
      }

      // Insert projection years with full financial data
      if (companyId) {
        await supabase
          .from("projection_years")
          .delete()
          .eq("company_id", companyId)
          .eq("user_id", user.id);

        const projRows: any[] = [];

        // Merge projectedData with projectionTargets (EV/FCF target prices)
        const allProjYears = new Set([
          ...parsed.projectedData.map(p => p.year),
          ...parsed.projectionTargets.map(p => p.year),
        ]);

        for (const year of allProjYears) {
          const pd = parsed.projectedData.find(p => p.year === year);
          const pt = parsed.projectionTargets.find(p => p.year === year);
          projRows.push({
            user_id: user.id,
            company_id: companyId!,
            projection_year: year,
            target_price: pt?.targetPrice ?? null,
            ebitda: pd?.ebitda ?? null,
            ebit: pd?.ebit ?? null,
            net_income: pd?.netIncome ?? null,
            fcf: pd?.fcf ?? null,
            net_debt: pd?.netDebt ?? null,
            market_cap: pd?.marketCap ?? null,
            ev: pd?.ev ?? null,
            diluted_shares: pd?.dilutedShares ?? null,
          });
        }

        if (projRows.length > 0) {
          await supabase.from("projection_years").insert(projRows);
        }

        // Save valuation target multiples in company_assumptions
        const vt = parsed.valuationTargets;
        if (vt.targetPer || vt.targetEvFcf || vt.targetEvEbitda || vt.targetEvEbit) {
          const { data: existingAssumptions } = await supabase
            .from("company_assumptions")
            .select("id")
            .eq("company_id", companyId)
            .eq("user_id", user.id)
            .maybeSingle();

          const assumptionData: any = {
            target_pe: vt.targetPer,
            fcf_multiple: vt.targetEvFcf,
            ev_ebitda_multiple: vt.targetEvEbitda,
            ev_ebit_multiple: vt.targetEvEbit,
            target_return_rate: vt.targetReturnRate != null ? vt.targetReturnRate * 100 : 15,
          };

          if (existingAssumptions) {
            await supabase.from("company_assumptions").update(assumptionData).eq("id", existingAssumptions.id);
          } else {
            await supabase.from("company_assumptions").insert({
              ...assumptionData,
              user_id: user.id,
              company_id: companyId,
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["tracking-companies"] });
      queryClient.invalidateQueries({ queryKey: ["projection-years"] });
      queryClient.invalidateQueries({ queryKey: ["assumptions"] });

      // Auto-fetch price from API after upload
      if (companyId && parsed.ticker) {
        try {
          const { data: priceData } = await supabase.functions.invoke("fetch-stock-price", {
            body: { ticker: parsed.ticker },
          });
          if (priceData?.success && priceData.data?.price) {
            await supabase.from("companies").update({
              current_price: priceData.data.price,
              week_52_high: priceData.data.week52High,
              week_52_low: priceData.data.week52Low,
              sector: priceData.data.sector || undefined,
              last_price_update: new Date().toISOString(),
            }).eq("id", companyId);
            queryClient.invalidateQueries({ queryKey: ["tracking-companies"] });
          }
        } catch (e) {
          console.warn("Auto price fetch failed:", e);
        }
      }
      toast.success(
        `${t("upload.success")} — ${parsed.periods.length} períodos extraídos${parsed.ticker ? ` para ${parsed.ticker}` : ""}`
      );
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Error al procesar el archivo");
    } finally {
      setIsProcessing(false);
    }
  }, [user, t, queryClient]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const statusConfig: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
    success: { label: "Completado", variant: "default" },
    no_data: { label: "Sin datos", variant: "secondary" },
    pending: { label: "Pendiente", variant: "secondary" },
    error: { label: "Error", variant: "destructive" },
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">{t("upload.title")}</h1>

        <Card
          className={`p-12 border-2 border-dashed transition-colors cursor-pointer ${
            isDragging ? "border-primary bg-accent" : "border-border hover:border-primary/50"
          } ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileSelect}
          />
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground mb-4">
              {isProcessing ? (
                <Loader2 className="h-7 w-7 animate-spin" />
              ) : (
                <Upload className="h-7 w-7" />
              )}
            </div>
            <p className="text-base font-medium text-foreground">
              {isProcessing ? t("upload.processing") : t("upload.dragDrop")}
            </p>
            {!isProcessing && (
              <>
                <p className="text-sm text-muted-foreground mt-1">{t("upload.orBrowse")}</p>
                <p className="text-xs text-muted-foreground mt-3">{t("upload.supportedFormats")}</p>
              </>
            )}
          </div>
        </Card>

        {uploads.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Historial de uploads</h3>
            <div className="space-y-2">
              {uploads.map((u) => {
                const status = statusConfig[u.status] || statusConfig.pending;
                return (
                  <Card key={u.id} className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{u.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {u.detected_ticker && <span className="font-medium">{u.detected_ticker}</span>}
                        {u.detected_company && ` · ${u.detected_company}`}
                        {` · ${u.periods_extracted} períodos`}
                        {` · ${new Date(u.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    {u.status === "success" && (
                      <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                    )}
                    {u.status === "error" && (
                      <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                       onClick={() => deleteMutation.mutate({ id: u.id, file_path: u.file_path })}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
