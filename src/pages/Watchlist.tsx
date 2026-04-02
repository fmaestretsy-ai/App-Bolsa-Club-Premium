import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Eye, Plus, Star } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

const watchlistItems = [
  { ticker: "NVDA", name: "NVIDIA Corp.", price: 495.2, intrinsicValue: 420.0, upside: -15.2, alert: false },
  { ticker: "META", name: "Meta Platforms", price: 354.7, intrinsicValue: 410.5, upside: 15.7, alert: true },
  { ticker: "V", name: "Visa Inc.", price: 271.8, intrinsicValue: 320.0, upside: 17.7, alert: true },
];

export default function Watchlist() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("nav.watchlist")}</h1>
          <Button><Plus className="h-4 w-4 mr-2" />{t("common.add")}</Button>
        </div>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>{t("companies.ticker")}</TableHead>
                <TableHead>{t("companies.name")}</TableHead>
                <TableHead className="text-right">{t("companies.currentPrice")}</TableHead>
                <TableHead className="text-right">{t("valuation.intrinsicValue")}</TableHead>
                <TableHead className="text-right">{t("companies.upside")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlistItems.map((item) => (
                <TableRow key={item.ticker}>
                  <TableCell><Star className={`h-4 w-4 ${item.alert ? "fill-warning text-warning" : "text-muted-foreground"}`} /></TableCell>
                  <TableCell className="font-semibold">{item.ticker}</TableCell>
                  <TableCell className="text-muted-foreground">{item.name}</TableCell>
                  <TableCell className="text-right font-mono">${item.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono">${item.intrinsicValue.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-semibold ${item.upside >= 0 ? "text-gain" : "text-loss"}`}>
                    {item.upside >= 0 ? "+" : ""}{item.upside.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
