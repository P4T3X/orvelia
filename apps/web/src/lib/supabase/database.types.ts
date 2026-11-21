/**
 * Database types.
 *
 * Hand-written subset covering what the app uses through Phase 2. After applying
 * the migrations, replace this file with the generated version:
 *
 *   supabase gen types typescript --linked > apps/web/src/lib/supabase/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type PlanId = "free" | "plus" | "ultra";
type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
type ProcessingStatus = "uploaded" | "processing" | "needs_review" | "confirmed" | "failed";
type DocumentType = "receipt" | "invoice" | "warranty" | "manual" | "insurance" | "certificate" | "other";
type WarrantyKind = "manufacturer" | "store" | "extended" | "other";
type ReminderStatus = "scheduled" | "sent" | "dismissed" | "cancelled" | "failed";
type ReminderSource = "warranty" | "return" | "document" | "custom";
type Recurrence = "none" | "monthly" | "quarterly" | "semiannual" | "yearly";
type ProductStatus = "active" | "sold" | "gifted" | "archived" | "disposed";
type VerificationStatus = "extracted" | "manual" | "confirmed" | "needs_verification";
export type FamilyRole = "owner" | "admin" | "member";

/** Tables the app only reads so far; writes come with their modules. */
type ReadOnly<Row> = {
  Row: Row;
  Insert: Record<string, never>;
  Update: Record<string, never>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          preferred_language: string;
          preferred_currency: string;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: {
          full_name?: string | null;
          avatar_url?: string | null;
          preferred_language?: string;
          preferred_currency?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          provider: string;
          provider_customer_id: string | null;
          provider_subscription_id: string | null;
          plan: PlanId;
          status: SubscriptionStatus;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          last_payment_status: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, never>;
        Update: {
          provider?: string;
          provider_customer_id?: string | null;
          provider_subscription_id?: string | null;
          plan?: PlanId;
          status?: SubscriptionStatus;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          last_payment_status?: string | null;
        };
        Relationships: [];
      };
      feedback: {
        Row: { id: string; user_id: string; kind: "idea" | "problem" | "other"; message: string; page: string | null; created_at: string };
        Insert: { user_id: string; kind: "idea" | "problem" | "other"; message: string; page?: string | null };
        Update: Record<string, never>;
        Relationships: [];
      };
      shared_resources: ReadOnly<{
        id: string;
        family_id: string;
        owner_id: string;
        product_id: string;
        shared_by: string | null;
        created_at: string;
      }>;
      plan_limits: ReadOnly<{
        plan: PlanId;
        max_products: number | null;
        scans_per_month: number;
        storage_mb: number;
        ai_queries_per_month: number | null;
        price_monthly: number;
        currency: string;
        family_members: number;
        advanced_analytics: boolean;
        updated_at: string;
      }>;
      billing_checkouts: {
        Row: {
          id: string;
          user_id: string;
          plan: PlanId;
          amount: number;
          currency: string;
          provider: string;
          provider_subscription_id: string | null;
          status: "created" | "pending" | "authorized" | "cancelled" | "expired" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: { user_id: string; plan: PlanId; amount: number; currency: string; provider?: string };
        Update: {
          provider_subscription_id?: string | null;
          status?: "created" | "pending" | "authorized" | "cancelled" | "expired" | "failed";
        };
        Relationships: [];
      };
      billing_events: {
        Row: {
          id: string;
          provider: string;
          event_id: string;
          type: string;
          data_id: string | null;
          received_at: string;
          processed_at: string | null;
          error: string | null;
        };
        Insert: { provider: string; event_id: string; type: string; data_id: string | null };
        Update: { processed_at?: string | null; error?: string | null };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          brand: string | null;
          model: string | null;
          category_id: string | null;
          description: string | null;
          notes: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          currency: string | null;
          seller: string | null;
          serial_number: string | null;
          image_path: string | null;
          receipt_id: string | null;
          status: ProductStatus;
          search_text: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          brand?: string | null;
          model?: string | null;
          category_id?: string | null;
          description?: string | null;
          notes?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | string | null;
          currency?: string | null;
          seller?: string | null;
          serial_number?: string | null;
          image_path?: string | null;
          receipt_id?: string | null;
          status?: ProductStatus;
        };
        Update: {
          name?: string;
          brand?: string | null;
          model?: string | null;
          category_id?: string | null;
          description?: string | null;
          notes?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | string | null;
          currency?: string | null;
          seller?: string | null;
          serial_number?: string | null;
          image_path?: string | null;
          receipt_id?: string | null;
          status?: ProductStatus;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: { id: string; user_id: string | null; name: string; icon: string | null; created_at: string };
        Insert: { id?: string; user_id: string; name: string; icon?: string | null };
        Update: { name?: string; icon?: string | null };
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          user_id: string;
          merchant: string | null;
          receipt_number: string | null;
          purchase_date: string | null;
          total_amount: number | null;
          tax_amount: number | null;
          currency: string | null;
          storage_path: string | null;
          mime_type: string | null;
          size_bytes: number | null;
          processing_status: ProcessingStatus;
          extraction: Json | null;
          processing_error: string | null;
          field_sources: Json;
          confirmed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          storage_path?: string | null;
          mime_type?: string | null;
          size_bytes?: number | null;
          processing_status?: ProcessingStatus;
        };
        Update: {
          merchant?: string | null;
          receipt_number?: string | null;
          purchase_date?: string | null;
          total_amount?: number | string | null;
          tax_amount?: number | string | null;
          currency?: string | null;
          processing_status?: ProcessingStatus;
          extraction?: Json | null;
          processing_error?: string | null;
          field_sources?: Json;
          confirmed_at?: string | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          document_type: DocumentType;
          title: string;
          storage_path: string;
          mime_type: string | null;
          size_bytes: number | null;
          expires_on: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          product_id?: string | null;
          document_type: DocumentType;
          title: string;
          storage_path: string;
          mime_type?: string | null;
          size_bytes?: number | null;
          expires_on?: string | null;
        };
        Update: {
          product_id?: string | null;
          document_type?: DocumentType;
          title?: string;
          expires_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "documents_product_fk";
            columns: ["product_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      warranties: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          kind: WarrantyKind;
          provider: string | null;
          start_date: string | null;
          end_date: string | null;
          coverage_description: string | null;
          source_document_id: string | null;
          verification_status: VerificationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          product_id: string;
          kind: WarrantyKind;
          provider: string | null;
          start_date: string | null;
          end_date: string | null;
          coverage_description: string | null;
          source_document_id: string | null;
          verification_status: VerificationStatus;
        };
        Update: {
          kind?: WarrantyKind;
          provider?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          coverage_description?: string | null;
          source_document_id?: string | null;
          verification_status?: VerificationStatus;
        };
        Relationships: [
          {
            foreignKeyName: "warranties_product_fk";
            columns: ["product_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "warranties_document_fk";
            columns: ["source_document_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      return_deadlines: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          deadline_date: string;
          policy_details: string | null;
          source_document_id: string | null;
          verification_status: VerificationStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          product_id: string;
          deadline_date: string;
          policy_details: string | null;
          source_document_id: string | null;
          verification_status: VerificationStatus;
        };
        Update: {
          deadline_date?: string;
          policy_details?: string | null;
          source_document_id?: string | null;
          verification_status?: VerificationStatus;
        };
        Relationships: [
          {
            foreignKeyName: "return_deadlines_product_fk";
            columns: ["product_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "return_deadlines_document_fk";
            columns: ["source_document_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          product_id: string | null;
          title: string;
          description: string | null;
          scheduled_at: string;
          status: ReminderStatus;
          notification_channels: string[];
          sent_at: string | null;
          source: ReminderSource;
          source_id: string | null;
          lead_days: number | null;
          recurrence: Recurrence;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          product_id: string | null;
          title: string;
          description: string | null;
          scheduled_at: string;
          notification_channels: string[];
          recurrence: Recurrence;
          source?: "custom";
          status?: "scheduled";
        };
        Update: {
          title?: string;
          description?: string | null;
          scheduled_at?: string;
          status?: ReminderStatus;
          notification_channels?: string[];
          recurrence?: Recurrence;
          product_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reminders_product_fk";
            columns: ["product_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          email_enabled: boolean;
          warranty_lead_days: number[];
          return_lead_days: number[];
          document_lead_days: number[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          email_enabled: boolean;
          warranty_lead_days: number[];
          return_lead_days: number[];
          document_lead_days: number[];
        };
        Update: {
          email_enabled?: boolean;
          warranty_lead_days?: number[];
          return_lead_days?: number[];
          document_lead_days?: number[];
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          reminder_id: string | null;
          title: string;
          body: string | null;
          link: string | null;
          email_status: "sent" | "skipped" | "failed" | "not_requested";
          read_at: string | null;
          created_at: string;
        };
        Insert: Record<string, never>;
        Update: { read_at?: string | null };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      billing_overview: {
        Args: Record<string, never>;
        Returns: {
          effective_plan: PlanId;
          subscribed_plan: PlanId;
          status: SubscriptionStatus;
          provider: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          last_payment_status: string | null;
        }[];
      };
      reserve_assistant_query: { Args: { p_provider: string }; Returns: string };
      finish_usage: { Args: { p_usage_id: string; p_succeeded: boolean }; Returns: undefined };
      assistant_usage: {
        Args: Record<string, never>;
        Returns: { used: number; queries_per_month: number | null; plan: PlanId }[];
      };
      resync_my_reminders: { Args: Record<string, never>; Returns: number };
      claim_due_reminders: {
        Args: { p_limit: number };
        Returns: {
          id: string;
          user_id: string;
          email: string | null;
          full_name: string | null;
          title: string;
          description: string | null;
          product_id: string | null;
          source: ReminderSource;
          channels: string[];
          email_enabled: boolean;
          attempts: number;
          scheduled_at: string;
        }[];
      };
      complete_reminder: {
        Args: { p_id: string; p_email_status: string; p_error?: string | null; p_retry?: boolean };
        Returns: undefined;
      };
      reserve_scan: { Args: { p_receipt_id: string; p_provider: string }; Returns: string };
      finish_scan: { Args: { p_usage_id: string; p_succeeded: boolean }; Returns: undefined };
      scan_usage: {
        Args: Record<string, never>;
        Returns: { used: number; scans_per_month: number; plan: PlanId }[];
      };
      product_usage: {
        Args: Record<string, never>;
        Returns: { used: number; max_products: number | null; plan: PlanId }[];
      };
      create_family: { Args: { p_name: string }; Returns: string };
      rename_family: { Args: { p_name: string }; Returns: undefined };
      delete_family: { Args: Record<string, never>; Returns: undefined };
      create_family_invitation: {
        Args: { p_email: string; p_role: FamilyRole };
        Returns: { invitation_id: string; token: string; expires_at: string; family_name: string }[];
      };
      revoke_family_invitation: { Args: { p_invitation: string }; Returns: undefined };
      invitation_preview: {
        Args: { p_token: string };
        Returns: {
          family_name: string;
          inviter_name: string | null;
          role: FamilyRole;
          email: string;
          status: "valid" | "accepted" | "revoked" | "expired" | "family_inactive";
          expires_at: string;
        }[];
      };
      accept_family_invitation: { Args: { p_token: string }; Returns: string };
      update_family_member_role: { Args: { p_user: string; p_role: FamilyRole }; Returns: undefined };
      remove_family_member: { Args: { p_user: string }; Returns: undefined };
      leave_family: { Args: Record<string, never>; Returns: undefined };
      share_product: { Args: { p_product: string }; Returns: undefined };
      unshare_product: { Args: { p_product: string }; Returns: undefined };
      family_overview: { Args: Record<string, never>; Returns: Json };
      family_shared_products: {
        Args: Record<string, never>;
        Returns: {
          product_id: string;
          name: string;
          brand: string | null;
          model: string | null;
          category: string | null;
          status: ProductStatus;
          purchase_date: string | null;
          owner_name: string | null;
          is_mine: boolean;
          shared_at: string;
          warranty_end: string | null;
          return_deadline: string | null;
          has_image: boolean;
        }[];
      };
      family_shared_product: { Args: { p_product: string }; Returns: Json };
      shared_file_path: { Args: { p_kind: string; p_id: string }; Returns: string | null };
      family_shared_events: {
        Args: { p_from: string; p_to: string };
        Returns: {
          event_date: string;
          kind: "warranty" | "return" | "reminder";
          title: string;
          product_id: string;
          product_name: string;
          owner_name: string | null;
        }[];
      };
      analytics_overview: { Args: Record<string, never>; Returns: Json };
    };
    Enums: {
      plan_id: PlanId;
      product_status: ProductStatus;
      processing_status: ProcessingStatus;
      document_type: DocumentType;
      verification_status: VerificationStatus;
      family_role: FamilyRole;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
