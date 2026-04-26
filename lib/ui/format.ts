/**
 * Korean number formatting helpers.
 * Uses 만 (10k) and 억 (100M) units instead of k/M.
 */

/**
 * Short Korean number format (for chart axis labels, chips, badges).
 * Examples:
 *   0 → '0'
 *   500 → '500'
 *   1,000 → '1,000'
 *   10,000 → '1만'
 *   12,100 → '1.2만'
 *   100,000 → '10만'
 *   1,000,000 → '100만'
 *   10,000,000 → '1,000만'
 *   100,000,000 → '1억'
 *   245,000,000 → '2.5억'
 *   1,173,000,000 → '11.7억'
 */
export function fmtKRWShort(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 100_000_000) {
    const eok = abs / 100_000_000;
    if (eok >= 100) return sign + Math.round(eok).toLocaleString('ko-KR') + '억';
    return sign + (Math.round(eok * 10) / 10).toString() + '억';
  }
  if (abs >= 10_000) {
    const man = abs / 10_000;
    if (man >= 1000) return sign + Math.round(man).toLocaleString('ko-KR') + '만';
    if (man >= 100) return sign + Math.round(man).toString() + '만';
    return sign + (Math.round(man * 10) / 10).toString() + '만';
  }
  return sign + abs.toLocaleString('ko-KR');
}

/**
 * Full Korean amount with 원 suffix (always with commas, no abbreviation).
 *   10,000 → '10,000원'
 *   1,234,567 → '1,234,567원'
 */
export function fmtFullKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}
