import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, Calculator, LineChart } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function CompanyDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/companies")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">Apple Inc.</h1>
              <Badge variant="secondary">AAPL</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Technology · USA · USD</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("companies.currentPrice"), value: "$182.50", sub: "Market" },
            { label: t("valuation.intrinsicValue"), value: "$227.10", sub: t("valuation.base") },
            { label: t("companies.upside"), value: "+24.5%", sub: t("valuation.undervalued"), color: "text-gain" },
            { label: t("companies.marketCap"), value: "$2.84T", sub: "Diluted" },
          ].map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-xl font-bold mt-1 ${item.color || "text-card-foreground"}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.sub}</p>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-muted">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="financials">{t("nav.financials")}</TabsTrigger>
            <TabsTrigger value="valuation">{t("nav.valuation")}</TabsTrigger>
            <TabsTrigger value="projection">{t("nav.projection")}</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Card className="p-6">
              <h3 className="font-semibold text-card-foreground mb-4">Key Metrics</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "P/E Ratio", value: "28.5x" }, { label: "EV/EBITDA", value: "22.1x" },
                  { label: "ROE", value: "147.3%" }, { label: "ROIC", value: "56.2%" },
                  { label: "FCF Yield", value: "3.8%" }, { label: "Debt/EBITDA", value: "1.2x" },
                  { label: "Revenue Growth", value: "+8.2%" }, { label: "Net Margin", value: "25.3%" },
                ].map((m) => (
                  <div key={m.label} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-sm font-semibold text-foreground">{m.value}</p>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
          <TabsContent value="financials" className="mt-4">
            <Card className="p-6">
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            </Card>
          </TabsContent>
          <TabsContent value="valuation" className="mt-4">
            <Card className="p-6">
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            </Card>
          </TabsContent>
          <TabsContent value="projection" className="mt-4">
            <Card className="p-6">
              <p className="text-muted-foreground text-sm">{t("common.noData")}</p>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
