import { describe, it, expect } from "vitest";
import { mediaFilename, extensionFromMime } from "../src/lib/filenames";

describe("mediaFilename", () => {
  it("builds safe video name", () => {
    expect(mediaFilename("video", "abc123", 0, "mp4")).toBe("threads-video-abc123.mp4");
  });
  it("strips traversal", () => {
    expect(mediaFilename("video", "../x", 0, "mp4")).toBe("threads-video-x.mp4");
  });
  it("builds image name with index", () => {
    expect(mediaFilename("image", "p1", 2, "jpg")).toBe("threads-image-p1-2.jpg");
  });
});

describe("extensionFromMime", () => {
  it("maps jpeg", () => {
    expect(extensionFromMime("image/jpeg", "bin")).toBe("jpg");
  });
  it("falls back", () => {
    expect(extensionFromMime(undefined, "mp4")).toBe("mp4");
  });
});
