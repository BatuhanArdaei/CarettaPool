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
  setLang: (code: LangCode) => void;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'tr',
  setLang: () => {},
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

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<LangCode>('tr');
  const [translations, setTranslations] = useState<Translations>({});

  useEffect(() => {
    const stored = (localStorage.getItem('lang') as LangCode) || 'tr';
    setLangState(stored);
    loadTranslations(stored).then(setTranslations);
  }, []);

  const setLang = useCallback((code: LangCode) => {
    setLangState(code);
    localStorage.setItem('lang', code);
    loadTranslations(code).then(setTranslations);
    // RTL support
    document.documentElement.dir = RTL_LANGS.includes(code) ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
  }, []);

  const t = useCallback((key: string): string => {
    const parts = key.split('.');
    if (parts.length === 2) {
      return translations[parts[0]]?.[parts[1]] ?? key;
    }
    return key;
  }, [translations]);

  const dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
