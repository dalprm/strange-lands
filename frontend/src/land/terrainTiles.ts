/**
 * Визуальная раскладка Kenney Map Pack (CC0): автотайлы + декор.
 * Вода только во внешней рамке. Cliff только на юге возвышенности.
 */
import type { Biome } from '../proceduralLandTile';
import { hash32 } from './helpers';
import {
  SUBTILE,
  buildHeightField,
  edgeMaskAt,
  forestNoiseAt,
  isSupportedEdgeMask,
} from './heightField';

const TILE_BASE = '/maps/tiles';
const TILE_VER = '8';

function tile(name: string): string {
  return `${TILE_BASE}/${name}.png?v=${TILE_VER}`;
}

/** Рамка острова. */
export const MAP_FRAME_TILES = {
  tl: tile('frame_tl'),
  t: tile('frame_t'),
  tr: tile('frame_tr'),
  l: tile('frame_l'),
  r: tile('frame_r'),
  bl: tile('frame_bl'),
  b: tile('frame_b'),
  br: tile('frame_br'),
  water: tile('water_0'),
} as const;

export { SUBTILE };

type EdgeKey = 'fill' | 'n' | 's' | 'w' | 'e' | 'nw' | 'ne' | 'sw' | 'se';
type TerrainKit = Record<EdgeKey, string>;

const GRASS_KIT: TerrainKit = {
  fill: tile('grass_fill'),
  n: tile('grass_n'),
  s: tile('grass_s'),
  w: tile('grass_w'),
  e: tile('grass_e'),
  nw: tile('grass_nw'),
  ne: tile('grass_ne'),
  sw: tile('grass_sw'),
  se: tile('grass_se'),
};

const DIRT_KIT: TerrainKit = {
  fill: tile('dirt_fill'),
  n: tile('dirt_n'),
  s: tile('dirt_s'),
  w: tile('dirt_w'),
  e: tile('dirt_e'),
  nw: tile('dirt_nw'),
  ne: tile('dirt_ne'),
  sw: tile('dirt_sw'),
  se: tile('dirt_se'),
};

const STONE_KIT: TerrainKit = {
  fill: tile('stone_fill'),
  n: tile('stone_n'),
  s: tile('stone_s'),
  w: tile('stone_w'),
  e: tile('stone_e'),
  nw: tile('stone_nw'),
  ne: tile('stone_ne'),
  sw: tile('stone_sw'),
  se: tile('stone_se'),
};

/** Полная lookup-таблица поддерживаемых масок (N=8 E=4 S=2 W=1). */
const MASK_TO_EDGE: Record<number, EdgeKey> = {
  0: 'fill',
  8: 'n',
  4: 'e',
  2: 's',
  1: 'w',
  9: 'nw', // N|W
  12: 'ne', // N|E
  3: 'sw', // S|W — cliff-угол снизу
  6: 'se', // S|E
};

function kitForBiome(biome: Biome): TerrainKit {
  switch (biome) {
    case 'swamp':
      return DIRT_KIT;
    case 'hills':
      return STONE_KIT;
    case 'forest':
    case 'plains':
    default:
      return GRASS_KIT;
  }
}

function biomeFromHeight(height: number, forestNoise: number): Biome {
  if (height >= 2) return 'hills';
  if (height === 1) return 'swamp'; // коричневое плато
  if (forestNoise >= 0.48) return 'forest';
  return 'plains';
}

function edgeKeyFromMask(mask: number): EdgeKey {
  return MASK_TO_EDGE[mask] ?? 'fill';
}

export type TerrainCell = {
  biome: Biome;
  height: number;
  edgeMask: number;
  tileUrl: string;
  underlayUrl: string | null;
  isFill: boolean;
};

export type DecorKind = 'tree_pine' | 'tree_round' | 'tree_bushy' | 'tree_small' | 'mushroom_red' | 'mushroom_brown' | 'mountain' | 'rock';

export type DecorCell = {
  kind: DecorKind;
  url: string;
  /** индекс подтайла r*hCols+c */
  index: number;
};

