/**
 * Long-form content for the legal / informational pages.
 *
 * Why a shared module instead of JSX-only text:
 * - `renderStaticRoute()` (src/server/content/render.ts) pre-renders these
 *   routes for crawlers without JavaScript. Before this file the server output
 *   was a single sentence per page, which is thin content for search engines and
 *   for advertising review. Both renderers consume the same blocks, so the
 *   visible page and the crawlable HTML can never drift.
 * - Contact-aware wording lives here too, but no email address is hardcoded:
 *   a public address only appears when the operator configures CONTACT_EMAIL.
 *
 * Content rules (enforced by tests/info-pages.test.ts):
 * - describe actual behaviour only (hashed logs, 5-min cache, no media storage);
 * - never invent an email, company, jurisdiction, phone number or support hours;
 * - never claim a legal certification (GDPR/CCPA "compliance"), ratings, users
 *   or download counts.
 */

export type InfoBlock =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "note"; text: string };

export interface InfoPageContent {
  /** Route path (must exist in SEO_ROUTES). */
  path: string;
  /** Extra paragraph printed under the H1 (the meta description stays in SEO_ROUTES). */
  intro: string;
  /** Human-readable date shown on pages that change over time. */
  updated?: string;
  blocks: InfoBlock[];
  related?: { href: string; label: string }[];
}

export const INFO_LAST_UPDATED = "27 October 2026";

const CONTACT_LINK = { href: "/contact", label: "Contact page" };
const HOW_TO_LINK = { href: "/how-to-use", label: "How to use this downloader" };

/* ------------------------------------------------------------------ about */

const ABOUT: InfoPageContent = {
  path: "/about",
  intro:
    "SaveThreadsVideos is a free, independent web tool that saves publicly accessible videos, photos and carousel media from Threads posts. It runs in your browser: paste a public post link, review what was detected, then download the files you are allowed to use.",
  blocks: [
    { kind: "h2", text: "What this site is" },
    {
      kind: "p",
      text: "SaveThreadsVideos is a single-purpose utility hosted at www.savethreadsvideos.com. It does not host a social network, does not require an account, and does not try to be a general-purpose video platform. Its only job is to answer one question: which media files are published in a public Threads post, and how can the visitor save them in the quality that was actually published?",
    },
    {
      kind: "p",
      text: "The project is operated by an independent developer and is not affiliated with, endorsed by or sponsored by Threads, Instagram or Meta. Threads and Meta are trademarks of their respective owners.",
    },
    { kind: "h2", text: "The problem it solves" },
    {
      kind: "p",
      text: "Threads posts often contain several images, videos, or a mix of both in a carousel. On a phone it is not always obvious how to save those files, and some posts expose several video renditions of different sizes. Manually inspecting a page to find the real media file is tedious and error-prone.",
    },
    {
      kind: "p",
      text: "This tool reads the public post once, lists every media item it can find, and shows the facts it actually knows — dimensions, duration, format — without inventing quality options that the post never published. If a post has no downloadable media, the tool says so instead of offering a broken button.",
    },
    { kind: "h2", text: "How people use it" },
    {
      kind: "ol",
      items: [
        "Open a public Threads post in the Threads app or in a browser.",
        "Copy the post link (Share → Copy link).",
        "Paste the link into the box on the home page and start the download.",
        "Check the previews and the detected details, then save the files you need.",
      ],
    },
    {
      kind: "p",
      text: "The step-by-step version, including what to do when a link is rejected, is on the how-to-use page.",
    },
    { kind: "h2", text: "Design goals" },
    {
      kind: "ul",
      items: [
        "Speed: the page is mostly text and a single form. There is no account, no install and no multi-step wizard.",
        "Clarity: every result shows its type, dimensions and duration when the source provides them, and nothing is shown when it does not.",
        "Accessibility: semantic HTML, labeled controls, keyboard support, visible focus states, and respect for reduced-motion and system theme preferences.",
        "Mobile first: the form, the result cards and the download buttons are sized for small screens.",
        "Restraint: no forced redirects, no fake progress bars, no misleading buttons and no advertising that covers the tool.",
      ],
    },
    { kind: "h2", text: "Privacy and responsible use" },
    {
      kind: "p",
      text: "The downloader does not ask for Threads credentials, cookies or access tokens, and it only supports content that anyone can open without logging in. Media is streamed to your device and is not stored on our servers. Link resolution events are recorded with a hashed link and a hashed network identifier for reliability and abuse prevention, as described in the privacy policy.",
    },
    {
      kind: "p",
      text: "Saving a file is not the same as owning it. Before you republish or reuse someone else's photo or video, check that you have permission, a licence, or another lawful basis. The terms of use and the disclaimer explain this in more detail.",
    },
    { kind: "h2", text: "Corrections and feedback" },
    {
      kind: "p",
      text: "If a supported public post fails repeatedly, if a page contains an error, or if you believe the site is being used to infringe your rights, use the contact page. Reports that include the post URL and a short description of the problem are the fastest to investigate.",
    },
  ],
  related: [HOW_TO_LINK, { href: "/faq", label: "Frequently asked questions" }, CONTACT_LINK],
};

