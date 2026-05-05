'use client';

import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Simple translation component — renders t(translationKey) as a span.
 * Use for inline text inside server-rendered pages.
 *
 * <T k="nav.home" />
 */
export default function T({ k }: { k: string }) {
  const { t } = useLanguage();
  return <>{t(k)}</>;
}
