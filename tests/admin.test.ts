import { describe, it, expect } from "vitest";
import { validateSetting } from "../src/server/db/types";
import { sha256Hex, hashIp } from "../src/server/db/hash";
import { clearAdminCookie, adminCookieHeader, verifyAdmin } from "../src/server/db/auth";
import { isDbConfigured } from "../src/server/db/supabase";
import { getDb, activeProvider } from "../src/server/db/index";
import { hashPassword, verifyPassword, validateNewPassword } from "../src/server/db/password";

describe("validateSetting", () => {
  it("accepts allowed keys", () => {
    expect(validateSetting("resolver_provider", "mock")).toBe(true);
    expect(validateSetting("resolver_provider", "opensource")).toBe(true);
    expect(validateSetting("resolve_limit", "20")).toBe(true);
    expect(validateSetting("ads_enabled", "true")).toBe(true);
  });
  it("rejects unknown keys and bad values", () => {
    expect(validateSetting("SUPABASE_SERVICE_KEY", "x")).toBe(false);
    expect(validateSetting("resolver_provider", "evil")).toBe(false);
    expect(validateSetting("resolve_limit", "0")).toBe(false);
    expect(validateSetting("resolve_limit", "9999")).toBe(false);
    expect(validateSetting("ads_enabled", "yes")).toBe(false);
    expect(validateSetting("resolve_limit", "")).toBe(false);
  });
});

describe("hashing", () => {
  it("sha256 is deterministic", async () => {
    expect(await sha256Hex("a")).toBe(await sha256Hex("a"));
  });
  it("ip hash differs by salt", async () => {
    expect(await hashIp("1.2.3.4", "s1")).not.toBe(await hashIp("1.2.3.4", "s2"));
  });
});

describe("auth cookies", () => {
  it("clears cookie", () => {
    expect(clearAdminCookie()).toContain("Max-Age=0");
  });
  it("sets HttpOnly", () => {
    expect(adminCookieHeader("tok", false)).toContain("HttpOnly");
  });
});

describe("db config gate", () => {
  it("detects missing config", () => {
    expect(isDbConfigured({})).toBe(false);
    expect(isDbConfigured({ SUPABASE_URL: "http://x", SUPABASE_SERVICE_KEY: "k" })).toBe(true);
  });
});

describe("provider selection", () => {
  it("none when nothing configured", () => {
    expect(getDb({})).toBe(null);
    expect(activeProvider({})).toBe("none");
  });
  it("prefers supabase when configured", () => {
    const db = getDb({ SUPABASE_URL: "http://x", SUPABASE_SERVICE_KEY: "k" });
    expect(db).not.toBe(null);
    expect(activeProvider({ SUPABASE_URL: "http://x", SUPABASE_SERVICE_KEY: "k" })).toBe("supabase");
  });
});

describe("dev-token gate", () => {
  const tok = "secret-token";
  const devReq = () => new Request("http://localhost/api/admin/stats", { headers: { cookie: `sb-access-token=${tok}` } });
  it("accepts dev token only when ENVIRONMENT=dev", async () => {
    expect(await verifyAdmin(devReq(), { ENVIRONMENT: "dev", ADMIN_DEV_TOKEN: tok })).toBe("dev-admin");
  });
  it("rejects dev token in any other environment", async () => {
    expect(await verifyAdmin(devReq(), { ENVIRONMENT: "production", ADMIN_DEV_TOKEN: tok })).toBe(null);
    expect(await verifyAdmin(devReq(), { ADMIN_DEV_TOKEN: tok })).toBe(null);
  });
  it("rejects wrong token in dev", async () => {
    const bad = new Request("http://localhost/x", { headers: { cookie: "sb-access-token=nope" } });
    expect(await verifyAdmin(bad, { ENVIRONMENT: "dev", ADMIN_DEV_TOKEN: tok })).toBe(null);
  });
});

describe("dev password storage", () => {
  it("hashes and verifies", async () => {
    const h = await hashPassword("correct-horse-123");
    expect(await verifyPassword("correct-horse-123", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  }, 15000);
  it("rejects malformed stored values", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "pbkdf2$10$salt$00")).toBe(false);
  });
  it("validates new password length", () => {
    expect(validateNewPassword("short")).toBe(false);
    expect(validateNewPassword("long-enough-1")).toBe(true);
    expect(validateNewPassword(123)).toBe(false);
  });
});
