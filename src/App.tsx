import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import "@/lib/i18n";

import Login from "./pages/Login";
import Index from "./pages/Index";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import ExcelUpload from "./pages/ExcelUpload";
import FinancialHistory from "./pages/FinancialHistory";
import Valuation from "./pages/Valuation";
import FinancialModel from "./pages/FinancialModel";
import Projection from "./pages/Projection";
import Portfolio from "./pages/Portfolio";
import TradeHistory from "./pages/TradeHistory";
import Watchlist from "./pages/Watchlist";
import Assumptions from "./pages/Assumptions";
import VersionHistory from "./pages/VersionHistory";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Tracking from "./pages/Tracking";
import FiscalSummary from "./pages/FiscalSummary";
import InvestmentTheses from "./pages/InvestmentTheses";
import Alerts from "./pages/Alerts";
import Dividends from "./pages/Dividends";
import RiskControl from "./pages/RiskControl";
import Journal from "./pages/Journal";

const queryClient = new QueryClient();

const P = ({ children }: { children: React.ReactNode }) => <ProtectedRoute>{children}</ProtectedRoute>;

const App = () => (
  <ThemeProvider>
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<P><Index /></P>} />
              <Route path="/companies" element={<P><Companies /></P>} />
              <Route path="/companies/:id" element={<P><CompanyDetail /></P>} />
              <Route path="/upload" element={<P><ExcelUpload /></P>} />
              <Route path="/financials" element={<P><FinancialHistory /></P>} />
              <Route path="/valuation" element={<P><Valuation /></P>} />
              <Route path="/projection" element={<P><Projection /></P>} />
              <Route path="/model" element={<P><FinancialModel /></P>} />
              <Route path="/portfolio" element={<P><Portfolio /></P>} />
              <Route path="/trades" element={<P><TradeHistory /></P>} />
              <Route path="/watchlist" element={<P><Watchlist /></P>} />
              <Route path="/assumptions" element={<P><Assumptions /></P>} />
              <Route path="/versions" element={<P><VersionHistory /></P>} />
              <Route path="/settings" element={<P><SettingsPage /></P>} />
              <Route path="/tracking" element={<P><Tracking /></P>} />
              <Route path="/fiscal" element={<P><FiscalSummary /></P>} />
              <Route path="/theses" element={<P><InvestmentTheses /></P>} />
              <Route path="/alerts" element={<P><Alerts /></P>} />
              <Route path="/dividends" element={<P><Dividends /></P>} />
              <Route path="/risk" element={<P><RiskControl /></P>} />
              <Route path="/journal" element={<P><Journal /></P>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
