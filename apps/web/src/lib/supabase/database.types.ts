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
type ProcessingStatus = "uploaded" | "processing" | "needs_review" | "confirmed" | "failed";
type DocumentType = "receipt" | "invoice" | "warranty" | "manual" | "insurance" | "certificate" | "other";
type ProductStatus = "active" | "sold" | "gifted" | "archived" | "disposed";
type VerificationStatus = "extracted" | "manual" | "confirmed" | "needs_verification";

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
      subscriptions: ReadOnly<{
        id: string;
        user_id: string;
        provider: string;
        plan: PlanId;
        status: "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
        current_period_start: string | null;
        current_period_end: string | null;
        created_at: string;
        updated_at: string;
      }>;
      plan_limits: ReadOnly<{
        plan: PlanId;
        max_products: number | null;
        scans_per_month: number;
        storage_mb: number;
        ai_queries_per_month: number | null;
        updated_at: string;
      }>;
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
          end_date: string | null;
          verification_status: VerificationStatus;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "warranties_product_fk";
            columns: ["product_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "products";
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
          verification_status: VerificationStatus;
        };
        Insert: Record<string, never>;
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "return_deadlines_product_fk";
            columns: ["product_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
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
    };
    Enums: {
      plan_id: PlanId;
      product_status: ProductStatus;
      processing_status: ProcessingStatus;
      document_type: DocumentType;
      verification_status: VerificationStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
