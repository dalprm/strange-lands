/** Процедурный SVG-тайл земли (детерминированно от worldId + landId). */

function hash32(x: number): number {
  let v = x >>> 0;
  v ^= v >>> 16;
  v = Math.imul(v, 0x7feb352d);
  v ^= v >>> 15;
  v = Math.imul(v, 0x846ca68b);
  v ^= v >>> 16;
  return v >>> 0;
}

function rngForLand(worldId: number, landId: number): () => number {
  let state = hash32(hash32(worldId * 2654435761) ^ hash32(landId * 1597334677));
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randBetween(rng: () => number, a: number, b: number): number {
  return a + (b - a) * rng();
}

/** RNG только для сетки тонов мира (отделён от landId). */
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

function stepNegZeroPos(rng: () => number): number {
  const x = rng();
  if (x < 1 / 3) return -1;
  if (x < 2 / 3) return 0;
  return 1;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * «Тон» клетки: tone[r,c] = A[r] + B[c], шаги A/B ∈ {-1,0,1} → у соседей по стороне |Δtone| ≤ 1.
 * Порядок — row-major: индекс i = r * cols + c.
 */
export function buildLandToneGrid(worldId: number, rows: number, cols: number): number[] {
  const rng = rngForWorldTerrain(worldId);
  const lo = 2;
  const hi = 6;
  const A: number[] = [];
  const B: number[] = [];
  A[0] = clampInt(3 + Math.floor(rng() * 3), lo, hi);
  for (let r = 1; r < rows; r++) {
    A[r] = clampInt(A[r - 1]! + stepNegZeroPos(rng), lo, hi);
  }
  B[0] = clampInt(3 + Math.floor(rng() * 3), lo, hi);
  for (let c = 1; c < cols; c++) {
    B[c] = clampInt(B[c - 1]! + stepNegZeroPos(rng), lo, hi);
  }
  const tones: number[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tones.push(A[r]! + B[c]!);
    }
  }
  return tones;
}

function grassBlade(rng: () => number): string {
  const x0 = randBetween(rng, 8, 92);
  const tipX = x0 + randBetween(rng, -18, 18);
  const tipY = randBetween(rng, 8, 42);
  const cp1x = x0 + randBetween(rng, -12, 12);
  const cp1y = randBetween(rng, 55, 95);
  if (rng() < 0.5) {
    return `M ${x0.toFixed(1)} 100 Q ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`;
  }
  const cp2x = x0 + randBetween(rng, -20, 20);
  const cp2y = randBetween(rng, 40, 78);
  return `M ${x0.toFixed(1)} 100 C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)} ${cp2x.toFixed(1)} ${cp2y.toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}`;
}

function crackPath(rng: () => number): string {
  const startSide = Math.floor(rng() * 4);
  let x: number;
  let y: number;
  let dx: number;
  let dy: number;
  switch (startSide) {
    case 0:
      x = randBetween(rng, 10, 90);
      y = 0;
      dx = randBetween(rng, -1, 1);
      dy = 1;
      break;
    case 1:
      x = 100;
      y = randBetween(rng, 10, 90);
      dx = -1;
      dy = randBetween(rng, -0.6, 0.6);
      break;
    case 2:
      x = randBetween(rng, 10, 90);
      y = 100;
      dx = randBetween(rng, -1, 1);
      dy = -1;
      break;
    default:
      x = 0;
      y = randBetween(rng, 10, 90);
      dx = 1;
      dy = randBetween(rng, -0.6, 0.6);
  }
  const parts = [`M ${x.toFixed(1)} ${y.toFixed(1)}`];
  let px = x;
  let py = y;
  const steps = 3 + Math.floor(rng() * 5);
  const len = randBetween(rng, 18, 38);
  for (let i = 0; i < steps; i++) {
    px += dx * (len / steps) + randBetween(rng, -6, 6);
    py += dy * (len / steps) + randBetween(rng, -6, 6);
    px = Math.max(0, Math.min(100, px));
    py = Math.max(0, Math.min(100, py));
    parts.push(`L ${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return parts.join(' ');
}

function stonePath(rng: () => number, cx: number, cy: number, rBase: number): string {
  const points: string[] = [];
  const n = 6 + Math.floor(rng() * 5);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + randBetween(rng, -0.15, 0.15);
    const rv = rBase * randBetween(rng, 0.75, 1.1);
    points.push(`${(cx + Math.cos(ang) * rv).toFixed(1)},${(cy + Math.sin(ang) * rv).toFixed(1)}`);
  }
  return `M ${points.join(' L ')} Z`;
}

function brokenEdgeOverlay(rng: () => number): { d: string; shade: string } {
  const edge = Math.floor(rng() * 4);
  const deep = randBetween(rng, 8, 22);
  const spread = randBetween(rng, 35, 75);
  let d = '';
  switch (edge) {
    case 0:
      d = `M 0 0 L ${spread} 0 L 0 ${deep} Z`;
      break;
    case 1:
      d = `M 100 0 L 100 ${deep} L ${100 - spread} 0 Z`;
      break;
    case 2:
      d = `M 100 100 L ${100 - spread} 100 L 100 ${100 - deep} Z`;
      break;
    default:
      d = `M 0 100 L 0 ${100 - deep} L ${spread} 100 Z`;
  }
  const shade = `rgba(0,0,0,${randBetween(rng, 0.18, 0.38)})`;
  return { d, shade };
}

export function buildProceduralLandTileSvg(worldId: number, landId: number, terrainTone: number): string {
  const rng = rngForLand(worldId, landId);
  const uid = `w${worldId}l${landId}`.replace(/[^a-zA-Z0-9_-]/g, '_');

  /** Один шаг terrainTone ≈ 1 п.п. светлоты HSL; у соседних клеток |ΔterrainTone| ≤ 1. */
  const toneMid = 8;
  const toneLightStep = 1;
  const lightFromTone = 52 + (terrainTone - toneMid) * toneLightStep;

  const isBrown = rng() < 0.07;
  const hue = isBrown ? randBetween(rng, 28, 44) : randBetween(rng, 78, 108);
  const sat = isBrown ? randBetween(rng, 32, 46) : randBetween(rng, 36, 52);
  const lightJ = randBetween(rng, -0.4, 0.4);
  const light = Math.max(38, Math.min(68, lightFromTone + lightJ));
  const base = `hsl(${hue.toFixed(1)} ${sat.toFixed(1)}% ${light.toFixed(1)}%)`;
  const base2Light = Math.max(40, Math.min(72, light + randBetween(rng, -4, 6)));
  const base2 = `hsl(${(hue + randBetween(rng, -6, 6)).toFixed(1)} ${(sat + randBetween(rng, -8, 8)).toFixed(1)}% ${base2Light.toFixed(1)}%)`;

  const noiseFreq = randBetween(rng, 0.35, 0.95);
  const noiseOpacity = randBetween(rng, 0.1, 0.22);
  const bladeCount = 4 + Math.floor(rng() * 14);

  const hasStone = rng() < 0.36;
  const hasCrack = rng() < 0.3;
  const hasBrokenEdge = rng() < 0.22;
  const bumpCount = 1 + Math.floor(rng() * 4);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">`,
  );
  parts.push(`<defs>`);
  parts.push(
    `<linearGradient id="${uid}g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${base2}"/><stop offset="100%" stop-color="${base}"/></linearGradient>`,
  );
  parts.push(
    `<filter id="${uid}noise" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${noiseFreq.toFixed(3)}" numOctaves="2" seed="${(rng() * 999) | 0}" result="n"/><feColorMatrix type="saturate" values="0" in="n" result="mono"/><feBlend in="SourceGraphic" in2="mono" mode="multiply"/></filter>`,
  );
  parts.push(`</defs>`);
  parts.push(`<rect width="100" height="100" fill="url(#${uid}g)" />`);
  parts.push(
    `<rect width="100" height="100" fill="#000" filter="url(#${uid}noise)" opacity="${noiseOpacity.toFixed(2)}" style="mix-blend-mode: overlay;" />`,
  );

  const bladeOpacity = randBetween(rng, 0.25, 0.55);
  const bladeW = randBetween(rng, 0.35, 1.1);
  for (let i = 0; i < bladeCount; i++) {
    const gh = (hue + randBetween(rng, -12, 12)).toFixed(1);
    const gs = randBetween(rng, 40, 58);
    const gl = randBetween(rng, 44, 62);
    parts.push(
      `<path d="${grassBlade(rng)}" fill="none" stroke="hsl(${gh} ${gs}% ${gl}%)" stroke-width="${bladeW.toFixed(2)}" stroke-linecap="round" opacity="${bladeOpacity.toFixed(2)}" />`,
    );
  }

  for (let i = 0; i < bumpCount; i++) {
    const bx = randBetween(rng, 12, 88);
    const by = randBetween(rng, 12, 88);
    const rx = randBetween(rng, 4, 14);
    const ry = randBetween(rng, 3, 11);
    if (rng() < 0.55) {
      parts.push(
        `<ellipse cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="rgba(255,255,255,${randBetween(rng, 0.04, 0.12).toFixed(3)})" />`,
      );
    } else {
      parts.push(
        `<ellipse cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="rgba(0,0,0,${randBetween(rng, 0.06, 0.14).toFixed(3)})" />`,
      );
    }
  }

  if (hasStone) {
    const scx = randBetween(rng, 22, 78);
    const scy = randBetween(rng, 22, 78);
    const sr = randBetween(rng, 6, 16);
    const sHue = randBetween(rng, 0, 40);
    const sSat = randBetween(rng, 3, 14);
    const sLight = randBetween(rng, 38, 62);
    const stoneFill = `hsl(${sHue.toFixed(1)} ${sSat.toFixed(1)}% ${sLight.toFixed(1)}%)`;
    const stoneDark = `hsl(${sHue.toFixed(1)} ${sSat.toFixed(1)}% ${(sLight - 12).toFixed(1)}%)`;
    parts.push(
      `<path d="${stonePath(rng, scx, scy, sr)}" fill="${stoneFill}" stroke="${stoneDark}" stroke-width="0.6" stroke-linejoin="round" opacity="0.92" />`,
    );
    if (rng() < 0.55) {
      const lx = scx + randBetween(rng, -sr * 0.4, sr * 0.4);
      const ly = scy + randBetween(rng, -sr * 0.35, sr * 0.35);
      const lr = randBetween(rng, 2, 5);
      parts.push(
        `<ellipse cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" rx="${lr.toFixed(1)}" ry="${(lr * 0.7).toFixed(1)}" fill="hsl(${randBetween(rng, 88, 108)} 35% 35%)" opacity="0.55" />`,
      );
      if (rng() < 0.5) {
        const lx2 = scx + randBetween(rng, -sr * 0.5, sr * 0.5);
        const ly2 = scy + randBetween(rng, -sr * 0.5, sr * 0.5);
        parts.push(
          `<ellipse cx="${lx2.toFixed(1)}" cy="${ly2.toFixed(1)}" rx="${(lr * 0.6).toFixed(1)}" ry="${(lr * 0.45).toFixed(1)}" fill="hsl(95 40% 42%)" opacity="0.35" />`,
        );
      }
    }
  }

  if (hasCrack) {
    parts.push(
      `<path d="${crackPath(rng)}" fill="none" stroke="rgba(35,22,12,${randBetween(rng, 0.45, 0.75).toFixed(2)})" stroke-width="${randBetween(rng, 0.4, 0.9).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" />`,
    );
    if (rng() < 0.4) {
      parts.push(
        `<path d="${crackPath(rng)}" fill="none" stroke="rgba(20,14,8,0.35)" stroke-width="0.35" stroke-linecap="round" />`,
      );
    }
  }

  if (hasBrokenEdge) {
    const be = brokenEdgeOverlay(rng);
    parts.push(`<path d="${be.d}" fill="${be.shade}" style="mix-blend-mode: multiply;" />`);
  }

  parts.push(`</svg>`);
  return parts.join('');
}
