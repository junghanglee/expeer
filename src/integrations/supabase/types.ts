export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ads: {
        Row: {
          asset: string;
          available_amount: number;
          created_at: string;
          expected_fill_sec: number | null;
          fiat: string | null;
          filled_amount: number;
          id: string;
          is_market: boolean;
          kind: Database["public"]["Enums"]["ad_kind"];
          max_order: number;
          min_order: number;
          network: string;
          payment_methods: string[];
          premium_pct: number | null;
          price: number;
          side: Database["public"]["Enums"]["ad_side"];
          status: Database["public"]["Enums"]["ad_status"];
          terms: string | null;
          to_amount: number | null;
          to_asset: string | null;
          to_network: string | null;
          total_amount: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset: string;
          available_amount: number;
          created_at?: string;
          expected_fill_sec?: number | null;
          fiat?: string | null;
          filled_amount?: number;
          id?: string;
          is_market?: boolean;
          kind?: Database["public"]["Enums"]["ad_kind"];
          max_order: number;
          min_order: number;
          network: string;
          payment_methods?: string[];
          premium_pct?: number | null;
          price: number;
          side: Database["public"]["Enums"]["ad_side"];
          status?: Database["public"]["Enums"]["ad_status"];
          terms?: string | null;
          to_amount?: number | null;
          to_asset?: string | null;
          to_network?: string | null;
          total_amount: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset?: string;
          available_amount?: number;
          created_at?: string;
          expected_fill_sec?: number | null;
          fiat?: string | null;
          filled_amount?: number;
          id?: string;
          is_market?: boolean;
          kind?: Database["public"]["Enums"]["ad_kind"];
          max_order?: number;
          min_order?: number;
          network?: string;
          payment_methods?: string[];
          premium_pct?: number | null;
          price?: number;
          side?: Database["public"]["Enums"]["ad_side"];
          status?: Database["public"]["Enums"]["ad_status"];
          terms?: string | null;
          to_amount?: number | null;
          to_asset?: string | null;
          to_network?: string | null;
          total_amount?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: Json;
        };
        Update: {
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      bank_accounts: {
        Row: {
          account_holder: string;
          account_number: string;
          bank_name: string;
          created_at: string;
          id: string;
          is_primary: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          account_holder: string;
          account_number: string;
          bank_name: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          account_holder?: string;
          account_number?: string;
          bank_name?: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      disputes: {
        Row: {
          created_at: string;
          description: string | null;
          evidence_urls: string[] | null;
          id: string;
          opener_id: string;
          order_id: string;
          reason: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolver_id: string | null;
          status: Database["public"]["Enums"]["dispute_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          evidence_urls?: string[] | null;
          id?: string;
          opener_id: string;
          order_id: string;
          reason: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolver_id?: string | null;
          status?: Database["public"]["Enums"]["dispute_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          evidence_urls?: string[] | null;
          id?: string;
          opener_id?: string;
          order_id?: string;
          reason?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolver_id?: string | null;
          status?: Database["public"]["Enums"]["dispute_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "disputes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence_packages: {
        Row: {
          created_at: string;
          dispute_id: string | null;
          file_size_bytes: number | null;
          id: string;
          item_counts: Json | null;
          order_id: string;
          requested_by: string;
        };
        Insert: {
          created_at?: string;
          dispute_id?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          item_counts?: Json | null;
          order_id: string;
          requested_by: string;
        };
        Update: {
          created_at?: string;
          dispute_id?: string | null;
          file_size_bytes?: number | null;
          id?: string;
          item_counts?: Json | null;
          order_id?: string;
          requested_by?: string;
        };
        Relationships: [];
      };
      kyc_submissions: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          id_back_url: string | null;
          id_front_url: string | null;
          id_number: string;
          id_type: string;
          reviewed_at: string | null;
          reviewer_id: string | null;
          reviewer_note: string | null;
          selfie_url: string | null;
          status: Database["public"]["Enums"]["kyc_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id?: string;
          id_back_url?: string | null;
          id_front_url?: string | null;
          id_number: string;
          id_type: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          reviewer_note?: string | null;
          selfie_url?: string | null;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          id_back_url?: string | null;
          id_front_url?: string | null;
          id_number?: string;
          id_type?: string;
          reviewed_at?: string | null;
          reviewer_id?: string | null;
          reviewer_note?: string | null;
          selfie_url?: string | null;
          status?: Database["public"]["Enums"]["kyc_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          attachment_url: string | null;
          content: string | null;
          created_at: string;
          id: string;
          metadata: Json | null;
          order_id: string;
          read_at: string | null;
          sender_id: string | null;
          type: Database["public"]["Enums"]["message_type"];
        };
        Insert: {
          attachment_url?: string | null;
          content?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          order_id: string;
          read_at?: string | null;
          sender_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
        };
        Update: {
          attachment_url?: string | null;
          content?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json | null;
          order_id?: string;
          read_at?: string | null;
          sender_id?: string | null;
          type?: Database["public"]["Enums"]["message_type"];
        };
        Relationships: [
          {
            foreignKeyName: "messages_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          metadata: Json | null;
          read_at: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          metadata?: Json | null;
          read_at?: string | null;
          title: string;
          type: Database["public"]["Enums"]["notification_type"];
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          metadata?: Json | null;
          read_at?: string | null;
          title?: string;
          type?: Database["public"]["Enums"]["notification_type"];
          user_id?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          ad_id: string;
          amount: number;
          asset: string;
          buyer_bank_account_id: string | null;
          buyer_cancel_requested_at: string | null;
          buyer_fee_amount: number;
          buyer_fee_pct: number;
          buyer_id: string;
          buyer_wallet_id: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          chain: string | null;
          completed_at: string | null;
          confirmed_at: string | null;
          created_at: string;
          escrow_contract_address: string | null;
          escrow_lock_tx_hash: string | null;
          escrow_order_id: string | null;
          escrow_order_id_hash: string | null;
          escrow_release_tx_hash: string | null;
          escrow_status: Database["public"]["Enums"]["escrow_status"];
          expires_at: string;
          fiat: string;
          fiat_amount: number;
          id: string;
          network: string;
          paid_at: string | null;
          payment_metadata: Json | null;
          price: number;
          price_snapshot_at: string | null;
          price_snapshot_krw: number | null;
          price_source: string | null;
          released_at: string | null;
          seller_bank_account_id: string | null;
          seller_cancel_requested_at: string | null;
          seller_fee_amount: number;
          seller_fee_pct: number;
          seller_id: string;
          status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
        };
        Insert: {
          ad_id: string;
          amount: number;
          asset: string;
          buyer_bank_account_id?: string | null;
          buyer_cancel_requested_at?: string | null;
          buyer_fee_amount?: number;
          buyer_fee_pct?: number;
          buyer_id: string;
          buyer_wallet_id?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          chain?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          escrow_contract_address?: string | null;
          escrow_lock_tx_hash?: string | null;
          escrow_order_id?: string | null;
          escrow_order_id_hash?: string | null;
          escrow_release_tx_hash?: string | null;
          escrow_status?: Database["public"]["Enums"]["escrow_status"];
          expires_at: string;
          fiat: string;
          fiat_amount: number;
          id?: string;
          network: string;
          paid_at?: string | null;
          payment_metadata?: Json | null;
          price: number;
          price_snapshot_at?: string | null;
          price_snapshot_krw?: number | null;
          price_source?: string | null;
          released_at?: string | null;
          seller_bank_account_id?: string | null;
          seller_cancel_requested_at?: string | null;
          seller_fee_amount?: number;
          seller_fee_pct?: number;
          seller_id: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Update: {
          ad_id?: string;
          amount?: number;
          asset?: string;
          buyer_bank_account_id?: string | null;
          buyer_cancel_requested_at?: string | null;
          buyer_fee_amount?: number;
          buyer_fee_pct?: number;
          buyer_id?: string;
          buyer_wallet_id?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          chain?: string | null;
          completed_at?: string | null;
          confirmed_at?: string | null;
          created_at?: string;
          escrow_contract_address?: string | null;
          escrow_lock_tx_hash?: string | null;
          escrow_order_id?: string | null;
          escrow_order_id_hash?: string | null;
          escrow_release_tx_hash?: string | null;
          escrow_status?: Database["public"]["Enums"]["escrow_status"];
          expires_at?: string;
          fiat?: string;
          fiat_amount?: number;
          id?: string;
          network?: string;
          paid_at?: string | null;
          payment_metadata?: Json | null;
          price?: number;
          price_snapshot_at?: string | null;
          price_snapshot_krw?: number | null;
          price_source?: string | null;
          released_at?: string | null;
          seller_bank_account_id?: string | null;
          seller_cancel_requested_at?: string | null;
          seller_fee_amount?: number;
          seller_fee_pct?: number;
          seller_id?: string;
          status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_ad_id_fkey";
            columns: ["ad_id"];
            isOneToOne: false;
            referencedRelation: "ads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_buyer_bank_account_id_fkey";
            columns: ["buyer_bank_account_id"];
            isOneToOne: false;
            referencedRelation: "bank_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_buyer_wallet_id_fkey";
            columns: ["buyer_wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_seller_bank_account_id_fkey";
            columns: ["seller_bank_account_id"];
            isOneToOne: false;
            referencedRelation: "bank_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_proofs: {
        Row: {
          amount: number | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          created_at: string;
          id: string;
          image_url: string;
          note: string | null;
          order_id: string;
          uploaded_by: string;
        };
        Insert: {
          amount?: number | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: string;
          image_url: string;
          note?: string | null;
          order_id: string;
          uploaded_by: string;
        };
        Update: {
          amount?: number | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          created_at?: string;
          id?: string;
          image_url?: string;
          note?: string | null;
          order_id?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_proofs_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          id: string;
          is_suspended: boolean;
          kyc_level: number;
          kyc_status: Database["public"]["Enums"]["kyc_status"];
          nickname: string | null;
          phone: string | null;
          rating: number;
          real_name: string | null;
          trade_count: number;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          id: string;
          is_suspended?: boolean;
          kyc_level?: number;
          kyc_status?: Database["public"]["Enums"]["kyc_status"];
          nickname?: string | null;
          phone?: string | null;
          rating?: number;
          real_name?: string | null;
          trade_count?: number;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          is_suspended?: boolean;
          kyc_level?: number;
          kyc_status?: Database["public"]["Enums"]["kyc_status"];
          nickname?: string | null;
          phone?: string | null;
          rating?: number;
          real_name?: string | null;
          trade_count?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          id: string;
          order_id: string;
          rating: number;
          reviewee_id: string;
          reviewer_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          order_id: string;
          rating: number;
          reviewee_id: string;
          reviewer_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          id?: string;
          order_id?: string;
          rating?: number;
          reviewee_id?: string;
          reviewer_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      transfers: {
        Row: {
          amount: number;
          asset: string;
          confirmed_at: string | null;
          created_at: string;
          id: string;
          network: string;
          order_id: string;
          sender_id: string;
          to_address: string;
          tx_hash: string | null;
        };
        Insert: {
          amount: number;
          asset: string;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          network: string;
          order_id: string;
          sender_id: string;
          to_address: string;
          tx_hash?: string | null;
        };
        Update: {
          amount?: number;
          asset?: string;
          confirmed_at?: string | null;
          created_at?: string;
          id?: string;
          network?: string;
          order_id?: string;
          sender_id?: string;
          to_address?: string;
          tx_hash?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transfers_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          address: string;
          asset: string;
          created_at: string;
          id: string;
          is_primary: boolean;
          label: string | null;
          network: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          address: string;
          asset: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          label?: string | null;
          network: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          address?: string;
          asset?: string;
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          label?: string | null;
          network?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_order_bank_accounts: {
        Args: { _order_id: string };
        Returns: {
          role: "seller" | "buyer";
          bank_name: string;
          account_number: string;
          account_holder: string;
        }[];
      };
      get_primary_bank_account_id: {
        Args: { _user_id: string };
        Returns: string;
      };
      get_user_trade_volume: {
        Args: { _since: string; _user_id: string };
        Returns: number;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      ad_kind: "fiat" | "crypto_swap";
      ad_side: "buy" | "sell";
      ad_status: "active" | "paused" | "completed" | "cancelled";
      app_role: "admin" | "user";
      dispute_status: "open" | "reviewing" | "resolved_buyer" | "resolved_seller" | "closed";
      escrow_status: "none" | "locked" | "released" | "refunded" | "disputed";
      kyc_status: "none" | "pending" | "approved" | "rejected";
      message_type: "text" | "image" | "system" | "proof" | "transfer";
      notification_type: "order" | "message" | "dispute" | "kyc" | "system";
      order_status:
        | "created"
        | "info_shared"
        | "paid"
        | "proof_uploaded"
        | "confirmed"
        | "released"
        | "completed"
        | "cancelled"
        | "disputed"
        | "expired";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ad_kind: ["fiat", "crypto_swap"],
      ad_side: ["buy", "sell"],
      ad_status: ["active", "paused", "completed", "cancelled"],
      app_role: ["admin", "user"],
      dispute_status: ["open", "reviewing", "resolved_buyer", "resolved_seller", "closed"],
      escrow_status: ["none", "locked", "released", "refunded", "disputed"],
      kyc_status: ["none", "pending", "approved", "rejected"],
      message_type: ["text", "image", "system", "proof", "transfer"],
      notification_type: ["order", "message", "dispute", "kyc", "system"],
      order_status: [
        "created",
        "info_shared",
        "paid",
        "proof_uploaded",
        "confirmed",
        "released",
        "completed",
        "cancelled",
        "disputed",
        "expired",
      ],
    },
  },
} as const;
