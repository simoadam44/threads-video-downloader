import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  collectPosts,
  selectPost,
  shortcodeFromOgUrl,
  shortcodeFromUrl,
  extractJsonBlocks,
} from "../src/server/resolvers/threads/threads-parser";
import { normalizePost } from "../src/server/resolvers/threads/threads-media";

const dir = path.resolve(__dirname, "fixtures/threads");
const load = (f: string) => fs.readFileSync(path.join(dir, f), "utf8");

describe("threads parser", () => {
  it("extracts multiple script-json blocks", () => {
    expect(extractJsonBlocks(load("video.html")).length).toBe(3);
  });
  it("collects media posts, ignores text posts and unrelated blobs", () => {
    const posts = collectPosts(load("video.html"));
    expect(posts.map((p) => p["code"])).toContain("VID123");
    expect(posts.map((p) => p["code"])).toContain("OTHER1");
    const text = collectPosts(load("no-media.html"));
    expect(text).toHaveLength(0);
  });
  it("strict shortcode match: wrong shortcode yields null (never another post)", () => {
    const posts = collectPosts(load("video.html"));
    expect(selectPost(posts, "NOPE")).toBe(null);
    expect(selectPost(posts, "VID123")?.["code"]).toBe("VID123");
  });
  it("changed layout yields zero posts", () => {
    expect(collectPosts(load("changed-layout.html"))).toHaveLength(0);
  });
  it("malformed blocks are skipped without throwing", () => {
    expect(collectPosts(load("malformed.html"))).toHaveLength(0);
  });
  it("og:url shortcode extraction incl. share links", () => {
    expect(shortcodeFromOgUrl(load("video.html"))).toBe("VID123");
    expect(shortcodeFromOgUrl(load("share.html"))).toBe(null);
  });
  it("url shortcode parsing", () => {
    expect(shortcodeFromUrl(new URL("https://www.threads.net/@u/post/AbC-1")).shortcode).toBe("AbC-1");
    expect(shortcodeFromUrl(new URL("https://www.threads.net/t/AbC-1")).shortcode).toBe("AbC-1");
    expect(shortcodeFromUrl(new URL("https://www.threads.net/share/xyz/")).shortcode).toBe(null);
  });
});

describe("threads normalization", () => {
  it("video: dedupes re-signed renditions, decodes duration, thumbnail, caption, username", () => {
    const post = selectPost(collectPosts(load("video.html")), "VID123")!;
    const r = normalizePost(post, "https://www.threads.net/@testuser/post/VID123", "testuser")!;
    expect(r.postId).toBe("VID123");
    expect(r.username).toBe("testuser");
    expect(r.caption).toBe("Demo video caption");
    const videos = r.mediaItems.filter((m) => m.type === "video");
    expect(videos).toHaveLength(2); // abc.mp4 (deduped) + hd.mp4
    expect(videos[0].duration).toBe(32);
    expect(videos.map((v) => v.quality).sort()).toEqual(["101", "103"]); // honest rendition labels, no fake "best"
    expect(r.thumbnail).toContain("t1.jpg");
  });
  it("single image: proven by image_versions2 candidates", () => {
    const post = selectPost(collectPosts(load("image.html")), "IMG456")!;
    const r = normalizePost(post, "https://x", null)!;
    expect(r.mediaItems).toHaveLength(2); // dup signed url removed
    expect(r.mediaItems[0].type).toBe("image");
    expect(r.mediaItems[0].width).toBe(1080);
    expect(r.username).toBe("photog");
  });
  it("carousel: image + video + image with per-item ids", () => {
    const post = selectPost(collectPosts(load("carousel.html")), "CAR789")!;
    const r = normalizePost(post, "https://x", null)!;
    expect(r.mediaItems.map((m) => m.type)).toEqual(["image", "video", "image"]);
    expect(r.mediaItems[1].duration).toBe(15);
  });
  it("multi-video carousel: two videos", () => {
    const post = selectPost(collectPosts(load("multi-video-carousel.html")), "MVID1")!;
    const r = normalizePost(post, "https://x", null)!;
    expect(r.mediaItems.filter((m) => m.type === "video")).toHaveLength(2);
  });
  it("no-media post normalizes to null", () => {
    // text-only posts aren't even collected; direct normalize also yields null
    const fake = { code: "TXT000", caption: { text: "hi" } };
    expect(normalizePost(fake as never, "https://x", null)).toBe(null);
  });
  it("share link: single-candidate page resolves without shortcode", () => {
    const posts = collectPosts(load("share.html"));
    expect(posts).toHaveLength(1);
    expect(selectPost(posts, null)?.["code"]).toBe("REAL999");
  });
  it("link-attachment post: falls back to honestly-labeled preview image", () => {
    const post = selectPost(collectPosts(load("link-preview.html")), "LNK321")!;
    const r = normalizePost(post, "https://x", null)!;
    expect(r.mediaItems).toHaveLength(1);
    expect(r.mediaItems[0].type).toBe("image");
    expect(r.mediaItems[0].quality).toBe("preview");
  });
});
