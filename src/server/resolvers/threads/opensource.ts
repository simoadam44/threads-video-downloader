/**
 * OpenSourceResolver: self-hosted Threads extraction, no paid API, no key.
 * Technique adapted from tribixbite/yt-dlp-threads (Unlicense, public domain):
 * fetch the public post page as a crawler, parse embedded post JSON, match
 * strictly by shortcode, normalize to ResolvedPost. Only publicly served
 * content; no login, no cookies, no CAPTCHA/auth handling. Fragile by nature:
 * any structural change degrades to MEDIA_NOT_FOUND/RESOLVER_UNAVAILABLE.
 */
import type { ResolvedPost } from "../../../types";
import type { MediaResolverProvider } from "../types";
import { ResolverError } from "../types";
import { fetchWithOneRetry } from "./threads-fetch";
import { collectPosts, selectPost, shortcodeFromOgUrl, shortcodeFromUrl } from "./threads-parser";
import { normalizePost } from "./threads-media";

export class OpenSourceResolver implements MediaResolverProvider {
  name = "opensource";
  canHandle(): boolean {
    return true;
  }
  async resolve(url: URL, normalized: string): Promise<ResolvedPost> {
    const { shortcode, username } = shortcodeFromUrl(url);
    const html = await fetchWithOneRetry(url);
    let code = shortcode;
    if (!code) code = shortcodeFromOgUrl(html); // /share/ links resolve via canonical og:url
    const posts = collectPosts(html);
    if (posts.length === 0) throw new ResolverError("MEDIA_NOT_FOUND");
    const post = selectPost(posts, code);
    if (!post) {
      // Either the shortcode isn't in the page (deleted/private/login-gated/
      // layout change) or the link form was ambiguous with many candidates.
      throw new ResolverError(code ? "MEDIA_NOT_FOUND" : "MEDIA_NOT_FOUND");
    }
    const resolved = normalizePost(post, normalized, username);
    if (!resolved) throw new ResolverError("MEDIA_NOT_FOUND");
    return resolved;
  }
}
