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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_identity: string
          created_at: string
          details: Json
          id: number
        }
        Insert: {
          action: string
          admin_identity: string
          created_at?: string
          details?: Json
          id?: number
        }
        Update: {
          action?: string
          admin_identity?: string
          created_at?: string
          details?: Json
          id?: number
        }
        Relationships: []
      }
      admin_login_attempts: {
        Row: {
          created_at: string
          id: number
          ip: string
          success: boolean
        }
        Insert: {
          created_at?: string
          id?: number
          ip: string
          success: boolean
        }
        Update: {
          created_at?: string
          id?: number
          ip?: string
          success?: boolean
        }
        Relationships: []
      }
      admin_sessions: {
        Row: {
          created_at: string
          expires_at: string
          ip: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          ip?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          ip?: string | null
          token_hash?: string
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          revoked: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          revoked?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          revoked?: boolean
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      balance_transactions: {
        Row: {
          admin_identity: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          id: string
          kind: string
          reason: string
          reference: string
          user_id: string
        }
        Insert: {
          admin_identity?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          id?: string
          kind: string
          reason: string
          reference: string
          user_id: string
        }
        Update: {
          admin_identity?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          id?: string
          kind?: string
          reason?: string
          reference?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_reservations: {
        Row: {
          amount: number
          charged: number | null
          created_at: string
          finalized_at: string | null
          id: string
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          charged?: number | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          charged?: number | null
          created_at?: string
          finalized_at?: string | null
          id?: string
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      gateways: {
        Row: {
          api_key: string
          base_url: string
          created_at: string
          enabled: boolean
          id: string
          last_error: string | null
          last_latency_ms: number | null
          last_model_count: number | null
          last_status: string | null
          last_tested_at: string | null
          name: string
          provider: string
          slug: string
          user_id: string | null
        }
        Insert: {
          api_key: string
          base_url: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_latency_ms?: number | null
          last_model_count?: number | null
          last_status?: string | null
          last_tested_at?: string | null
          name: string
          provider: string
          slug: string
          user_id?: string | null
        }
        Update: {
          api_key?: string
          base_url?: string
          created_at?: string
          enabled?: boolean
          id?: string
          last_error?: string | null
          last_latency_ms?: number | null
          last_model_count?: number | null
          last_status?: string | null
          last_tested_at?: string | null
          name?: string
          provider?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      login_sessions: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          status: string
          telegram_id: number | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          status?: string
          telegram_id?: number | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          status?: string
          telegram_id?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      models: {
        Row: {
          created_at: string
          display_name: string
          enabled: boolean
          gateway_id: string
          id: string
          input_rate: number
          is_free: boolean
          output_rate: number
          priority: number
          slug: string
          upstream_model: string
        }
        Insert: {
          created_at?: string
          display_name: string
          enabled?: boolean
          gateway_id: string
          id?: string
          input_rate?: number
          is_free?: boolean
          output_rate?: number
          priority?: number
          slug: string
          upstream_model: string
        }
        Update: {
          created_at?: string
          display_name?: string
          enabled?: boolean
          gateway_id?: string
          id?: string
          input_rate?: number
          is_free?: boolean
          output_rate?: number
          priority?: number
          slug?: string
          upstream_model?: string
        }
        Relationships: [
          {
            foreignKeyName: "models_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blocked: boolean
          created_at: string
          display_name: string | null
          id: string
          telegram_id: number | null
          telegram_username: string | null
          token_balance: number
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          display_name?: string | null
          id: string
          telegram_id?: number | null
          telegram_username?: string | null
          token_balance?: number
        }
        Update: {
          blocked?: boolean
          created_at?: string
          display_name?: string | null
          id?: string
          telegram_id?: number | null
          telegram_username?: string | null
          token_balance?: number
        }
        Relationships: []
      }
      redeem_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number
          tokens: number
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          tokens: number
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          tokens?: number
          uses?: number
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          code_id: string
          created_at: string
          id: string
          tokens: number
          user_id: string
        }
        Insert: {
          code_id: string
          created_at?: string
          id?: string
          tokens: number
          user_id: string
        }
        Update: {
          code_id?: string
          created_at?: string
          id?: string
          tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "redemptions_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "redeem_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_rules: {
        Row: {
          created_at: string
          gateway_id: string
          id: string
          model_pattern: string
          priority: number
          upstream_model: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          gateway_id: string
          id?: string
          model_pattern: string
          priority?: number
          upstream_model?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          gateway_id?: string
          id?: string
          model_pattern?: string
          priority?: number
          upstream_model?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routing_rules_gateway_id_fkey"
            columns: ["gateway_id"]
            isOneToOne: false
            referencedRelation: "gateways"
            referencedColumns: ["id"]
          },
        ]
      }
      topup_requests: {
        Row: {
          admin_note: string | null
          amount: string
          created_at: string
          id: string
          method: string
          reviewed_at: string | null
          status: string
          tokens_granted: number | null
          tokens_requested: number | null
          tx_ref: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: string
          created_at?: string
          id?: string
          method: string
          reviewed_at?: string | null
          status?: string
          tokens_granted?: number | null
          tokens_requested?: number | null
          tx_ref: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: string
          created_at?: string
          id?: string
          method?: string
          reviewed_at?: string | null
          status?: string
          tokens_granted?: number | null
          tokens_requested?: number | null
          tx_ref?: string
          user_id?: string
        }
        Relationships: []
      }
      usage_logs: {
        Row: {
          api_key_id: string | null
          completion_tokens: number | null
          cost_tokens: number
          created_at: string
          error: string | null
          gateway_id: string | null
          gateway_name: string | null
          id: string
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          status: number | null
          stream: boolean
          upstream_model: string | null
          user_id: string
        }
        Insert: {
          api_key_id?: string | null
          completion_tokens?: number | null
          cost_tokens?: number
          created_at?: string
          error?: string | null
          gateway_id?: string | null
          gateway_name?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          status?: number | null
          stream?: boolean
          upstream_model?: string | null
          user_id: string
        }
        Update: {
          api_key_id?: string | null
          completion_tokens?: number | null
          cost_tokens?: number
          created_at?: string
          error?: string | null
          gateway_id?: string | null
          gateway_name?: string | null
          id?: string
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          status?: number | null
          stream?: boolean
          upstream_model?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _ledger_apply: {
        Args: {
          _admin: string
          _amount: number
          _kind: string
          _reason: string
          _reference: string
          _uid: string
        }
        Returns: number
      }
      adjust_tokens: { Args: { _delta: number; _uid: string }; Returns: number }
      admin_adjust_balance: {
        Args: {
          _admin: string
          _amount: number
          _reason: string
          _reference: string
          _uid: string
        }
        Returns: {
          is_duplicate: boolean
          new_balance: number
        }[]
      }
      approve_topup: {
        Args: { _admin: string; _id: string; _note: string; _tokens: number }
        Returns: number
      }
      charge_tokens: {
        Args: { _amount: number; _uid: string }
        Returns: number
      }
      redeem_code: { Args: { _code: string; _uid: string }; Returns: number }
      release_credits: {
        Args: { _reason?: string; _rid: string }
        Returns: boolean
      }
      release_stale_credits: { Args: { _older_than?: string }; Returns: number }
      reserve_credits: {
        Args: { _amount: number; _note?: string; _uid: string }
        Returns: string
      }
      settle_credits: {
        Args: { _actual: number; _rid: string }
        Returns: number
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
