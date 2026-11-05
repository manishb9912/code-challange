import type { Product } from '@catalogue/shared';

const formatters = new Map<string, Intl.NumberFormat>();

export function formatPrice({ amount, currency }: Product['price']): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    formatters.set(currency, formatter);
  }
  return formatter.format(amount);
}
