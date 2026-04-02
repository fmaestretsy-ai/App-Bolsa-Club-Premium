import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { useCompanies, useCompanyAssumptions } from "@/hooks/useCompanyData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const FIELDS = [
  { key: "target_pe", label: "Target P/E Ratio", unit: "x", default: 25 },
  { key: "fcf_multiple", label: "FCF Multiple", unit: "x", default: 15 },
  { key: "revenue_growth_rate", label: "Revenue Growth Rate", unit: "%", default: 5 },
  { key: "net_margin_target", label: "Net Margin Target", unit: "%", default: 15 },
  { key: "discount_rate", label: "Discount Rate (WACC)", unit: "%", default: 10 },
  { key: "terminal_growth_rate", label: "Terminal Growth Rate", unit: "%", default: 3 },
  { key: "conservative_discount", label: "Conservative Discount", unit: "%", default: 15 },
  { key: "optimistic_premium", label: "Optimistic Premium", unit: "%", default: 15 },
] as const;

type FieldKey = typeof FIELDS[number]["key"];

export default function Assumptions() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies = [], isLoading } = useCompanies();
  const [selectedId, setSelectedId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const companyId = selectedId || companies[0]?.id;
  const { data: assumptions, isLoading: loadingAssumptions } = useCompanyAssumptions(companyId);

  const [values, setValues] = useState<Record<FieldKey, string>>(() => {
    const init: Record<string, string> = {};
    FIELDS.forEach((f) => (init[f.key] = String(f.default)));
    return init as Record<FieldKey, string>;
  });

  useEffect(() => {
    if (assumptions) {
      const updated: Record<string, string> = {};
      FIELDS.forEach((f) => {
        const val = assumptions[f.key as keyof typeof assumptions];
        updated[f.key] = val != null ? String(val) : String(f.default);
      });
      setValues(updated as Record<FieldKey, string>);
    } else {
      const init: Record<string, string> = {};
      FIELDS.forEach((f) => (init[f.key] = String(f.default)));
      setValues(init as Record<FieldKey, string>);
    }
  }, [assumptions]);

  const handleSave = async () => {
    if (!user || !companyId) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        user_id: user.id,
        company_id: companyId,
      };
      FIELDS.forEach((f) => {
        payload[f.key] = parseFloat(values[f.key]) || f.default;
      });

      if (assumptions?.id) {
        const { error } = await supabase
          .from("company_assumptions")
          .update(payload)
          .eq("id", assumptions.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_assumptions")
          .insert(payload as any);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["assumptions", companyId] });
      toast.success("Supuestos guardados");
    } catch (err: any) {
      toast.error(err.message || "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("nav.assumptions")}</h1>
          <Select value={companyId || ""} onValueChange={setSelectedId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
            <SelectContent>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {companies.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Sube un Excel para configurar supuestos de valoración</p>
          </Card>
        ) : (
          <Card className="p-6">
            <h3 className="font-semibold text-card-foreground mb-6">Supuestos de valoración</h3>
            {loadingAssumptions ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <Label className="text-sm text-muted-foreground">{f.label}</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={values[f.key]}
                          onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          className="font-mono"
                          type="number"
                          step="0.1"
                        />
                        <span className="text-sm text-muted-foreground w-6 shrink-0">{f.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {t("common.save")}
                  </Button>
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
