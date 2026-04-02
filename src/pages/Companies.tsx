import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const mockCompanies = [
  { id: "1", name: "Apple Inc.", ticker: "AAPL", sector: "Technology", country: "USA", currentPrice: 182.5, intrinsicValue: 227.1, upside: 24.5, lastUpdated: "2024-01-15" },
  { id: "2", name: "Microsoft Corp.", ticker: "MSFT", sector: "Technology", country: "USA", currentPrice: 378.9, intrinsicValue: 447.8, upside: 18.2, lastUpdated: "2024-01-14" },
  { id: "3", name: "ASML Holding", ticker: "ASML", sector: "Technology", country: "NLD", currentPrice: 680.0, intrinsicValue: 810.5, upside: 19.2, lastUpdated: "2024-01-12" },
  { id: "4", name: "Inditex", ticker: "ITX.MC", sector: "Consumer", country: "ESP", currentPrice: 38.5, intrinsicValue: 32.1, upside: -16.6, lastUpdated: "2024-01-10" },
];

export default function Companies() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const filtered = mockCompanies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.ticker.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("companies.title")}</h1>
          <Button><Plus className="h-4 w-4 mr-2" />{t("companies.addCompany")}</Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t("companies.ticker")}</TableHead>
                <TableHead>{t("companies.name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("companies.sector")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("companies.country")}</TableHead>
                <TableHead className="text-right">{t("companies.currentPrice")}</TableHead>
                <TableHead className="text-right hidden md:table-cell">{t("companies.intrinsicValue")}</TableHead>
                <TableHead className="text-right">{t("companies.upside")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/companies/${c.id}`)}>
                  <TableCell className="font-semibold text-foreground">{c.ticker}</TableCell>
                  <TableCell className="text-muted-foreground">{c.name}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="secondary">{c.sector}</Badge></TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{c.country}</TableCell>
                  <TableCell className="text-right font-mono">${c.currentPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono hidden md:table-cell">${c.intrinsicValue.toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-semibold ${c.upside >= 0 ? "text-gain" : "text-loss"}`}>
                    {c.upside >= 0 ? "+" : ""}{c.upside.toFixed(1)}%
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
