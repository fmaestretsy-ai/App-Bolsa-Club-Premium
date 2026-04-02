import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function TradeHistory() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: trades = [], isLoading } = useQuery({
    queryKey: ["trades"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*, companies(name, ticker)")
        .order("trade_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
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
        <h1 className="text-2xl font-bold text-foreground">{t("nav.trades")}</h1>
        {trades.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Sin operaciones registradas</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>{t("companies.ticker")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("companies.name")}</TableHead>
                  <TableHead className="text-right">{t("portfolio.shares")}</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((tr: any) => (
                  <TableRow key={tr.id}>
                    <TableCell className="text-muted-foreground">{tr.trade_date}</TableCell>
                    <TableCell>
                      <Badge variant={tr.trade_type === "buy" ? "default" : "destructive"}
                        className={tr.trade_type === "buy" ? "bg-green-600" : ""}>
                        {tr.trade_type === "buy" ? "COMPRA" : "VENTA"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">{tr.companies?.ticker || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{tr.companies?.name || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{Number(tr.shares)}</TableCell>
                    <TableCell className="text-right font-mono">${Number(tr.price).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">${Number(tr.total).toLocaleString()}</TableCell>
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
