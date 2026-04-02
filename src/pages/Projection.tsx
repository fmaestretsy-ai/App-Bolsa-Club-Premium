import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const projectionData = [
  { year: 2024, revenue: 410000, netIncome: 103000, fcf: 108000, intrinsicValue: 240, targetPrice: 235, expectedReturn: 28.8 },
  { year: 2025, revenue: 438700, netIncome: 112100, fcf: 118800, intrinsicValue: 262, targetPrice: 258, expectedReturn: 41.4 },
  { year: 2026, revenue: 469400, netIncome: 122200, fcf: 130700, intrinsicValue: 286, targetPrice: 282, expectedReturn: 54.5 },
  { year: 2027, revenue: 502300, netIncome: 133200, fcf: 143800, intrinsicValue: 312, targetPrice: 308, expectedReturn: 68.8 },
  { year: 2028, revenue: 537500, netIncome: 145200, fcf: 158200, intrinsicValue: 341, targetPrice: 336, expectedReturn: 84.1 },
];

export default function Projection() {
  const { t } = useTranslation();
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}B`;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("projection.title")}</h1>
          <Select defaultValue="aapl">
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aapl">AAPL - Apple</SelectItem>
              <SelectItem value="msft">MSFT - Microsoft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("projection.cagr")} Revenue</p>
            <p className="text-xl font-bold text-card-foreground mt-1">7.0%</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("projection.cagr")} FCF</p>
            <p className="text-xl font-bold text-card-foreground mt-1">9.5%</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("projection.targetPrice")} 2028</p>
            <p className="text-xl font-bold text-gain mt-1">$336</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">{t("projection.expectedReturn")}</p>
            <p className="text-xl font-bold text-gain mt-1">+84.1%</p>
          </Card>
        </div>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-card-foreground mb-4">{t("projection.title")}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="year" tick={{ fill: "hsl(220, 10%, 46%)" }} />
                <YAxis tick={{ fill: "hsl(220, 10%, 46%)" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}B`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 25%, 11%)", border: "1px solid hsl(222, 20%, 18%)", borderRadius: "8px", color: "hsl(220, 15%, 90%)" }} />
                <Legend />
                <Bar dataKey="revenue" name={t("projection.revenue")} fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fcf" name={t("projection.fcf")} fill="hsl(152, 69%, 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("projection.year")}</TableHead>
                  <TableHead className="text-right">{t("projection.revenue")}</TableHead>
                  <TableHead className="text-right">{t("projection.netIncome")}</TableHead>
                  <TableHead className="text-right">{t("projection.fcf")}</TableHead>
                  <TableHead className="text-right">{t("projection.intrinsicValue")}</TableHead>
                  <TableHead className="text-right">{t("projection.targetPrice")}</TableHead>
                  <TableHead className="text-right">{t("projection.expectedReturn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projectionData.map((row) => (
                  <TableRow key={row.year}>
                    <TableCell className="font-semibold">{row.year}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.revenue)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.netIncome)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(row.fcf)}</TableCell>
                    <TableCell className="text-right font-mono">${row.intrinsicValue}</TableCell>
                    <TableCell className="text-right font-mono">${row.targetPrice}</TableCell>
                    <TableCell className="text-right font-mono text-gain">+{row.expectedReturn.toFixed(1)}%</TableCell>
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
