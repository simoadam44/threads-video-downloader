import { describe, it, expect } from "vitest";
import { validateThreadsUrl, extractThreadsUrl } from "../src/server/validate";

describe("validateThreadsUrl", () => {
  it("accepts threads.net post", () => {
    const r = validateThreadsUrl("https://www.threads.net/@user/post/abc123");
    expect(r.ok).toBe(true);
  });
  it("accepts threads.com post", () => {
    expect(validateThreadsUrl("https://www.threads.com/@u/post/x").ok).toBe(true);
  });
  it("rejects javascript:", () => {
    expect(validateThreadsUrl("javascript:alert(1)").ok).toBe(false);
  });
  it("rejects unsupported domain", () => {
    const r = validateThreadsUrl("https://evil.com/@user/post/abc");
    expect(r.ok).toBe(false);
  });
  it("rejects localhost", () => {
    expect(validateThreadsUrl("https://localhost/@u/post/x").ok).toBe(false);
  });
  it("extracts embedded url", () => {
    expect(extractThreadsUrl("check this https://www.threads.com/@u/post/x out")).toContain("threads.com");
  });
  it("normalizes utm params away", () => {
    const r = validateThreadsUrl("https://www.threads.net/@u/post/x?utm_source=a&x=1");
    if (r.ok) expect(r.normalized).not.toContain("utm_source");
    else throw new Error("should be ok");
  });
});
