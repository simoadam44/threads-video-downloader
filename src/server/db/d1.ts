import type { DbProvider, ResolveEventInput, StatsSummary } from "./types";
import type { ToolPage, ToolPageInput, Guide, GuideInput } from "../content/types";
import { parseFaqs, parseSlugList } from "../content/types";

interface ToolRow {
  id: number;
  slug: string;
  badge: string;
  lang: string;
  target_keyword: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  faqs: string;
  related_slugs: string;
  status: string;
  updated_at?: string | null;
}

interface GuideRow {
  id: number;
  slug: string;
  lang: string;
  target_keyword: string;
  title: string;
  description: string;
  h1: string;
  body: string;
  faqs: string;
  related_slugs: string;
  status: string;
  updated_at?: string | null;
}

function toTool(r: ToolRow): ToolPage {
  return {
    id: r.id,
    slug: r.slug,
    badge: r.badge ?? "",
    lang: r.lang,
    target_keyword: r.target_keyword ?? "",
    title: r.title,
    description: r.description,
    h1: r.h1,
    intro: r.intro ?? "",
    faqs: parseFaqs(r.faqs),
    related_slugs: parseSlugList(r.related_slugs),
    status: r.status,
    updated_at: r.updated_at ?? "",
  };
}

function toGuide(r: GuideRow): Guide {
  return {
    id: r.id,
    slug: r.slug,
    lang: r.lang,
    target_keyword: r.target_keyword ?? "",
    title: r.title,
    description: r.description,
    h1: r.h1,
    body: r.body ?? "",
    faqs: parseFaqs(r.faqs),
    related_slugs: parseSlugList(r.related_slugs),
    status: r.status,
    updated_at: r.updated_at ?? "",
  };
}

