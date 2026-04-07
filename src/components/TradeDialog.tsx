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
import { createTaxLot, consumeLotsForSale, adjustLotsForSplit } from "@/lib/fifoEngine";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  TRADE_TYPES,
  TRADE_TYPE_LABELS,
  TRADE_NEEDS_COMPANY,
  TRADE_NEEDS_SHARES,
  TRADE_NEEDS_AMOUNT,
  TRADE_NEEDS_RATIO,
  type TradeType,
} from "@/types";

interface TradeDialogProps {
  defaultCompanyId?: string;
  trigger?: React.ReactNode;
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "CHF", "SEK", "NOK", "DKK", "JPY"];

const initialForm = (defaultCompanyId?: string) => ({
  companyId: defaultCompanyId || "",
  tradeType: "buy" as TradeType,
  shares: "",
  price: "",
  amount: "",
  splitRatio: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
  currency: "USD",
  fxRate: "1",
});

export function TradeDialog({ defaultCompanyId, trigger }: TradeDialogProps) {
  const { user } = useAuth();
  const { data: companies = [] } = useCompanies();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm(defaultCompanyId));

  const needsCompany = TRADE_NEEDS_COMPANY.includes(form.tradeType);
  const needsShares = TRADE_NEEDS_SHARES.includes(form.tradeType);
  const needsAmount = TRADE_NEEDS_AMOUNT.includes(form.tradeType);
  const needsRatio = TRADE_NEEDS_RATIO.includes(form.tradeType);

  const computedTotal = needsShares
    ? (parseFloat(form.shares) || 0) * (parseFloat(form.price) || 0)
    : parseFloat(form.amount) || 0;

  const fxRate = parseFloat(form.fxRate) || 1;
  const amountBase = computedTotal * fxRate;

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const ensurePortfolio = async () => {
    let { data: portfolio } = await supabase
      .from("portfolios")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (!portfolio) {
      const { data: p, error } = await supabase
        .from("portfolios")
        .insert({ user_id: user!.id, name: "Principal" })
        .select("id")
        .single();
      if (error) throw error;
      portfolio = p;
    }
    return portfolio!.id;
  };

  const updatePosition = async (portfolioId: string) => {
    if (!needsCompany || !form.companyId) return;

    const { data: pos } = await supabase
      .from("portfolio_positions")
      .select("*")
      .eq("company_id", form.companyId)
      .eq("portfolio_id", portfolioId)
      .eq("user_id", user!.id)
      .maybeSingle();

    const shares = parseFloat(form.shares) || 0;
    const price = parseFloat(form.price) || 0;

    if (form.tradeType === "buy") {
      if (pos) {
        const oldS = Number(pos.shares);
        const oldA = Number(pos.avg_cost);
        const newS = oldS + shares;
        const newA = newS > 0 ? (oldS * oldA + shares * price) / newS : 0;
        await supabase.from("portfolio_positions").update({ shares: newS, avg_cost: Math.round(newA * 100) / 100 }).eq("id", pos.id);
      } else {
        const company = companies.find((c) => c.id === form.companyId);
        await supabase.from("portfolio_positions").insert({
          user_id: user!.id,
          company_id: form.companyId,
          portfolio_id: portfolioId,
          shares,
          avg_cost: price,
          currency: company?.currency || "USD",
        });
      }
      // Create FIFO tax lot
      await createTaxLot({
        userId: user!.id,
        companyId: form.companyId,
        portfolioId,
        purchaseDate: form.date,
        shares,
        costPerShare: price,
        costPerShareBase: price * fxRate,
        currency: form.currency,
        fxRate,
      });
    } else if (form.tradeType === "sell") {
      if (pos) {
        const newS = Math.max(0, Number(pos.shares) - shares);
        if (newS <= 0) {
          await supabase.from("portfolio_positions").delete().eq("id", pos.id);
        } else {
          await supabase.from("portfolio_positions").update({ shares: newS }).eq("id", pos.id);
        }
      }
      // Consume FIFO lots and record realized gain
      await consumeLotsForSale({
        userId: user!.id,
        companyId: form.companyId,
        portfolioId,
        sellDate: form.date,
        sharesToSell: shares,
        sellPriceBase: price * fxRate,
      });
    } else if (form.tradeType === "split" && pos) {
      const ratio = parseFloat(form.splitRatio) || 1;
      const newS = Number(pos.shares) * ratio;
      const newA = Number(pos.avg_cost) / ratio;
      await supabase.from("portfolio_positions").update({ shares: newS, avg_cost: Math.round(newA * 100) / 100 }).eq("id", pos.id);
      // Adjust FIFO lots for split
      await adjustLotsForSplit({
        userId: user!.id,
        companyId: form.companyId,
        portfolioId,
        ratio,
      });
    }
    // dividend, commission, withholding → no position change
  };

  const handleSubmit = async () => {
    if (!user) return;
    if (needsCompany && !form.companyId) {
      toast.error("Selecciona una empresa");
      return;
    }
    if (needsShares && (!form.shares || !form.price)) {
      toast.error("Completa acciones y precio");
      return;
    }
    if (needsAmount && !form.amount) {
      toast.error("Introduce el importe");
      return;
    }
    if (needsRatio && (!form.splitRatio || parseFloat(form.splitRatio) <= 0)) {
      toast.error("Introduce un ratio de split válido");
      return;
    }

    setSaving(true);
    try {
      const portfolioId = await ensurePortfolio();

      await supabase.from("trades").insert({
        user_id: user.id,
        company_id: needsCompany && form.companyId ? form.companyId : null,
        portfolio_id: portfolioId,
        trade_type: form.tradeType,
        shares: needsShares ? parseFloat(form.shares) : needsRatio ? parseFloat(form.splitRatio) : null,
        price: needsShares ? parseFloat(form.price) : null,
        total: computedTotal,
        trade_date: form.date,
        notes: form.notes || null,
        currency: form.currency,
        currency_original: form.currency,
        fx_rate_to_base: fxRate,
        amount_base: amountBase,
      });

      await updatePosition(portfolioId);

      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio-positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["all-positions"] });

      toast.success(`${TRADE_TYPE_LABELS[form.tradeType]} registrada`);
      setOpen(false);
      setForm(initialForm(defaultCompanyId));
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
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar operación</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tradeType} onValueChange={(v) => set({ tradeType: v as TradeType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRADE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TRADE_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />
            </div>
          </div>

          {/* Company (conditional) */}
          {needsCompany && (
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
          )}

          {/* Shares + Price (buy/sell) */}
          {needsShares && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Acciones</Label>
                <Input type="number" placeholder="Ej: 50" value={form.shares} onChange={(e) => set({ shares: e.target.value })} className="font-mono" />
              </div>
              <div>
                <Label>Precio</Label>
                <Input type="number" step="0.01" placeholder="Ej: 250.00" value={form.price} onChange={(e) => set({ price: e.target.value })} className="font-mono" />
              </div>
            </div>
          )}

          {/* Amount (dividend, commission, withholding, cash, fx) */}
          {needsAmount && (
            <div>
              <Label>Importe</Label>
              <Input type="number" step="0.01" placeholder="Ej: 500.00" value={form.amount} onChange={(e) => set({ amount: e.target.value })} className="font-mono" />
            </div>
          )}

          {/* Split ratio */}
          {needsRatio && (
            <div>
              <Label>Ratio de split (ej: 4 para 4:1)</Label>
              <Input type="number" step="0.01" placeholder="Ej: 4" value={form.splitRatio} onChange={(e) => set({ splitRatio: e.target.value })} className="font-mono" />
            </div>
          )}

          {/* Currency + FX Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Divisa</Label>
              <Select value={form.currency} onValueChange={(v) => set({ currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo cambio → base</Label>
              <Input type="number" step="0.0001" value={form.fxRate} onChange={(e) => set({ fxRate: e.target.value })} className="font-mono" />
            </div>
          </div>

          {/* Total preview */}
          {computedTotal > 0 && (
            <div className="rounded-lg bg-muted p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total ({form.currency})</span>
                <span className="text-sm font-semibold font-mono text-foreground">
                  {computedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {form.currency}
                </span>
              </div>
              {fxRate !== 1 && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Equiv. moneda base</span>
                  <span className="text-sm font-mono text-foreground">
                    {amountBase.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Notas (opcional)</Label>
            <Input placeholder="Comentarios sobre la operación" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {TRADE_TYPE_LABELS[form.tradeType]}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
