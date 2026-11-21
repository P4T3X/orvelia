import "server-only";

import type { FamilyRole } from "@orvelia/domain";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type FamilyMember = {
  userId: string;
  name: string;
  email: string | null;
  role: FamilyRole;
  joinedAt: string;
  sharedCount: number;
  isMe: boolean;
};

export type FamilyInvitation = {
  id: string;
  email: string;
  role: FamilyRole;
  expiresAt: string;
  createdAt: string;
  invitedBy: string | null;
};

export type FamilyActivity = {
  action: string;
  createdAt: string;
  actor: string | null;
  target: string | null;
  metadata: Record<string, unknown>;
};

export type FamilyOverview =
  | { family: null; canCreate: boolean }
  | {
      family: { id: string; name: string; createdAt: string; ownerName: string; active: boolean; seatLimit: number };
      myRole: FamilyRole;
      members: FamilyMember[];
      invitations: FamilyInvitation[];
      activity: FamilyActivity[];
    };

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : null);

/** The caller's family as their role allows them to see it. */
export const getFamilyOverview = cache(async (): Promise<FamilyOverview> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("family_overview");
  if (error) throw new Error(`No se pudo cargar la familia: ${error.message}`);
  const o = (data ?? {}) as Raw;
  if (!o.family) return { family: null, canCreate: Boolean(o.can_create) };
  const f = o.family as Raw;
  return {
    family: {
      id: String(f.id),
      name: String(f.name),
      createdAt: String(f.created_at),
      ownerName: String(f.owner_name ?? ""),
      active: Boolean(f.active),
      seatLimit: Number(f.seat_limit ?? 0),
    },
    myRole: o.my_role as FamilyRole,
    members: ((o.members as Raw[]) ?? []).map((m) => ({
      userId: String(m.user_id),
      name: String(m.name ?? "Miembro"),
      email: str(m.email),
      role: m.role as FamilyRole,
      joinedAt: String(m.joined_at),
      sharedCount: Number(m.shared_count ?? 0),
      isMe: Boolean(m.is_me),
    })),
    invitations: ((o.invitations as Raw[]) ?? []).map((i) => ({
      id: String(i.id),
      email: String(i.email),
      role: i.role as FamilyRole,
      expiresAt: String(i.expires_at),
      createdAt: String(i.created_at),
      invitedBy: str(i.invited_by),
    })),
    activity: ((o.activity as Raw[]) ?? []).map((a) => ({
      action: String(a.action),
      createdAt: String(a.created_at),
      actor: str(a.actor),
      target: str(a.target),
      metadata: (a.metadata as Record<string, unknown>) ?? {},
    })),
  };
});

export type SharedProductItem = {
  productId: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  status: string;
  purchaseDate: string | null;
  ownerName: string;
  isMine: boolean;
  sharedAt: string;
  warrantyEnd: string | null;
  returnDeadline: string | null;
  imageUrl: string | null;
};

export const sharedFileUrl = (kind: "document" | "receipt" | "product-image", id: string) =>
  `/app/files/shared/${kind}/${id}`;

export async function listSharedProducts(): Promise<SharedProductItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("family_shared_products");
  if (error) throw new Error(`No se pudieron cargar los productos compartidos: ${error.message}`);
  return (data ?? []).map((r) => ({
    productId: r.product_id,
    name: r.name,
    brand: r.brand,
    model: r.model,
    category: r.category,
    status: r.status,
    purchaseDate: r.purchase_date,
    ownerName: r.owner_name ?? "Miembro",
    isMine: r.is_mine,
    sharedAt: r.shared_at,
    warrantyEnd: r.warranty_end,
    returnDeadline: r.return_deadline,
    imageUrl: r.has_image ? sharedFileUrl("product-image", r.product_id) : null,
  }));
}

export type SharedProductDetail = {
  product: {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    category: string | null;
    description: string | null;
    status: string;
    purchaseDate: string | null;
    purchasePrice: number | null;
    currency: string | null;
    seller: string | null;
    serialNumber: string | null;
    imageUrl: string | null;
  };
  ownerName: string;
  isMine: boolean;
  sharedAt: string;
  warranties: { id: string; provider: string | null; startDate: string | null; endDate: string | null; coverage: string | null; verification: string }[];
  returns: { id: string; deadlineDate: string; policy: string | null; verification: string }[];
  documents: { id: string; title: string; documentType: string; mimeType: string | null; sizeBytes: number | null; expiresOn: string | null; createdAt: string }[];
  receipts: { id: string; merchant: string | null; purchaseDate: string | null; total: number | null; currency: string | null; hasFile: boolean }[];
  reminders: { id: string; title: string; scheduledAt: string; recurrence: string }[];
};

export async function getSharedProduct(id: string): Promise<SharedProductDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("family_shared_product", { p_product: id });
  if (error) throw new Error(`No se pudo cargar el producto compartido: ${error.message}`);
  if (!data) return null;
  const o = data as Raw;
  const p = o.product as Raw;
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const arr = (k: string) => ((o[k] as Raw[]) ?? []);
  return {
    product: {
      id: String(p.id),
      name: String(p.name),
      brand: str(p.brand),
      model: str(p.model),
      category: str(p.category),
      description: str(p.description),
      status: String(p.status),
      purchaseDate: str(p.purchase_date),
      purchasePrice: num(p.purchase_price),
      currency: str(p.currency),
      seller: str(p.seller),
      serialNumber: str(p.serial_number),
      imageUrl: p.has_image ? sharedFileUrl("product-image", String(p.id)) : null,
    },
    ownerName: String(o.owner_name ?? "Miembro"),
    isMine: Boolean(o.is_mine),
    sharedAt: String(o.shared_at),
    warranties: arr("warranties").map((w) => ({
      id: String(w.id),
      provider: str(w.provider),
      startDate: str(w.start_date),
      endDate: str(w.end_date),
      coverage: str(w.coverage_description),
      verification: String(w.verification_status),
    })),
    returns: arr("returns").map((r) => ({
      id: String(r.id),
      deadlineDate: String(r.deadline_date),
      policy: str(r.policy_details),
      verification: String(r.verification_status),
    })),
    documents: arr("documents").map((d) => ({
      id: String(d.id),
      title: String(d.title),
      documentType: String(d.document_type),
      mimeType: str(d.mime_type),
      sizeBytes: num(d.size_bytes),
      expiresOn: str(d.expires_on),
      createdAt: String(d.created_at),
    })),
    receipts: arr("receipts").map((r) => ({
      id: String(r.id),
      merchant: str(r.merchant),
      purchaseDate: str(r.purchase_date),
      total: num(r.total_amount),
      currency: str(r.currency),
      hasFile: Boolean(r.has_file),
    })),
    reminders: arr("reminders").map((m) => ({
      id: String(m.id),
      title: String(m.title),
      scheduledAt: String(m.scheduled_at),
      recurrence: String(m.recurrence),
    })),
  };
}

/** Whether a product of the caller is shared in their family (RLS: members read). */
export async function isProductShared(productId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("shared_resources").select("id").eq("product_id", productId).maybeSingle();
  return Boolean(data);
}
