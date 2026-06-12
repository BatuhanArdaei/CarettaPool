'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { LangCode } from '@/lib/i18n';

type Translations = Record<string, Record<string, string>>;

interface LanguageContextValue {
  lang: LangCode;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'tr',
  t: (k) => k,
  dir: 'ltr',
});

const RTL_LANGS = ['ar'];

async function loadTranslations(code: LangCode): Promise<Translations> {
  try {
    const mod = await import(`@/lib/i18n/locales/${code}.json`);
    return mod.default as Translations;
  } catch {
    const fallback = await import('@/lib/i18n/locales/tr.json');
    return fallback.default as Translations;
  }
}

export function LanguageProvider({
  lang,
  initialMessages,
  children,
}: {
  lang: LangCode;
  initialMessages?: Translations;
  children: ReactNode;
}) {
  // Server provides initialMessages so first paint has translations (no flash)
  const [translations, setTranslations] = useState<Translations>(initialMessages ?? {});

  useEffect(() => {
    // On client nav (lang switch), reload for the new lang.
    // Module cache makes repeat loads for the same lang instant.
    loadTranslations(lang).then(setTranslations);
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';
  }, [lang]);

  const t = useCallback(
    (key: string): string => {
      const parts = key.split('.');
      if (parts.length === 2) {
        return translations[parts[0]]?.[parts[1]] ?? key;
      }
      return key;
    },
    [translations],
  );

  const dir: 'ltr' | 'rtl' = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
