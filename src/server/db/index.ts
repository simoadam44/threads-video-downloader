import type { DbProvider } from "./types";
import { SupabaseDb, isDbConfigured as isSupabaseConfigured, type SupabaseEnv } from "./supabase";
import { D1Db, type D1Binding } from "./d1";

export interface DbEnv extends SupabaseEnv {
  SUPABASE_ANON_KEY?: string;
  ADMIN_DB?: D1Binding;
  /** "d1" forces local D1; anything else (or unset) prefers Supabase when configured. */
  DB_PROVIDER?: string;
}

/**
 * TEMPORARY dev path: D1 is used only when explicitly selected AND bound.
 * Production uses Supabase (same DbProvider interface, zero code change).
 */
export function getDb(env: DbEnv): DbProvider | null {
  if ((env.DB_PROVIDER || "").toLowerCase() === "d1" && env.ADMIN_DB) {
    return new D1Db(env.ADMIN_DB);
  }
  if (isSupabaseConfigured(env)) return new SupabaseDb(env);
  if (env.ADMIN_DB) return new D1Db(env.ADMIN_DB);
  return null;
}

export function isDbConfigured(env: DbEnv): boolean {
  return getDb(env) !== null;
}

export function activeProvider(env: DbEnv): "d1" | "supabase" | "none" {
  if ((env.DB_PROVIDER || "").toLowerCase() === "d1" && env.ADMIN_DB) return "d1";
  if (isSupabaseConfigured(env)) return "supabase";
  if (env.ADMIN_DB) return "d1";
  return "none";
}
