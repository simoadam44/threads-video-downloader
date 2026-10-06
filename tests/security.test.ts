import { describe, it, expect } from "vitest";
import { validateThreadsUrl, extractThreadsUrl } from "../src/server/validate";
import { sanitizeGuideHtml, isValidSlug } from "../src/server/content/types";
import { lookupDownloadToken } from "../src/server/services/dl-tokens";

const ok = (r: ReturnType<typeof validateThreadsUrl>) => r.ok === true;
const codeOf = (input: string) => {
  const r = validateThreadsUrl(input);
  return r.ok ? "OK" : r.code;
};

describe("SSRF / URL matrix", () => {
  it("accepts legitimate Threads post URLs", () => {
    expect(ok(validateThreadsUrl("https://www.threads.net/@user/post/abc123"))).toBe(true);
    expect(ok(validateThreadsUrl("https://threads.com/@user/post/abc123"))).toBe(true);
    expect(ok(validateThreadsUrl("https://www.threads.net/t/abc123"))).toBe(true);
    expect(ok(validateThreadsUrl("https://www.threads.com/share/xyz789/"))).toBe(true);
  });
  it("blocks localhost / loopback / private IPs", () => {
    for (const u of [
      "https://localhost/@u/post/x",
      "https://127.0.0.1/@u/post/x",
      "https://127.1.2.3/@u/post/x",
      "https://[::1]/@u/post/x",
      "https://10.0.0.1/@u/post/x",
      "https://192.168.1.1/@u/post/x",
      "https://172.16.5.4/@u/post/x",
      "https://0x7f.0x0.0x0.0x1/@u/post/x",
      "http://2130706433/@u/post/x",
    ]) {
      expect(ok(validateThreadsUrl(u))).toBe(false);
    }
  });
  it("blocks dangerous schemes and arbitrary domains", () => {
    expect(codeOf("javascript:alert(1)")).toBe("INVALID_URL");
    expect(codeOf("data:text/html,<h1>x</h1>")).toBe("INVALID_URL");
    expect(codeOf("file:///etc/passwd")).toBe("INVALID_URL");
    expect(codeOf("ftp://www.threads.net/@u/post/x")).toBe("INVALID_URL");
    expect(codeOf("https://evil.com/@u/post/x")).toBe("UNSUPPORTED_URL");
    // userinfo-looking host is rejected as invalid (credentials never allowed)
    expect(codeOf("https://threads.net@evil.com/@u/post/x")).toBe("INVALID_URL");
    expect(codeOf("https://evil.com#@www.threads.net/")).toBe("UNSUPPORTED_URL");
  });
  it("rejects credentials inside URLs", () => {
    expect(codeOf("https://user:pass@www.threads.net/@u/post/x")).toBe("INVALID_URL");
    expect(codeOf("https://user@www.threads.net/@u/post/x")).toBe("INVALID_URL");
  });
  it("rejects oversized / malformed input", () => {
    expect(codeOf("x".repeat(3000))).toBe("INVALID_URL");
    expect(codeOf("")).toBe("INVALID_URL");
    expect(codeOf("not a url at all")).toBe("INVALID_URL");
    expect(codeOf("https://www.threads.net/")).toBe("UNSUPPORTED_URL");
  });
  it("extracts embedded URLs without executing them", () => {
    const found = extractThreadsUrl('see this: https://www.threads.net/@u/post/abc123 "quoted"');
    expect(found).toBe("https://www.threads.net/@u/post/abc123");
    expect(extractThreadsUrl("no url here")).toBe(null);
  });
  it("overlong shortcodes bounded by input cap", () => {
    expect(ok(validateThreadsUrl(`https://www.threads.net/@u/post/${"a".repeat(500)}`))).toBe(true);
    expect(codeOf(`https://www.threads.net/@u/post/${"a".repeat(3000)}`)).toBe("INVALID_URL");
  });
});

describe("XSS / traversal hardening", () => {
  it("sanitizer strips scripts, handlers, javascript: and traversal", () => {
    const out = sanitizeGuideHtml(
      '<p onclick="evil()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="../../secret">y</a><img src="data:x" onerror="z()" />',
    );
    expect(out).not.toContain("<script");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("../");
    expect(out).not.toContain("onerror");
    expect(out).toContain("<p>Hi</p>");
  });
  it("slugs reject traversal and separators", () => {
    for (const s of ["../admin", "..%2fadmin", "a/b", "", "A B", "/api/dl/x"]) {
      expect(isValidSlug(s)).toBe(false);
    }
  });
  it("download tokens reject path tricks", () => {
    expect(lookupDownloadToken("../abc")).toBe(null);
    expect(lookupDownloadToken("x".repeat(31))).toBe(null);
    expect(lookupDownloadToken("X".repeat(32))).toBe(null);
  });
});
