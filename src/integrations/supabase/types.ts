export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      companies: {
        Row: {
          country: string
          created_at: string
          currency: string
          current_price: number | null
          estimated_annual_return: number | null
          exchange: string | null
          id: string
          last_price_update: string | null
          market_cap: number | null
          name: string
          next_earnings_date: string | null
          notes: string | null
          price_for_15_return: number | null
          sector: string | null
          shares_outstanding: number | null
          target_price_5y: number | null
          ticker: string
          updated_at: string
          user_id: string
          week_52_high: number | null
          week_52_low: number | null
        }
        Insert: {
          country?: string
          created_at?: string
          currency?: string
          current_price?: number | null
          estimated_annual_return?: number | null
          exchange?: string | null
          id?: string
          last_price_update?: string | null
          market_cap?: number | null
          name: string
          next_earnings_date?: string | null
          notes?: string | null
          price_for_15_return?: number | null
          sector?: string | null
          shares_outstanding?: number | null
          target_price_5y?: number | null
          ticker: string
          updated_at?: string
          user_id: string
          week_52_high?: number | null
          week_52_low?: number | null
        }
        Update: {
          country?: string
          created_at?: string
          currency?: string
          current_price?: number | null
          estimated_annual_return?: number | null
          exchange?: string | null
          id?: string
          last_price_update?: string | null
          market_cap?: number | null
          name?: string
          next_earnings_date?: string | null
          notes?: string | null
          price_for_15_return?: number | null
          sector?: string | null
          shares_outstanding?: number | null
          target_price_5y?: number | null
          ticker?: string
          updated_at?: string
          user_id?: string
          week_52_high?: number | null
          week_52_low?: number | null
        }
        Relationships: []
      }
      company_assumptions: {
        Row: {
          company_id: string
          conservative_discount: number | null
          created_at: string
          custom_params: Json | null
          discount_rate: number | null
          fcf_multiple: number | null
          id: string
          net_margin_target: number | null
          optimistic_premium: number | null
          revenue_growth_rate: number | null
          target_pe: number | null
          terminal_growth_rate: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          conservative_discount?: number | null
          created_at?: string
          custom_params?: Json | null
          discount_rate?: number | null
          fcf_multiple?: number | null
          id?: string
          net_margin_target?: number | null
          optimistic_premium?: number | null
          revenue_growth_rate?: number | null
          target_pe?: number | null
          terminal_growth_rate?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          conservative_discount?: number | null
          created_at?: string
          custom_params?: Json | null
          discount_rate?: number | null
          fcf_multiple?: number | null
          id?: string
          net_margin_target?: number | null
          optimistic_premium?: number | null
          revenue_growth_rate?: number | null
          target_pe?: number | null
          terminal_growth_rate?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_assumptions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dividends: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          currency: string
          ex_date: string | null
          id: string
          notes: string | null
          payment_date: string
          portfolio_id: string
          shares_held: number | null
          user_id: string
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          currency?: string
          ex_date?: string | null
          id?: string
          notes?: string | null
          payment_date: string
          portfolio_id: string
          shares_held?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          currency?: string
          ex_date?: string | null
          id?: string
          notes?: string | null
          payment_date?: string
          portfolio_id?: string
          shares_held?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dividends_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dividends_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      excel_uploads: {
        Row: {
          company_id: string | null
          created_at: string
          detected_company: string | null
          detected_ticker: string | null
          error_message: string | null
          file_hash: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          periods_extracted: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          detected_company?: string | null
          detected_ticker?: string | null
          error_message?: string | null
          file_hash?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          periods_extracted?: number | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          detected_company?: string | null
          detected_ticker?: string | null
          error_message?: string | null
          file_hash?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          periods_extracted?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "excel_uploads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_periods: {
        Row: {
          bvps: number | null
          capex: number | null
          cash: number | null
          company_id: string
          created_at: string
          diluted_shares: number | null
          dividend_per_share: number | null
          ebit: number | null
          ebitda: number | null
          eps: number | null
          ev_ebitda: number | null
          fcf: number | null
          fcf_growth: number | null
          fcf_per_share: number | null
          fiscal_year: number
          id: string
          margin_ebitda: number | null
          margin_fcf: number | null
          margin_net: number | null
          net_debt: number | null
          net_income: number | null
          net_income_growth: number | null
          p_fcf: number | null
          pe_ratio: number | null
          revenue: number | null
          revenue_growth: number | null
          roe: number | null
          roic: number | null
          total_debt: number | null
          updated_at: string
          upload_id: string | null
          user_id: string
        }
        Insert: {
          bvps?: number | null
          capex?: number | null
          cash?: number | null
          company_id: string
          created_at?: string
          diluted_shares?: number | null
          dividend_per_share?: number | null
          ebit?: number | null
          ebitda?: number | null
          eps?: number | null
          ev_ebitda?: number | null
          fcf?: number | null
          fcf_growth?: number | null
          fcf_per_share?: number | null
          fiscal_year: number
          id?: string
          margin_ebitda?: number | null
          margin_fcf?: number | null
          margin_net?: number | null
          net_debt?: number | null
          net_income?: number | null
          net_income_growth?: number | null
          p_fcf?: number | null
          pe_ratio?: number | null
          revenue?: number | null
          revenue_growth?: number | null
          roe?: number | null
          roic?: number | null
          total_debt?: number | null
          updated_at?: string
          upload_id?: string | null
          user_id: string
        }
        Update: {
          bvps?: number | null
          capex?: number | null
          cash?: number | null
          company_id?: string
          created_at?: string
          diluted_shares?: number | null
          dividend_per_share?: number | null
          ebit?: number | null
          ebitda?: number | null
          eps?: number | null
          ev_ebitda?: number | null
          fcf?: number | null
          fcf_growth?: number | null
          fcf_per_share?: number | null
          fiscal_year?: number
          id?: string
          margin_ebitda?: number | null
          margin_fcf?: number | null
          margin_net?: number | null
          net_debt?: number | null
          net_income?: number | null
          net_income_growth?: number | null
          p_fcf?: number | null
          pe_ratio?: number | null
          revenue?: number | null
          revenue_growth?: number | null
          roe?: number | null
          roic?: number | null
          total_debt?: number | null
          updated_at?: string
          upload_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_periods_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "excel_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      market_snapshots: {
        Row: {
          company_id: string
          created_at: string
          id: string
          market_cap: number | null
          price: number
          snapshot_date: string
          source: string | null
          user_id: string
          volume: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          market_cap?: number | null
          price: number
          snapshot_date?: string
          source?: string | null
          user_id: string
          volume?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          market_cap?: number | null
          price?: number
          snapshot_date?: string
          source?: string | null
          user_id?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_positions: {
        Row: {
          avg_cost: number
          company_id: string
          created_at: string
          currency: string
          id: string
          portfolio_id: string
          shares: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cost?: number
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          portfolio_id: string
          shares?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cost?: number
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          portfolio_id?: string
          shares?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_positions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolio_positions_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolios: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projection_years: {
        Row: {
          company_id: string
          created_at: string
          expected_return: number | null
          fcf: number | null
          id: string
          intrinsic_value: number | null
          net_income: number | null
          projection_year: number
          revenue: number | null
          target_price: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          expected_return?: number | null
          fcf?: number | null
          id?: string
          intrinsic_value?: number | null
          net_income?: number | null
          projection_year: number
          revenue?: number | null
          target_price?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          expected_return?: number | null
          fcf?: number | null
          id?: string
          intrinsic_value?: number | null
          net_income?: number | null
          projection_year?: number
          revenue?: number | null
          target_price?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projection_years_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          commission: number | null
          company_id: string
          created_at: string
          currency: string
          id: string
          notes: string | null
          portfolio_id: string
          price: number
          shares: number
          total: number
          trade_date: string
          trade_type: string
          user_id: string
        }
        Insert: {
          commission?: number | null
          company_id: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          portfolio_id: string
          price: number
          shares: number
          total: number
          trade_date?: string
          trade_type: string
          user_id: string
        }
        Update: {
          commission?: number | null
          company_id?: string
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          portfolio_id?: string
          price?: number
          shares?: number
          total?: number
          trade_date?: string
          trade_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_portfolio_id_fkey"
            columns: ["portfolio_id"]
            isOneToOne: false
            referencedRelation: "portfolios"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          currency: string
          id: string
          language: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          language?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          language?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      valuation_results: {
        Row: {
          calculated_at: string
          company_id: string
          created_at: string
          current_price: number | null
          id: string
          intrinsic_value: number
          margin_of_safety: number | null
          recommendation: string | null
          scenario_id: string
          upside_percent: number | null
          user_id: string
        }
        Insert: {
          calculated_at?: string
          company_id: string
          created_at?: string
          current_price?: number | null
          id?: string
          intrinsic_value: number
          margin_of_safety?: number | null
          recommendation?: string | null
          scenario_id: string
          upside_percent?: number | null
          user_id: string
        }
        Update: {
          calculated_at?: string
          company_id?: string
          created_at?: string
          current_price?: number | null
          id?: string
          intrinsic_value?: number
          margin_of_safety?: number | null
          recommendation?: string | null
          scenario_id?: string
          upside_percent?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "valuation_results_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "valuation_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      valuation_scenarios: {
        Row: {
          company_id: string
          created_at: string
          discount_rate: number | null
          growth_rate: number | null
          id: string
          method: string
          scenario_type: string
          target_multiple: number
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          discount_rate?: number | null
          growth_rate?: number | null
          id?: string
          method: string
          scenario_type: string
          target_multiple: number
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          discount_rate?: number | null
          growth_rate?: number | null
          id?: string
          method?: string
          scenario_type?: string
          target_multiple?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "valuation_scenarios_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlist_items: {
        Row: {
          alert_below: number | null
          company_id: string
          created_at: string
          id: string
          notes: string | null
          user_id: string
          watchlist_id: string
        }
        Insert: {
          alert_below?: number | null
          company_id: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id: string
          watchlist_id: string
        }
        Update: {
          alert_below?: number | null
          company_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          user_id?: string
          watchlist_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "watchlist_items_watchlist_id_fkey"
            columns: ["watchlist_id"]
            isOneToOne: false
            referencedRelation: "watchlists"
            referencedColumns: ["id"]
          },
        ]
      }
      watchlists: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
