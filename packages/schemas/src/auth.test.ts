import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  safeRedirectPath,
} from "./auth";
import { profileUpdateSchema } from "./profile";

describe("loginSchema", () => {
  it("normalizes email casing and whitespace", () => {
    const r = loginSchema.parse({ email: "  Ana@Example.COM ", password: "x" });
    expect(r.email).toBe("ana@example.com");
  });

  it("rejects invalid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});

describe("registerSchema", () => {
  const valid = {
    fullName: "Ana Torres",
    email: "ana@example.com",
    password: "secreto123",
    confirmPassword: "secreto123",
    acceptTerms: true,
  };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires accepting terms", () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it("requires matching passwords", () => {
    const r = registerSchema.safeParse({ ...valid, confirmPassword: "otro12345" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("enforces password strength", () => {
    for (const pw of ["short1", "onlyletters", "12345678"]) {
      const r = registerSchema.safeParse({ ...valid, password: pw, confirmPassword: pw });
      expect(r.success).toBe(false);
    }
  });

  it("rejects passwords over 72 chars", () => {
    const pw = "a1".repeat(37);
    expect(resetPasswordSchema.safeParse({ password: pw, confirmPassword: pw }).success).toBe(false);
  });
});

describe("safeRedirectPath", () => {
  it("allows relative paths", () => {
    expect(safeRedirectPath("/app/products")).toBe("/app/products");
  });

  it("blocks absolute and protocol-relative URLs", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/app");
    expect(safeRedirectPath("//evil.com")).toBe("/app");
    expect(safeRedirectPath("/\\evil.com")).toBe("/app");
    expect(safeRedirectPath(undefined)).toBe("/app");
  });
});

describe("profileUpdateSchema", () => {
  it("validates time zones", () => {
    const base = { fullName: "Ana", preferredLanguage: "es", preferredCurrency: "PEN" };
    expect(profileUpdateSchema.safeParse({ ...base, timezone: "America/Lima" }).success).toBe(true);
    expect(profileUpdateSchema.safeParse({ ...base, timezone: "Mars/Base" }).success).toBe(false);
  });
});
