import type { BuildingsDto, LandDto, WarriorDto } from '../api/client';

export const WARRIOR_TYPE_LABEL: Record<string, string> = {
  FIGHTER: 'Человек',
  ORC: 'Орк',
  ELF: 'Эльф',
  DWARF: 'Гном',
  S_ELF: 'Эльф (S)',
  HALF: 'Хоббит',
  CATAPULT: 'Катапульта',
  BALISTA: 'Баллиста',
  TARAN: 'Таран',
  HERO_FIGHTER: 'Герой-боец',
  HERO_DWARF: 'Герой-гном',
  HERO_ELF: 'Герой-эльф',
  CLERIC: 'Клирик',
  MAGIC: 'Маг',
};

const WALL_LEVEL_ORDER = [
  'FORTRESS_LEVEL_1',
  'FORTRESS_LEVEL_2',
  'FORTRESS_LEVEL_3',
  'FORTRESS_LEVEL_4',
] as const;

const WALL_LEVEL_LABEL: Record<string, string> = {
  FORTRESS_LEVEL_1: 'крепость I',
  FORTRESS_LEVEL_2: 'крепость II',
  FORTRESS_LEVEL_3: 'крепость III',
  FORTRESS_LEVEL_4: 'крепость IV',
};

export const MAX_COUNTABLE_BUILDINGS = 6;

export type BuildActionOption = {
  type: 'CASTLE' | 'BARRACK' | 'WALL' | 'MAGIC_CASTLE' | 'CLERIC_CASTLE';
  label: string;
  wallLevel?: number;
};

/** Следующий уровень стены для апгрейда, или null если стена макс. */
export function nextWallLevelIndex(b: BuildingsDto | null | undefined): number | null {
  if (b == null || !landHasWall(b)) return 0;
  const raw = String(b.wallLevel ?? '');
  const idx = WALL_LEVEL_ORDER.indexOf(raw as (typeof WALL_LEVEL_ORDER)[number]);
  if (idx < 0) return null;
  if (idx >= WALL_LEVEL_ORDER.length - 1) return null;
  return idx + 1;
}

export function landCanBuildMoreCountable(b: BuildingsDto | null | undefined): boolean {
  if (b == null) return true;
  if (typeof b.canBuildMore === 'boolean') return b.canBuildMore;
  const used =
    (b.barrackCount ?? 0) + (b.magicCastleCount ?? 0) + (b.clericCastleCount ?? 0);
  return used < MAX_COUNTABLE_BUILDINGS;
}

/** Доступные кнопки постройки с учётом лимитов BUG-001. */
export function availableBuildActions(b: BuildingsDto | null | undefined): BuildActionOption[] {
  const out: BuildActionOption[] = [];
  if (!landHasCastle(b)) {
    out.push({ type: 'CASTLE', label: 'Замок' });
  }
  if (landCanBuildMoreCountable(b)) {
    out.push({ type: 'BARRACK', label: 'Казарма' });
    out.push({ type: 'MAGIC_CASTLE', label: 'Магический замок' });
    out.push({ type: 'CLERIC_CASTLE', label: 'Замок клирика' });
  }
  const nextWall = nextWallLevelIndex(b);
  if (nextWall != null) {
    const levelKey = WALL_LEVEL_ORDER[nextWall];
    const label =
      nextWall === 0 || levelKey == null
        ? 'Стена'
        : `Стена → ${WALL_LEVEL_LABEL[levelKey] ?? levelKey}`;
    out.push({ type: 'WALL', label, wallLevel: nextWall });
  }
  return out;
}

/** Подписи типов построек (DM / логи). */
export const BUILDING_TYPE_LABEL: Record<string, string> = {
  CASTLE: 'Замок',
  BARRACK: 'Казарма',
  WALL: 'Стена',
  MAGIC_CASTLE: 'Магический замок',
  CLERIC_CASTLE: 'Замок клирика',
};

/** @deprecated используйте availableBuildActions / BUILDING_TYPE_LABEL */
export const BUILDING_TYPES = [
  { type: 'CASTLE', label: 'Замок' },
  { type: 'BARRACK', label: 'Казарма' },
  { type: 'WALL', label: 'Стена', wallLevel: 0 },
  { type: 'MAGIC_CASTLE', label: 'Магический замок' },
  { type: 'CLERIC_CASTLE', label: 'Замок клирика' },
] as const;

