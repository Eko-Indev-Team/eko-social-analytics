import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isLanguageCode, LANGUAGES, type LanguageCode } from './languages';

/**
 * Interface translation. The English text is the key: `t('Campaigns')`, `t('{count} leads', { count })`.
 * A missing translation falls back to English, so untranslated text never disappears.
 * Strings defined outside components (labels in constants) are wrapped in `msg()` so the extractor finds them,
 * then translated at render time with `t(label)`.
 */
export type Vars = Record<string, string | number>;
export type Translate = (text: string, vars?: Vars) => string;
type Dictionary = Record<string, string>;

const STORAGE_KEY = 'socialboard-lang';

const loaders = import.meta.glob<Dictionary>('./locales/*.json', { import: 'default' });

/** Marks a string for translation without translating it (for constants); translate later with t(). */
export const msg = <S extends string>(text: S): S => text;

export function interpolate(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

const english: Translate = (text, vars) => interpolate(text, vars);

interface I18nValue {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue>({ lang: 'en', setLang: () => {}, t: english });

export function readLanguage(): LanguageCode {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguageCode(stored) ? stored : 'en';
  } catch {
    return 'en';
  }
}

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: LanguageCode }) {
  const [lang, setLangState] = useState<LanguageCode>(() => initial ?? readLanguage());
  const [dict, setDict] = useState<Dictionary | null>(null);

  useEffect(() => {
    document.documentElement.lang = LANGUAGES.find((l) => l.code === lang)?.htmlLang ?? 'en';
    if (lang === 'en') {
      setDict(null);
      return;
    }
    let cancelled = false;
    const load = loaders[`./locales/${lang}.json`];
    if (!load) return;
    load()
      .then((loaded) => !cancelled && setDict(loaded))
      .catch(() => !cancelled && setDict(null));
    return () => {
      cancelled = true;
    };
  }, [lang]);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  }, []);

  const t = useCallback<Translate>((text, vars) => interpolate((dict && dict[text]) || text, vars), [dict]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/** The translate function for the current language. */
export const useT = () => useContext(I18nContext).t;
