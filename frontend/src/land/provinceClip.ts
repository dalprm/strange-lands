/** Детерминированный clip-path «провинции» от landId. */
export function provinceClipPath(landId: number): string {
  let x = landId >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  const h = x >>> 0;

  const j = (i: number) => ((h >>> (i * 3)) & 7) - 3; // -3..4
  const p = (base: number, i: number) => Math.max(2, Math.min(98, base + j(i) * 2.2));

  const pts = [
    `${p(8, 0)}% ${p(12, 1)}%`,
    `${p(35, 2)}% ${p(4, 3)}%`,
    `${p(68, 4)}% ${p(8, 5)}%`,
    `${p(94, 6)}% ${p(22, 7)}%`,
    `${p(96, 0)}% ${p(55, 1)}%`,
    `${p(88, 2)}% ${p(88, 3)}%`,
    `${p(55, 4)}% ${p(96, 5)}%`,
    `${p(18, 6)}% ${p(90, 7)}%`,
    `${p(4, 0)}% ${p(58, 2)}%`,
  ];
  return `polygon(${pts.join(', ')})`;
}
