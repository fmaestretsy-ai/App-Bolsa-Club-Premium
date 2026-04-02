import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export default function Valuation() {
  const { t } = useTranslation();

  const scenarios = [
    { name: t("valuation.conservative"), value: 205.3, upside: 12.5, color: "bg-warning" },
    { name: t("valuation.base"), value: 227.1, upside: 24.5, color: "bg-primary" },
    { name: t("valuation.optimistic"), value: 258.8, upside: 41.8, color: "bg-success" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">{t("valuation.title")}</h1>
          <Select defaultValue="aapl">
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aapl">AAPL - Apple</SelectItem>
              <SelectItem value="msft">MSFT - Microsoft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <Card key={s.name} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-muted-foreground">{s.name}</p>
                <div className={`h-2 w-2 rounded-full ${s.color}`} />
              </div>
              <p className="text-3xl font-bold text-card-foreground">${s.value.toFixed(2)}</p>
              <p className="text-sm font-semibold text-gain mt-1">+{s.upside.toFixed(1)}% upside</p>
            </Card>
          ))}
        </div>

        <Card className="p-6">
          <h3 className="font-semibold text-card-foreground mb-6">{t("valuation.recommendation")}</h3>
          <div className="flex flex-col items-center">
            <Badge className="bg-gain text-primary-foreground text-lg px-6 py-2 mb-4">{t("valuation.buy")}</Badge>

            <div className="w-full max-w-lg space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{t("companies.currentPrice")}</span>
                  <span className="font-mono text-foreground">$182.50</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{t("valuation.intrinsicValue")} ({t("valuation.base")})</span>
                  <span className="font-mono text-foreground">$227.10</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">{t("valuation.marginOfSafety")}</span>
                  <span className="font-semibold text-gain">19.6%</span>
                </div>
                <Progress value={80.4} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>$0</span>
                  <span className="text-foreground font-medium">← {t("companies.currentPrice")}</span>
                  <span>${"227.10"}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">{t("valuation.perTarget")}</h3>
            <div className="space-y-2">
              {[
                { label: "Current P/E", value: "28.5x" },
                { label: "Target P/E", value: "25.0x" },
                { label: "Normalized EPS", value: "$6.42" },
                { label: "Fair Value (P/E)", value: "$160.50" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">{t("valuation.fcfMultiple")}</h3>
            <div className="space-y-2">
              {[
                { label: "FCF per Share", value: "$6.13" },
                { label: "FCF Multiple", value: "20.0x" },
                { label: "FCF Yield", value: "3.4%" },
                { label: "Fair Value (FCF)", value: "$122.60" },
              ].map((r) => (
                <div key={r.label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-mono text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