/* -------------------------------------------------------------- how-to-use */

const HOW_TO_USE: InfoPageContent = {
  path: "/how-to-use",
  intro:
    "A complete walkthrough for first-time visitors: finding a public Threads post, copying its link, running the downloader, choosing a file, and fixing the most common errors.",
  updated: INFO_LAST_UPDATED,
  blocks: [
    { kind: "h2", text: "Before you start" },
    {
      kind: "ul",
      items: [
        "The post must be public. If you have to log in to view it, this tool cannot read it either.",
        "You need the post link, not a screenshot and not the profile link of the account.",
        "No account, extension or software installation is required.",
      ],
    },
    { kind: "h2", text: "Step 1 — Find a publicly accessible Threads post" },
    {
      kind: "p",
      text: "Open Threads in the app or at threads.com and navigate to the post you want. Public posts are visible without signing in. An easy check: open the post in a private browser window. If it is still visible, it is public; if you are asked to log in, it is restricted and this tool will not be able to help.",
    },
    { kind: "h2", text: "Step 2 — Copy the post link" },
    {
      kind: "ol",
      items: [
        "In the Threads app, tap the share or paper-plane icon on the post and choose Copy link.",
        "On the web, copy the address from the browser bar, or use the post's menu and choose Copy link.",
        "The link normally looks like https://www.threads.net/@username/post/ABC123 or https://www.threads.com/@username/post/ABC123.",
      ],
    },
    {
      kind: "note",
      text: "Profile links, search pages and the Threads home page are not post links. They are rejected with a clear message instead of producing a broken download.",
    },
    { kind: "h2", text: "Step 3 — Paste the link into the downloader" },
    {
      kind: "p",
      text: "Return to the home page and paste the link into the input field. You can also paste a whole message that contains a link: the tool extracts the first Threads URL it recognises. The Paste button fills the field from your clipboard on browsers that allow clipboard access — if your browser blocks it, paste manually with Ctrl+V or a long press.",
    },
    { kind: "h2", text: "Step 4 — Start processing" },
    {
      kind: "p",
      text: "Press the Download button. The tool validates the link, requests the public post, and lists the media it found. This usually takes a second or two. While it runs you will see a resolving indicator; if something goes wrong you get a plain-language message and the form stays available so you can try a different link.",
    },
    { kind: "h2", text: "Step 5 — Review the detected media" },
    {
      kind: "ul",
      items: [
        "Videos show a player, the published resolution when known, and an MP3 button that extracts audio in your browser.",
        "Photos show a preview plus width × height and the file format when available.",
        "Carousel posts list every item separately, each with its own preview and download button.",
        "Only qualities that the post actually published are listed. A post that only has one file gets one download button, not a fake 1080p option.",
      ],
    },
    { kind: "h2", text: "Step 6 — Save the file" },
    {
      kind: "p",
      text: "Press the download button on the item you want. The browser saves the file to its usual download location — the Downloads folder on desktop, or the Files/Downloads area on iOS and Android. Download All saves the items one after another, so your browser may ask you to allow multiple downloads the first time.",
    },
    {
      kind: "note",
      text: "Carousel posts do not have a ZIP export. Creating archives would mean building large files inside the server, so the tool deliberately offers individual downloads instead of a slow, memory-heavy ZIP process.",
    },
    { kind: "h2", text: "Troubleshooting" },
    { kind: "h3", text: "The link is rejected as invalid" },
    {
      kind: "p",
      text: "Check that you copied the whole post URL and that it starts with https://. Links without a post identifier (profile pages, hashtags, search results) are not post links and cannot be resolved.",
    },
    { kind: "h3", text: "The link is rejected as unsupported" },
    {
      kind: "p",
      text: "Only threads.net and threads.com post URLs are accepted. Links from other social networks, shortened link wrappers, or local addresses are refused by design — the server must never be usable as a generic proxy for arbitrary URLs.",
    },
    { kind: "h3", text: "The post is private or has been deleted" },
    {
      kind: "p",
      text: "Private, followers-only, age-restricted and deleted posts cannot be read. There is no workaround: the site does not accept logins, cookies or tokens, and it does not attempt to bypass access controls.",
    },
    { kind: "h3", text: "No media was found" },
    {
      kind: "p",
      text: "Some posts are text only, some embed an external link, and some have media that the public page does not expose. In those cases there is nothing to download and the tool says so.",
    },
    { kind: "h3", text: "You are asked to wait (rate limit)" },
    {
      kind: "p",
      text: "To keep the service available for everyone, repeated requests are limited per network and per minute. Wait a minute and try again; a single post rarely needs more than one or two attempts.",
    },
    { kind: "h3", text: "A download fails or the preview is empty" },
    {
      kind: "p",
      text: "Media links issued by Threads expire, and a long pause between resolving and downloading can invalidate them. Resolve the post again and download immediately. If the preview image does not load but the download works, the preview CDN was blocked while the file itself is fine.",
    },
    { kind: "h2", text: "Browsers and devices" },
    {
      kind: "p",
      text: "The site works in current versions of Chrome, Edge, Firefox and Safari on Windows, macOS, Linux, Android and iOS. Safari on iPhone may open a video in its player first; use the share sheet and Save to Files, or choose Download from the player menu. Keeping the browser up to date avoids most clipboard and download-permission issues.",
    },
    { kind: "h2", text: "Copyright and responsible use" },
    {
      kind: "p",
      text: "Only download and reuse content you have the right to use: your own posts, posts you have permission to republish, or material under a licence that allows it. A public post is still protected by copyright. Do not use this tool to harass, dox or redistribute someone else's private or personal media.",
    },
  ],
  related: [
    { href: "/how-to-download-threads-videos", label: "Quick three-step guide" },
    { href: "/faq", label: "FAQ" },
    CONTACT_LINK,
  ],
};

