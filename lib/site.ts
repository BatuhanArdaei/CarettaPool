import { LANGUAGES } from '@/lib/i18n';
import { localePath, type PageKey } from '@/lib/i18n/routes';

/** Sitenin ana adresi; carettapool.com nginx'te buraya kalıcı yönlenir. */
export const SITE_URL = 'https://www.carettapool.com';

export const DEFAULT_LANG = 'tr';

export type SitePage = PageKey | 'home' | 'create';

/** Bir sayfanın tüm dillerdeki adresleri (hreflang kodu → yol). */
export function languagePaths(page: SitePage): Record<string, string> {
  const paths: Record<string, string> = {};
  for (const { code } of LANGUAGES) paths[code] = localePath(code, page);
  paths['x-default'] = localePath(DEFAULT_LANG, page);
  return paths;
}

/** Sayfanın canonical ve hreflang etiketleri. */
export function pageAlternates(lang: string, page: SitePage) {
  return { canonical: localePath(lang, page), languages: languagePaths(page) };
}