const DECOR_URL: Record<DecorKind, string> = {
  tree_pine: tile('decor_tree_pine'),
  tree_round: tile('decor_tree_round'),
  tree_bushy: tile('decor_tree_bushy'),
  tree_small: tile('decor_tree_small'),
  mushroom_red: tile('decor_mushroom_red'),
  mushroom_brown: tile('decor_mushroom_brown'),
  mountain: tile('decor_mountain'),
  rock: tile('decor_rock'),
};

function variantIndex(worldId: number, cellIndex: number, salt: number, count: number): number {
  return hash32(worldId * 0x9e3779b1 + cellIndex * 0x85ebca6b + salt) % count;
}

function unitNoise(worldId: number, cellIndex: number, salt: number): number {
  return (hash32(worldId * 0x27d4eb2d + cellIndex * 0x165667b1 + salt) % 10000) / 10000;
}

/**
 * Раскладка визуальных подтайлов: длина hRows*hCols.
 * Индекс i = r * hCols + c.
 */
export function buildTerrainLayout(worldId: number, rows: number, cols: number): {
  cells: TerrainCell[];
  hRows: number;
  hCols: number;
} {
  const { heights, hRows, hCols } = buildHeightField(worldId, rows, cols);
  const cells: TerrainCell[] = [];

  for (let r = 0; r < hRows; r++) {
    for (let c = 0; c < hCols; c++) {
      const i = r * hCols + c;
      const height = heights[i] ?? 0;
      const forest = forestNoiseAt(worldId, r, c);
      const biome = biomeFromHeight(height, forest);
      const kit = kitForBiome(biome);
      const mask = edgeMaskAt(heights, hRows, hCols, r, c);
      const key = isSupportedEdgeMask(mask) ? edgeKeyFromMask(mask) : 'fill';
      const tileUrl = kit[key];

      let underlayUrl: string | null = null;
      if (mask !== 0) {
        // Под волной/cliff — fill более низкого соседа (зелень под коричневым краем).
        type Dir = { bit: number; rr: number; cc: number };
        const dirs: Dir[] = [
          { bit: 2, rr: r + 1, cc: c }, // S first — важнее для cliff
          { bit: 4, rr: r, cc: c + 1 },
          { bit: 1, rr: r, cc: c - 1 },
          { bit: 8, rr: r - 1, cc: c },
        ];
        let underH: number | null = null;
        let underR = r;
        let underC = c;
        for (const d of dirs) {
          if ((mask & d.bit) === 0) continue;
          if (d.rr < 0 || d.cc < 0 || d.rr >= hRows || d.cc >= hCols) continue;
          const nh = heights[d.rr * hCols + d.cc] ?? 0;
          if (underH == null || nh < underH) {
            underH = nh;
            underR = d.rr;
            underC = d.cc;
          }
        }
        if (underH != null) {
          const underBiome = biomeFromHeight(underH, forestNoiseAt(worldId, underR, underC));
          underlayUrl = kitForBiome(underBiome).fill;
        }
      }

      cells.push({
        biome,
        height,
        edgeMask: mask,
        tileUrl,
        underlayUrl,
        isFill: key === 'fill',
      });
    }
  }

  return { cells, hRows, hCols };
}

/**
 * Декор только на внутренних fill; плотности около референса Kenney.
 * Деревья ~12%, грибы ~2.5%, горы ~1.5% от eligible.
 */
