/** Зеркало EconomyRules (GP). Сервер — источник истины при списании. */

export const STARTING_GOLD = 30_000;

export const BUILDING_GOLD_COST: Record<string, number> = {
  CASTLE: 7_500,
  BARRACK: 15_000,
  MAGIC_CASTLE: 10_000,
  CLERIC_CASTLE: 12_000,
};

/** Индекс WallLevel.values(): 0…3 → L1…L4 */
export const WALL_GOLD_COST = [5_000, 10_000, 15_000, 20_000] as const;

export function goldCostForBuild(type: string, wallLevel?: number): number {
  if (type === 'WALL') {
    const idx = wallLevel ?? 0;
    return WALL_GOLD_COST[idx] ?? WALL_GOLD_COST[0]!;
  }
  return BUILDING_GOLD_COST[type] ?? 0;
}
