import { describe, expect, it } from "vitest";
import { familyInviteSchema, familyNameSchema, invitationTokenSchema } from "./family";

describe("family schemas", () => {
  it("normalizes invite e-mail and accepts member/admin", () => {
    const r = familyInviteSchema.parse({ email: "  Carla@Example.COM ", role: "admin" });
    expect(r).toEqual({ email: "carla@example.com", role: "admin" });
  });
  it("rejects owner role and bad e-mails", () => {
    expect(familyInviteSchema.safeParse({ email: "a@b.co", role: "owner" }).success).toBe(false);
    expect(familyInviteSchema.safeParse({ email: "no-es-correo", role: "member" }).success).toBe(false);
  });
  it("trims and bounds family names", () => {
    expect(familyNameSchema.parse({ name: "  Familia Torres " }).name).toBe("Familia Torres");
    expect(familyNameSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(familyNameSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });
  it("accepts only 64-hex invitation tokens", () => {
    expect(invitationTokenSchema.safeParse("a".repeat(64)).success).toBe(true);
    expect(invitationTokenSchema.safeParse("A".repeat(64)).success).toBe(false);
    expect(invitationTokenSchema.safeParse("abc").success).toBe(false);
  });
});

import { feedbackSchema } from "./feedback";

describe("feedback schema", () => {
  it("trims and bounds the message, drops a bad page path", () => {
    const r = feedbackSchema.parse({ kind: "problem", message: "  No carga el calendario  ", page: "javascript:alert(1)" });
    expect(r).toEqual({ kind: "problem", message: "No carga el calendario", page: undefined });
    expect(feedbackSchema.safeParse({ kind: "idea", message: "hey" }).success).toBe(false);
    expect(feedbackSchema.safeParse({ kind: "spam", message: "hola mundo" }).success).toBe(false);
  });
});
