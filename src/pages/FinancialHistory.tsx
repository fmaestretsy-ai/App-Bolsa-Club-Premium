import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const mockData = [
  { year: 2020, revenue: 274515, ebitda: 81020, netIncome: 57411, fcf: 73365, marginNet: 20.9, roe: 73.7, roic: 30.1 },
  { year: 2021, revenue: 365817, ebitda: 120233, netIncome: 94680, fcf: 92953, marginNet: 25.9, roe: 147.4, roic: 56.2 },
  { year: 2022, revenue: 394328, ebitda: 130541, netIncome: 99803, fcf: 111443, marginNet: 25.3, roe: 175.5, roic: 61.2 },
  { year: 2023, revenue: 383285, ebitda: 125820, netIncome: 96995, fcf: 99584, marginNet: 25.3, roe: 156.1, roic: 54.8 },
];

export default function FinancialHistory() {
  const { t } = useTranslation();

  const fmt = (n: number) => `$${(n / 1000).toFixed(1)}B`;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("nav.financials")}</h1>
          <Select defaultValue="aapl">
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aapl">AAPL - Apple</SelectItem>
              <SelectItem value="msft">MSFT - Microsoft</SelectItem>
              <SelectItem value="googl">GOOGL - Alphabet</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">EBITDA</TableHead>
                  <TableHead className="text-right">Net Income</TableHead>
                  <TableHead className="text-right">FCF</TableHead>
                  <TableHead className="text-right">Net Margin</TableHead>
                  <TableHead className="text-right">ROE</TableHead>
                  <TableHead className="text-right">ROIC</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockData.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell className="font-semibold">{row.year}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.revenue)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.ebitda)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.netIncome)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.fcf)}</TableCell>
                    <TableCell className="text-right font-mono">{row.marginNet.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{row.roe.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{row.roic.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
