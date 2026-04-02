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
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("excel_uploads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excel-uploads"] });
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

      // Check for duplicates
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

      // Parse the Excel file
      let parsed: ParsedFinancialData;
      try {
        parsed = parseExcelFile(buffer, file.name);
      } catch (e) {
        toast.error("Error al parsear el archivo Excel");
        setIsProcessing(false);
        return;
      }

      // Upload file to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("excel-uploads")
        .upload(filePath, file);

      if (storageError) throw storageError;

      // Find or create company
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
          // Update company with new data from Excel
          await supabase.from("companies").update({
            sector: parsed.sector || undefined,
            target_price_5y: parsed.targetPrice5y,
            price_for_15_return: parsed.priceFor15Return,
            estimated_annual_return: parsed.estimatedAnnualReturn,
          }).eq("id", existingCompany.id);
        } else {
          const { data: newCompany, error: companyError } = await supabase
            .from("companies")
            .insert({
              user_id: user.id,
              ticker: parsed.ticker,
              name: parsed.companyName || parsed.ticker,
              sector: parsed.sector,
              target_price_5y: parsed.targetPrice5y,
              price_for_15_return: parsed.priceFor15Return,
              estimated_annual_return: parsed.estimatedAnnualReturn,
            } as any)
            .select("id")
            .single();
          if (companyError) throw companyError;
          companyId = newCompany.id;
        }
      }

      // Create upload record
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

      // Insert financial periods
      if (companyId && parsed.periods.length > 0) {
        // Delete existing periods for this company to avoid duplicates
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
        }));

        const { error: periodsError } = await supabase
          .from("financial_periods")
          .insert(periodsToInsert);

        if (periodsError) throw periodsError;
      }

      queryClient.invalidateQueries({ queryKey: ["excel-uploads"] });
      queryClient.invalidateQueries({ queryKey: ["companies"] });
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
                      onClick={() => deleteMutation.mutate(u.id)}
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
