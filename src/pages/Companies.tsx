import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Loader2, Building2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanyData";
import { EmptyState } from "@/components/EmptyState";
import { getCurrencySymbol } from "@/lib/currency";

export default function Companies() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data: companies = [], isLoading } = useCompanies();

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.ticker.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("companies.title")}</h1>
          <Button onClick={() => navigate("/upload")}>
            <Plus className="h-4 w-4 mr-2" />{t("companies.addCompany")}
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title={companies.length === 0 ? "Sin empresas" : "Sin resultados"}
            description={companies.length === 0 ? "Sube un Excel para importar tu primera empresa" : "Intenta con otro término de búsqueda"}
          />
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("companies.ticker")}</TableHead>
                  <TableHead>{t("companies.name")}</TableHead>
                  <TableHead className="hidden md:table-cell">{t("companies.sector")}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t("companies.country")}</TableHead>
                  <TableHead className="text-right">{t("companies.currentPrice")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/companies/${c.id}`)}>
                    <TableCell className="font-semibold text-foreground">{c.ticker}</TableCell>
                    <TableCell className="text-muted-foreground">{c.name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.sector && <Badge variant="secondary">{c.sector}</Badge>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{c.country}</TableCell>
                    <TableCell className="text-right font-mono">
                      {c.current_price ? `${getCurrencySymbol(c.currency)}${Number(c.current_price).toFixed(2)}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