/* ---------------------------------------------------------------- privacy */

const PRIVACY: InfoPageContent = {
  path: "/privacy",
  intro:
    "This policy explains what happens to information when you use SaveThreadsVideos. It describes the current implementation, including the parts that are deliberately minimal, and it separates what the site does today from features that are prepared but not enabled.",
  updated: INFO_LAST_UPDATED,
  blocks: [
    { kind: "h2", text: "1. Who is responsible for this site" },
    {
      kind: "p",
      text: "SaveThreadsVideos is an independent tool at www.savethreadsvideos.com, operated by an individual developer. It is not affiliated with Threads, Instagram or Meta. You can reach the operator through the contact page; that page is the official contact channel for privacy questions and requests.",
    },
    { kind: "h2", text: "2. What this policy covers" },
    {
      kind: "p",
      text: "This policy applies to the website and to its public interfaces, including the link resolution and download endpoints. It does not cover Threads or any other third-party site you visit, and it does not cover what those services do with your data under their own policies.",
    },
    { kind: "h2", text: "3. Information you give us" },
    {
      kind: "p",
      text: "You can use the downloader without providing any personal information: there is no account, no login, no newsletter and no payment. Personal information reaches the site in one situation only — when you submit the contact form.",
    },
    {
      kind: "ul",
      items: [
        "Contact form: your name, email address, subject and message.",
        "The message is stored in the site's database so the operator can read and answer it. It is not added to a mailing list, not sold, and not used for advertising.",
        "Please do not include passwords, identity documents, payment data or other sensitive information in a message.",
      ],
    },
    { kind: "h2", text: "4. Information collected automatically" },
    {
      kind: "p",
      text: "When a link is resolved, the server records a small event so the service can be operated, rate-limited and debugged. Specifically, the database receives:",
    },
    {
      kind: "ul",
      items: [
        "a SHA-256 hash of the normalised Threads URL (not the link itself);",
        "a salted hash of the requesting IP address (the raw address is not written to the database);",
        "the resulting status code, the number of media items found, and the request time;",
        "the browser's User-Agent string, truncated to 256 characters.",
      ],
    },
    {
      kind: "p",
      text: "Hashing reduces identifiability but is not the same as anonymisation, because the same input always produces the same hash. Neither the raw link nor the raw IP address is written to that log — only their hashes are. These records are used for aggregate reliability statistics, rate limiting and abuse investigation. Your IP address is also processed transiently by the hosting and security layer (Cloudflare) to deliver the request and block attacks, as with any website.",
    },
    { kind: "h2", text: "5. What happens to the links you paste" },
    {
      kind: "p",
      text: "A pasted link is validated, normalised and used to request the public post. Resolved metadata is cached in the server's memory for about five minutes (configurable, default 300 seconds) to avoid repeat requests for the same post; that cache is per server instance and is not written to disk.",
    },
    {
      kind: "p",
      text: "Media files are streamed through a short-lived opaque token that expires after roughly five minutes, or fetched directly from the platform's CDN by your browser. Files are not written to our storage, and there is no media library, no history and no profile of what you downloaded.",
    },
    { kind: "h2", text: "6. Cookies and local storage" },
    {
      kind: "ul",
      items: [
        "The site does not set advertising or profiling cookies of its own.",
        "If you log into the private admin area, a single HttpOnly session cookie is set for that area. Ordinary visitors never receive it.",
        "The hosting and security provider may set strictly necessary security cookies (for example bot-management cookies) to protect the service.",
        "Your theme choice and language choice are stored in your browser's local storage under the keys tvd-theme and tvd-lang. They stay on your device and are not sent to the server.",
      ],
    },
    { kind: "h2", text: "7. Analytics" },
    {
      kind: "p",
      text: "The site currently loads Google Analytics 4 (measurement ID G-G57VCHWGMX) to count page views and understand which pages are useful. Google may set its own cookies and receives standard request data such as the page address, your approximate location derived from the request, your browser type and your device type. The links you paste into the downloader are not sent to analytics, and the site does not send custom events containing post URLs.",
    },
    {
      kind: "p",
      text: "The hosting provider also injects its own web analytics beacon (Cloudflare Web Analytics), which reports aggregate page-load measurements without using cookies for that purpose.",
    },
    {
      kind: "note",
      text: "Analytics currently loads for all visitors; the site does not yet show a consent banner. If you are in a region that requires consent for analytics, we recommend blocking analytics with your browser or an extension — the downloader keeps working when analytics is blocked.",
    },
    { kind: "h2", text: "8. Advertising (not enabled)" },
    {
      kind: "p",
      text: "Advertising is not active on this site. The AdSense publisher identifier is empty, every ad placement is switched off, and no advertising script is loaded, so no advertising cookies are set and no ad personalisation takes place.",
    },
    {
      kind: "p",
      text: "If advertising is enabled in the future, this policy will be updated first. It will then describe Google advertising cookies, how personalised and non-personalised ads differ, how visitors can control ad personalisation through Google's ad settings, and which consent mechanism is used where the law requires one. Enabling advertising without updating this policy would be a policy violation, so the two changes are tied together.",
    },
    { kind: "h2", text: "9. Third-party services" },
    {
      kind: "ul",
      items: [
        "Cloudflare — hosting, content delivery and security for this website.",
        "Supabase — database hosting for contact messages and the small operational event log.",
        "Google Analytics — traffic measurement, as described above.",
        "Threads / Meta — the platform whose public pages and media files are requested when you resolve a link. Your browser or our server requests the public post and the media directly from their infrastructure; their policies apply to those requests.",
      ],
    },
    {
      kind: "p",
      text: "The site does not send your link to a third-party resolver API: resolution runs on this site's own Worker. If that ever changes, this policy will name the provider before it is used.",
    },
    { kind: "h2", text: "10. Sharing and retention" },
    {
      kind: "p",
      text: "Personal data is not sold and is not shared for advertising. It is shared only with the service providers listed above, which process it to run the site, or when the law requires disclosure.",
    },
    {
      kind: "ul",
      items: [
        "Contact messages are kept until the request has been handled and for a reasonable period afterwards so that follow-ups can be answered, then deleted.",
        "Operational resolve events are small, hashed records used for reliability and abuse prevention. There is no automatic expiry yet; they are retained while that purpose lasts and are reviewed periodically.",
        "The metadata cache and download tokens expire within minutes.",
        "Downloaded media is never stored on the server.",
      ],
    },
    { kind: "h2", text: "11. Security" },
    {
      kind: "p",
      text: "The site is served over HTTPS with HSTS, applies a content security policy, restricts accepted link formats, limits request rates and stores no Threads credentials. Access to the database is limited to the server. No service can promise perfect security, so please avoid sending sensitive material through the contact form.",
    },
    { kind: "h2", text: "12. Your choices and rights" },
    {
      kind: "p",
      text: "Depending on where you live, you may have the right to ask what personal data is held about you, to have it corrected or deleted, or to object to certain processing. Use the contact page to make a request and describe what you need; requests are handled in line with the law that applies to the operator. Because operational records are hashed, we may not be able to locate an individual record without additional information from you.",
    },
    {
      kind: "p",
      text: "You can also limit data collection without contacting us: block or clear analytics cookies in your browser, use a private window, or use a content blocker. The downloader itself does not depend on analytics.",
    },
    { kind: "h2", text: "13. Children" },
    {
      kind: "p",
      text: "The site is a general-purpose utility and is not directed at children. It does not create accounts and does not knowingly collect personal information from children. If you believe a child has sent personal information through the contact form, contact us and it will be deleted.",
    },
    { kind: "h2", text: "14. International visitors" },
    {
      kind: "p",
      text: "The site runs on a global edge network and uses service providers that may process data in countries other than yours. Those transfers rely on the providers' own safeguards.",
    },
    { kind: "h2", text: "15. Changes to this policy" },
    {
      kind: "p",
      text: "This policy may be updated when the site changes — for example when a new analytics provider, an advertising partner or a new contact channel is added. The date at the top of the page always shows the current version, and material changes will be reflected here before the related feature goes live.",
    },
    { kind: "h2", text: "16. Contact" },
    {
      kind: "p",
      text: "Questions about this policy, or requests concerning your data, can be sent through the contact page. Including the subject line “Privacy request” helps route the message.",
    },
  ],
  related: [CONTACT_LINK, { href: "/terms", label: "Terms of use" }, { href: "/disclaimer", label: "Disclaimer" }],
};

