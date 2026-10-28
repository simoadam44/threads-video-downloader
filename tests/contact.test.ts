import { describe, it, expect } from "vitest";
import worker from "../src/server/worker";

interface ContactRow {
  id: number;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  ip_hash: string | null;
  user_agent: string | null;
}

/**
 * Minimal in-memory D1 stand-in for the contact inbox queries only.
 * `fail: true` simulates the state before the migration is applied.
 */
function contactD1(opts: { fail?: boolean } = {}) {
  const rows: ContactRow[] = [];
  const guard = () => {
    if (opts.fail) throw new Error("D1_ERROR: no such table: contact_messages");
  };
  return {
    rows,
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            first: async () => {
              guard();
              if (/^insert/i.test(query)) {
                const row: ContactRow = {
                  id: rows.length + 1,
                  created_at: new Date().toISOString(),
                  name: String(values[0] ?? ""),
                  email: String(values[1] ?? ""),
                  subject: String(values[2] ?? ""),
                  message: String(values[3] ?? ""),
                  ip_hash: (values[4] as string | null) ?? null,
                  user_agent: (values[5] as string | null) ?? null,
                };
                rows.push(row);
                return row;
              }
              return rows[0] ?? null;
            },
            all: async () => {
              guard();
              return { results: [...rows].reverse() };
            },
            run: async () => {
              guard();
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
    batch: async () => [],
  };
}

type TestEnv = Parameters<typeof worker.fetch>[1];

function env(db = contactD1(), extra: Record<string, unknown> = {}): TestEnv {
  return { DB_PROVIDER: "d1", ADMIN_DB: db, ...extra } as unknown as TestEnv;
}

const ORIGIN = "https://www.savethreadsvideos.com";

function getContact(): Request {
  return new Request(`${ORIGIN}/api/contact`, {
    method: "GET",
    headers: { "cf-connecting-ip": "203.0.113.10" },
  });
}

function postContact(body: unknown, opts: { ip?: string; headers?: Record<string, string> } = {}): Request {
  return new Request(`${ORIGIN}/api/contact`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": opts.ip ?? "198.51.100.7",
      ...(opts.headers ?? {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const VALID = {
  name: "Alex Martin",
  email: "alex@example.com",
  subject: "A public post does not resolve",
  message: "https://www.threads.net/@someone/post/ABC123 fails on Firefox with a temporary error message.",
};

describe("GET /api/contact", () => {
  it("reports unavailable when no database is configured (no fake form)", async () => {
    const res = await worker.fetch(getContact(), {} as unknown as TestEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { accepting: boolean; email: string | null } };
    expect(json.success).toBe(true);
    expect(json.data.accepting).toBe(false);
    expect(json.data.email).toBeNull();
    expect(res.headers.get("cache-control")).toContain("max-age=60");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("reports unavailable when the messages table is missing", async () => {
    const res = await worker.fetch(getContact(), env(contactD1({ fail: true })));
    const json = (await res.json()) as { data: { accepting: boolean } };
    expect(json.data.accepting).toBe(false);
  });

  it("reports accepting once the inbox table exists", async () => {
    const res = await worker.fetch(getContact(), env(contactD1()));
    const json = (await res.json()) as { data: { accepting: boolean } };
    expect(json.data.accepting).toBe(true);
  });

  it("only exposes CONTACT_EMAIL when it is a valid address", async () => {
    const ok = await worker.fetch(getContact(), env(contactD1(), { CONTACT_EMAIL: "help@example.com" }));
    expect(((await ok.json()) as { data: { email: string | null } }).data.email).toBe("help@example.com");

    const bad = await worker.fetch(getContact(), env(contactD1(), { CONTACT_EMAIL: "not-an-address" }));
    expect(((await bad.json()) as { data: { email: string | null } }).data.email).toBeNull();
  });
});

describe("POST /api/contact", () => {
  it("stores a valid message with a hashed IP and no raw address", async () => {
    const db = contactD1();
    const res = await worker.fetch(
      postContact(VALID, { ip: "198.51.100.11", headers: { "user-agent": "vitest-agent" } }),
      env(db),
    );
    expect(res.status).toBe(201);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(db.rows).toHaveLength(1);
    const row = db.rows[0];
    expect(row.name).toBe(VALID.name);
    expect(row.email).toBe(VALID.email);
    expect(row.subject).toBe(VALID.subject);
    expect(row.message).toBe(VALID.message);
    expect(row.ip_hash).toBeTruthy();
    expect(row.ip_hash).not.toContain("198.51.100.11");
    expect(row.user_agent).toBe("vitest-agent");
  });

  it("rejects a non-JSON content type", async () => {
    const req = new Request(`${ORIGIN}/api/contact`, {
      method: "POST",
      headers: { "content-type": "text/plain", "cf-connecting-ip": "198.51.100.12" },
      body: "hello",
    });
    const res = await worker.fetch(req, env(contactD1()));
    expect(res.status).toBe(415);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("CONTACT_INVALID");
  });

  it("rejects malformed JSON without leaking internals", async () => {
    const res = await worker.fetch(postContact("{not json", { ip: "198.51.100.13" }), env(contactD1()));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).toContain("CONTACT_INVALID");
    expect(text).not.toMatch(/at |Error:|stack/i);
  });

  it("returns the offending field for every invalid field", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ ...VALID, name: "A" }, "name"],
      [{ ...VALID, email: "nope" }, "email"],
      [{ ...VALID, subject: "" }, "subject"],
      [{ ...VALID, message: "short" }, "message"],
    ];
    let i = 0;
    for (const [body, field] of cases) {
      const db = contactD1();
      const res = await worker.fetch(postContact(body, { ip: `198.51.100.2${i++}` }), env(db));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string; field?: string } };
      expect(json.error.code).toBe("CONTACT_INVALID");
      expect(json.error.field).toBe(field);
      expect(db.rows).toHaveLength(0);
    }
  });

  it("rejects oversized payloads before parsing", async () => {
    const req = new Request(`${ORIGIN}/api/contact`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "20000",
        "cf-connecting-ip": "198.51.100.30",
      },
      body: JSON.stringify(VALID),
    });
    const res = await worker.fetch(req, env(contactD1()));
    expect(res.status).toBe(413);
  });

  it("rejects an oversized body even when Content-Length is absent", async () => {
    const req = new Request(`${ORIGIN}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json", "cf-connecting-ip": "198.51.100.33" },
      body: JSON.stringify({ ...VALID, message: "x".repeat(20_000) }),
    });
    req.headers.delete("content-length");
    expect(req.headers.get("content-length")).toBeNull();
    const db = contactD1();
    const res = await worker.fetch(req, env(db));
    expect(res.status).toBe(413);
    expect(db.rows).toHaveLength(0);
  });

  it("silently drops honeypot submissions but answers like a success", async () => {
    const db = contactD1();
    const res = await worker.fetch(
      postContact({ ...VALID, website: "https://spam.example" }, { ip: "198.51.100.31" }),
      env(db),
    );
    expect(res.status).toBe(201);
    expect(db.rows).toHaveLength(0);
  });

  it("returns 503 (not a fake success) when the inbox table is missing", async () => {
    const res = await worker.fetch(postContact(VALID, { ip: "198.51.100.32" }), env(contactD1({ fail: true })));
    expect(res.status).toBe(503);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("CONTACT_UNAVAILABLE");
    expect(json.error.message).toMatch(/temporarily unavailable/i);
  });

  it("rate limits after three messages from the same network", async () => {
    const db = contactD1();
    const ip = "198.51.100.40";
    for (let n = 0; n < 3; n += 1) {
      const ok = await worker.fetch(postContact(VALID, { ip }), env(db));
      expect(ok.status).toBe(201);
    }
    const blocked = await worker.fetch(postContact(VALID, { ip }), env(db));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(((await blocked.json()) as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
    // A different network is unaffected.
    const other = await worker.fetch(postContact(VALID, { ip: "198.51.100.41" }), env(db));
    expect(other.status).toBe(201);
  });

  it("rejects cross-site submissions (CSRF)", async () => {
    const db = contactD1();
    const res = await worker.fetch(
      postContact(VALID, { ip: "198.51.100.50", headers: { "sec-fetch-site": "cross-site" } }),
      env(db),
    );
    expect(res.status).toBe(403);
    expect(db.rows).toHaveLength(0);
  });

  it("does not accept other methods", async () => {
    const req = new Request(`${ORIGIN}/api/contact`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await worker.fetch(req, env(contactD1()));
    expect(res.status).toBe(404);
  });
});

describe("admin inbox endpoints", () => {
  it("requires an authenticated admin session", async () => {
    const res = await worker.fetch(
      new Request(`${ORIGIN}/api/admin/messages`, { headers: { "cf-connecting-ip": "198.51.100.60" } }),
      env(contactD1()),
    );
    expect(res.status).toBe(401);
  });
});
