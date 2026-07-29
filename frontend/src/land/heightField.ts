/**
 * Компактное поле высот для визуальной сетки SUB×SUB подтайлов на провинцию.
 * Детерминировано от worldId; без длинных полос A[r]+B[c].
 */
import { hash32 } from './helpers';

export const SUBTILE = 3;

export type Height = 0 | 1 | 2;

function rngForWorldTerrain(worldId: number): () => number {
  let state = hash32(worldId ^ 0x51eef00d);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function idx(r: number, c: number, cols: number): number {
  return r * cols + c;
}

function inBounds(r: number, c: number, rows: number, cols: number): boolean {
  return r >= 0 && c >= 0 && r < rows && c < cols;
}

function paintDisk(
  h: number[],
  rows: number,
  cols: number,
  cy: number,
  cx: number,
  radius: number,
  value: number,
  soft: number,
): void {
  const r2 = radius * radius;
  const soft2 = (radius + soft) * (radius + soft);
  for (let r = cy - radius - soft; r <= cy + radius + soft; r++) {
    for (let c = cx - radius - soft; c <= cx + radius + soft; c++) {
      if (!inBounds(r, c, rows, cols)) continue;
      const d = (r - cy) * (r - cy) + (c - cx) * (c - cx);
      if (d <= r2) {
        h[idx(r, c, cols)] = Math.max(h[idx(r, c, cols)]!, value);
      } else if (d <= soft2 && value > 0) {
        const cur = h[idx(r, c, cols)]!;
        if (cur < value) h[idx(r, c, cols)] = Math.max(cur, value - 1);
      }
    }
  }
}

function majoritySmooth(h: number[], rows: number, cols: number): void {
  const next = h.slice();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const counts = [0, 0, 0];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (!inBounds(rr, cc, rows, cols)) continue;
          const v = h[idx(rr, cc, cols)]! as Height;
          counts[v] = (counts[v] ?? 0) + 1;
        }
      }
      let best = h[idx(r, c, cols)]! as Height;
      let bestN = -1;
      for (let v = 0; v <= 2; v++) {
        const n = counts[v] ?? 0;
        if (n > bestN || (n === bestN && v === h[idx(r, c, cols)])) {
          bestN = n;
          best = v as Height;
        }
      }
      next[idx(r, c, cols)] = best;
    }
  }
  for (let i = 0; i < h.length; i++) h[i] = next[i]!;
}

/** Удаляет компоненты одного уровня площадью < minSize (понижает до соседа). */
function removeSmallComponents(h: number[], rows: number, cols: number, minSize: number): void {
  const seen = new Array(h.length).fill(false);
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const;

  for (let i = 0; i < h.length; i++) {
    if (seen[i]) continue;
    const level = h[i]!;
    if (level === 0) {
      seen[i] = true;
      continue;
    }
    const stack = [i];
    const comp: number[] = [];
    seen[i] = true;
    while (stack.length) {
      const cur = stack.pop()!;
      comp.push(cur);
      const r = Math.floor(cur / cols);
      const c = cur % cols;
      for (const [dr, dc] of dirs) {
        const rr = r + dr;
        const cc = c + dc;
        if (!inBounds(rr, cc, rows, cols)) continue;
        const j = idx(rr, cc, cols);
        if (seen[j] || h[j] !== level) continue;
        seen[j] = true;
        stack.push(j);
      }
    }
    if (comp.length < minSize) {
      for (const j of comp) h[j] = Math.max(0, level - 1);
    }
  }
}

/** Убирает клетки с < 2 ортогональных соседей того же уровня (тонкие перешейки). */
function removeThinCells(h: number[], rows: number, cols: number): void {
  let changed = true;
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ] as const;
  while (changed) {
    changed = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(r, c, cols);
        const level = h[i]!;
        if (level === 0) continue;
        let same = 0;
        for (const [dr, dc] of dirs) {
          const rr = r + dr;
          const cc = c + dc;
          if (!inBounds(rr, cc, rows, cols)) continue;
          if (h[idx(rr, cc, cols)] === level) same++;
        }
        if (same < 2) {
          h[i] = level - 1;
          changed = true;
        }
      }
    }
  }
}

/** |Δ| ≤ 1 по стороне. */
function enforceStep(h: number[], rows: number, cols: number): void {
  for (let pass = 0; pass < 6; pass++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = idx(r, c, cols);
        for (const [dr, dc] of [
          [0, 1],
          [1, 0],
        ] as const) {
          const rr = r + dr;
          const cc = c + dc;
          if (!inBounds(rr, cc, rows, cols)) continue;
          const j = idx(rr, cc, cols);
          const a = h[i]!;
          const b = h[j]!;
          if (Math.abs(a - b) <= 1) continue;
          if (a > b) h[i] = b + 1;
          else h[j] = a + 1;
        }
      }
    }
  }
}