export function warriorTypeLabel(type: string | undefined): string {
  if (type == null || type === '') return '—';
  return WARRIOR_TYPE_LABEL[type] ?? type.replace(/_/g, ' ');
}

export function warriorRowKey(w: Pick<WarriorDto, 'type' | 'level'>): string {
  return `${w.type ?? ''}_${w.level ?? 0}`;
}

export function wallLevelLabel(level: string): string {
  return WALL_LEVEL_LABEL[level] ?? level;
}

export function landOwnerLabel(land: LandDto): string | null {
  const p = land.player;
  if (p == null) return null;
  const n = p.name?.trim();
  return n ? n : `Игрок #${p.id}`;
}

export function landHasCastle(b: BuildingsDto | null | undefined): boolean {
  if (b == null) return false;
  return (
    b.hasCastle === true ||
    b.castle === true ||
    (Array.isArray(b.all) && b.all.some((x) => (x.name ?? '').toLowerCase() === 'castle'))
  );
}

export function landHasWall(b: BuildingsDto | null | undefined): boolean {
  if (b == null) return false;
  if (b.hasWall === true) return true;
  const wl = b.wallLevel;
  return wl != null && String(wl).trim() !== '';
}

export function landWallLevelDisplay(b: BuildingsDto | null | undefined): string | null {
  if (!landHasWall(b)) return null;
  const raw = b?.wallLevel;
  if (raw != null && String(raw).trim() !== '') {
    return wallLevelLabel(String(raw));
  }
  return 'стена';
}

export function landBarrackCount(b: BuildingsDto | null | undefined): number {
  if (b == null) return 0;
  return Math.max(0, b.barrackCount ?? 0);
}

export function buildingSummaryLines(b: BuildingsDto | null | undefined): string[] {
  if (b == null) return [];
  const lines: string[] = [];
  if (landHasCastle(b)) lines.push('Замок');
  const barr = b.barrackCount ?? 0;
  if (barr > 0) lines.push(`Казармы ×${barr}`);
  const magic = b.magicCastleCount ?? 0;
  if (magic > 0) lines.push(`Магический замок ×${magic}`);
  const cler = b.clericCastleCount ?? 0;
  if (cler > 0) lines.push(`Замок клирика ×${cler}`);
  if (landHasWall(b)) {
    const cap = landWallLevelDisplay(b);
    lines.push(cap === 'стена' ? 'Стена' : `Стена (${cap})`);
  }
  return lines;
}

export function formatWarriorLine(w: WarriorDto): string {
  const t = warriorTypeLabel(w.type);
  const n = w.count ?? 0;
  const lv = w.level != null ? `, ур. ${w.level}` : '';
  return `${t} ×${n}${lv}`;
}

export function hash32(n: number): number {
  let x = n >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function playerLandBackgroundFromId(playerId: number): string {
  const h = hash32(playerId) % 360;
  const s = 45 + (hash32(playerId + 0x9e3779b9) % 30);
  const l = 26 + (hash32(playerId + 0x85ebca6b) % 18);
  return `hsl(${h} ${s}% ${l}%)`;
}

export function computeFogOfWarVisibleLandIds(
  lands: LandDto[],
  neighbors: Record<string, number[]> | undefined,
  currentPlayerId: number | null,
): Set<number> | null {
  if (currentPlayerId == null) return null;
  const playerLandIds: number[] = [];
  for (const land of lands) {
    if (land.player?.id === currentPlayerId) playerLandIds.push(land.id);
  }
  const visible = new Set<number>(playerLandIds);
  const neigh = neighbors ?? {};
  for (const id of playerLandIds) {
    const raw = neigh[String(id)];
    if (!Array.isArray(raw)) continue;
    for (const n of raw) {
      const nid = typeof n === 'number' ? n : Number(n);
      if (!Number.isNaN(nid)) visible.add(nid);
    }
  }
  return visible;
}

export type LegendPlayer = { id: number; name?: string };

export function collectPlayersForLegend(lands: LandDto[]): LegendPlayer[] {
  const map = new Map<number, LegendPlayer>();
  for (const land of lands) {
    const pl = land.player;
    if (pl?.id != null && !map.has(pl.id)) {
      map.set(pl.id, { id: pl.id, name: pl.name });
    }
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}

export const FOG_BLOCKED_MESSAGE = 'Сюда еще идти и идти';
export const RECRUIT_COUNT_STEP = 40;
