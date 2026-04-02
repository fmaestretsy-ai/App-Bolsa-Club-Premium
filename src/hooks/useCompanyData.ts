import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useCompanies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const [{ data: companies, error: companiesError }, { data: uploads, error: uploadsError }] = await Promise.all([
        supabase
          .from("companies")
          .select("*")
          .order("updated_at", { ascending: false }),
        supabase
          .from("excel_uploads")
          .select("company_id")
          .not("company_id", "is", null),
      ]);

      if (companiesError) throw companiesError;
      if (uploadsError) throw uploadsError;

      const activeCompanyIds = new Set((uploads ?? []).map((upload) => upload.company_id).filter(Boolean));
      return (companies ?? []).filter((company) => activeCompanyIds.has(company.id));
    },
    enabled: !!user,
  });
}

export function useCompany(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!id,
  });
}

export function useFinancialPeriods(companyId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["financial-periods", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_periods")
        .select("*")
        .eq("company_id", companyId!)
        .order("fiscal_year", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!companyId,
  });
}

export function useCompanyAssumptions(companyId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assumptions", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_assumptions")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!companyId,
  });
}

export function useValuationScenarios(companyId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["valuation-scenarios", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("valuation_scenarios")
        .select("*")
        .eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!companyId,
  });
}

export function useProjectionYears(companyId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["projection-years", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projection_years")
        .select("*")
        .eq("company_id", companyId!)
        .order("projection_year", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!companyId,
  });
}
