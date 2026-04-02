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

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground">{t("nav.settings")}</h1>

        <Card className="p-6 space-y-6">
          <h3 className="font-semibold text-card-foreground">General</h3>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Language</Label>
              <p className="text-xs text-muted-foreground">Choose your preferred language</p>
            </div>
            <Select value={i18n.language} onValueChange={(v) => i18n.changeLanguage(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Dark Mode</Label>
              <p className="text-xs text-muted-foreground">Toggle dark/light appearance</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-foreground">Default Currency</Label>
              <p className="text-xs text-muted-foreground">Used for portfolio calculations</p>
            </div>
            <Select defaultValue="usd">
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="usd">USD ($)</SelectItem>
                <SelectItem value="eur">EUR (€)</SelectItem>
                <SelectItem value="gbp">GBP (£)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-6 space-y-6">
          <h3 className="font-semibold text-card-foreground">Account</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">{user?.email ?? "—"}</p>
              <p className="text-xs text-muted-foreground">Signed in via {user?.app_metadata?.provider ?? "email"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={async () => { await signOut(); navigate("/login"); }}>{t("auth.logout")}</Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
