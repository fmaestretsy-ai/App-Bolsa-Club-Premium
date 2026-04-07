import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, FileText, Edit, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanyData";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = { active: "Activa", reviewed: "Revisada", closed: "Cerrada" };
const STATUS_COLORS: Record<string, string> = { active: "bg-green-600 text-white", reviewed: "bg-blue-600 text-white", closed: "bg-muted text-muted-foreground" };

export default function InvestmentTheses() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const [form, setForm] = useState({
    companyId: "", buyRationale: "", risks: "", catalysts: "",
    targetPrice: "", status: "active", nextReviewDate: "",
  });

  const { data: theses = [], isLoading } = useQuery({
    queryKey: ["investment-theses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investment_theses")
        .select("*, companies(name, ticker, current_price)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: versions = [] } = useQuery({
    queryKey: ["thesis-versions", historyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("thesis_versions")
        .select("*")
        .eq("thesis_id", historyId!)
        .order("version_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!historyId,
  });

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const resetForm = () => {
    setForm({ companyId: "", buyRationale: "", risks: "", catalysts: "", targetPrice: "", status: "active", nextReviewDate: "" });
    setEditId(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.companyId) throw new Error("Selecciona una empresa");
      const payload = {
        user_id: user.id,
        company_id: form.companyId,
        buy_rationale: form.buyRationale || null,
        risks: form.risks || null,
        catalysts: form.catalysts || null,
        target_price: form.targetPrice ? parseFloat(form.targetPrice) : null,
        status: form.status,
        next_review_date: form.nextReviewDate || null,
      };

      if (editId) {
        // Save version before updating
        const existing = theses.find((t: any) => t.id === editId);
        if (existing) {
          await supabase.from("thesis_versions").insert({
            thesis_id: editId,
            user_id: user.id,
            buy_rationale: existing.buy_rationale,
            risks: existing.risks,
            catalysts: existing.catalysts,
            target_price: existing.target_price,
            status: existing.status,
          } as any);
        }
        const { error } = await supabase.from("investment_theses").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investment_theses").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["investment-theses"] });
      toast.success(editId ? "Tesis actualizada" : "Tesis creada");
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEdit = (thesis: any) => {
    setEditId(thesis.id);
    setForm({
      companyId: thesis.company_id,
      buyRationale: thesis.buy_rationale || "",
      risks: thesis.risks || "",
      catalysts: thesis.catalysts || "",
      targetPrice: thesis.target_price ? String(thesis.target_price) : "",
      status: thesis.status,
      nextReviewDate: thesis.next_review_date || "",
    });
    setDialogOpen(true);
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
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Tesis de inversión</h1>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nueva tesis</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editId ? "Editar tesis" : "Nueva tesis de inversión"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Empresa</Label>
                  <Select value={form.companyId} onValueChange={(v) => set({ companyId: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Motivo de compra / Tesis</Label>
                  <Textarea rows={3} value={form.buyRationale} onChange={(e) => set({ buyRationale: e.target.value })} placeholder="¿Por qué invertir en esta empresa?" />
                </div>
                <div>
                  <Label>Riesgos identificados</Label>
                  <Textarea rows={2} value={form.risks} onChange={(e) => set({ risks: e.target.value })} placeholder="Principales riesgos..." />
                </div>
                <div>
                  <Label>Catalizadores esperados</Label>
                  <Textarea rows={2} value={form.catalysts} onChange={(e) => set({ catalysts: e.target.value })} placeholder="Eventos que podrían impulsar el precio..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Precio objetivo</Label>
                    <Input type="number" step="0.01" value={form.targetPrice} onChange={(e) => set({ targetPrice: e.target.value })} className="font-mono" />
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Activa</SelectItem>
                        <SelectItem value="reviewed">Revisada</SelectItem>
                        <SelectItem value="closed">Cerrada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Próxima revisión</Label>
                  <Input type="date" value={form.nextReviewDate} onChange={(e) => set({ nextReviewDate: e.target.value })} />
                </div>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full">
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editId ? "Guardar cambios" : "Crear tesis"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {theses.length === 0 ? (
          <Card className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Sin tesis de inversión. Crea una para documentar tu análisis.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {theses.map((t: any) => {
              const price = Number(t.companies?.current_price) || 0;
              const target = Number(t.target_price) || 0;
              const upside = target > 0 && price > 0 ? ((target - price) / price) * 100 : null;
              return (
                <Card key={t.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{t.companies?.ticker} — {t.companies?.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                        {target > 0 && (
                          <span className="text-xs font-mono text-muted-foreground">
                            Obj: ${target.toFixed(2)}
                            {upside !== null && (
                              <span className={upside >= 0 ? "text-green-500" : "text-red-500"}> ({upside >= 0 ? "+" : ""}{upside.toFixed(1)}%)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setHistoryId(historyId === t.id ? null : t.id)}><History className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  {t.buy_rationale && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Tesis</p>
                      <p className="text-sm text-foreground">{t.buy_rationale}</p>
                    </div>
                  )}
                  {t.risks && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Riesgos</p>
                      <p className="text-sm text-foreground">{t.risks}</p>
                    </div>
                  )}
                  {t.catalysts && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase">Catalizadores</p>
                      <p className="text-sm text-foreground">{t.catalysts}</p>
                    </div>
                  )}
                  {t.next_review_date && (
                    <p className="text-xs text-muted-foreground">Próxima revisión: {t.next_review_date}</p>
                  )}
                  {/* Version history inline */}
                  {historyId === t.id && versions.length > 0 && (
                    <div className="border-t border-border pt-3 mt-3 space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground">Historial de versiones</p>
                      {versions.map((v: any) => (
                        <div key={v.id} className="text-xs bg-muted/50 rounded p-2">
                          <p className="text-muted-foreground">{new Date(v.version_date).toLocaleDateString()}</p>
                          {v.buy_rationale && <p className="truncate">{v.buy_rationale}</p>}
                          {v.target_price && <p className="font-mono">Obj: ${Number(v.target_price).toFixed(2)}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
