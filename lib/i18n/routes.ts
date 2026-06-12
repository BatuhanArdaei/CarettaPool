export type PageKey = 'products' | 'contact' | 'gallery' | 'catalogs' | 'faq' | 'login';

// Maps each language's URL slug to its PageKey
export const SLUG_MAP: Record<string, Record<string, PageKey>> = {
  tr: { urunler: 'products', iletisim: 'contact', galeri: 'gallery', kataloglar: 'catalogs', sss: 'faq', login: 'login' },
  en: { products: 'products', contact: 'contact', gallery: 'gallery', catalogs: 'catalogs', faq: 'faq', login: 'login' },
  de: { produkte: 'products', kontakt: 'contact', galerie: 'gallery', kataloge: 'catalogs', faq: 'faq', login: 'login' },
  fr: { produits: 'products', contact: 'contact', galerie: 'gallery', catalogues: 'catalogs', faq: 'faq', login: 'login' },
  nl: { producten: 'products', contact: 'contact', galerij: 'gallery', catalogi: 'catalogs', faq: 'faq', login: 'login' },
  it: { prodotti: 'products', contatto: 'contact', galleria: 'gallery', cataloghi: 'catalogs', faq: 'faq', login: 'login' },
  pt: { produtos: 'products', contato: 'contact', galeria: 'gallery', catalogos: 'catalogs', faq: 'faq', login: 'login' },
  es: { productos: 'products', contacto: 'contact', galeria: 'gallery', catalogos: 'catalogs', faq: 'faq', login: 'login' },
  ro: { produse: 'products', contact: 'contact', galerie: 'gallery', cataloage: 'catalogs', faq: 'faq', login: 'login' },
  lt: { produktai: 'products', kontaktai: 'contact', galerija: 'gallery', katalogai: 'catalogs', duk: 'faq', login: 'login' },
  pl: { produkty: 'products', kontakt: 'contact', galeria: 'gallery', katalogi: 'catalogs', faq: 'faq', login: 'login' },
  no: { produkter: 'products', kontakt: 'contact', galleri: 'gallery', kataloger: 'catalogs', faq: 'faq', login: 'login' },
  da: { produkter: 'products', kontakt: 'contact', galleri: 'gallery', kataloger: 'catalogs', faq: 'faq', login: 'login' },
  el: { products: 'products', contact: 'contact', gallery: 'gallery', catalogs: 'catalogs', faq: 'faq', login: 'login' },
  ar: { products: 'products', contact: 'contact', gallery: 'gallery', catalogs: 'catalogs', faq: 'faq', login: 'login' },
};

/** Returns the localized slug for a given lang + pageKey */
export function getSlug(lang: string, page: PageKey): string {
  const map = SLUG_MAP[lang] ?? SLUG_MAP.en;
  const entry = Object.entries(map).find(([, v]) => v === page);
  return entry ? entry[0] : page;
}

/** Builds a full pathname for a given lang + page */
export function localePath(lang: string, page: PageKey | 'home' | 'create'): string {
  if (page === 'home') return `/${lang}`;
  if (page === 'create') return `/${lang}/create`;
  return `/${lang}/${getSlug(lang, page)}`;
}
