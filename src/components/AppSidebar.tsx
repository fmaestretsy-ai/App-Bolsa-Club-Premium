import {
  LayoutDashboard, Building2, Upload, TrendingUp, LineChart,
  Briefcase, ArrowLeftRight, Eye, Settings, History, Calculator, LogOut, Sun, Moon, BarChart3
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
    { title: t("nav.upload"), url: "/upload", icon: Upload },
  ];

  const analysisItems = [
    { title: t("nav.financials"), url: "/financials", icon: TrendingUp },
    { title: t("nav.valuation"), url: "/valuation", icon: Calculator },
    { title: t("nav.projection"), url: "/projection", icon: LineChart },
    { title: t("nav.assumptions"), url: "/assumptions", icon: Settings },
  ];

  const portfolioItems = [
    { title: t("nav.portfolio"), url: "/portfolio", icon: Briefcase },
    { title: t("nav.trades"), url: "/trades", icon: ArrowLeftRight },
    { title: t("nav.watchlist"), url: "/watchlist", icon: Eye },
  ];

  const systemItems = [
    { title: t("nav.versions"), url: "/versions", icon: History },
    { title: t("nav.settings"), url: "/settings", icon: Settings },
  ];

  const renderGroup = (label: string, items: typeof mainItems) => (
    <SidebarGroup key={label}>
      {!collapsed && <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase tracking-wider">{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === "/"}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="text-sm">{item.title}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  const toggleLang = () => i18n.changeLanguage(i18n.language === "es" ? "en" : "es");

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <TrendingUp className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && <span className="font-bold text-sidebar-foreground text-lg tracking-tight">Club Premium</span>}
      </div>
      <SidebarContent className="pt-2">
        {renderGroup("General", mainItems)}
        {renderGroup(collapsed ? "" : (i18n.language === "es" ? "Análisis" : "Analysis"), analysisItems)}
        {renderGroup(collapsed ? "" : (i18n.language === "es" ? "Cartera" : "Portfolio"), portfolioItems)}
        {renderGroup(collapsed ? "" : (i18n.language === "es" ? "Sistema" : "System"), systemItems)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <div className={`flex ${collapsed ? "flex-col" : "flex-row"} items-center gap-1`}>
          <button onClick={toggleTheme} className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={toggleLang} className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors text-xs font-semibold">
            {i18n.language === "es" ? "EN" : "ES"}
          </button>
          <button onClick={async () => { await signOut(); navigate("/login"); }} className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
