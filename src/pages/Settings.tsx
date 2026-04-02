import { useTranslation } from "react-i18next";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: settings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [currency, setCurrency] = useState("USD");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setCurrency(settings.currency);
      if (settings.language && settings.language !== i18n.language) {
        i18n.changeLanguage(settings.language);
      }
    }
  }, [settings]);

  const saveSettings = async (updates: Record<string, string>) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        language: updates.language || i18n.language,
        theme: updates.theme || theme,
        currency: updates.currency || currency,
      };

      if (settings?.id) {
        const { error } = await supabase.from("user_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_settings").insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["user-settings"] });
      toast.success("Configuración guardada");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
    saveSettings({ language: lang });
  };

  const handleCurrencyChange = (cur: string) => {
    setCurrency(cur);
    saveSettings({ currency: cur });
  };

  const handleThemeToggle = () => {
    toggleTheme();
    saveSettings({ theme: theme === "dark" ? "light" : "dark" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.settings")}</h1>

        <Card className="p-6 space-y-6">
          <h3 className="font-semibold text-card-foreground">General</h3>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Idioma</Label>
              <p className="text-xs text-muted-foreground">Elige tu idioma preferido</p>
            </div>
            <Select value={i18n.language} onValueChange={handleLanguageChange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Modo oscuro</Label>
              <p className="text-xs text-muted-foreground">Alternar apariencia oscura/clara</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={handleThemeToggle} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Moneda por defecto</Label>
              <p className="text-xs text-muted-foreground">Usada para cálculos de cartera</p>
            </div>
            <Select value={currency} onValueChange={handleCurrencyChange}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD ($)</SelectItem>
                <SelectItem value="EUR">EUR (€)</SelectItem>
                <SelectItem value="GBP">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <h3 className="font-semibold text-card-foreground">Cuenta</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">{user?.email ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Conectado via {user?.app_metadata?.provider ?? "email"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate("/login"); }}>
              {t("auth.logout")}
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
