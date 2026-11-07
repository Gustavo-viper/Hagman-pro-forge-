import { formatMoney, type Locale } from '@fandom/shared';
import type { LocalizedText } from '@fandom/types';

export function localized(text: LocalizedText | undefined, locale: Locale): string {
  if (!text) return '';
  return text[locale] ?? text['pt-BR'] ?? Object.values(text)[0] ?? '';
}

export function money(amountMinor: number, currency: string, locale: Locale): string {
  return formatMoney(amountMinor, currency, locale);
}

export function formatDate(iso: string, locale: Locale, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(locale).format(n);
}