export function buildDecorLayout(
  worldId: number,
  _rows: number,
  _cols: number,
  terrain: TerrainCell[],
  _hRows: number,
  hCols: number,
): DecorCell[] {
  const decor: DecorCell[] = [];
  const occupied = new Set<number>();

  const tooClose = (i: number, minDist: number): boolean => {
    const r = Math.floor(i / hCols);
    const c = i % hCols;
    for (const o of occupied) {
      const or = Math.floor(o / hCols);
      const oc = o % hCols;
      if (Math.abs(or - r) + Math.abs(oc - c) < minDist) return true;
    }
    return false;
  };

  const tryPlace = (i: number, kind: DecorKind, minDist: number) => {
    if (occupied.has(i) || tooClose(i, minDist)) return;
    occupied.add(i);
    decor.push({ kind, url: DECOR_URL[kind], index: i });
  };

  for (let i = 0; i < terrain.length; i++) {
    const cell = terrain[i]!;
    if (!cell.isFill) continue;

    const n = unitNoise(worldId, i, 0xdec0);
    const biome = cell.biome;

    // Горы / скалы — на холмах плотнее
    if (biome === 'hills' && n < 0.22) {
      const kind: DecorKind = unitNoise(worldId, i, 11) < 0.65 ? 'mountain' : 'rock';
      tryPlace(i, kind, 2);
      continue;
    }
    if (biome === 'plains' && n < 0.015) {
      tryPlace(i, 'rock', 4);
      continue;
    }

    // Грибы
    if ((biome === 'forest' || biome === 'swamp') && n < 0.035) {
      const kind: DecorKind = unitNoise(worldId, i, 22) < 0.55 ? 'mushroom_red' : 'mushroom_brown';
      tryPlace(i, kind, 2);
      continue;
    }

    // Деревья (~10–15% eligible: лес плотнее, равнины реже)
    const treeChance = biome === 'forest' ? 0.38 : biome === 'plains' ? 0.09 : biome === 'swamp' ? 0.03 : 0.02;
    if (unitNoise(worldId, i, 33) < treeChance) {
      const v = variantIndex(worldId, i, 44, 4);
      const kind: DecorKind =
        v === 0 ? 'tree_pine' : v === 1 ? 'tree_round' : v === 2 ? 'tree_bushy' : 'tree_small';
      tryPlace(i, kind, 2);
    }
  }

  return decor;
}

export type TerrainValidation = {
  ok: boolean;
  issues: string[];
  decorStats: { trees: number; mushrooms: number; mountains: number; eligible: number };
};

/** Проверка инвариантов раскладки (для отладки / тестов). */
export function validateTerrainLayout(
  worldId: number,
  rows: number,
  cols: number,
): TerrainValidation {
  const { cells, hRows, hCols } = buildTerrainLayout(worldId, rows, cols);
  const again = buildTerrainLayout(worldId, rows, cols);
  const issues: string[] = [];

  if (cells.length !== again.cells.length) issues.push('nondeterministic length');
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]!.tileUrl !== again.cells[i]!.tileUrl || cells[i]!.height !== again.cells[i]!.height) {
      issues.push('nondeterministic cells');
      break;
    }
  }

  const { heights } = buildHeightField(worldId, rows, cols);
  for (let r = 0; r < hRows; r++) {
    for (let c = 0; c < hCols; c++) {
      const i = r * hCols + c;
      const mask = edgeMaskAt(heights, hRows, hCols, r, c);
      if (!isSupportedEdgeMask(mask)) issues.push(`unsupported mask ${mask} at ${r},${c}`);
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ] as const) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= hRows || cc >= hCols) continue;
        const a = heights[i]!;
        const b = heights[rr * hCols + cc]!;
        if (Math.abs(a - b) > 1) issues.push(`step ${a}->${b} at ${r},${c}`);
      }
    }
  }

  const decor = buildDecorLayout(worldId, rows, cols, cells, hRows, hCols);
  let eligible = 0;
  let trees = 0;
  let mushrooms = 0;
  let mountains = 0;
  for (const cell of cells) if (cell.isFill) eligible++;
  for (const d of decor) {
    const cell = cells[d.index];
    if (cell == null || !cell.isFill) issues.push(`decor on non-fill ${d.index}`);
    if (d.kind.startsWith('tree')) trees++;
    else if (d.kind.startsWith('mushroom')) mushrooms++;
    else mountains++;
  }

  return {
    ok: issues.length === 0,
    issues,
    decorStats: { trees, mushrooms, mountains, eligible },
  };
}
