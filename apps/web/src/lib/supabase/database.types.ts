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
      receipts: ReadOnly<{
        id: string;
        user_id: string;
        processing_status: "uploaded" | "processing" | "needs_review" | "confirmed" | "failed";
        created_at: string;
      }>;
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
      product_usage: {
        Args: Record<string, never>;
        Returns: { used: number; max_products: number | null; plan: PlanId }[];
      };
    };
    Enums: {
      plan_id: PlanId;
      product_status: ProductStatus;
      verification_status: VerificationStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
