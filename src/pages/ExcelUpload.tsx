import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Upload, FileSpreadsheet, CheckCircle } from "lucide-react";
import { useState } from "react";

export default function ExcelUpload() {
  const { t } = useTranslation();
  const [isDragging, setIsDragging] = useState(false);

  const uploads = [
    { name: "AAPL_Financials_2024.xlsx", company: "Apple Inc.", date: "2024-01-15", status: "success" },
    { name: "MSFT_Analysis.xlsx", company: "Microsoft Corp.", date: "2024-01-14", status: "success" },
    { name: "GOOGL_Data.xlsx", company: "Alphabet Inc.", date: "2024-01-12", status: "success" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-foreground">{t("upload.title")}</h1>

        <Card
          className={`p-12 border-2 border-dashed transition-colors cursor-pointer ${isDragging ? "border-primary bg-accent" : "border-border hover:border-primary/50"}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); }}
        >
          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground mb-4">
              <Upload className="h-7 w-7" />
            </div>
            <p className="text-base font-medium text-foreground">{t("upload.dragDrop")}</p>
            <p className="text-sm text-muted-foreground mt-1">{t("upload.orBrowse")}</p>
            <p className="text-xs text-muted-foreground mt-3">{t("upload.supportedFormats")}</p>
          </div>
        </Card>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Recent Uploads</h3>
          <div className="space-y-2">
            {uploads.map((u) => (
              <Card key={u.name} className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center text-accent-foreground">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.company} · {u.date}</p>
                </div>
                <CheckCircle className="h-5 w-5 text-gain shrink-0" />
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
