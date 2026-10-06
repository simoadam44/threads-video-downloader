import type { ResolvedPost } from "../../types";
import type { MediaResolverProvider } from "./types";

function postIdFrom(url: URL): string {
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "post";
  return last.replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 32) || "demo";
}

function usernameFrom(url: URL): string {
  const m = url.pathname.match(/@([^/]+)/);
  return m ? m[1].replace(/[^a-zA-Z0-9-_.]/g, "").slice(0, 30) : "threads_user";
}

/** Realistic fixtures so the full UI works without an external API. */
export class MockResolver implements MediaResolverProvider {
  name = "mock";
  canHandle(): boolean {
    return true;
  }
  async resolve(url: URL, normalized: string): Promise<ResolvedPost> {
    const postId = postIdFrom(url);
    const username = usernameFrom(url);
    const lowered = normalized.toLowerCase();
    const base: ResolvedPost = {
      postUrl: normalized,
      postId,
      username,
      profileUrl: `https://www.threads.net/@${username}`,
      caption: "Demo public post (mock resolver). Connect a real resolver API for live media.",
      mediaItems: [],
    };
    if (lowered.includes("private")) {
      const { ResolverError } = await import("./types");
      throw new ResolverError("PRIVATE_CONTENT");
    }
    if (lowered.includes("empty") || lowered.includes("nomedia")) {
      const { ResolverError } = await import("./types");
      throw new ResolverError("MEDIA_NOT_FOUND");
    }
    if (lowered.includes("carousel") || lowered.includes("multi")) {
      base.thumbnail = "https://picsum.photos/seed/threads-carousel/1080/1350";
      base.mediaItems = [0, 1, 2, 3, 4].map((i) =>
        i === 2
          ? {
              id: `mock-${postId}-video-${i}`,
              type: "video",
              url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
              thumbnail: `https://picsum.photos/seed/threads-${postId}-${i}/1080/1350`,
              width: 1080,
              height: 1350,
              duration: 32,
              mimeType: "video/mp4",
              quality: "best",
              extension: "mp4",
            }
          : {
              id: `mock-${postId}-img-${i}`,
              type: "image",
              url: `https://picsum.photos/seed/threads-${postId}-${i}/1080/1350`,
              thumbnail: `https://picsum.photos/seed/threads-${postId}-${i}/1080/1350`,
              width: 1080,
              height: 1350,
              mimeType: "image/jpeg",
              extension: "jpg",
            },
      );
      return base;
    }
    if (lowered.includes("photo") || lowered.includes("image") || lowered.includes("pic")) {
      base.thumbnail = `https://picsum.photos/seed/threads-${postId}/1080/1350`;
      base.mediaItems = [
        {
          id: `mock-${postId}-img-0`,
          type: "image",
          url: `https://picsum.photos/seed/threads-${postId}/1080/1350`,
          thumbnail: `https://picsum.photos/seed/threads-${postId}/1080/1350`,
          width: 1080,
          height: 1350,
          mimeType: "image/jpeg",
          extension: "jpg",
        },
      ];
      return base;
    }
    base.thumbnail = `https://picsum.photos/seed/threads-${postId}/1080/608`;
    base.mediaItems = [
      {
        id: `mock-${postId}-video-0`,
        type: "video",
        url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        thumbnail: `https://picsum.photos/seed/threads-${postId}/1080/608`,
        width: 1920,
        height: 1080,
        duration: 32,
        mimeType: "video/mp4",
        quality: "best",
        extension: "mp4",
      },
    ];
    return base;
  }
}
