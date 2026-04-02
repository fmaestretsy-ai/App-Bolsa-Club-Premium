import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanies } from "@/hooks/useCompanyData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface TradeDialogProps {
  defaultCompanyId?: string;
  trigger?: React.ReactNode;
}

export function TradeDialog({ defaultCompanyId, trigger }: TradeDialogProps) {
  const { user } = useAuth();
  const { data: companies = [] } = useCompanies();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    companyId: defaultCompanyId || "",
    tradeType: "buy",
    shares: "",
    price: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const total = (parseFloat(form.shares) || 0) * (parseFloat(form.price) || 0);

  const handleSubmit = async () => {
    if (!user || !form.companyId || !form.shares || !form.price) {
      toast.error("Completa todos los campos obligatorios");
      return;
    }
    setSaving(true);
    try {
      // Ensure portfolio exists
      let { data: portfolio } = await supabase
        .from("portfolios")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!portfolio) {
        const { data: newPortfolio, error: pErr } = await supabase
          .from("portfolios")
          .insert({ user_id: user.id, name: "Principal" })
          .select("id")
          .single();
        if (pErr) throw pErr;
        portfolio = newPortfolio;
      }

      const shares = parseFloat(form.shares);
      const price = parseFloat(form.price);

      // Insert trade
      const { error: tradeErr } = await supabase.from("trades").insert({
        user_id: user.id,
        company_id: form.companyId,
        portfolio_id: portfolio.id,
        trade_type: form.tradeType,
        shares,
        price,
        total: shares * price,
        trade_date: form.date,
        notes: form.notes || null,
      });
      if (tradeErr) throw tradeErr;

      // Update or create position
      const { data: existingPos } = await supabase
        .from("portfolio_positions")
        .select("*")
        .eq("company_id", form.companyId)
        .eq("portfolio_id", portfolio.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingPos) {
        const oldShares = Number(existingPos.shares);
        const oldAvg = Number(existingPos.avg_cost);

        let newShares: number;
        let newAvg: number;

        if (form.tradeType === "buy") {
          newShares = oldShares + shares;
          newAvg = newShares > 0 ? (oldShares * oldAvg + shares * price) / newShares : 0;
        } else {
          newShares = Math.max(0, oldShares - shares);
          newAvg = oldAvg; // avg cost doesn't change on sell
        }

        if (newShares <= 0) {
          await supabase.from("portfolio_positions").delete().eq("id", existingPos.id);
        } else {
          await supabase
            .from("portfolio_positions")
            .update({ shares: newShares, avg_cost: Math.round(newAvg * 100) / 100 })
            .eq("id", existingPos.id);
        }
      } else if (form.tradeType === "buy") {
        const company = companies.find((c) => c.id === form.companyId);
        await supabase.from("portfolio_positions").insert({
          user_id: user.id,
          company_id: form.companyId,
          portfolio_id: portfolio.id,
          shares,
          avg_cost: price,
          currency: company?.currency || "USD",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["all-positions"] });

      toast.success(`${form.tradeType === "buy" ? "Compra" : "Venta"} registrada`);
      setOpen(false);
      setForm({ companyId: defaultCompanyId || "", tradeType: "buy", shares: "", price: "", date: new Date().toISOString().split("T")[0], notes: "" });
    } catch (err: any) {
      toast.error(err.message || "Error al registrar operación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button><Plus className="h-4 w-4 mr-2" />Registrar operación</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar operación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tradeType} onValueChange={(v) => setForm((f) => ({ ...f, tradeType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Compra</SelectItem>
                  <SelectItem value="sell">Venta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Acciones</Label>
              <Input type="number" placeholder="Ej: 50" value={form.shares} onChange={(e) => setForm((f) => ({ ...f, shares: e.target.value }))} className="font-mono" />
            </div>
            <div>
              <Label>Precio</Label>
              <Input type="number" step="0.01" placeholder="Ej: 250.00" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className="font-mono" />
            </div>
          </div>

          {total > 0 && (
            <div className="rounded-lg bg-muted p-3 flex justify-between">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-sm font-semibold font-mono text-foreground">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
          )}

          <div>
            <Label>Notas (opcional)</Label>
            <Input placeholder="Comentarios sobre la operación" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {form.tradeType === "buy" ? "Registrar compra" : "Registrar venta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
