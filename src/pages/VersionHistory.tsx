import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Calculator, Settings, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const badgeColor = (status: string) => {
  switch (status) {
    case "success": return "bg-green-500/10 text-green-500";
    case "pending": return "bg-yellow-500/10 text-yellow-500";
    case "error": return "bg-red-500/10 text-red-500";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function VersionHistory() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: uploads = [], isLoading } = useQuery({
    queryKey: ["version-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("excel_uploads")
        .select("*, companies(name, ticker)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.versions")}</h1>
        {uploads.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground">Sin historial. Sube un Excel para comenzar.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {uploads.map((u: any) => (
              <Card key={u.id} className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.companies?.ticker && <span className="font-medium">{u.companies.ticker}</span>}
                    {u.companies?.name && ` · ${u.companies.name}`}
                    {` · ${u.periods_extracted || 0} períodos`}
                    {` · ${new Date(u.created_at).toLocaleString()}`}
                  </p>
                </div>
                <Badge className={badgeColor(u.status)} variant="secondary">
                  {u.status === "success" ? "Completado" : u.status === "error" ? "Error" : u.status}
                </Badge>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
