import { describe, it, expect } from "vitest";
import { MockResolver } from "../src/server/resolvers/mock";
import { getResolver } from "../src/server/resolvers";

describe("MockResolver", () => {
  it("resolves video by default", async () => {
    const r = new MockResolver();
    const post = await r.resolve(new URL("https://www.threads.net/@u/post/v1"), "https://www.threads.net/@u/post/v1");
    expect(post.mediaItems.length).toBe(1);
    expect(post.mediaItems[0].type).toBe("video");
  });
  it("resolves carousel to 5 items", async () => {
    const r = new MockResolver();
    const post = await r.resolve(new URL("https://www.threads.net/@u/post/carousel9"), "https://www.threads.net/@u/post/carousel9");
    expect(post.mediaItems.length).toBe(5);
  });
  it("resolves photo to image", async () => {
    const r = new MockResolver();
    const post = await r.resolve(new URL("https://www.threads.net/@u/post/photo7"), "https://www.threads.net/@u/post/photo7");
    expect(post.mediaItems[0].type).toBe("image");
  });
});

describe("getResolver", () => {
  it("defaults to opensource (no paid key required)", () => {
    expect(getResolver({}).name).toBe("opensource");
  });
  it("selects mock explicitly", () => {
    expect(getResolver({ MEDIA_RESOLVER_PROVIDER: "mock" }).name).toBe("mock");
  });
  it("selects external (optional only)", () => {
    expect(getResolver({ MEDIA_RESOLVER_PROVIDER: "external" }).name).toBe("external");
  });
});