/* ------------------------------------------------------------------ terms */

const TERMS: InfoPageContent = {
  path: "/terms",
  intro:
    "These terms explain the rules for using SaveThreadsVideos. They are written to be readable rather than intimidating. By using the site you accept them; if you do not agree, please do not use the service.",
  updated: INFO_LAST_UPDATED,
  blocks: [
    { kind: "h2", text: "1. Acceptance" },
    {
      kind: "p",
      text: "By accessing www.savethreadsvideos.com or using any of its features, you agree to these terms and to the privacy policy. If you use the site on behalf of an organisation, you confirm that you are allowed to accept these terms for it.",
    },
    { kind: "h2", text: "2. What the service is" },
    {
      kind: "p",
      text: "SaveThreadsVideos is a free utility that inspects publicly accessible Threads posts and offers the media files those posts publish. It is an independent third-party tool. It is not affiliated with, endorsed by or sponsored by Threads, Instagram or Meta; those names identify the platform the tool works with, not a relationship. It does not provide access to accounts, and it cannot reveal content that is not already public.",
    },
    {
      kind: "p",
      text: "The service depends on how public posts are published, so supported links, available qualities and results can change or stop working without notice.",
    },
    { kind: "h2", text: "3. Acceptable use" },
    {
      kind: "p",
      text: "You may use the site for personal or professional purposes that are lawful in your country. You are responsible for how you use the files you save.",
    },
    {
      kind: "ul",
      items: [
        "Download only content you have the right to download: your own posts, content you have permission to reuse, or content covered by a licence that allows it.",
        "Respect copyright, trademark, privacy and publicity rights. A public post is not a licence to republish.",
        "Do not use the service to obtain, redistribute or amplify someone else's private or intimate media.",
      ],
    },
    { kind: "h2", text: "4. Prohibited conduct" },
    {
      kind: "ul",
      items: [
        "Attempting to bypass access controls, logins, paywalls or technical restrictions.",
        "Automated scraping, bulk crawling or load testing that degrades the service for other visitors.",
        "Circumventing rate limits, or using multiple addresses to do so.",
        "Uploading or transmitting malware, or probing for vulnerabilities outside a responsible disclosure.",
        "Using the service to infringe intellectual property, harass someone, or break any applicable law.",
        "Reselling, rebranding or presenting the service as your own, or removing attribution from the site.",
      ],
    },    { kind: "h2", text: "5. Copyright and intellectual property" },
    {
      kind: "p",
      text: "The media files you download belong to the people who created them, not to this site and not to you. The site does not grant you any licence to that content. The site's own name, design, text and code belong to its operator and may not be copied wholesale without permission.",
    },
    {
      kind: "p",
      text: "The site does not host the downloaded media, so it cannot remove files from the original platform. If you believe content has been used through this tool in a way that infringes your rights, contact us with the post link and the basis of your claim so the report can be reviewed.",
    },
    { kind: "h2", text: "6. Third-party services and links" },
    {
      kind: "p",
      text: "The service reads public pages and media from Threads, which is operated by a third party. Availability therefore depends on systems outside this site's control. Links to third-party sites are provided for convenience; this site does not control their content or their privacy practices, and their terms apply when you visit them.",
    },
    { kind: "h2", text: "7. Availability and changes" },
    {
      kind: "p",
      text: "The service is provided free of charge and without a service-level agreement. It may be changed, limited or temporarily unavailable, including for maintenance or because a platform changed how public posts are delivered. Rate limits may be applied to keep the service usable for everyone. No guarantee is made that any particular post can be downloaded.",
    },
    { kind: "h2", text: "8. No warranty" },
    {
      kind: "p",
      text: "The service is provided “as is” and “as available”. To the extent permitted by applicable law, the operator makes no warranty that the service will be uninterrupted, error-free or fit for a particular purpose. Nothing in these terms excludes warranties or rights that cannot lawfully be excluded.",
    },
    { kind: "h2", text: "9. Limitation of liability" },
    {
      kind: "p",
      text: "To the maximum extent permitted by applicable law, the operator is not liable for indirect or consequential losses, loss of data, loss of profit, or for how you use downloaded content. Where liability cannot be excluded, it is limited to the amount you paid to use the service — which, for a free service, is zero. This section does not limit liability for intent, gross negligence, or any other liability that cannot be limited by law.",
    },
    { kind: "h2", text: "10. Your responsibility" },
    {
      kind: "p",
      text: "You are responsible for the links you submit and for the way you use the files. You agree not to hold the operator responsible for claims arising from your own use of third-party content, and to comply with the law of the country in which you are located.",
    },
    { kind: "h2", text: "11. Changes to these terms" },
    {
      kind: "p",
      text: "These terms may be updated when the service changes. The date at the top of the page shows the current version, and continued use after a change means you accept the updated terms.",
    },
    { kind: "h2", text: "12. Contact" },
    {
      kind: "p",
      text: "Questions about these terms can be sent through the contact page. For copyright matters, include the post URL and a description of the rights involved.",
    },
  ],
  related: [{ href: "/privacy", label: "Privacy policy" }, { href: "/disclaimer", label: "Disclaimer" }, CONTACT_LINK],
};

