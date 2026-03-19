/**
 * Safely converts any value to a finite number.
 * Returns defaultValue if the value is not a finite number.
 */
export function safeNumber(val: any, defaultValue: number = 0): number {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return Number.isFinite(num) ? num : defaultValue;
}

/**
 * Formats a number to Brazilian currency string (R$ XX,XX).
 */
export function formatCurrency(val: any): string {
  const num = safeNumber(val);
  return 'R$ ' + num.toFixed(2).replace('.', ',');
}

/**
 * Validates that all provided values are finite numbers.
 * Throws an error if any value is invalid.
 */
export function validateNumbers(values: Record<string, any>): void {
  for (const [key, val] of Object.entries(values)) {
    if (!Number.isFinite(safeNumber(val, NaN))) {
      throw new Error(`Invalid numeric value for field: ${key}`);
    }
  }
}
