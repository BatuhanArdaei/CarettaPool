import type { MetadataRoute } from 'next';
import { LANGUAGES } from '@/lib/i18n';
import { localePath } from '@/lib/i18n/routes';
import { SITE_URL, languagePaths, type SitePage } from '@/lib/site';

const PAGES: SitePage[] = ['home', 'products', 'create', 'gallery', 'catalogs', 'faq', 'contact'];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap((page) => {
    const languages = Object.fromEntries(
      Object.entries(languagePaths(page)).map(([code, path]) => [code, `${SITE_URL}${path}`]),
    );
    return LANGUAGES.map(({ code }) => ({
      url: `${SITE_URL}${localePath(code, page)}`,
      alternates: { languages },
    }));
  });
}
