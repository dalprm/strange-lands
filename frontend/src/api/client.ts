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
  canBuildMore?: boolean;
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
  /** владелец назначен приказом на нейтраль, гарнизон ещё в пути */
  claimPending?: boolean;
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

function errorMessageFromBody(status: number, statusText: string, text: string, path: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return `${status} ${statusText}: ${path}`;
  }
  try {
    const json = JSON.parse(trimmed) as {
      message?: string;
      detail?: string;
      title?: string;
      error?: string;
    };
    const reason = json.message ?? json.detail ?? json.title;
    if (reason != null && String(reason).trim() !== '') {
      return String(reason).trim();
    }
    if (json.error != null && String(json.error).trim() !== '') {
      return `${status} ${json.error}`;
    }
  } catch {
    /* not JSON — use raw text */
  }
  return `${status} ${statusText}: ${trimmed}`;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Нет связи с сервером (${path}). Запущены ли Vite (:5173) и Spring Boot (:8080)? ${detail}`,
    );
  }
  const text = await res.text();
  if (!res.ok) {
    throw new Error(errorMessageFromBody(res.status, res.statusText, text, path));
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

/** Земли текущего игрока — соседи цели, с войсками (legacy: цель → источники). */
export function getMoveSourceLands(worldId: number, toLandId: number): Promise<LandDto[]> {
  return fetchJson<LandDto[]>(`/api/worlds/${worldId}/lands/${toLandId}/move-sources`);
}

/** Соседи земли-источника — куда можно переместить (сервер проверяет ход и владельца). */
export function getMoveTargetLands(worldId: number, fromLandId: number): Promise<LandDto[]> {
  return fetchJson<LandDto[]>(`/api/worlds/${worldId}/lands/${fromLandId}/move-targets`);
}

/** Постройка здания на земле. */
export function buildBuilding(
  worldId: number,
  landId: number,
  buildingType: string,
  wallLevel?: number,
): Promise<void> {
  const body: Record<string, unknown> = { buildingType };
  if (wallLevel != null) {
    body.wallLevel = wallLevel;
  }
  return fetchJson<void>(`/api/worlds/${worldId}/lands/${landId}/build`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Набор воинов на земле (один тип за запрос). turnCount задаёт сервер. */
export function recruitWarriors(
  worldId: number,
  landId: number,
  warriorType: string,
  count: number,
): Promise<void> {
  return fetchJson<void>(`/api/worlds/${worldId}/lands/${landId}/recruit`, {
    method: 'POST',
    body: JSON.stringify({ warriorType, count }),
  });
}

/** Атомарный batch-найм: items схлопнуты по типу. */
export function recruitWarriorsBatch(
  worldId: number,
  landId: number,
  items: { warriorType: string; count: number }[],
): Promise<void> {
  return fetchJson<void>(`/api/worlds/${worldId}/lands/${landId}/recruit-batch`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}

export type RecruitOptionsDto = {
  barrackSlotsFree: number;
  barrackSlotsCapacity: number;
  clericSlotsFree: number;
  clericSlotsCapacity: number;
  magicSlotsFree: number;
  magicSlotsCapacity: number;
  types: {
    warriorType: string;
    turnCount: number;
    slotPool: string;
    unitsPerSlot: number;
    maxUnits: number;
    /** GP за один квант заказа (пачка 40 / 1 юнит) */
    goldCost: number;
  }[];
  pending: {
    warriorType: string;
    count: number;
    turnsRemaining: number;
    slotPool: string;
  }[];
};

export function getRecruitOptions(worldId: number, landId: number): Promise<RecruitOptionsDto> {
  return fetchJson<RecruitOptionsDto>(`/api/worlds/${worldId}/lands/${landId}/recruit-options`);
}
