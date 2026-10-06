export interface AdminAuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  /** TEMPORARY local-dev backdoor. Only honored when ENVIRONMENT === "dev". Never in production. */
  ENVIRONMENT?: string;
  ADMIN_DEV_TOKEN?: string;
  IP_HASH_SALT?: string;
}

function getCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** Verify the admin session cookie against Supabase Auth. Returns email or null. */
export async function verifyAdmin(req: Request, env: AdminAuthEnv): Promise<string | null> {
  const token = getCookie(req, "sb-access-token");
  if (!token) return null;
  // TEMPORARY dev-only paths, strictly gated on ENVIRONMENT === "dev".
  // Any other environment (including production) ignores them entirely.
  if (env.ENVIRONMENT === "dev") {
    if (env.ADMIN_DEV_TOKEN && token.length === env.ADMIN_DEV_TOKEN.length && token === env.ADMIN_DEV_TOKEN) {
      return "dev-admin";
    }
    if (await verifyDevSession(token, devSalt(env))) return "dev-admin";
  }
  const base = env.SUPABASE_URL?.trim();
  const anon = env.SUPABASE_ANON_KEY?.trim();
  if (!base || !anon) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/auth/v1/user`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const user = (await res.json()) as {
      email?: string;
      app_metadata?: { role?: string };
    };
    if (user?.app_metadata?.role !== "admin") return null;
    return user.email ?? "admin";
  } catch {
    return null;
  }
}

export const ADMIN_COOKIE = "sb-access-token";

export function adminCookieHeader(token: string, secure: boolean): string {
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600${
    secure ? "; Secure" : ""
  }`;
}

export function clearAdminCookie(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// --- TEMPORARY dev-only signed sessions (no Supabase Auth locally) ---

function devSalt(env: AdminAuthEnv & { IP_HASH_SALT?: string }): string {
  return env.IP_HASH_SALT || "local-dev-salt";
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Issue a stateless dev session token, valid 24h. */
export async function issueDevSession(env: AdminAuthEnv & { IP_HASH_SALT?: string }): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 86_400;
  const sig = await hmacHex(devSalt(env), `dev-admin:${exp}`);
  return `dev1.${exp}.${sig}`;
}

async function verifyDevSession(token: string, salt: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "dev1") return false;
  const exp = Number(parts[1]);
  if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return false;
  const sig = await hmacHex(salt, `dev-admin:${exp}`);
  if (sig.length !== parts[2].length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ parts[2].charCodeAt(i);
  return diff === 0;
}
