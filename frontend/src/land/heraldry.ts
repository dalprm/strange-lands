/** До 6 империй — фиксированные цвета и гербы (оригинальные, в духе FE Banner). */

export const MAX_EMPIRE_SLOTS = 6;

export type EmpireSlot = 0 | 1 | 2 | 3 | 4 | 5;

export type EmpireHeraldry = {
  slot: EmpireSlot;
  /** Заливка щита */
  fill: string;
  /** Светлая грань / блик */
  highlight: string;
  /** Обводка золотого канта */
  stroke: string;
  /** Цвет герба на щите */
  crest: string;
  /** Контур выбранной своей земли — чуть светлее highlight градиента */
  selectionRing: string;
};

/** Стабильный порядок слотов: по возрастанию id игрока на карте. */
export function empireSlotForPlayer(
  playerId: number,
  orderedPlayerIds: readonly number[],
): EmpireSlot | null {
  const idx = orderedPlayerIds.indexOf(playerId);
  if (idx < 0 || idx >= MAX_EMPIRE_SLOTS) return null;
  return idx as EmpireSlot;
}

export function orderedEmpirePlayerIds(playerIds: Iterable<number>): number[] {
  return [...new Set(playerIds)].sort((a, b) => a - b).slice(0, MAX_EMPIRE_SLOTS);
}

const HERALDRY: EmpireHeraldry[] = [
  {
    slot: 0,
    fill: '#6b2b2b',
    highlight: '#a04848',
    selectionRing: '#d48888',
    stroke: '#e8c878',
    crest: '#f3e6c8',
  },
  {
    slot: 1,
    fill: '#2a4a6b',
    highlight: '#4a78a0',
    selectionRing: '#8eb8d8',
    stroke: '#e8c878',
    crest: '#f3e6c8',
  },
  {
    slot: 2,
    fill: '#2f5a32',
    highlight: '#4e8a52',
    selectionRing: '#8ec894',
    stroke: '#e8c878',
    crest: '#f3e6c8',
  },
  {
    slot: 3,
    fill: '#6b4a1e',
    highlight: '#a07838',
    selectionRing: '#d4b078',
    stroke: '#e8c878',
    crest: '#f3e6c8',
  },
  {
    slot: 4,
    fill: '#4a2f5a',
    highlight: '#7a5090',
    selectionRing: '#b890c8',
    stroke: '#e8c878',
    crest: '#f3e6c8',
  },
  {
    slot: 5,
    fill: '#1e4a4a',
    highlight: '#3a7878',
    selectionRing: '#78b8b8',
    stroke: '#e8c878',
    crest: '#f3e6c8',
  },
];

export function empireSelectionRing(slot: EmpireSlot): string {
  return empireHeraldry(slot).selectionRing;
}

export function empireHeraldry(slot: EmpireSlot): EmpireHeraldry {
  return HERALDRY[slot] ?? HERALDRY[0]!;
}

/** Цвет империи для подложки/легенды; fallback если слот неизвестен. */
export function empireFillForPlayer(
  playerId: number,
  orderedPlayerIds: readonly number[],
  fallback: string,
): string {
  const slot = empireSlotForPlayer(playerId, orderedPlayerIds);
  return slot == null ? fallback : empireHeraldry(slot).fill;
}