/* ------------------------------------------------------------- disclaimer */

const DISCLAIMER: InfoPageContent = {
  path: "/disclaimer",
  intro:
    "This page explains the limits of what this website is and what it can do. It is short on purpose: it sets expectations instead of protecting anyone from them.",
  updated: INFO_LAST_UPDATED,
  blocks: [
    { kind: "h2", text: "Independent third-party tool" },
    {
      kind: "p",
      text: "SaveThreadsVideos is an independent website. It is not affiliated with, endorsed by, sponsored by, or officially connected to Threads, Instagram or Meta. It does not use their logos as its own, does not present itself as their product, and does not speak on their behalf.",
    },
    { kind: "h2", text: "Trademarks and content belong to their owners" },
    {
      kind: "p",
      text: "Threads, Instagram and Meta are trademarks of Meta Platforms, Inc. or its affiliates. All other brand names, media files, captions and images shown or downloaded through this site belong to their respective owners. References to those names describe the platform the tool works with; they do not imply any relationship.",
    },
    { kind: "h2", text: "You are responsible for how you use it" },
    {
      kind: "p",
      text: "Downloading a file does not give you the right to publish, sell, modify or distribute it. Copyright, privacy, publicity and other rights still apply. Before reusing someone else's content, make sure you have permission, a licence or another lawful basis.",
    },
    {
      kind: "p",
      text: "The site is intended for lawful use, including saving content you created, content you have been authorised to use, and content that is offered under a permissive licence. It does not grant permission to reuse material owned by other people, and nothing on this page makes an otherwise unlawful use lawful.",
    },
    { kind: "h2", text: "Availability and results" },
    {
      kind: "p",
      text: "Supported links, detected qualities and download results can change at any time, because they depend on how public posts are published. The tool does not promise that every Threads post can be downloaded, and it cannot access private, deleted or login-protected content.",
    },
    { kind: "h2", text: "External services" },
    {
      kind: "p",
      text: "Media is delivered from third-party infrastructure, and the site may link to external pages. Those services are outside this site's control, and their own terms and policies apply.",
    },
    { kind: "h2", text: "No professional advice" },
    {
      kind: "p",
      text: "Nothing on this website is legal advice. If you are unsure whether you may use a particular file, consult a qualified professional in your jurisdiction.",
    },
  ],
  related: [{ href: "/terms", label: "Terms of use" }, { href: "/privacy", label: "Privacy policy" }, CONTACT_LINK],
};

