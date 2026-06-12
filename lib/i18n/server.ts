import type { LangCode } from './index';

type Messages = Record<string, Record<string, string>>;

export async function getMessages(lang: LangCode): Promise<Messages> {
  try {
    const mod = await import(`./locales/${lang}.json`);
    return mod.default as Messages;
  } catch {
    const fallback = await import('./locales/tr.json');
    return fallback.default as Messages;
  }
}

export function createT(messages: Messages) {
  return function t(key: string): string {
    const [ns, k] = key.split('.');
    return messages[ns]?.[k] ?? key;
  };
}
