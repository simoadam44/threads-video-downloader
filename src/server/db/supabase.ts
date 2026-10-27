import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DbProvider, ResolveEventInput, StatsSummary } from "./types";
import type { ToolPage, ToolPageInput, Guide, GuideInput } from "../content/types";
import { parseFaqs, parseSlugList } from "../content/types";

interface ToolRow {
  id: number;
  slug: string;
  badge: string | null;
  lang: string;
  target_keyword: string | null;
  title: string;
  description: string;
  h1: string;
  intro: string | null;
  faqs: unknown;
  related_slugs: unknown;
  status: string;
  updated_at: string | null;
}

interface GuideRow {
  id: number;
  slug: string;
  lang: string;
  target_keyword: string | null;
  title: string;
  description: string;
  h1: string;
  body: string | null;
  faqs: unknown;
  related_slugs: unknown;
  status: string;
  updated_at: string | null;
}

function toTool(r: ToolRow): ToolPage {
  return {
    id: r.id, slug: r.slug, badge: r.badge ?? "", lang: r.lang,
    target_keyword: r.target_keyword ?? "", title: r.title, description: r.description,
    h1: r.h1, intro: r.intro ?? "", faqs: parseFaqs(r.faqs),
    related_slugs: parseSlugList(r.related_slugs), status: r.status,
    updated_at: r.updated_at ?? "",
  };
}

function toGuide(r: GuideRow): Guide {
  return {
    id: r.id, slug: r.slug, lang: r.lang, target_keyword: r.target_keyword ?? "",
    title: r.title, description: r.description, h1: r.h1, body: r.body ?? "",
    faqs: parseFaqs(r.faqs), related_slugs: parseSlugList(r.related_slugs), status: r.status,
    updated_at: r.updated_at ?? "",
  };
}

export interface SupabaseEnv {
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_KEY?: string;
}

export function isDbConfigured(env: SupabaseEnv): boolean {
  return Boolean(env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_KEY?.trim());
}

