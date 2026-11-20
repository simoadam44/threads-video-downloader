export type MediaType = "video" | "image" | "gif" | "audio";

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  /** Same-origin proxied download path (e.g. /api/dl/<token>), when issued. */
  dl?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  duration?: number;
  mimeType?: string;
  fileSize?: number;
  quality?: string;
  extension?: string;
}

export interface ResolvedPost {
  postUrl: string;
  postId?: string;
  username?: string;
  profileUrl?: string;
  caption?: string;
  thumbnail?: string;
  mediaItems: MediaItem[];
}

export type ApiErrorCode =
  | "INVALID_URL"
  | "UNSUPPORTED_URL"
  | "NOT_FOUND"
  | "PRIVATE_CONTENT"
  | "MEDIA_NOT_FOUND"
  | "RESOLVER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "TEMPORARY_ERROR"
  | "DOWNLOAD_FAILED"
  | "UNKNOWN_ERROR";

export interface ResolveSuccess {
  success: true;
  data: ResolvedPost;
}

export interface ResolveFailure {
  success: false;
  error: { code: ApiErrorCode; message: string };
}

export type ResolveResponse = ResolveSuccess | ResolveFailure;

export interface SeoRoute {
  path: string;
  title: string;
  description: string;
  h1: string;
  /**
   * Visible page summary, used by BOTH the React tool pages and the server
   * renderer. Keeping it in the registry is what makes the crawlable HTML and
   * the hydrated page say the same thing instead of two hand-written copies.
   */
  summary?: string;
  /**
   * Date (`YYYY-MM-DD`) the copy or markup of this static page last changed.
   * Emitted as `<lastmod>` in both sitemaps. It is curated, not generated: a
   * build or deploy does not change a page, so a build timestamp would be a
   * fake signal. Bump it only when the visible content of the page changes.
   */
  updated?: string;
}
