import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Assumptions() {
  const { t } = useTranslation();

  const fields = [
    { label: "Target P/E Ratio", defaultValue: "25.0", unit: "x" },
    { label: "FCF Multiple", defaultValue: "20.0", unit: "x" },
    { label: "Revenue Growth Rate", defaultValue: "7.0", unit: "%" },
    { label: "Net Margin Target", defaultValue: "25.0", unit: "%" },
    { label: "Discount Rate (WACC)", defaultValue: "10.0", unit: "%" },
    { label: "Terminal Growth Rate", defaultValue: "3.0", unit: "%" },
    { label: "Conservative Discount", defaultValue: "15.0", unit: "%" },
    { label: "Optimistic Premium", defaultValue: "15.0", unit: "%" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("nav.assumptions")}</h1>
          <Select defaultValue="aapl">
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aapl">AAPL - Apple</SelectItem>
              <SelectItem value="msft">MSFT - Microsoft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="p-6">
          <h3 className="font-semibold text-card-foreground mb-6">Valuation Assumptions</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {fields.map((f) => (
              <div key={f.label}>
                <Label className="text-sm text-muted-foreground">{f.label}</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input defaultValue={f.defaultValue} className="font-mono" />
                  <span className="text-sm text-muted-foreground w-6 shrink-0">{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3">
            <Button>{t("common.save")}</Button>
            <Button variant="outline">{t("common.cancel")}</Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