export class SupabaseDb implements DbProvider {
  private client: SupabaseClient;
  constructor(env: SupabaseEnv) {
    if (!isDbConfigured(env)) throw new Error("DB not configured");
    this.client = createClient(env.SUPABASE_URL!.trim(), env.SUPABASE_SERVICE_KEY!.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch },
    });
  }

  async logEvent(e: ResolveEventInput): Promise<void> {
    const { error } = await this.client.from("resolve_events").insert({
      url_hash: e.urlHash.slice(0, 128),
      status: e.status.slice(0, 32),
      media_count: e.mediaCount,
      ip_hash: e.ipHash?.slice(0, 128) ?? null,
      ua: e.userAgent?.slice(0, 256) ?? null,
    });
    if (error) throw error;
  }

  async getStats(): Promise<StatsSummary> {
    const [total, recent] = await Promise.all([
      this.client.from("resolve_events").select("status", { count: "exact", head: true }),
      this.client
        .from("resolve_events")
        .select("id,created_at,status,media_count")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    if (total.error) throw total.error;
    if (recent.error) throw recent.error;
    const day = await this.client
      .from("resolve_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    const rows = (recent.data ?? []) as StatsSummary["recent"];
    // Accurate aggregates without pulling all rows:
    const byStatus = await this.statusCounts();
    return {
      total: total.count ?? 0,
      success: byStatus.SUCCESS ?? 0,
      errors: (total.count ?? 0) - (byStatus.SUCCESS ?? 0) - (byStatus.RATE_LIMITED ?? 0),
      rateLimited: byStatus.RATE_LIMITED ?? 0,
      last24h: day.count ?? 0,
      recent: rows,
    };
  }

  private async statusCounts(): Promise<Record<string, number>> {
    // Two bounded count queries (success vs rate-limited); keeps it cheap.
    const [ok, rl] = await Promise.all([
      this.client.from("resolve_events").select("id", { count: "exact", head: true }).eq("status", "SUCCESS"),
      this.client.from("resolve_events").select("id", { count: "exact", head: true }).eq("status", "RATE_LIMITED"),
    ]);
    return { SUCCESS: ok.count ?? 0, RATE_LIMITED: rl.count ?? 0 };
  }

  async listEvents(limit: number, offset: number): Promise<StatsSummary["recent"]> {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 20;
    const safeOffset = Number.isFinite(offset) ? Math.max(Math.floor(offset), 0) : 0;
    const { data, error } = await this.client
      .from("resolve_events")
      .select("id,created_at,status,media_count")
      .order("created_at", { ascending: false })
      .range(safeOffset, safeOffset + safeLimit - 1);
    if (error) throw error;
    return (data ?? []) as StatsSummary["recent"];
  }

  async getSettings(): Promise<Record<string, string>> {
    const { data, error } = await this.client.from("app_settings").select("key,value");
    if (error) throw error;
    const out: Record<string, string> = {};
    for (const row of (data ?? []) as { key: string; value: string }[]) out[row.key] = row.value;
    return out;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    const { error } = await this.client
      .from("app_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
  }

  async listToolPages(): Promise<ToolPage[]> {
    const { data, error } = await this.client.from("tool_pages").select("*").order("id", { ascending: false }).limit(200);
    if (error) throw error;
    return ((data ?? []) as ToolRow[]).map(toTool);
  }

  async getToolPage(id: number): Promise<ToolPage | null> {
    const { data, error } = await this.client.from("tool_pages").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toTool(data as ToolRow) : null;
  }

  async getToolPageBySlug(slug: string): Promise<ToolPage | null> {
    const { data, error } = await this.client.from("tool_pages").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? toTool(data as ToolRow) : null;
  }

  async createToolPage(input: ToolPageInput): Promise<ToolPage> {
    const { data, error } = await this.client.from("tool_pages").insert({ ...input }).select("*").single();
    if (error) throw error;
    return toTool(data as ToolRow);
  }

  async updateToolPage(id: number, input: ToolPageInput): Promise<ToolPage | null> {
    const { data, error } = await this.client
      .from("tool_pages")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toTool(data as ToolRow) : null;
  }

  async deleteToolPage(id: number): Promise<boolean> {
    const { error, count } = await this.client.from("tool_pages").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listGuides(): Promise<Guide[]> {
    const { data, error } = await this.client.from("guides").select("*").order("id", { ascending: false }).limit(200);
    if (error) throw error;
    return ((data ?? []) as GuideRow[]).map(toGuide);
  }

  async getGuide(id: number): Promise<Guide | null> {
    const { data, error } = await this.client.from("guides").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? toGuide(data as GuideRow) : null;
  }

  async getGuideBySlug(slug: string): Promise<Guide | null> {
    const { data, error } = await this.client.from("guides").select("*").eq("slug", slug).maybeSingle();
    if (error) throw error;
    return data ? toGuide(data as GuideRow) : null;
  }

  async createGuide(input: GuideInput): Promise<Guide> {
    const { data, error } = await this.client.from("guides").insert({ ...input }).select("*").single();
    if (error) throw error;
    return toGuide(data as GuideRow);
  }

  async updateGuide(id: number, input: GuideInput): Promise<Guide | null> {
    const { data, error } = await this.client
      .from("guides")
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw error;
    return data ? toGuide(data as GuideRow) : null;
  }

  async deleteGuide(id: number): Promise<boolean> {
    const { error, count } = await this.client.from("guides").delete({ count: "exact" }).eq("id", id);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async listLiveSlugs(): Promise<{ kind: "tool" | "guide"; slug: string; updated_at: string }[]> {
    const [tools, guides] = await Promise.all([
      this.client.from("tool_pages").select("slug,updated_at").eq("status", "live").limit(500),
      this.client.from("guides").select("slug,updated_at").eq("status", "live").limit(500),
    ]);
    if (tools.error) throw tools.error;
    if (guides.error) throw guides.error;
    const out: { kind: "tool" | "guide"; slug: string; updated_at: string }[] = [];
    for (const r of (tools.data ?? []) as { slug: string; updated_at: string }[]) {
      out.push({ kind: "tool", slug: r.slug, updated_at: r.updated_at ?? "" });
    }
    for (const r of (guides.data ?? []) as { slug: string; updated_at: string }[]) {
      out.push({ kind: "guide", slug: r.slug, updated_at: r.updated_at ?? "" });
    }
    return out;
  }
}
