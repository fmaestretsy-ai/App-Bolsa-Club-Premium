import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, ArrowUpDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TradeDialog } from "@/components/TradeDialog";
import {
  TRADE_TYPES,
  TRADE_TYPE_LABELS,
  TRADE_TYPE_COLORS,
  type TradeType,
} from "@/types";

type SortKey = "trade_date" | "trade_type" | "ticker" | "total";
type SortDir = "asc" | "desc";

export default function TradeHistory() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterCompany, setFilterCompany] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("trade_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const filtered = useMemo(() => {
    let result = [...trades];
    if (filterType !== "all") {
      result = result.filter((t: any) => t.trade_type === filterType);
    }
    if (filterCompany.trim()) {
      const q = filterCompany.toLowerCase();
      result = result.filter((t: any) =>
        (t.companies?.ticker || "").toLowerCase().includes(q) ||
        (t.companies?.name || "").toLowerCase().includes(q)
      );
    }
    result.sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortKey) {
        case "trade_date": va = a.trade_date; vb = b.trade_date; break;
        case "trade_type": va = a.trade_type; vb = b.trade_type; break;
        case "ticker": va = a.companies?.ticker || ""; vb = b.companies?.ticker || ""; break;
        case "total": va = Number(a.total); vb = Number(b.total); break;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [trades, filterType, filterCompany, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const SortHeader = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
      </span>
    </TableHead>
  );

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
          <h1 className="text-2xl font-bold text-foreground">{t("nav.trades")}</h1>
          <TradeDialog />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {TRADE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TRADE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="Buscar empresa/ticker..."
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="w-[220px]"
          />
        </div>

        {filtered.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Sin operaciones registradas</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortHeader k="trade_date">Fecha</SortHeader>
                  <SortHeader k="trade_type">Tipo</SortHeader>
                  <SortHeader k="ticker">{t("companies.ticker")}</SortHeader>
                  <TableHead className="hidden sm:table-cell">{t("companies.name")}</TableHead>
                  <TableHead className="text-right">{t("portfolio.shares")}</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <SortHeader k="total">Total</SortHeader>
                  <TableHead className="text-right hidden md:table-cell">Divisa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tr: any) => {
                  const tt = tr.trade_type as TradeType;
                  return (
                    <TableRow key={tr.id}>
                      <TableCell className="text-muted-foreground">{tr.trade_date}</TableCell>
                      <TableCell>
                        <Badge className={TRADE_TYPE_COLORS[tt] || "bg-muted text-foreground"}>
                          {TRADE_TYPE_LABELS[tt] || tr.trade_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">{tr.companies?.ticker || "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{tr.companies?.name || "—"}</TableCell>
                      <TableCell className="text-right font-mono">
                        {tr.shares != null ? Number(tr.shares) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {tr.price != null ? `$${Number(tr.price).toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {Number(tr.total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell text-muted-foreground">
                        {tr.currency || "USD"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