/* ------------------------------------------------------------ quick guide */

const QUICK_GUIDE: InfoPageContent = {
  path: "/how-to-download-threads-videos",
  intro:
    "Saving a public Threads video takes three steps and about fifteen seconds. This short guide covers the happy path; the full walkthrough adds troubleshooting, browser notes and copyright guidance.",
  blocks: [
    { kind: "h2", text: "Step 1 — Copy the post link, not the profile" },
    {
      kind: "p",
      text: "Open the public post in the Threads app or at threads.com. Use Share → Copy link on the post itself. The address you need contains /post/ and looks like https://www.threads.net/@username/post/ABC123. A profile address (https://www.threads.net/@username) points at an account, not a post, and is rejected.",
    },
    { kind: "h2", text: "Step 2 — Paste it into the downloader" },
    {
      kind: "p",
      text: "Return to the home page and paste the link into the input field. The Paste button can read your clipboard on browsers that allow it; otherwise use Ctrl+V, ⌘V or a long press. If you copied a message that contains the link, the tool extracts the Threads URL from it.",
    },
    { kind: "h2", text: "Step 3 — Preview and download" },
    {
      kind: "p",
      text: "Press Download and wait a moment while the public post is read. You get a player, the resolution and duration the post publishes, and a download button for each available file. On a carousel post every slide is listed separately with a Download All option.",
    },
    { kind: "h2", text: "If it does not work" },
    {
      kind: "ul",
      items: [
        "Private, followers-only and deleted posts cannot be resolved — the site never asks for a login or a cookie.",
        "A rate-limit message means too many requests came from your network in a short time; wait a minute.",
        "Media links expire, so download soon after resolving instead of leaving the tab open for hours.",
      ],
    },
    {
      kind: "p",
      text: "The full how-to-use page explains every error message, how downloads behave on iPhone and Android, and how to check that a post is public before trying.",
    },
    {
      kind: "note",
      text: "Downloading a file does not give you the right to republish it. Use this tool for content you created, content you have permission to use, or content under a licence that allows it.",
    },
  ],
  related: [HOW_TO_LINK, { href: "/faq", label: "FAQ" }, { href: "/threads-video-downloader", label: "Video downloader" }],
};

