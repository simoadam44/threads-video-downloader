/**
 * FAQ content shared by the React FAQ page and the server renderer, so the
 * visible questions/answers exist in the initial HTML (crawlable without JS)
 * and can never drift between the two renderers.
 *
 * Every answer must match the actual implementation:
 * - only public threads.net / threads.com post links are accepted;
 * - media is streamed and never stored on the server;
 * - a hashed copy of the link + hashed IP are logged for reliability/abuse;
 * - advertising is currently disabled.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is SaveThreadsVideos?",
    a: "It is a free, independent web tool that lists the media published in a public Threads post — videos, photos and carousel items — and lets you save the files you have the right to use. It is not affiliated with Threads, Instagram or Meta.",
  },
  {
    q: "How do I download a Threads video?",
    a: "Open the public post in Threads, copy its link, paste the link into the box on the home page and press Download. Review the detected video, choose an available quality and save the file. The how-to-use page shows the same steps with screenshots of the flow.",
  },
  {
    q: "Which Threads links are supported?",
    a: "Public post links on threads.net and threads.com, such as https://www.threads.net/@username/post/ABC123, including the equivalent threads.com and /t/ share variants. Profile links, search pages, hashtags and links from other sites are rejected.",
  },
  {
    q: "Is the service free?",
    a: "Yes. There is no account, no payment and no download limit beyond the rate limits that keep the service available for everyone. There is no premium tier at the moment.",
  },
  {
    q: "Do I need a Threads account or my password?",
    a: "No. The tool never asks for Threads credentials, cookies or access tokens, and it only reads posts that are visible without logging in. If a post requires a login, it cannot be downloaded here.",
  },
  {
    q: "Can I download private or deleted posts?",
    a: "No. Private, followers-only, age-restricted and deleted posts are out of scope. The site does not attempt to bypass access controls, and there is no workaround to request.",
  },
  {
    q: "Can I download carousel posts and multiple images?",
    a: "Yes. Carousel posts are detected automatically and each image or video is listed with its own preview and download button, plus a Download All option that saves the items one after another. There is no ZIP export because building archives server-side would mean processing large files in memory.",
  },
  {
    q: "What video quality can I download?",
    a: "Whatever renditions the public post actually publishes — for example 1080p, 720p or 480p. Only qualities that exist are shown; the tool never invents a resolution, bitrate, file size or duration that the source did not provide.",
  },
  {
    q: "Why is my Threads link not working?",
    a: "The most common causes are a profile or search link instead of a post link, a private or deleted post, a truncated URL, or a link from an unsupported domain. Rate limits also trigger a temporary message; waiting a minute usually clears it.",
  },
  {
    q: "Where are downloaded files saved?",
    a: "Wherever your browser saves downloads: usually the Downloads folder on desktop, and the Files or Downloads area on iPhone and Android. The site cannot choose the location and does not keep a copy of your files.",
  },
  {
    q: "Do you store the links I paste or the media I download?",
    a: "Media files are never stored on the server; they are streamed to your device or fetched from the platform's CDN. Each resolve request is recorded with a SHA-256 hash of the normalised link and a salted hash of the IP address, plus the result status and media count, for reliability and abuse prevention. The raw link and raw IP address are not written to that log.",
  },
  {
    q: "Which browsers and devices are supported?",
    a: "Current versions of Chrome, Edge, Firefox and Safari on Windows, macOS, Linux, Android and iOS. On iPhone, Safari may open a video in its player first; use the share sheet to save it to Files, or open the post in Chrome.",
  },
  {
    q: "Can I use the downloaded content however I want?",
    a: "No. Downloading a file does not transfer ownership or grant a licence. A public post is still protected by copyright, so only reuse content you created, content you have permission to use, or content under a licence that allows it.",
  },
  {
    q: "Is this website affiliated with Threads or Meta?",
    a: "No. SaveThreadsVideos is an independent third-party tool. It does not use Threads or Meta branding as its own, and it is not endorsed, sponsored or operated by them. Trademarks belong to their respective owners.",
  },
  {
    q: "How do I contact you about a problem or a privacy request?",
    a: "Use the contact page. Include the post URL for a link problem, or describe the data request for a privacy question. The page explains what is stored when you submit the form and how long messages are kept.",
  },
];
