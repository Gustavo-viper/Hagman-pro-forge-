/**
 * Money is always handled as integer minor units (cents) plus an ISO 4217
 * currency code. Never use floats for prices. Never convert between
 * currencies: every price is configured explicitly per currency.
 */

export function formatMoney(amountMinor: number, currency: string, locale: string): string {
  if (!Number.isInteger(amountMinor)) throw new TypeError('amountMinor must be an integer');
  const digits = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    amountMinor / 10 ** digits,
  );
}

/** Monthly equivalent of a yearly price, rounded down to the minor unit. */
export function monthlyEquivalent(yearlyAmountMinor: number): number {
  return Math.floor(yearlyAmountMinor / 12);
}

/** Percentage saved when paying yearly instead of 12 monthly payments. */
export function yearlySavingsPercent(monthlyMinor: number, yearlyMinor: number): number {
  const fullYear = monthlyMinor * 12;
  if (fullYear <= 0) return 0;
  return Math.max(0, Math.round(((fullYear - yearlyMinor) / fullYear) * 100));
}