/* ---------------------------------------------------------------- contact */

const CONTACT: InfoPageContent = {
  path: "/contact",
  intro:
    "Use this page to report a problem, request a correction, raise a copyright or privacy concern, or ask a question about how the tool works. Messages are read by the site operator.",
  updated: INFO_LAST_UPDATED,
  blocks: [
    { kind: "h2", text: "What to contact us about" },
    {
      kind: "ul",
      items: [
        "A public post that this tool cannot resolve, with the post link and a short description of what happens.",
        "An error, broken page or accessibility problem on this website.",
        "A copyright or trademark concern about content saved through the tool.",
        "A privacy question or a request concerning personal data.",
        "A correction to something inaccurate on one of our pages.",
      ],
    },
    { kind: "h2", text: "What helps us answer faster" },
    {
      kind: "ul",
      items: [
        "The exact post URL, if your message is about a specific post.",
        "The browser and device you used, for technical problems.",
        "For rights complaints: the post link, the material concerned, and the basis of your claim.",
      ],
    },
    {
      kind: "note",
      text: "This is a small independent project, not a staffed help desk. There is no telephone support and no guaranteed response time; messages are handled as time allows, and clear reports are handled first.",
    },
    { kind: "h2", text: "Privacy notice for the contact form" },
    {
      kind: "p",
      text: "The form asks for your name, email address, subject and message. Those fields are stored in the site's database so the operator can read and answer your message. They are not used for marketing, not added to a mailing list and not sold. Messages are kept until the request is resolved and for a reasonable follow-up period, then deleted; you can ask for earlier deletion through the same form.",
    },
    {
      kind: "p",
      text: "Please do not send passwords, identity documents, payment details or other sensitive information. The full details are in the privacy policy.",
    },
  ],
  related: [{ href: "/privacy", label: "Privacy policy" }, { href: "/faq", label: "FAQ" }, HOW_TO_LINK],
};

export const INFO_PAGES: Record<string, InfoPageContent> = {
  "/about": ABOUT,
  "/how-to-use": HOW_TO_USE,
  "/how-to-download-threads-videos": QUICK_GUIDE,
  "/privacy": PRIVACY,
  "/terms": TERMS,
  "/disclaimer": DISCLAIMER,
  "/contact": CONTACT,
};

export function infoPageFor(path: string): InfoPageContent | null {
  return INFO_PAGES[path] ?? null;
}
