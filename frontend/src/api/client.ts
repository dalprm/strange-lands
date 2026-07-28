/** Ответы бэкенда — только поля, которые использует UI. */

export type BuildingsDto = {
  hasCastle?: boolean;
  /** если в JSON пришло иначе (старые ответы Jackson для boolean hasCastle()) */
  castle?: boolean;
  /** синтетическое поле Jackson по getAll() */
  all?: { name?: string }[];
  hasWall?: boolean;
  barrackCount?: number;
  magicCastleCount?: number;
  clericCastleCount?: number;
  wallLevel?: string | null;
  canBuildMagicCastle?: boolean;
  canBuildClericCastle?: boolean;
};

export type WarriorDto = {
  type?: string;
  count?: number;
  level?: number;
};

export type LandDto = {
  id: number;
  name?: string;
  costs?: number;
  player?: { id: number; name?: string; level?: number } | null;
  buildings?: BuildingsDto | null;
  warriors?: WarriorDto[] | null;
  /** типы, доступные для найма на этой земле */
  accessBuildWarriorTypes?: string[];
};

export type WorldDetail = {
  id: number;
  lands?: LandDto[];
  size?: { width: number; height: number };
  turn?: { currentPlayerId?: number | null };
  /** id игрока (строка в JSON) → ресурсы в мире */
  playerWorldResources?: Record<string, { gold?: number; arcaneMana?: number; druidMana?: number; clericMana?: number }>;
  /** id земли (строка в JSON) → id соседних земель */
  neighbors?: Record<string, number[]>;
};

/** Элемент списка миров (без полной карты). */
export type World = {
  id: number;
  size?: { width: number; height: number };
  lands?: unknown[];
};

export type Player = {
  id: number;
  name: string;
  level: number;
};

export type Turn = {
  turnNumber: number;
  pendingActionsCount: number;
  /** id игрока, чей сейчас ход; null, если на карте нет владельцев земель */
  currentPlayerId: number | null;
};

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text || path}`);
  }
  if (res.status === 204 || text.trim() === '') {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

export function getWorlds(): Promise<World[]> {
  return fetchJson<World[]>('/api/worlds');
}

export function getWorld(worldId: number): Promise<WorldDetail> {
  return fetchJson<WorldDetail>(`/api/worlds/${worldId}`);
}

export function createWorld(sizeX: number, sizeY: number, playerIds?: number[]): Promise<World> {
  const body: Record<string, unknown> = { sizeX, sizeY };
  if (playerIds != null && playerIds.length > 0) {
    body.playerIds = playerIds;
  }
  return fetchJson<World>('/api/worlds', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function addPlayerToWorld(worldId: number, playerId: number): Promise<void> {
  return fetchJson<void>(`/api/worlds/${worldId}/players`, {
    method: 'POST',
    body: JSON.stringify({ playerId }),
  });
}

export function getPlayers(): Promise<Player[]> {
  return fetchJson<Player[]>('/api/players');
}

export function createPlayer(name: string, level?: number): Promise<Player> {
  const body: Record<string, unknown> = { name };
  if (level != null) body.level = level;
  return fetchJson<Player>('/api/players', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getCurrentTurn(worldId: number): Promise<Turn> {
  return fetchJson<Turn>(`/api/worlds/${worldId}/turns/current`);
}

export function executeTurn(worldId: number): Promise<Turn> {
  return fetchJson<Turn>(`/api/worlds/${worldId}/turns/execute`, {
    method: 'POST',
  });
}

/** Перемещение войск с земли {@code fromLandId} (тело: toLandId, warriors). */
export function moveWarriors(
  worldId: number,
  fromLandId: number,
  toLandId: number,
  warriors: { type: string; count: number; level?: number }[],
  turns?: number,
): Promise<void> {
  const body: Record<string, unknown> = { toLandId, warriors };
  if (turns != null) {
    body.turns = turns;
  }
  return fetchJson<void>(`/api/worlds/${worldId}/lands/${fromLandId}/move`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Земли текущего игрока — соседи цели, с войсками (сервер проверяет ход). */
export function getMoveSourceLands(worldId: number, toLandId: number): Promise<LandDto[]> {
  return fetchJson<LandDto[]>(`/api/worlds/${worldId}/lands/${toLandId}/move-sources`);
}

/** Набор воинов на земле (один тип за запрос). */
export function recruitWarriors(
  worldId: number,
  landId: number,
  warriorType: string,
  count: number,
  turnCount?: number,
): Promise<void> {
  const body: Record<string, unknown> = { warriorType, count };
  if (turnCount != null) {
    body.turnCount = turnCount;
  }
  return fetchJson<void>(`/api/worlds/${worldId}/lands/${landId}/recruit`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
