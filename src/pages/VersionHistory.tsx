import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, FileSpreadsheet, Calculator, Settings } from "lucide-react";

const versions = [
  { id: "1", action: "Excel uploaded", company: "Apple Inc.", user: "You", date: "2024-01-15 14:32", icon: FileSpreadsheet, type: "upload" },
  { id: "2", action: "Assumptions updated", company: "Apple Inc.", user: "You", date: "2024-01-15 15:10", icon: Settings, type: "config" },
  { id: "3", action: "Valuation recalculated", company: "Apple Inc.", user: "You", date: "2024-01-15 15:12", icon: Calculator, type: "valuation" },
  { id: "4", action: "Excel uploaded", company: "Microsoft Corp.", user: "You", date: "2024-01-14 09:45", icon: FileSpreadsheet, type: "upload" },
  { id: "5", action: "Valuation recalculated", company: "Microsoft Corp.", user: "You", date: "2024-01-14 10:00", icon: Calculator, type: "valuation" },
];

const badgeColor = (type: string) => {
  switch (type) {
    case "upload": return "bg-primary/10 text-primary";
    case "config": return "bg-warning/10 text-warning";
    case "valuation": return "bg-success/10 text-success";
    default: return "";
  }
};

export default function VersionHistory() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.versions")}</h1>
        <div className="space-y-3">
          {versions.map((v) => (
            <Card key={v.id} className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <v.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{v.action}</p>
                <p className="text-xs text-muted-foreground">{v.company} · {v.date}</p>
              </div>
              <Badge className={badgeColor(v.type)} variant="secondary">{v.type}</Badge>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
