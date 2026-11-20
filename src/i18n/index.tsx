import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import en from "./en.json";
import fr from "./fr.json";
import ar from "./ar.json";

export type Lang = "en" | "fr" | "ar";
type Dict = typeof en;

const DICTS: Record<Lang, Dict> = { en, fr: fr as Dict, ar: ar as Dict };

interface I18n {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
}

const Ctx = createContext<I18n>({ lang: "en", t: en, setLang: () => {} });

/**
 * Initial language. A real localized route wins over the stored preference:
 * `/ar` must render Arabic on the very first paint (the server already sent
 * Arabic HTML, and a flash of English would be a hydration mismatch for a
 * reader). Otherwise the visitor's stored choice, then English.
 */
function initialLang(): Lang {
  try {
    if (typeof location !== "undefined") {
      const path = location.pathname;
      if (path === "/ar" || path.startsWith("/ar/")) return "ar";
      if (path === "/fr" || path.startsWith("/fr/")) return "fr";
    }
    const s = localStorage.getItem("tvd-lang") as Lang | null;
    return s === "fr" || s === "ar" || s === "en" ? s : "en";
  } catch {
    return "en";
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem("tvd-lang", lang);
    } catch {
      /* ignore */
    }
  }, [lang]);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  return <Ctx.Provider value={{ lang, t: DICTS[lang], setLang }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  return useContext(Ctx);
}
