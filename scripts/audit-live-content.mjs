#!/usr/bin/env node
/**
 * Read-only content audit for the live site.
 *
 * Why: the blog + tool pages are created from the admin dashboard (and from AI
 * drafts), so their substance drifts away from the hand-written pages. This
 * script measures what a crawler receives, without touching the database:
 *
 *   - word count inside <main> (thin content)
 *   - presence of an FAQ block and FAQPage JSON-LD
 *   - near-duplicate pairs (6-gram Jaccard) between published pages
 *   - phrases that break the site's own claim rules
 *
 * Usage:
 *   node scripts/audit-live-content.mjs             # human-readable summary
 *   node scripts/audit-live-content.mjs --json      # machine-readable
 *   node scripts/audit-live-content.mjs --origin http://127.0.0.1:8788
 *
 * It only issues GET requests to public pages and the two public content
 * indexes. No credentials, no writes, no admin endpoints.
 */

const argOrigin = (() => {
  const i = process.argv.indexOf("--origin");
  return i >= 0 ? process.argv[i + 1] : process.env.AUDIT_ORIGIN;
})();
const ORIGIN = (argOrigin || "https://www.savethreadsvideos.com").replace(/\/$/, "");
const AS_JSON = process.argv.includes("--json");

/** Same rules as tests/info-pages.test.ts and tests/tool-content.test.ts. */
const CLAIMS = [
  [/\bunlimited\b|no (?:download )?limits?/gi, "unlimited"],
  [/watermark[- ]free|without watermark|removes? the watermark/gi, "watermark removal wording"],
  [/\bguarantee[ds]?\b/gi, "guarantee"],
  [/\bbest\b|fastest|#1\b|number one/gi, "superlative"],
  [/\b100% ?(?:free|safe|secure|anonymous)\b/gi, "absolute claim"],
];

/**
 * Heuristics, not verdicts: every hit must be read in context before acting.
 * `lastIndex` is reset because the expressions are global.
 */
function claimLabels(text) {
  const labels = [];
  for (const [re, label] of CLAIMS) {
    re.lastIndex = 0;
    if (re.test(text)) labels.push(label);
  }
  return labels;
}

const strip = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const wordCount = (text) => text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

function shingles(text, n = 6) {
  const w = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i + n <= w.length; i += 1) set.add(w.slice(i, i + n).join(" "));
  return set;
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

async function getJson(path) {
  const res = await fetch(`${ORIGIN}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  const body = await res.json();
  return body.data;
}

async function auditPage(path) {
  const res = await fetch(`${ORIGIN}${path}`);
  const html = await res.text();
  const raw = html.match(/<main>([\s\S]*?)<\/main>/i)?.[1] ?? "";
  // Related-link blocks repeat sibling page titles ("best threads video
  // downloader...") verbatim; counting them would flag every page that links
  // to a keyword-y neighbour. Measure the page's own copy instead.
  const main = raw.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ");
  const text = strip(main);
  const claims = claimLabels(text);
  return {
    path,
    status: res.status,
    words: wordCount(text),
    h2: (main.match(/<h2[^>]*>/gi) || []).length,
    faq: /"@type"\s*:\s*"FAQPage"/.test(html),
    claims,
    shingles: shingles(text),
  };
}

const [tools, guides] = await Promise.all([getJson("/api/content/tools"), getJson("/api/content/guides")]);
const targets = [
  ...(tools ?? []).map((t) => ({ kind: "tool", slug: t.slug, path: `/${encodeURI(t.slug)}`, title: t.title, lang: t.lang })),
  ...(guides ?? []).map((g) => ({ kind: "guide", slug: g.slug, path: `/blog/${encodeURI(g.slug)}`, title: g.title, lang: g.lang })),
];

const rows = [];
for (const t of targets) {
  const page = await auditPage(t.path);
  rows.push({ ...t, ...page });
}

const pairs = [];
for (let i = 0; i < rows.length; i += 1) {
  for (let j = i + 1; j < rows.length; j += 1) {
    const sim = jaccard(rows[i].shingles, rows[j].shingles);
    if (sim >= 0.12) pairs.push({ a: rows[i].path, b: rows[j].path, similarity: Number(sim.toFixed(2)) });
  }
}
pairs.sort((x, y) => y.similarity - x.similarity);

const report = {
  origin: ORIGIN,
  checkedAt: new Date().toISOString(),
  pages: rows.length,
  wordCounts: rows.map((r) => r.words).sort((a, b) => a - b),
  thin: rows.filter((r) => r.words < 300).map((r) => ({ path: r.path, words: r.words })),
  noFaqMarkup: rows.filter((r) => !r.faq).map((r) => r.path),
  claimRisks: rows.filter((r) => r.claims.length).map((r) => ({ path: r.path, claims: r.claims })),
  nearDuplicates: pairs.slice(0, 25),
};

if (AS_JSON) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const min = report.wordCounts[0] ?? 0;
  const max = report.wordCounts[report.wordCounts.length - 1] ?? 0;
  console.log(`${ORIGIN}: ${report.pages} DB pages (${tools?.length ?? 0} tools, ${guides?.length ?? 0} guides)`);
  console.log(`word counts: min ${min}, max ${max}`);
  console.log(`under 300 words: ${report.thin.length}`);
  for (const t of report.thin) console.log(`  - ${t.path} (${t.words})`);
  console.log(`pages without FAQPage markup: ${report.noFaqMarkup.length}`);
  for (const p of report.noFaqMarkup) console.log(`  - ${p}`);
  console.log(`claim-rule risks: ${report.claimRisks.length}`);
  for (const c of report.claimRisks) console.log(`  - ${c.path}: ${c.claims.join(", ")}`);
  console.log(`near-duplicate pairs (>=0.12): ${pairs.length}`);
  for (const p of report.nearDuplicates) console.log(`  - ${p.similarity} ${p.a} <> ${p.b}`);
}