/** Minimal structural type for the D1 binding (avoids extra deps). */
export interface D1Binding {
  prepare(query: string): {
    bind(...values: unknown[]): {
      run(): Promise<unknown>;
      first<T>(column?: string): Promise<T | null>;
      all<T>(): Promise<{ results: T[] }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown[]>;
}

export class D1Db implements DbProvider {
  constructor(private db: D1Binding) {}

  async logEvent(e: ResolveEventInput): Promise<void> {
    await this.db
      .prepare(
        "insert into resolve_events (url_hash, status, media_count, ip_hash, ua) values (?, ?, ?, ?, ?)",
      )
      .bind(
        e.urlHash.slice(0, 128),
        e.status.slice(0, 32),
        e.mediaCount,
        e.ipHash?.slice(0, 128) ?? null,
        e.userAgent?.slice(0, 256) ?? null,
      )
      .run();
  }

  async getStats(): Promise<StatsSummary> {
    const total = await this.db.prepare("select count(*) as c from resolve_events").bind().first<{ c: number }>();
    const ok = await this.db
      .prepare("select count(*) as c from resolve_events where status = 'SUCCESS'")
      .bind()
      .first<{ c: number }>();
    const rl = await this.db
      .prepare("select count(*) as c from resolve_events where status = 'RATE_LIMITED'")
      .bind()
      .first<{ c: number }>();
    const day = await this.db
      .prepare("select count(*) as c from resolve_events where created_at >= datetime('now', '-1 day')")
      .bind()
      .first<{ c: number }>();
    const recent = await this.db
      .prepare("select id, created_at, status, media_count from resolve_events order by id desc limit 10")
      .bind()
      .all<StatsSummary["recent"][number]>();
    const t = total?.c ?? 0;
    const s = ok?.c ?? 0;
    const r = rl?.c ?? 0;
    return {
      total: t,
      success: s,
      errors: t - s - r,
      rateLimited: r,
      last24h: day?.c ?? 0,
      recent: recent.results ?? [],
    };
  }

  async listEvents(limit: number, offset: number): Promise<StatsSummary["recent"]> {
    const safeLimit = Math.min(Math.max(Math.floor(limit) || 20, 1), 100);
    const safeOffset = Math.max(Math.floor(offset) || 0, 0);
    const res = await this.db
      .prepare("select id, created_at, status, media_count from resolve_events order by id desc limit ? offset ?")
      .bind(safeLimit, safeOffset)
      .all<StatsSummary["recent"][number]>();
    return res.results ?? [];
  }

  async getSettings(): Promise<Record<string, string>> {
    const res = await this.db.prepare("select key, value from app_settings").bind().all<{ key: string; value: string }>();
    const out: Record<string, string> = {};
    for (const row of res.results ?? []) out[row.key] = row.value;
    return out;
  }

  async updateSetting(key: string, value: string): Promise<void> {
    await this.db
      .prepare("insert into app_settings (key, value, updated_at) values (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) on conflict(key) do update set value = excluded.value, updated_at = excluded.updated_at")
      .bind(key, value)
      .run();
  }

  async listToolPages(): Promise<ToolPage[]> {
    const res = await this.db
      .prepare("select * from tool_pages order by id desc limit 200")
      .bind()
      .all<ToolRow>();
    return (res.results ?? []).map(toTool);
  }

  async getToolPage(id: number): Promise<ToolPage | null> {
    const row = await this.db.prepare("select * from tool_pages where id = ?").bind(id).first<ToolRow>();
    return row ? toTool(row) : null;
  }

  async getToolPageBySlug(slug: string): Promise<ToolPage | null> {
    const row = await this.db.prepare("select * from tool_pages where slug = ?").bind(slug).first<ToolRow>();
    return row ? toTool(row) : null;
  }

  async createToolPage(input: ToolPageInput): Promise<ToolPage> {
    const res = await this.db
      .prepare(
        "insert into tool_pages (slug, badge, lang, target_keyword, title, description, h1, intro, faqs, related_slugs, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning *",
      )
      .bind(
        input.slug, input.badge, input.lang, input.target_keyword, input.title,
        input.description, input.h1, input.intro,
        JSON.stringify(input.faqs), JSON.stringify(input.related_slugs), input.status,
      )
      .first<ToolRow>();
    if (!res) throw new Error("insert failed");
    return toTool(res);
  }

  async updateToolPage(id: number, input: ToolPageInput): Promise<ToolPage | null> {
    const res = await this.db
      .prepare(
        "update tool_pages set slug = ?, badge = ?, lang = ?, target_keyword = ?, title = ?, description = ?, h1 = ?, intro = ?, faqs = ?, related_slugs = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ? returning *",
      )
      .bind(
        input.slug, input.badge, input.lang, input.target_keyword, input.title,
        input.description, input.h1, input.intro,
        JSON.stringify(input.faqs), JSON.stringify(input.related_slugs), input.status, id,
      )
      .first<ToolRow>();
    return res ? toTool(res) : null;
  }

  async deleteToolPage(id: number): Promise<boolean> {
    const res = await this.db.prepare("delete from tool_pages where id = ? returning id").bind(id).first<{ id: number }>();
    return res !== null;
  }

  async listGuides(): Promise<Guide[]> {
    const res = await this.db.prepare("select * from guides order by id desc limit 200").bind().all<GuideRow>();
    return (res.results ?? []).map(toGuide);
  }

  async getGuide(id: number): Promise<Guide | null> {
    const row = await this.db.prepare("select * from guides where id = ?").bind(id).first<GuideRow>();
    return row ? toGuide(row) : null;
  }

  async getGuideBySlug(slug: string): Promise<Guide | null> {
    const row = await this.db.prepare("select * from guides where slug = ?").bind(slug).first<GuideRow>();
    return row ? toGuide(row) : null;
  }

  async createGuide(input: GuideInput): Promise<Guide> {
    const res = await this.db
      .prepare(
        "insert into guides (slug, lang, target_keyword, title, description, h1, body, faqs, related_slugs, status) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) returning *",
      )
      .bind(
        input.slug, input.lang, input.target_keyword, input.title, input.description,
        input.h1, input.body, JSON.stringify(input.faqs), JSON.stringify(input.related_slugs), input.status,
      )
      .first<GuideRow>();
    if (!res) throw new Error("insert failed");
    return toGuide(res);
  }

  async updateGuide(id: number, input: GuideInput): Promise<Guide | null> {
    const res = await this.db
      .prepare(
        "update guides set slug = ?, lang = ?, target_keyword = ?, title = ?, description = ?, h1 = ?, body = ?, faqs = ?, related_slugs = ?, status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') where id = ? returning *",
      )
      .bind(
        input.slug, input.lang, input.target_keyword, input.title, input.description,
        input.h1, input.body, JSON.stringify(input.faqs), JSON.stringify(input.related_slugs), input.status, id,
      )
      .first<GuideRow>();
    return res ? toGuide(res) : null;
  }

  async deleteGuide(id: number): Promise<boolean> {
    const res = await this.db.prepare("delete from guides where id = ? returning id").bind(id).first<{ id: number }>();
    return res !== null;
  }

  async listLiveSlugs(): Promise<{ kind: "tool" | "guide"; slug: string; updated_at: string }[]> {
    // Sequential: local SQLite handles one statement at a time.
    const tools = await this.db.prepare("select slug, updated_at from tool_pages where status = 'live' limit 500").bind().all<{ slug: string; updated_at: string }>();
    const guides = await this.db.prepare("select slug, updated_at from guides where status = 'live' limit 500").bind().all<{ slug: string; updated_at: string }>();
    const out: { kind: "tool" | "guide"; slug: string; updated_at: string }[] = [];
    for (const r of tools.results ?? []) out.push({ kind: "tool", slug: r.slug, updated_at: r.updated_at ?? "" });
    for (const r of guides.results ?? []) out.push({ kind: "guide", slug: r.slug, updated_at: r.updated_at ?? "" });
    return out;
  }
}
