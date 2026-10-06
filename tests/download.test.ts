import { describe, it, expect } from "vitest";
import { issueDownloadToken, lookupDownloadToken } from "../src/server/services/dl-tokens";
import { sanitizePost } from "../src/server/worker";

describe("download tokens", () => {
  it("issues lookup-able tokens with post context", () => {
    const t = issueDownloadToken("https://x.test/v.mp4", "threads-video-p.mp4", "https://www.threads.net/@u/post/p", "p-video-0");
    expect(t).toMatch(/^[0-9a-f]{32}$/);
    const e = lookupDownloadToken(t);
    expect(e?.url).toBe("https://x.test/v.mp4");
    expect(e?.filename).toBe("threads-video-p.mp4");
    expect(e?.postUrl).toBe("https://www.threads.net/@u/post/p");
    expect(e?.itemId).toBe("p-video-0");
  });
  it("rejects malformed and unknown tokens", () => {
    expect(lookupDownloadToken("not-a-token")).toBe(null);
    expect(lookupDownloadToken("../../../etc/passwd")).toBe(null);
    expect(lookupDownloadToken("a".repeat(32))).toBe(null);
    expect(lookupDownloadToken("https://evil.com/x")).toBe(null);
  });
  it("tokens are unguessable (unique per issue)", () => {
    const a = issueDownloadToken("https://x.test/a.mp4", "a.mp4");
    const b = issueDownloadToken("https://x.test/a.mp4", "a.mp4");
    expect(a).not.toBe(b);
  });
});

describe("sanitizePost media urls", () => {
  it("preserves long signed CDN urls intact (truncation breaks signatures)", () => {
    const longUrl = "https://x.test/v.mp4?" + "p=".repeat(1) + "x".repeat(1400);
    expect(longUrl.length).toBeGreaterThan(1024);
    const out = sanitizePost({
      postUrl: "https://www.threads.net/@u/post/p1",
      mediaItems: [{ id: "v0", type: "video", url: longUrl }],
    });
    expect(out.mediaItems[0].url).toBe(longUrl);
  });
});
