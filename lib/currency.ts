// New demo amounts are INR fixtures, not exchange-rate conversions.
export function inrOnly(text: string): string {
  return text.replace(/(?:US\$|\$|USD\s*|EUR\s*|GBP\s*|€|£)\s*\d[\d,]*(?:\.\d+)?/gi, '[enter INR amount]');
}

export function formatINRAmount(value: string): string {
  if (/(?:\$|USD|EUR|GBP|€|£)/i.test(value)) return 'INR amount needed';
  return value.replace(/(?:INR|Rs\.?)\s*/gi, '₹');
}
