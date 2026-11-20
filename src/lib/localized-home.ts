/**
 * Localized homepage copy — the real multilingual entry points.
 *
 * Why this module exists:
 * - Language selection used to live only in `localStorage`, so Googlebot (which
 *   does not carry a visitor's stored preference) only ever saw English. There
 *   was no `/ar/` or `/fr/` URL and no `hreflang`, so the Arabic and French
 *   content was invisible to search even though the site already ranked for
 *   Arabic queries.
 * - `/ar` and `/fr` are now real routes served by the Worker (SSR) and hydrated
 *   by React. Both renderers read these blocks, so the crawlable HTML and the
 *   visible page cannot drift.
 * - The pages deliberately do not machine-translate the long English guides.
 *   They are shorter, self-contained homepages in the target language, with the
 *   English in-depth pages one click away (the header and footer already link
 *   to them). That is honest: nothing claims a translated article exists.
 *
 * Content rules (same bar as the English shared modules, enforced by tests):
 * - describe only behaviour that exists in this repository;
 * - no "unlimited", "best", "guaranteed", "100% safe" or watermark claims;
 * - no invented statistics, ratings, user counts or testimonials.
 */

import type { ToolFaq, ToolSection } from "./tool-content";

export type LocalizedLang = "ar" | "fr";

export interface LocalizedHome {
  /** Canonical path, e.g. "/ar". */
  path: string;
  lang: LocalizedLang;
  dir: "rtl" | "ltr";
  /** `<title>` for the localized page (unique, never shared with `/`). */
  title: string;
  description: string;
  h1: string;
  intro: string;
  /** Visible FAQ heading in the page's language (not reused from English). */
  faqTitle: string;
  /** Anchor text for the link back to the English homepage. */
  englishLabel: string;
  sections: ToolSection[];
  faqs: ToolFaq[];
}

/**
 * The hreflang cluster. Every member declares all three alternates plus an
 * `x-default`, and each page stays self-canonical: an alternate URL is a
 * translation of the page, not a duplicate of it.
 */
export const HREFLANG_PATHS = ["/", "/ar", "/fr"] as const;

