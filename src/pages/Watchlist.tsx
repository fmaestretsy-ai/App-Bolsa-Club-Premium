import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Star, Trash2, Loader2, ShoppingCart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompanies } from "@/hooks/useCompanyData";
import { TradeDialog } from "@/components/TradeDialog";

export default function Watchlist() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: companies = [] } = useCompanies();
  const [addOpen, setAddOpen] = useState(false);
  const [addCompanyId, setAddCompanyId] = useState("");
  const [alertBelow, setAlertBelow] = useState("");

  const { data: watchlists = [], isLoading } = useQuery({
    queryKey: ["watchlists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("watchlists").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const watchlistId = watchlists[0]?.id;

  const { data: items = [] } = useQuery({
    queryKey: ["watchlist-items", watchlistId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchlist_items")
        .select("*, companies(name, ticker, current_price, target_price_5y, estimated_annual_return)")
        .eq("watchlist_id", watchlistId!);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!watchlistId,
  });

  const ensureWatchlist = async (): Promise<string> => {
    if (watchlistId) return watchlistId;
    const { data, error } = await supabase
      .from("watchlists")
      .insert({ user_id: user!.id, name: "Default" })
      .select("id")
      .single();
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ["watchlists"] });
    return data.id;
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!addCompanyId || !user) throw new Error("Selecciona una empresa");
      const wlId = await ensureWatchlist();
      const { error } = await supabase.from("watchlist_items").insert({
        user_id: user.id,
        watchlist_id: wlId,
        company_id: addCompanyId,
        alert_below: alertBelow ? parseFloat(alertBelow) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-items"] });
      toast.success("Empresa añadida al watchlist");
      setAddOpen(false);
      setAddCompanyId("");
      setAlertBelow("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("watchlist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-items"] });
      toast.success("Eliminado del watchlist");
    },
  });

  const itemsWithCalc = items.map((item: any) => {
    const price = Number(item.companies?.current_price) || 0;
    const targetPrice = Number(item.companies?.target_price_5y) || 0;
    const annualReturn = Number(item.companies?.estimated_annual_return) || 0;
    const alertPrice = Number(item.alert_below) || 0;
    const isAlert = alertPrice > 0 && price > 0 && price <= alertPrice;

    // Margin of safety: (intrinsicValue - price) / intrinsicValue
    // Using target_price_5y as proxy for intrinsic value
    const marginOfSafety = targetPrice > 0 && price > 0 ? ((targetPrice - price) / targetPrice) * 100 : null;

    return {
      ...item,
      ticker: item.companies?.ticker || "—",
      name: item.companies?.name || "—",
      price,
      targetPrice,
      annualReturn,
      marginOfSafety,
      isAlert,
    };
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("nav.watchlist")}</h1>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />{t("common.add")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Añadir al watchlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Empresa</Label>
                  <Select value={addCompanyId} onValueChange={setAddCompanyId}>
                    <SelectTrigger><SelectValue placeholder="Selecciona empresa" /></SelectTrigger>
                    <SelectContent>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.ticker} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alerta por debajo de (opcional)</Label>
                  <Input type="number" placeholder="Ej: 150.00" value={alertBelow} onChange={(e) => setAlertBelow(e.target.value)} className="font-mono" />
                </div>
                <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !addCompanyId}>
                  {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Añadir
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {itemsWithCalc.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">
              {companies.length === 0
                ? "Sube un Excel primero para añadir empresas al watchlist"
                : "Tu watchlist está vacío. Añade empresas para seguirlas."}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>{t("companies.ticker")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("companies.name")}</TableHead>
                  <TableHead className="text-right">{t("companies.currentPrice")}</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">V. Intrínseco</TableHead>
                  <TableHead className="text-right">M. Seguridad</TableHead>
                  <TableHead className="text-right hidden md:table-cell">% Retorno est.</TableHead>
                  <TableHead className="text-right">Alerta</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemsWithCalc.map((item) => (
                  <TableRow key={item.id} className={item.isAlert ? "bg-yellow-500/10" : ""}>
                    <TableCell>
                      <Star className={`h-4 w-4 ${item.isAlert ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"}`} />
                    </TableCell>
                    <TableCell className="font-semibold">{item.ticker}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{item.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {item.price > 0 ? `$${item.price.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden sm:table-cell">
                      {item.targetPrice > 0 ? `$${item.targetPrice.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.marginOfSafety !== null ? (
                        <Badge className={item.marginOfSafety >= 0 ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                          {item.marginOfSafety >= 0 ? "+" : ""}{item.marginOfSafety.toFixed(1)}%
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      {item.annualReturn > 0 ? `${(item.annualReturn * 100).toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {item.alert_below ? `$${Number(item.alert_below).toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <TradeDialog
                          defaultCompanyId={item.company_id}
                          trigger={
                            <Button variant="ghost" size="icon" title="Comprar">
                              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          }
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate(item.id)}>
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