/** Маска края относительно более низких соседей: N=8 E=4 S=2 W=1. */
export function edgeMaskAt(h: number[], rows: number, cols: number, r: number, c: number): number {
  const level = h[idx(r, c, cols)]!;
  let mask = 0;
  const n = inBounds(r - 1, c, rows, cols) ? h[idx(r - 1, c, cols)]! : level;
  const e = inBounds(r, c + 1, rows, cols) ? h[idx(r, c + 1, cols)]! : level;
  const s = inBounds(r + 1, c, rows, cols) ? h[idx(r + 1, c, cols)]! : level;
  const w = inBounds(r, c - 1, rows, cols) ? h[idx(r, c - 1, cols)]! : level;
  // Край к «внешнему» миру карты не рисуем — его даёт frame.
  if (inBounds(r - 1, c, rows, cols) && level > n) mask |= 8;
  if (inBounds(r, c + 1, rows, cols) && level > e) mask |= 4;
  if (inBounds(r + 1, c, rows, cols) && level > s) mask |= 2;
  if (inBounds(r, c - 1, rows, cols) && level > w) mask |= 1;
  return mask;
}

const REALLY_SUPPORTED = new Set([0, 1, 2, 3, 4, 6, 8, 9, 12]);

export function isSupportedEdgeMask(mask: number): boolean {
  return REALLY_SUPPORTED.has(mask);
}

/** Чинит неподдерживаемые маски понижением/повышением локальных клеток. */
function fixUnsupportedMasks(h: number[], rows: number, cols: number): void {
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const mask = edgeMaskAt(h, rows, cols, r, c);
        if (isSupportedEdgeMask(mask)) continue;
        const i = idx(r, c, cols);
        // Сглаживаем: понижаем до max(соседей), убирая сложный выступ.
        let maxN = 0;
        for (const [dr, dc] of [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ] as const) {
          const rr = r + dr;
          const cc = c + dc;
          if (!inBounds(rr, cc, rows, cols)) continue;
          maxN = Math.max(maxN, h[idx(rr, cc, cols)]!);
        }
        const next = Math.min(h[i]!, maxN);
        if (next !== h[i]) {
          h[i] = next;
          changed = true;
        } else if (h[i]! > 0) {
          h[i] = h[i]! - 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
    enforceStep(h, rows, cols);
  }
}

/**
 * Поле высот 0..2 размера (rows*SUB)×(cols*SUB).
 * 0 — база (трава), 1 — коричневое плато, 2 — холмы.
 */
export function buildHeightField(worldId: number, rows: number, cols: number): {
  heights: number[];
  hRows: number;
  hCols: number;
} {
  const hRows = rows * SUBTILE;
  const hCols = cols * SUBTILE;
  const h = new Array(hRows * hCols).fill(0);
  const rng = rngForWorldTerrain(worldId);

  const area = rows * cols;
  const plateauCount = Math.max(1, Math.round(area / 10) + Math.floor(rng() * 2));
  for (let p = 0; p < plateauCount; p++) {
    const cy = Math.floor(rng() * hRows);
    const cx = Math.floor(rng() * hCols);
    const radius = 2 + Math.floor(rng() * Math.min(5, Math.floor(Math.min(hRows, hCols) / 3)));
    paintDisk(h, hRows, hCols, cy, cx, radius, 1, 1);
  }

  const hillCount = Math.max(1, Math.floor(plateauCount / 2) + (rng() < 0.5 ? 1 : 0));
  for (let p = 0; p < hillCount; p++) {
    const cy = Math.floor(rng() * hRows);
    const cx = Math.floor(rng() * hCols);
    const radius = 1 + Math.floor(rng() * 3);
    // Холмы предпочитают уже приподнятое
    const base = h[idx(Math.min(hRows - 1, Math.max(0, cy)), Math.min(hCols - 1, Math.max(0, cx)), hCols)] ?? 0;
    if (base >= 1 || rng() < 0.45) {
      paintDisk(h, hRows, hCols, cy, cx, radius, 2, 1);
    }
  }

  for (let i = 0; i < 3; i++) majoritySmooth(h, hRows, hCols);
  removeSmallComponents(h, hRows, hCols, 6);
  removeThinCells(h, hRows, hCols);
  enforceStep(h, hRows, hCols);
  removeSmallComponents(h, hRows, hCols, 5);
  fixUnsupportedMasks(h, hRows, hCols);
  removeThinCells(h, hRows, hCols);
  enforceStep(h, hRows, hCols);
  fixUnsupportedMasks(h, hRows, hCols);

  return { heights: h, hRows, hCols };
}

/** Шум «лесной зоны» на базе (height 0), детерминированный. */
export function forestNoiseAt(worldId: number, r: number, c: number): number {
  return (hash32(worldId * 0x9e3779b1 + r * 73856093 + c * 19349663) % 1000) / 1000;
}
