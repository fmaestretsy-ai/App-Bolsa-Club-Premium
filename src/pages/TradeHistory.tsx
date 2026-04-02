import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const trades = [
  { id: "1", ticker: "AAPL", name: "Apple Inc.", type: "buy" as const, shares: 25, price: 150.0, date: "2023-06-15", currency: "USD" },
  { id: "2", ticker: "MSFT", name: "Microsoft", type: "buy" as const, shares: 20, price: 310.0, date: "2023-08-22", currency: "USD" },
  { id: "3", ticker: "AAPL", name: "Apple Inc.", type: "buy" as const, shares: 25, price: 160.0, date: "2023-11-10", currency: "USD" },
  { id: "4", ticker: "ASML", name: "ASML Holding", type: "buy" as const, shares: 5, price: 580.0, date: "2024-01-05", currency: "EUR" },
  { id: "5", ticker: "GOOGL", name: "Alphabet", type: "sell" as const, shares: 15, price: 141.2, date: "2024-01-12", currency: "USD" },
];

export default function TradeHistory() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.trades")}</h1>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>{t("companies.ticker")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("companies.name")}</TableHead>
                <TableHead className="text-right">{t("portfolio.shares")}</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((tr) => (
                <TableRow key={tr.id}>
                  <TableCell className="text-muted-foreground">{tr.date}</TableCell>
                  <TableCell>
                    <Badge variant={tr.type === "buy" ? "default" : "destructive"} className={tr.type === "buy" ? "bg-gain" : ""}>
                      {tr.type === "buy" ? "BUY" : "SELL"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{tr.ticker}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{tr.name}</TableCell>
                  <TableCell className="text-right font-mono">{tr.shares}</TableCell>
                  <TableCell className="text-right font-mono">${tr.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">${(tr.shares * tr.price).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </DashboardLayout>
  );
}
