import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "@/lib/i18n";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Companies from "./pages/Companies";
import CompanyDetail from "./pages/CompanyDetail";
import ExcelUpload from "./pages/ExcelUpload";
import FinancialHistory from "./pages/FinancialHistory";
import Valuation from "./pages/Valuation";
import Projection from "./pages/Projection";
import Portfolio from "./pages/Portfolio";
import TradeHistory from "./pages/TradeHistory";
import Watchlist from "./pages/Watchlist";
import Assumptions from "./pages/Assumptions";
import VersionHistory from "./pages/VersionHistory";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Index />} />
            <Route path="/companies" element={<Companies />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/upload" element={<ExcelUpload />} />
            <Route path="/financials" element={<FinancialHistory />} />
            <Route path="/valuation" element={<Valuation />} />
            <Route path="/projection" element={<Projection />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/trades" element={<TradeHistory />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/assumptions" element={<Assumptions />} />
            <Route path="/versions" element={<VersionHistory />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
