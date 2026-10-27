/**
 * FAQ content shared by the React FAQ page and the server renderer, so the
 * visible questions/answers exist in the initial HTML (crawlable without JS)
 * and can never drift between the two renderers.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  { q: "Is this Threads video downloader free to use?", a: "Yes. Paste a public Threads link and download the available media. No account or payment required." },
  { q: "Do I need to create an account?", a: "No. No Threads login, password or cookies are required. Only publicly accessible posts are supported." },
  { q: "Which videos can I download?", a: "Only videos from public posts that you can already open without logging in. Private posts are not supported." },
  { q: "What video quality can I download?", a: "Whatever quality the public post actually publishes (for example 1080p, 720p, 480p). We never fabricate quality options." },
  { q: "Is it safe to use?", a: "The tool runs link validation, rate limiting and safe downloads, and does not permanently store your links or files by default." },
  { q: "Why is my video not downloading?", a: "Usually the link is private, deleted, malformed, or from an unsupported domain. Only public threads.net and threads.com post URLs work." },
];