export const LOCALIZED_HOMES: LocalizedHome[] = [
  {
    path: "/ar",
    lang: "ar",
    dir: "rtl",
    title: "تحميل فيديوهات وصور ثريدز - مجاني وبدون تسجيل",
    description:
      "حمّل منشورات ثريدز العامة: فيديو MP4 أو صورة JPG أو صوت MP3. بدون حساب أو تطبيق، ويعمل على الجوال والكمبيوتر.",
    h1: "تحميل فيديوهات وصور ثريدز",
    intro:
      "الصق رابط منشور عام من ثريدز ليعرض الموقع كل ملف وسائط ينشره المنشور: مقاطع الفيديو، والصور، وكل شريحة في منشور متعدد الصور. تراجع النتيجة، ثم تحفظ الملف الذي تحتاجه.",
    faqTitle: "أسئلة شائعة",
    englishLabel: "النسخة الإنجليزية",
    sections: [
      {
        h2: "من الرابط إلى الملف في ثلاث خطوات",
        body: [
          "افتح المنشور في تطبيق ثريدز أو على الويب، اضغط أيقونة المشاركة ثم «نسخ الرابط». يكون العنوان على شكل https://www.threads.net/@username/post/ABC123، ويعمل عنوان threads.com بالطريقة نفسها.",
          "الصق الرابط في المربع أعلى الصفحة واضغط تحميل. يقرأ المحلّل المنشور، ثم تظهر بطاقة لكل عنصر فيها معاينة ونوع الوسائط والأبعاد إن أرسلها المصدر، ولكل عنصر زر حفظ خاص به.",
        ],
        bullets: [
          "انسخ رابط المنشور نفسه، وليس رابط الحساب.",
          "الصق الرابط كاملًا؛ الرابط المقطوع لا يمكن تحليله.",
          "روابط المشاركة من نوع /t/… تُحوَّل إلى المنشور الذي تشير إليه.",
        ],
      },
      {
        h2: "الجودة هي ما ينشره المنشور فعلًا",
        body: [
          "لا تختار الأداة دقة من قائمة ثابتة. إذا نشر المنشور أكثر من نسخة للفيديو، تظهر كل نسخة بوصفها عنصرًا مستقلًا مع دقتها الحقيقية. وإذا نشر ملفًا واحدًا، يظهر زر واحد فقط.",
          "لا يتم تكبير الدقة ولا إعادة ترميز الملف، ولا تُعرض مدة أو حجم لم يرسلهما المصدر. ولهذا قد يعرض منشوران مجموعتين مختلفتين من الأرقام.",
        ],
      },
      {
        h2: "الصوت بصيغة MP3 داخل المتصفح",
        body: [
          "لكل بطاقة فيديو زر MP3. يُفكّ ترميز المسار الصوتي ويُحوَّل إلى MP3 داخل متصفحك، فلا يُرفع الفيديو إلى خادم للتحويل. المقاطع الطويلة جدًا قد تتجاوز ذاكرة الهاتف فتُرفض برسالة واضحة بدل ملف تالف.",
        ],
      },
      {
        h2: "ما لا تفعله الأداة",
        body: [
          "الحسابات الخاصة والمنشورات المحذوفة والمقيّدة بالعمر لا يمكن تحليلها، ولا تُقدَّم أي طريقة لتجاوز ذلك. روابط الحسابات وصور الملف الشخصي ليست منشورات وتُرفض كروابط غير مدعومة.",
          "لا تضيف الأداة علامة مائية ولا تحذف علامة موجودة في الملف الأصلي؛ البايتات التي تصلك هي ما يقدّمه المنشور العام.",
        ],
      },
      {
        h2: "الخصوصية والحدود",
        body: [
          "تُحدَّد عمليات التحليل بعشرين طلبًا في الدقيقة لكل شبكة، وتُحفظ بيانات المنشور نحو خمس دقائق لتسريع الطلب المتكرر. تُبثّ الوسائط من خوادم المنصة إلى جهازك مباشرة، ولا تُكتب نسخة منها على خادمنا.",
          "هذا موقع مستقل من طرف ثالث، غير تابع لثريدز أو ميتا ولا معتمد منهما. تحميل ملف عام لا يمنحك حقوق نشره؛ استخدم فقط ما تملكه أو لديك إذن باستخدامه.",
        ],
      },
    ],
    faqs: [
      {
        q: "هل أحتاج إلى حساب ثريدز؟",
        a: "لا. لا يطلب الموقع اسم مستخدم أو كلمة مرور أو ملف تعريف ارتباط، ولا يقرأ إلا ما يراه زائر غير مسجل.",
      },
      {
        q: "هل يمكنني حفظ منشور خاص؟",
        a: "لا. المنشورات الخاصة والمحذوفة خارج نطاق الأداة، ويعرض الموقع سبب الفشل بدل نتيجة فارغة.",
      },
      {
        q: "لماذا تظهر جودة واحدة فقط؟",
        a: "لأن المنشور ينشر ملفًا واحدًا. القائمة مبنية على النسخ الموجودة فعلًا، ولا تُضاف دقة غير متاحة.",
      },
      {
        q: "هل يعمل على الجوال؟",
        a: "نعم، في متصفح الهاتف. على iOS قد يفتح المتصفح الفيديو في مشغّله أولًا؛ استخدم قائمة المشاركة للحفظ في الملفات. على Android يُحفظ الملف في مجلد التنزيلات أو المعرض.",
      },
      {
        q: "هل تحتفظون بالملفات؟",
        a: "لا. تُبثّ الملفات إلى جهازك ولا تُخزَّن على الخادم، ولا يُسجَّل الرابط نفسه بل قيمة مُجزّأة.",
      },
    ],
  },
  {
    path: "/fr",
    lang: "fr",
    dir: "ltr",
    title: "Téléchargeur Threads - Vidéos et photos publiques, sans compte",
    description:
      "Enregistrez une publication Threads publique : vidéo MP4, photo JPG ou audio MP3. Gratuit, sans compte ni application, sur mobile comme sur ordinateur.",
    h1: "Téléchargeur de vidéos et photos Threads",
    intro:
      "Collez le lien d'une publication Threads publique : la page liste chaque fichier publié par le post, c'est-à-dire les vidéos, les photos et chaque diapositive d'un carrousel. Vous vérifiez le résultat, puis vous enregistrez le fichier utile.",
    faqTitle: "Questions fréquentes",
    englishLabel: "Version anglaise",
    sections: [
      {
        h2: "Du lien au fichier en trois étapes",
        body: [
          "Ouvrez la publication dans l'application Threads ou sur le web, touchez l'icône de partage et choisissez Copier le lien. L'adresse ressemble à https://www.threads.net/@nom/post/ABC123 ; l'équivalent threads.com fonctionne de la même façon.",
          "Collez-la dans le champ en haut de la page et appuyez sur Télécharger. Le résolveur lit la publication, puis une carte apparaît pour chaque élément, avec un aperçu, le type de média et les dimensions lorsque la source les fournit.",
        ],
        bullets: [
          "Copiez le lien de la publication, pas celui du profil.",
          "Collez le lien entier : une adresse tronquée ne peut pas être analysée.",
          "Les liens de partage /t/… sont ramenés à la publication qu'ils désignent.",
        ],
      },
      {
        h2: "La qualité est celle que la publication propose",
        body: [
          "L'outil n'applique pas une liste fixe de qualités. Si la publication expose plusieurs versions d'une vidéo, chacune devient une entrée distincte avec sa résolution réelle. S'il n'y a qu'un fichier, il n'y a qu'un bouton.",
          "Aucune mise à l'échelle, aucun réencodage et aucune durée inventée : une valeur absente de la source est simplement omise.",
        ],
      },
      {
        h2: "De l'audio MP3, décodé dans le navigateur",
        body: [
          "Chaque carte vidéo propose un bouton MP3. La piste audio est décodée puis encodée localement, donc la vidéo n'est jamais envoyée sur un serveur de conversion. Un clip très long peut dépasser la mémoire du téléphone et être refusé avec un message clair.",
        ],
      },
      {
        h2: "Ce que l'outil ne fait pas",
        body: [
          "Les comptes privés, les publications supprimées ou réservées à un âge ne peuvent pas être lus, et aucun contournement n'est proposé. Les pages de profil ne sont pas des publications et sont refusées.",
          "L'outil n'ajoute pas de filigrane et ne retire pas celui du fichier d'origine : les octets reçus sont ceux du post public.",
        ],
      },
      {
        h2: "Confidentialité et limites",
        body: [
          "La résolution est limitée à 20 requêtes par minute et par réseau, et les métadonnées sont mises en cache environ cinq minutes. Les médias sont diffusés directement de la plateforme vers votre appareil ; aucune copie n'est écrite sur le serveur.",
          "Ce site est un outil indépendant, sans lien avec Threads ou Meta. Télécharger un fichier public ne transfère aucun droit : n'utilisez que ce que vous avez créé ou le droit de réutiliser.",
        ],
      },
    ],
    faqs: [
      {
        q: "Faut-il un compte Threads ?",
        a: "Non. Aucun identifiant, mot de passe ou cookie n'est demandé : l'outil lit seulement ce qu'un visiteur non connecté peut voir.",
      },
      {
        q: "Puis-je enregistrer une publication privée ?",
        a: "Non. Les publications privées ou supprimées sont hors de portée, et la page indique la raison au lieu d'un résultat vide.",
      },
      {
        q: "Pourquoi une seule qualité ?",
        a: "Parce que la publication ne propose qu'un fichier. La liste reflète les versions réellement présentes.",
      },
      {
        q: "Est-ce que cela fonctionne sur mobile ?",
        a: "Oui, dans le navigateur. Sur iOS, utilisez la feuille de partage pour enregistrer dans Fichiers ; sur Android, le fichier arrive dans Téléchargements ou la galerie.",
      },
      {
        q: "Conservez-vous les fichiers ?",
        a: "Non. Ils sont diffusés vers votre appareil et ne sont pas stockés ; le journal garde une valeur hachée du lien.",
      },
    ],
  },
];

export function localizedHomeFor(path: string): LocalizedHome | undefined {
  return LOCALIZED_HOMES.find((p) => p.path === path);
}

/** Alternates for a page that belongs to the hreflang cluster, else null. */
export function hreflangFor(path: string): { hreflang: string; href: string }[] | null {
  if (!(HREFLANG_PATHS as readonly string[]).includes(path)) return null;
  const alternates = HREFLANG_PATHS.map((p) => ({
    hreflang: p === "/" ? "en" : p.slice(1),
    href: p,
  }));
  return [...alternates, { hreflang: "x-default", href: "/" }];
}
