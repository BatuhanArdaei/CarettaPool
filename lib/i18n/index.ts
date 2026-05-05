export const LANGUAGES = [
  { code: 'tr', name: 'Türkçe',        country: 'tr', dir: 'ltr' },
  { code: 'en', name: 'English',       country: 'gb', dir: 'ltr' },
  { code: 'de', name: 'Deutsch',       country: 'de', dir: 'ltr' },
  { code: 'fr', name: 'Français',      country: 'fr', dir: 'ltr' },
  { code: 'nl', name: 'Nederlands',    country: 'nl', dir: 'ltr' },
  { code: 'it', name: 'Italiano',      country: 'it', dir: 'ltr' },
  { code: 'pt', name: 'Português',     country: 'pt', dir: 'ltr' },
  { code: 'es', name: 'Español',       country: 'es', dir: 'ltr' },
  { code: 'ro', name: 'Română',        country: 'ro', dir: 'ltr' },
  { code: 'lt', name: 'Lietuviškai',  country: 'lt', dir: 'ltr' },
  { code: 'pl', name: 'Polski',        country: 'pl', dir: 'ltr' },
  { code: 'no', name: 'Norsk Nynorsk', country: 'no', dir: 'ltr' },
  { code: 'da', name: 'Dansk',         country: 'dk', dir: 'ltr' },
  { code: 'el', name: 'Ελληνικά',     country: 'gr', dir: 'ltr' },
  { code: 'ar', name: 'العربية',      country: 'sa', dir: 'rtl' },
] as const;

/** Returns the flagcdn.com URL for a country code */
export function flagUrl(countryCode: string, size: 20 | 40 | 80 = 40) {
  return `https://flagcdn.com/w${size}/${countryCode}.png`;
}

export type LangCode = typeof LANGUAGES[number]['code'];

export function getLanguage(code: string) {
  return LANGUAGES.find(l => l.code === code) ?? LANGUAGES[0];
}
