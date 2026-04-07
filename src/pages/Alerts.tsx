import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Bell, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanyData";
import { toast } from "sonner";

const ALERT_TYPES = [
  { value: "buy_range", label: "Rango de compra", desc: "Precio ≤ umbral" },
  { value: "above_intrinsic", label: "Sobre valor intrínseco", desc: "Precio ≥ V.I. × factor" },
  { value: "weight_excess", label: "Exceso de peso", desc: "Peso en cartera ≥ umbral %" },
];

const ALERT_LABELS: Record<string, string> = {
  buy_range: "Rango compra",
  above_intrinsic: "Sobre V.I.",
  weight_excess: "Exceso peso",
};

export default function Alerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ companyId: "", alertType: "buy_range", threshold: "", notes: "" });

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["user-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_alerts")
        .select("*, companies(name, ticker, current_price)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Evaluate alerts against current data
  const { data: positions = [] } = useQuery({
    queryKey: ["all-positions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_positions")
        .select("*, companies(current_price, ticker)");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const totalPortfolioValue = positions.reduce((s: number, p: any) => s + Number(p.shares) * (Number(p.companies?.current_price) || 0), 0);

  const evaluatedAlerts = alerts.map((a: any) => {
    const price = Number(a.companies?.current_price) || 0;
    const threshold = Number(a.threshold);
    let triggered = false;

    if (a.alert_type === "buy_range") {
      triggered = price > 0 && price <= threshold;
    } else if (a.alert_type === "above_intrinsic") {
      triggered = price > 0 && price >= threshold;
    } else if (a.alert_type === "weight_excess") {
      const pos = positions.find((p: any) => p.company_id === a.company_id);
      if (pos && totalPortfolioValue > 0) {
        const weight = (Number(pos.shares) * (Number(pos.companies?.current_price) || 0)) / totalPortfolioValue * 100;
        triggered = weight >= threshold;
      }
    }

    return { ...a, price, triggered: a.is_active && triggered };
  });

  const activeTriggered = evaluatedAlerts.filter((a) => a.triggered).length;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !form.companyId) throw new Error("Completa los campos");
      const { error } = await supabase.from("user_alerts").insert({
        user_id: user.id,
        company_id: form.companyId,
        alert_type: form.alertType,
        threshold: parseFloat(form.threshold),
        notes: form.notes || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-alerts"] });
      toast.success("Alerta creada");
      setDialogOpen(false);
      setForm({ companyId: "", alertType: "buy_range", threshold: "", notes: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from("user_alerts").update({ is_active: !isActive } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user-alerts"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_alerts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-alerts"] });
      toast.success("Alerta eliminada");
    },
  });

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
            {activeTriggered > 0 && (
              <Badge className="bg-red-600 text-white">{activeTriggered} activas</Badge>
            )}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nueva alerta</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Configurar alerta</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Empresa</Label>
                  <Select value={form.companyId} onValueChange={(v) => setForm((f) => ({ ...f, companyId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo de alerta</Label>
                  <Select value={form.alertType} onValueChange={(v) => setForm((f) => ({ ...f, alertType: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALERT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label} — {t.desc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>
                    Umbral {form.alertType === "weight_excess" ? "(%)" : "($)"}
                  </Label>
                  <Input type="number" step="0.01" value={form.threshold} onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))} className="font-mono" />
                </div>
                <div>
                  <Label>Notas (opcional)</Label>
                  <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.companyId || !form.threshold} className="w-full">
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear alerta
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {evaluatedAlerts.length === 0 ? (
          <Card className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Sin alertas configuradas.</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Umbral</TableHead>
                  <TableHead className="text-right">Precio actual</TableHead>
                  <TableHead className="hidden sm:table-cell">Notas</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {evaluatedAlerts.map((a: any) => (
                  <TableRow key={a.id} className={a.triggered ? "bg-red-500/10" : ""}>
                    <TableCell>
                      {a.triggered ? (
                        <Badge className="bg-red-600 text-white">¡Activa!</Badge>
                      ) : a.is_active ? (
                        <Badge variant="outline">Vigilando</Badge>
                      ) : (
                        <Badge variant="secondary">Pausada</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">{a.companies?.ticker || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{ALERT_LABELS[a.alert_type] || a.alert_type}</TableCell>
                    <TableCell className="text-right font-mono">
                      {a.alert_type === "weight_excess" ? `${Number(a.threshold)}%` : `$${Number(a.threshold).toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-right font-mono">{a.price > 0 ? `$${a.price.toFixed(2)}` : "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs truncate max-w-[150px]">{a.notes || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleMutation.mutate({ id: a.id, isActive: a.is_active })}>
                          {a.is_active ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(a.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
