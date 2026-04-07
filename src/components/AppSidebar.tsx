import {
  LayoutDashboard, Building2, Upload, TrendingUp, LineChart,
  Briefcase, ArrowLeftRight, Eye, Settings, History, Calculator, LogOut, Sun, Moon, BarChart3, Table2, Receipt, FileText, Bell, DollarSign, Shield, BookOpen
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const mainItems = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("nav.companies"), url: "/companies", icon: Building2 },
    { title: i18n.language === "es" ? "Seguimiento" : "Tracking", url: "/tracking", icon: BarChart3 },
    { title: t("nav.upload"), url: "/upload", icon: Upload },
  ];

  const analysisItems = [
    { title: t("nav.financials"), url: "/financials", icon: TrendingUp },
    { title: "Modelo Financiero", url: "/model", icon: Table2 },
    { title: t("nav.valuation"), url: "/valuation", icon: Calculator },
    { title: t("nav.projection"), url: "/projection", icon: LineChart },
    { title: t("nav.assumptions"), url: "/assumptions", icon: Settings },
  ];

  const portfolioItems = [
    { title: t("nav.portfolio"), url: "/portfolio", icon: Briefcase },
    { title: t("nav.trades"), url: "/trades", icon: ArrowLeftRight },
    { title: i18n.language === "es" ? "Dividendos" : "Dividends", url: "/dividends", icon: DollarSign },
    { title: i18n.language === "es" ? "Fiscal" : "Tax Summary", url: "/fiscal", icon: Receipt },
    { title: i18n.language === "es" ? "Riesgo" : "Risk", url: "/risk", icon: Shield },
    { title: t("nav.watchlist"), url: "/watchlist", icon: Eye },
    { title: i18n.language === "es" ? "Tesis" : "Theses", url: "/theses", icon: FileText },
    { title: i18n.language === "es" ? "Alertas" : "Alerts", url: "/alerts", icon: Bell },
    { title: "Journal", url: "/journal", icon: BookOpen },
  ];

  const systemItems = [
    { title: t("nav.versions"), url: "/versions", icon: History },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const isActive = (url: string) => url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup key={label}>
      {!collapsed && (
        <SidebarGroupLabel className="text-sidebar-foreground/40 text-[10px] font-semibold uppercase tracking-[0.1em] mb-1 px-3">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActive(item.url);
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild>
                  <NavLink
                    to={item.url}
                    end={item.url === "/"}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ${
                      active
                        ? "sidebar-active-item bg-sidebar-accent text-sidebar-primary font-medium"
                        : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                    }`}
                    activeClassName="sidebar-active-item bg-sidebar-accent text-sidebar-primary font-medium"
                  >
                    <item.icon className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-sidebar-primary" : ""}`} />
                    {!collapsed && <span>{item.title}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  const toggleLang = () => i18n.changeLanguage(i18n.language === "es" ? "en" : "es");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/50">
      {/* Logo */}
      <div className="flex h-14 items-center gap-3 px-4 border-b border-sidebar-border/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shadow-lg shadow-sidebar-primary/20">
          <TrendingUp className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-sidebar-foreground text-lg tracking-tight">
            Club <span className="text-sidebar-primary">Premium</span>
          </span>
        )}
      </div>
      <SidebarContent className="pt-3 px-2">
        {renderGroup("General", mainItems)}
        {renderGroup(collapsed ? "" : (i18n.language === "es" ? "Análisis" : "Analysis"), analysisItems)}
        {renderGroup(collapsed ? "" : (i18n.language === "es" ? "Cartera" : "Portfolio"), portfolioItems)}
        {renderGroup(collapsed ? "" : (i18n.language === "es" ? "Sistema" : "System"), systemItems)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 p-3">
        <div className={`flex ${collapsed ? "flex-col" : "flex-row"} items-center gap-1`}>
          <button onClick={toggleTheme} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-all duration-150" title={theme === "dark" ? "Light mode" : "Dark mode"}>
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={toggleLang} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/50 hover:text-sidebar-foreground transition-all duration-150 text-xs font-bold" title="Switch language">
            {i18n.language === "es" ? "EN" : "ES"}
          </button>
          <button onClick={async () => { await signOut(); navigate("/login"); }} className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-destructive/20 text-sidebar-foreground/50 hover:text-destructive transition-all duration-150" title="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
