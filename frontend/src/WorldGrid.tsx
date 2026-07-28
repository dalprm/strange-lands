import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import type { BuildingsDto, LandDto, WarriorDto, WorldDetail } from './api/client';
import { getMoveSourceLands, moveWarriors, recruitWarriors } from './api/client';
import { buildLandToneGrid, buildProceduralLandTileSvg } from './proceduralLandTile';

/** Детерминированный 32-битный хэш — один и тот же id всегда даёт те же компоненты цвета. */
function hash32(n: number): number {
  let x = n >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

/** Фон клетки владения: HSL из id (постоянный для игрока). */
export function playerLandBackgroundFromId(playerId: number): string {
  const h = hash32(playerId) % 360;
  const s = 45 + (hash32(playerId + 0x9e3779b9) % 30); // 45–74%
  const l = 26 + (hash32(playerId + 0x85ebca6b) % 18); // 26–43%
  return `hsl(${h} ${s}% ${l}%)`;
}

const textOnTileStyle: CSSProperties = {
  textShadow: '0 1px 2px rgba(0,0,0,.92), 0 0 8px rgba(0,0,0,.55)',
};

const WARRIOR_TYPE_LABEL: Record<string, string> = {
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

const WALL_LEVEL_LABEL: Record<string, string> = {
  FORTRESS_LEVEL_1: 'крепость I',
  FORTRESS_LEVEL_2: 'крепость II',
  FORTRESS_LEVEL_3: 'крепость III',
  FORTRESS_LEVEL_4: 'крепость IV',
};

function warriorTypeLabel(type: string | undefined): string {
  if (type == null || type === '') return '—';
  return WARRIOR_TYPE_LABEL[type] ?? type.replace(/_/g, ' ');
}

function warriorRowKey(w: Pick<WarriorDto, 'type' | 'level'>): string {
  return `${w.type ?? ''}_${w.level ?? 0}`;
}

function wallLevelLabel(level: string): string {
  return WALL_LEVEL_LABEL[level] ?? level;
}

const FOG_BLOCKED_MESSAGE = 'Сюда еще идти и идти';

const RECRUIT_COUNT_STEP = 40;

/** Для текущего игрока: его земли и все соседствующие с ними (туман войны скрывает остальное на карте). */
function computeFogOfWarVisibleLandIds(
  lands: LandDto[],
  neighbors: Record<string, number[]> | undefined,
  currentPlayerId: number | null,
): Set<number> | null {
  if (currentPlayerId == null) {
    return null;
  }
  const playerLandIds: number[] = [];
  for (const land of lands) {
    if (land.player?.id === currentPlayerId) {
      playerLandIds.push(land.id);
    }
  }
  const visible = new Set<number>(playerLandIds);
  const neigh = neighbors ?? {};
  for (const id of playerLandIds) {
    const raw = neigh[String(id)];
    if (!Array.isArray(raw)) continue;
    for (const n of raw) {
      const nid = typeof n === 'number' ? n : Number(n);
      if (!Number.isNaN(nid)) {
        visible.add(nid);
      }
    }
  }
  return visible;
}

/** Оверлей тумана войны на клетке (уникальные id фильтров на каждый тайл). */
function FogOfWarOverlay({ worldId, landId }: { worldId: number; landId: number }) {
  const uid = `fogW${worldId}L${landId}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      aria-hidden
      style={{ display: 'block' }}
    >
      <defs>
        <filter id={`${uid}-noise`} x="0%" y="0%" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" result="noise" />
          <feColorMatrix in="noise" type="saturate" values="0" result="grayNoise" />
          <feComponentTransfer in="grayNoise" result="softNoise">
            <feFuncA type="linear" slope={0.3} />
          </feComponentTransfer>
        </filter>
        <radialGradient id={`${uid}-grad`} cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="rgb(20, 20, 30)" stopOpacity={0.4} />
          <stop offset="100%" stopColor="rgb(0, 0, 0)" stopOpacity={0.85} />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" fill={`url(#${uid}-grad)`} />
      <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.5)" filter={`url(#${uid}-noise)`} />
      <text
        x="50"
        y="55"
        fontFamily="monospace"
        fontSize="22"
        fill="rgba(255,255,240,0.5)"
        textAnchor="middle"
        dominantBaseline="middle"
        fontWeight="bold"
      >
        ?
      </text>
    </svg>
  );
}

/** Подпись владельца для UI; null, если земля без игрока. */
function landOwnerLabel(land: LandDto): string | null {
  const p = land.player;
  if (p == null) return null;
  const n = p.name?.trim();
  return n ? n : `Игрок #${p.id}`;
}

/** Замок на земле — по флагам API или по списку построек. */
function landHasCastle(b: BuildingsDto | null | undefined): boolean {
  if (b == null) return false;
  return (
    b.hasCastle === true ||
    b.castle === true ||
    (Array.isArray(b.all) && b.all.some((x) => (x.name ?? '').toLowerCase() === 'castle'))
  );
}

/** Иконка замка с клетки (тот же рисунок, слегка подсвечена для читаемости на фоне тайла). */
function CastleGlyph({ size, tile }: { size: number; tile?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      style={{
        display: 'block',
        flexShrink: 0,
        ...(tile ? { filter: 'drop-shadow(0 0 2px rgba(230,237,243,0.45))' } : {}),
      }}
    >
      <rect x="35" y="45" width="30" height="40" fill="#1a1a1a" />
      <rect x="10" y="35" width="22" height="50" fill="#1a1a1a" />
      <rect x="68" y="35" width="22" height="50" fill="#1a1a1a" />
      <rect x="35" y="38" width="6" height="7" fill="#1a1a1a" />
      <rect x="47" y="38" width="6" height="7" fill="#1a1a1a" />
      <rect x="59" y="38" width="6" height="7" fill="#1a1a1a" />
      <rect x="10" y="28" width="5" height="7" fill="#1a1a1a" />
      <rect x="20" y="28" width="5" height="7" fill="#1a1a1a" />
      <rect x="75" y="28" width="5" height="7" fill="#1a1a1a" />
      <rect x="85" y="28" width="5" height="7" fill="#1a1a1a" />
      <polygon points="35,45 50,20 65,45" fill="#1a1a1a" />
      <polygon points="10,35 21,15 32,35" fill="#1a1a1a" />
      <polygon points="68,35 79,15 90,35" fill="#1a1a1a" />
      <path d="M43,85 L43,65 Q50,55 57,65 L57,85 Z" fill="#2a2a2a" />
      <rect x="18" y="50" width="6" height="12" rx="3" fill="#2a2a2a" />
      <rect x="76" y="50" width="6" height="12" rx="3" fill="#2a2a2a" />
      <line x1="50" y1="20" x2="50" y2="8" stroke="#1a1a1a" strokeWidth="2" />
      <polygon points="50,8 62,12 50,16" fill="#1a1a1a" />
    </svg>
  );
}

/** Стена на земле — по уровню стены или флагу API. */
function landHasWall(b: BuildingsDto | null | undefined): boolean {
  if (b == null) return false;
  if (b.hasWall === true) return true;
  const wl = b.wallLevel;
  return wl != null && String(wl).trim() !== '';
}

function landWallLevelDisplay(b: BuildingsDto | null | undefined): string | null {
  if (!landHasWall(b)) return null;
  const raw = b?.wallLevel;
  if (raw != null && String(raw).trim() !== '') {
    return wallLevelLabel(String(raw));
  }
  return 'стена';
}

/** Иконка стены (кладка с зубцами). */
function WallGlyph({ size, tile }: { size: number; tile?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      style={{
        display: 'block',
        flexShrink: 0,
        ...(tile ? { filter: 'drop-shadow(0 0 2px rgba(230,237,243,0.45))' } : {}),
      }}
    >
      <rect x="5" y="50" width="90" height="45" fill="#1a1a1a" />
      <rect x="5" y="43" width="8" height="7" fill="#1a1a1a" />
      <rect x="18" y="43" width="8" height="7" fill="#1a1a1a" />
      <rect x="31" y="43" width="8" height="7" fill="#1a1a1a" />
      <rect x="44" y="43" width="8" height="7" fill="#1a1a1a" />
      <rect x="57" y="43" width="8" height="7" fill="#1a1a1a" />
      <rect x="70" y="43" width="8" height="7" fill="#1a1a1a" />
      <rect x="83" y="43" width="12" height="7" fill="#1a1a1a" />
      <line x1="5" y1="60" x2="95" y2="60" stroke="#2a2a2a" strokeWidth={1.5} />
      <line x1="5" y1="70" x2="95" y2="70" stroke="#2a2a2a" strokeWidth={1.5} />
      <line x1="5" y1="80" x2="95" y2="80" stroke="#2a2a2a" strokeWidth={1.5} />
      <line x1="20" y1="50" x2="20" y2="60" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="35" y1="50" x2="35" y2="60" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="50" y1="50" x2="50" y2="60" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="65" y1="50" x2="65" y2="60" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="80" y1="50" x2="80" y2="60" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="12" y1="60" x2="12" y2="70" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="27" y1="60" x2="27" y2="70" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="42" y1="60" x2="42" y2="70" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="57" y1="60" x2="57" y2="70" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="72" y1="60" x2="72" y2="70" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="87" y1="60" x2="87" y2="70" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="20" y1="70" x2="20" y2="80" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="35" y1="70" x2="35" y2="80" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="50" y1="70" x2="50" y2="80" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="65" y1="70" x2="65" y2="80" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="80" y1="70" x2="80" y2="80" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="12" y1="80" x2="12" y2="90" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="27" y1="80" x2="27" y2="90" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="42" y1="80" x2="42" y2="90" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="57" y1="80" x2="57" y2="90" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="72" y1="80" x2="72" y2="90" stroke="#2a2a2a" strokeWidth={1} />
      <line x1="87" y1="80" x2="87" y2="90" stroke="#2a2a2a" strokeWidth={1} />
      <rect x="5" y="50" width="90" height="3" fill="#2a2a2a" opacity={0.5} />
    </svg>
  );
}

/** Число казарм на земле (по счётчику API). */
function landBarrackCount(b: BuildingsDto | null | undefined): number {
  if (b == null) return 0;
  return Math.max(0, b.barrackCount ?? 0);
}

/** Иконка казармы (рисунок с клетки). */
function BarrackGlyph({ size, tile }: { size: number; tile?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      aria-hidden
      style={{
        display: 'block',
        flexShrink: 0,
        ...(tile ? { filter: 'drop-shadow(0 0 2px rgba(230,237,243,0.45))' } : {}),
      }}
    >
      <rect x="10" y="35" width="80" height="55" fill="#1a1a1a" />
      <rect x="8" y="32" width="84" height="5" fill="#1a1a1a" />
      <rect x="20" y="15" width="10" height="20" fill="#1a1a1a" />
      <rect x="18" y="13" width="14" height="3" fill="#1a1a1a" />
      <rect x="70" y="18" width="8" height="17" fill="#1a1a1a" />
      <rect x="68" y="16" width="12" height="3" fill="#1a1a1a" />
      <rect x="18" y="48" width="14" height="18" fill="#2a2a2a" />
      <rect x="43" y="48" width="14" height="18" fill="#2a2a2a" />
      <rect x="68" y="48" width="14" height="18" fill="#2a2a2a" />
      <line x1="25" y1="48" x2="25" y2="66" stroke="#1a1a1a" strokeWidth={1.5} />
      <line x1="18" y1="57" x2="32" y2="57" stroke="#1a1a1a" strokeWidth={1.5} />
      <line x1="50" y1="48" x2="50" y2="66" stroke="#1a1a1a" strokeWidth={1.5} />
      <line x1="43" y1="57" x2="57" y2="57" stroke="#1a1a1a" strokeWidth={1.5} />
      <line x1="75" y1="48" x2="75" y2="66" stroke="#1a1a1a" strokeWidth={1.5} />
      <line x1="68" y1="57" x2="82" y2="57" stroke="#1a1a1a" strokeWidth={1.5} />
      <rect x="40" y="68" width="20" height="22" fill="#2a2a2a" />
      <circle cx="55" cy="80" r="2" fill="#555" />
      <line x1="10" y1="42" x2="90" y2="42" stroke="#2a2a2a" strokeWidth={1.5} />
      <rect x="10" y="85" width="80" height="5" fill="#2a2a2a" />
    </svg>
  );
}

/** Одна иконка казармы на клетке с числом в углу (режим «Здания»). */
function BarrackGlyphTileWithCount({ count, size }: { count: number; size: number }) {
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        lineHeight: 0,
        alignSelf: 'flex-start',
        ...textOnTileStyle,
      }}
      aria-label={`Казарм: ${count}`}
    >
      <BarrackGlyph size={size} tile />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -1,
          bottom: 1,
          minWidth: '0.85rem',
          padding: '0.06rem 0.2rem',
          fontSize: '0.55rem',
          fontWeight: 700,
          lineHeight: 1.1,
          textAlign: 'center',
          borderRadius: 5,
          background: 'rgba(22, 27, 34, 0.92)',
          border: '1px solid rgba(88, 166, 255, 0.65)',
          color: '#e6edf3',
          fontVariantNumeric: 'tabular-nums',
          boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}
      >
        {count}
      </span>
    </span>
  );
}

type MapTileViewMode = 'economy' | 'buildings';

type Props = {
  world: WorldDetail | null;
  currentPlayerId: number | null;
  loading?: boolean;
  onWorldRefresh?: () => Promise<void>;
};

type LandContextMenuState = {
  x: number;
  y: number;
  landId: number;
  kind: 'own' | 'neighbor';
};

type CaptureMoveState = { targetId: number; sourceIds: number[] };

export function WorldGrid({ world, currentPlayerId, loading, onWorldRefresh }: Props) {
  const [selectedLandId, setSelectedLandId] = useState<number | null>(null);
  const [mapViewMode, setMapViewMode] = useState<MapTileViewMode>('economy');
  const [landContextMenu, setLandContextMenu] = useState<LandContextMenuState | null>(null);
  const [fogBlockedModalOpen, setFogBlockedModalOpen] = useState(false);
  const [recruitLandId, setRecruitLandId] = useState<number | null>(null);
  const [recruitCounts, setRecruitCounts] = useState<Record<string, number>>({});
  const [recruitSubmitting, setRecruitSubmitting] = useState(false);
  const [recruitError, setRecruitError] = useState<string | null>(null);
  const [captureMove, setCaptureMove] = useState<CaptureMoveState | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureInitError, setCaptureInitError] = useState<string | null>(null);
  const [moveWarriorsModal, setMoveWarriorsModal] = useState<null | { fromId: number; toId: number }>(null);
  const [moveCounts, setMoveCounts] = useState<Record<string, number>>({});
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  const fogVisibleLandIds = useMemo(() => {
    if (world == null || !world.lands?.length || currentPlayerId == null) {
      return null;
    }
    return computeFogOfWarVisibleLandIds(world.lands, world.neighbors, currentPlayerId);
  }, [world, currentPlayerId]);

  const tileByLandId = useMemo(() => {
    if (world == null || !world.lands?.length || world.size == null) {
      return new Map<number, string>();
    }
    const r = world.size.width;
    const c = world.size.height;
    const wid = world.id;
    const tones = buildLandToneGrid(wid, r, c);
    const m = new Map<number, string>();
    world.lands.forEach((land, index) => {
      const t = tones[index] ?? 8;
      m.set(land.id, buildProceduralLandTileSvg(wid, land.id, t));
    });
    return m;
  }, [world]);

  useEffect(() => {
    setSelectedLandId(null);
    setMapViewMode('economy');
    setLandContextMenu(null);
    setFogBlockedModalOpen(false);
    setRecruitLandId(null);
    setRecruitError(null);
    setRecruitCounts({});
    setRecruitSubmitting(false);
    setCaptureMove(null);
    setCaptureLoading(false);
    setCaptureInitError(null);
    setMoveWarriorsModal(null);
    setMoveCounts({});
    setMoveSubmitting(false);
    setMoveError(null);
  }, [world?.id]);

  useEffect(() => {
    if (moveWarriorsModal == null || world == null) {
      setMoveCounts({});
      setMoveError(null);
      return;
    }
    const land = world.lands?.find((l) => l.id === moveWarriorsModal.fromId);
    const next: Record<string, number> = {};
    for (const w of land?.warriors ?? []) {
      if ((w.count ?? 0) > 0 && w.type != null && w.type !== '') {
        next[warriorRowKey(w)] = 0;
      }
    }
    setMoveCounts(next);
    setMoveError(null);
  }, [moveWarriorsModal, world]);

  useEffect(() => {
    if (recruitLandId == null || world == null || !world.lands?.length) {
      setRecruitCounts({});
      return;
    }
    const land = world.lands.find((l) => l.id === recruitLandId);
    const types = land?.accessBuildWarriorTypes ?? [];
    const next: Record<string, number> = {};
    for (const t of types) {
      next[t] = 0;
    }
    setRecruitCounts(next);
    setRecruitError(null);
  }, [recruitLandId, world]);

  useEffect(() => {
    if (recruitLandId == null || world == null || !world.lands?.length) {
      return;
    }
    if (!world.lands.some((l) => l.id === recruitLandId)) {
      setRecruitLandId(null);
      setRecruitError(null);
    }
  }, [recruitLandId, world]);

  useEffect(() => {
    if (landContextMenu == null) return;
    function onPointerDown() {
      setLandContextMenu(null);
    }
    function onScroll() {
      setLandContextMenu(null);
    }
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [landContextMenu]);

  useEffect(() => {
    const needEsc =
      selectedLandId != null ||
      landContextMenu != null ||
      fogBlockedModalOpen ||
      recruitLandId != null ||
      captureMove != null ||
      moveWarriorsModal != null;
    if (!needEsc) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (recruitSubmitting || moveSubmitting) return;
        setSelectedLandId(null);
        setLandContextMenu(null);
        setFogBlockedModalOpen(false);
        setRecruitLandId(null);
        setRecruitError(null);
        setCaptureMove(null);
        setCaptureInitError(null);
        setMoveWarriorsModal(null);
        setMoveError(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    selectedLandId,
    landContextMenu,
    fogBlockedModalOpen,
    recruitLandId,
    recruitSubmitting,
    captureMove,
    moveWarriorsModal,
    moveSubmitting,
  ]);

  function handleLandContextMenu(
    e: ReactMouseEvent,
    land: LandDto,
    isFogged: boolean,
  ) {
    if (currentPlayerId == null) {
      return;
    }
    e.preventDefault();
    setLandContextMenu(null);
    if (isFogged) {
      setFogBlockedModalOpen(true);
      return;
    }
    const ownerId = land.player?.id ?? null;
    if (ownerId === currentPlayerId) {
      setLandContextMenu({ x: e.clientX, y: e.clientY, landId: land.id, kind: 'own' });
    } else {
      setLandContextMenu({ x: e.clientX, y: e.clientY, landId: land.id, kind: 'neighbor' });
    }
  }

  function openLandInfoModal(landId: number) {
    setLandContextMenu(null);
    setSelectedLandId(landId);
  }

  function openRecruitModal(landId: number) {
    setLandContextMenu(null);
    setRecruitLandId(landId);
    setRecruitError(null);
  }

  async function startCaptureFromContext(targetLandId: number) {
    if (world == null) return;
    setLandContextMenu(null);
    setCaptureInitError(null);
    setCaptureLoading(true);
    try {
      const sources = await getMoveSourceLands(world.id, targetLandId);
      const sourceIds = sources.map((s) => s.id).filter((id): id is number => id != null);
      if (sourceIds.length === 0) {
        setCaptureMove(null);
        setCaptureInitError('Нет ваших соседних земель с войсками для этого перемещения.');
        return;
      }
      setCaptureMove({ targetId: targetLandId, sourceIds });
    } catch (e) {
      setCaptureMove(null);
      setCaptureInitError(e instanceof Error ? e.message : String(e));
    } finally {
      setCaptureLoading(false);
    }
  }

  function handleLandTileClick(land: LandDto, isFogged: boolean) {
    if (captureMove != null && !isFogged) {
      if (captureMove.sourceIds.includes(land.id)) {
        setMoveWarriorsModal({ fromId: land.id, toId: captureMove.targetId });
        setMoveError(null);
        return;
      }
      setCaptureMove(null);
      setCaptureInitError(null);
    }
  }

  async function confirmRecruit() {
    if (world == null || recruitLandId == null || onWorldRefresh == null) return;
    const entries = Object.entries(recruitCounts).filter(([, c]) => c > 0);
    if (entries.length === 0) {
      setRecruitError('Укажите количество хотя бы для одного типа.');
      return;
    }
    setRecruitSubmitting(true);
    setRecruitError(null);
    try {
      for (const [warriorType, count] of entries) {
        await recruitWarriors(world.id, recruitLandId, warriorType, count);
      }
      await onWorldRefresh();
      setRecruitLandId(null);
    } catch (e) {
      setRecruitError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecruitSubmitting(false);
    }
  }

  async function confirmMoveWarriors() {
    if (world == null || moveWarriorsModal == null || onWorldRefresh == null) return;
    const fromLand = world.lands?.find((l) => l.id === moveWarriorsModal.fromId);
    if (fromLand == null) return;
    const payload: { type: string; count: number; level: number }[] = [];
    for (const w of fromLand.warriors ?? []) {
      if ((w.count ?? 0) <= 0 || w.type == null || w.type === '') continue;
      const key = warriorRowKey(w);
      const want = moveCounts[key] ?? 0;
      const max = w.count ?? 0;
      if (want > max) {
        setMoveError(`Слишком много для ${warriorTypeLabel(w.type)}: максимум ${max}.`);
        return;
      }
      if (want > 0) {
        payload.push({ type: w.type, count: want, level: w.level ?? 0 });
      }
    }
    if (payload.length === 0) {
      setMoveError('Укажите количество хотя бы для одного типа войск.');
      return;
    }
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      await moveWarriors(world.id, moveWarriorsModal.fromId, moveWarriorsModal.toId, payload);
      await onWorldRefresh();
      setMoveWarriorsModal(null);
      setCaptureMove(null);
      setMoveCounts({});
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : String(e));
    } finally {
      setMoveSubmitting(false);
    }
  }

  const recruitLand =
    recruitLandId != null && world != null
      ? world.lands?.find((l) => l.id === recruitLandId) ?? null
      : null;
  const recruitTypes = recruitLand?.accessBuildWarriorTypes ?? [];

  const moveFromLand =
    moveWarriorsModal != null && world != null
      ? world.lands?.find((l) => l.id === moveWarriorsModal.fromId) ?? null
      : null;
  const moveWarriorsList =
    moveFromLand?.warriors?.filter((w) => (w.count ?? 0) > 0 && w.type != null && w.type !== '') ?? [];

  const contextMenuItemStyle: CSSProperties = {
    display: 'block',
    width: '100%',
    margin: 0,
    padding: '0.45rem 0.75rem',
    border: 'none',
    borderRadius: 4,
    background: 'transparent',
    color: '#e6edf3',
    font: 'inherit',
    fontSize: '0.84rem',
    textAlign: 'left',
    cursor: 'pointer',
  };

  if (loading && !world) {
    return <p style={{ marginTop: '1rem', opacity: 0.75 }}>Загрузка карты…</p>;
  }
  if (!world?.lands?.length || world.size == null) {
    return null;
  }

  const rows = world.size.width;
  const cols = world.size.height;
  const expected = rows * cols;
  const lands = world.lands;
  const countOk = lands.length === expected;

  const legendPlayers = collectPlayersForLegend(lands);

  const selectedLand =
    selectedLandId != null ? lands.find((l) => l.id === selectedLandId) ?? null : null;
  const neighborIds =
    selectedLand != null ? world.neighbors?.[String(selectedLand.id)] : undefined;
  const buildingLines = selectedLand != null ? buildingSummaryLines(selectedLand.buildings) : [];
  const selectedHasCastle =
    selectedLand != null ? landHasCastle(selectedLand.buildings) : false;
  const selectedHasWall = selectedLand != null ? landHasWall(selectedLand.buildings) : false;
  const selectedWallCaption =
    selectedLand != null ? landWallLevelDisplay(selectedLand.buildings) : null;
  const selectedBarrackCount = selectedLand?.buildings?.barrackCount ?? 0;
  const selectedHasBarrack = selectedBarrackCount > 0;
  const warriorsList = selectedLand?.warriors?.filter((w) => (w.count ?? 0) > 0) ?? [];
  const accessTypes = selectedLand?.accessBuildWarriorTypes;

  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0.75rem' }}>Карта мира</h3>
      <div
        role="group"
        aria-label="Режим отображения клеток карты"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>Просмотр:</span>
        <button
          type="button"
          aria-pressed={mapViewMode === 'economy'}
          onClick={() => setMapViewMode('economy')}
          style={{
            font: 'inherit',
            fontSize: '0.78rem',
            padding: '0.28rem 0.55rem',
            borderRadius: 6,
            border: mapViewMode === 'economy' ? '1px solid #58a6ff' : '1px solid #30363d',
            background: mapViewMode === 'economy' ? '#1f3d5c' : '#21262d',
            color: '#e6edf3',
            cursor: 'pointer',
          }}
        >
          Экономика
        </button>
        <button
          type="button"
          aria-pressed={mapViewMode === 'buildings'}
          onClick={() => setMapViewMode('buildings')}
          style={{
            font: 'inherit',
            fontSize: '0.78rem',
            padding: '0.28rem 0.55rem',
            borderRadius: 6,
            border: mapViewMode === 'buildings' ? '1px solid #58a6ff' : '1px solid #30363d',
            background: mapViewMode === 'buildings' ? '#1f3d5c' : '#21262d',
            color: '#e6edf3',
            cursor: 'pointer',
          }}
        >
          Здания
        </button>
      </div>
      {legendPlayers.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem 1rem',
            alignItems: 'center',
            marginBottom: '0.75rem',
            fontSize: '0.78rem',
          }}
        >
          <span style={{ opacity: 0.75 }}>Цвет по id игрока:</span>
          {legendPlayers.map((p) => (
            <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: '1px solid #30363d',
                  background: playerLandBackgroundFromId(p.id),
                  flexShrink: 0,
                }}
              />
              <span>
                <strong>#{p.id}</strong> {p.name ?? ''}
              </span>
            </span>
          ))}
        </div>
      )}
      {!countOk && (
        <p style={{ fontSize: '0.8rem', color: '#d29922', margin: '0 0 0.5rem' }}>
          Ожидалось клеток: {expected}, в ответе: {lands.length} — сетка по порядку списка lands.
        </p>
      )}
      {captureLoading && (
        <p style={{ fontSize: '0.82rem', opacity: 0.85, margin: '0 0 0.5rem' }}>Проверка земель для захвата…</p>
      )}
      {captureMove != null && (
        <p style={{ fontSize: '0.82rem', color: '#f0883e', margin: '0 0 0.5rem' }}>
          Захват: кликните клетку с <strong>оранжевой рамкой</strong> (источник войск). Цель — <strong>фиолетовая</strong>{' '}
          рамка. Esc — отмена режима.
        </p>
      )}
      {captureInitError != null && (
        <p style={{ fontSize: '0.82rem', color: '#ff7b72', margin: '0 0 0.5rem' }}>{captureInitError}</p>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, minmax(76px, 1fr))`,
          gap: 5,
          maxWidth: `min(${cols * 108 + (cols - 1) * 5}px, 100%)`,
        }}
      >
        {lands.map((land, index) => {
          const pid = land.player?.id ?? null;
          const isCurrentTurn = currentPlayerId != null && pid === currentPlayerId;
          const isSelected = selectedLandId === land.id;
          const svg = tileByLandId.get(land.id) ?? '';
          const isFogged = fogVisibleLandIds != null && !fogVisibleLandIds.has(land.id);
          const borderColor = isFogged
            ? '#30363d'
            : isCurrentTurn
              ? '#58a6ff'
              : pid != null
                ? playerLandBackgroundFromId(pid)
                : '#30363d';
          const borderWidth = isFogged ? 1 : pid != null || isCurrentTurn ? 2 : 1;
          const recruitTypes = land.accessBuildWarriorTypes ?? [];
          const recruitText =
            recruitTypes.length > 0 ? recruitTypes.map(warriorTypeLabel).join(', ') : 'нет типов';
          const row = Math.floor(index / cols) + 1;
          const col = (index % cols) + 1;
          const ownerLabel = landOwnerLabel(land);
          const hasCastle = landHasCastle(land.buildings);
          const hasWall = landHasWall(land.buildings);
          const barrackCount = landBarrackCount(land.buildings);
          const hasBarrack = barrackCount > 0;
          const ownerSegment = ownerLabel != null ? ` · ${ownerLabel}` : '';
          const buildingLinesForTile = buildingSummaryLines(land.buildings);
          const economyAria = `Клетка:${ownerLabel != null ? ` ${ownerLabel},` : ''} доход ${land.costs ?? '—'}, найм: ${recruitText}`;
          const buildingsAriaParts: string[] = [];
          if (ownerLabel != null) {
            buildingsAriaParts.push(`владелец: ${ownerLabel}`);
          }
          if (buildingLinesForTile.length > 0) {
            buildingsAriaParts.push(`здания: ${buildingLinesForTile.join(', ')}`);
          } else {
            buildingsAriaParts.push('зданий нет');
          }
          const buildingsAria = `Клетка: ${buildingsAriaParts.join('; ')}`;
          const ariaLand = mapViewMode === 'economy' ? economyAria : buildingsAria;
          const fullEconomyTitle = `#${land.id} · ряд ${row}, кол ${col}${ownerSegment} · доход ${land.costs ?? '—'} · найм: ${recruitText}`;
          const buildingsTitle =
            buildingLinesForTile.length > 0
              ? `#${land.id}${ownerSegment} · ${buildingLinesForTile.join(' · ')}`
              : `#${land.id}${ownerSegment} · нет построек`;
          const isCaptureSource = captureMove != null && captureMove.sourceIds.includes(land.id);
          const isCaptureTarget = captureMove != null && land.id === captureMove.targetId;
          let borderWidthUse = borderWidth;
          let borderColorUse = borderColor;
          if (captureMove != null) {
            if (isCaptureSource) {
              borderWidthUse = 3;
              borderColorUse = '#f0883e';
            } else if (isCaptureTarget) {
              borderWidthUse = 3;
              borderColorUse = '#d2a8ff';
            }
          }
          return (
            <button
              key={land.id}
              type="button"
              title={
                isFogged
                  ? 'Туман войны — правый клик'
                  : mapViewMode === 'economy'
                    ? fullEconomyTitle
                    : buildingsTitle
              }
              aria-label={
                isFogged ? 'Туман войны. Правый клик для меню.' : ariaLand
              }
              onClick={() => handleLandTileClick(land, isFogged)}
              onContextMenu={(e) => handleLandContextMenu(e, land, isFogged)}
              style={{
                position: 'relative',
                border: `${borderWidthUse}px solid ${borderColorUse}`,
                borderRadius: 6,
                minHeight: 72,
                overflow: 'hidden',
                boxSizing: 'border-box',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                font: 'inherit',
                color: 'inherit',
                textAlign: 'left',
                background: 'transparent',
                outline: isSelected ? '2px solid #a371f7' : undefined,
                outlineOffset: isSelected ? 1 : undefined,
              }}
            >
              <div
                aria-hidden
                style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 1,
                  pointerEvents: 'none',
                  ...(isFogged || pid == null
                    ? { background: 'rgba(15, 20, 26, 0.7)' }
                    : { background: playerLandBackgroundFromId(pid), opacity: 0.4, mixBlendMode: 'multiply' }),
                }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: '0.32rem 0.28rem',
                  fontSize: '0.68rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: mapViewMode === 'economy' ? 'center' : 'flex-start',
                  gap: mapViewMode === 'economy' ? '0.2rem' : '0.15rem',
                  minHeight: 72,
                  boxSizing: 'border-box',
                }}
              >
                {!isFogged &&
                  (mapViewMode === 'economy' ? (
                    <>
                      <span style={{ fontVariantNumeric: 'tabular-nums', ...textOnTileStyle }}>
                        <strong>{ownerLabel ?? '—'}</strong>
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums', ...textOnTileStyle }}>
                        <span style={{ opacity: 0.85 }}>Доход </span>
                        <strong>{land.costs != null ? land.costs : '—'}</strong>
                      </span>
                      <span
                        style={{
                          fontSize: '0.6rem',
                          lineHeight: 1.25,
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          ...textOnTileStyle,
                        }}
                      >
                        <span style={{ opacity: 0.8 }}>Найм </span>
                        {recruitText}
                      </span>
                    </>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.12rem',
                        alignSelf: 'stretch',
                        width: '100%',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.68rem',
                          lineHeight: 1.2,
                          fontVariantNumeric: 'tabular-nums',
                          ...textOnTileStyle,
                        }}
                      >
                        <strong>{ownerLabel ?? '—'}</strong>
                      </span>
                      {(hasCastle || hasBarrack) && (
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            alignItems: 'flex-start',
                            gap: '0.28rem',
                            lineHeight: 0,
                          }}
                        >
                          {hasCastle && (
                            <span style={{ lineHeight: 0, ...textOnTileStyle }}>
                              <CastleGlyph size={28} tile />
                            </span>
                          )}
                          {hasBarrack && <BarrackGlyphTileWithCount count={barrackCount} size={28} />}
                        </div>
                      )}
                      {hasWall && (
                        <span style={{ lineHeight: 0, alignSelf: 'flex-start', ...textOnTileStyle }}>
                          <WallGlyph size={28} tile />
                        </span>
                      )}
                    </div>
                  ))}
              </div>
              {isFogged && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 4,
                    pointerEvents: 'none',
                    borderRadius: 6,
                  }}
                >
                  <FogOfWarOverlay worldId={world.id} landId={land.id} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: '0.72rem', opacity: 0.65, margin: '0.5rem 0 0' }}>
        Переключатель <strong>Просмотр</strong>: «Экономика» — имя владельца (или «—»), доход и набор для найма; «Здания» — в
        первой строке имя владельца, ниже замок и казарма (одна иконка с числом в углу) в одной строке, стена при необходимости
        ниже. Номер земли и координаты — во всплывающей подсказке; подробное окно — пункт <strong>Инфо</strong> в меню (правый
        клик). Esc или фон закрывают окно. Рамка по игроку; синяя — чей ход; фиолетовый контур — открыта карточка «Инфо».
        {currentPlayerId != null
          ? ' Туман войны: при вашем ходе видны только ваши земли и примыкающие к ним; остальные клетки затемнены.'
          : ''}
        {currentPlayerId != null
          ? ' Правый клик: меню (Инфо, построить/нанять или захват).'
          : ''}
      </p>

      {landContextMenu != null && (
        <div
          role="menu"
          aria-label="Действия на земле"
          style={{
            position: 'fixed',
            left: landContextMenu.x,
            top: landContextMenu.y,
            zIndex: 1100,
            minWidth: 160,
            padding: '0.35rem',
            borderRadius: 8,
            border: '1px solid #30363d',
            background: '#21262d',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {landContextMenu.kind === 'own' ? (
            <>
              <button
                type="button"
                role="menuitem"
                style={contextMenuItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#30363d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => openLandInfoModal(landContextMenu.landId)}
              >
                Построить
              </button>
              <button
                type="button"
                role="menuitem"
                style={contextMenuItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#30363d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => openRecruitModal(landContextMenu.landId)}
              >
                Нанять
              </button>
              <button
                type="button"
                role="menuitem"
                style={contextMenuItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#30363d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => openLandInfoModal(landContextMenu.landId)}
              >
                Инфо
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitem"
                style={contextMenuItemStyle}
                disabled={captureLoading}
                onMouseEnter={(e) => {
                  if (!captureLoading) e.currentTarget.style.background = '#30363d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => void startCaptureFromContext(landContextMenu.landId)}
              >
                Захватить
              </button>
              <button
                type="button"
                role="menuitem"
                style={contextMenuItemStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#30363d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
                onClick={() => openLandInfoModal(landContextMenu.landId)}
              >
                Инфо
              </button>
            </>
          )}
        </div>
      )}

      {fogBlockedModalOpen && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            background: 'rgba(1, 4, 9, 0.62)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFogBlockedModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="fog-blocked-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 360,
              borderRadius: 10,
              border: '1px solid #30363d',
              background: '#161b22',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              padding: '1.25rem 1.35rem',
              color: '#e6edf3',
            }}
          >
            <p id="fog-blocked-title" style={{ margin: 0, fontSize: '1rem', lineHeight: 1.45 }}>
              {FOG_BLOCKED_MESSAGE}
            </p>
            <button
              type="button"
              onClick={() => setFogBlockedModalOpen(false)}
              style={{
                marginTop: '1rem',
                padding: '0.45rem 1rem',
                borderRadius: 6,
                border: '1px solid #30363d',
                background: '#21262d',
                color: '#e6edf3',
                font: 'inherit',
                cursor: 'pointer',
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      )}

      {recruitLandId != null && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'rgba(1, 4, 9, 0.62)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !recruitSubmitting) {
              setRecruitLandId(null);
              setRecruitError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="recruit-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 420,
              maxHeight: 'min(90vh, 560px)',
              overflowY: 'auto',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: '#161b22',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              padding: '1.1rem 1.2rem',
              color: '#e6edf3',
            }}
          >
            {recruitLand == null ? (
              <>
                <div id="recruit-modal-title" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Найм
                </div>
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem' }}>Земля не найдена на карте.</p>
                <button
                  type="button"
                  onClick={() => {
                    setRecruitLandId(null);
                    setRecruitError(null);
                  }}
                  style={{
                    marginTop: '1rem',
                    padding: '0.45rem 1rem',
                    borderRadius: 6,
                    border: '1px solid #30363d',
                    background: '#21262d',
                    color: '#e6edf3',
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Закрыть
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    marginBottom: '0.85rem',
                  }}
                >
                  <div id="recruit-modal-title" style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.35 }}>
                    Найм на земле #{recruitLand.id}
                  </div>
                  <button
                    type="button"
                    aria-label="Закрыть"
                    disabled={recruitSubmitting}
                    onClick={() => {
                      setRecruitLandId(null);
                      setRecruitError(null);
                    }}
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      padding: 0,
                      borderRadius: 6,
                      border: '1px solid #30363d',
                      background: '#21262d',
                      color: '#e6edf3',
                      cursor: recruitSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '1.2rem',
                      lineHeight: 1,
                      opacity: recruitSubmitting ? 0.55 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: '0 0 0.85rem', fontSize: '0.8rem', opacity: 0.8 }}>
                  Количество для каждого типа с шагом {RECRUIT_COUNT_STEP}. По кнопке «Подтвердить найм» для сервера
                  вызывается <code style={{ fontSize: '0.78rem' }}>recruitWarriors</code> отдельно по каждому типу с
                  ненулевым количеством.
                </p>
                {recruitTypes.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>
                    На этой земле нет доступных типов для найма.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {recruitTypes.map((warriorType) => (
                      <label
                        key={warriorType}
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem 1rem',
                          fontSize: '0.88rem',
                        }}
                      >
                        <span style={{ minWidth: '9rem' }}>{warriorTypeLabel(warriorType)}</span>
                        <input
                          type="number"
                          min={0}
                          step={RECRUIT_COUNT_STEP}
                          disabled={recruitSubmitting}
                          value={recruitCounts[warriorType] ?? 0}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value, 10);
                            setRecruitCounts((prev) => ({
                              ...prev,
                              [warriorType]: Number.isFinite(v) ? Math.max(0, v) : 0,
                            }));
                          }}
                          style={{
                            width: '6.5rem',
                            padding: '0.4rem 0.45rem',
                            borderRadius: 6,
                            border: '1px solid #30363d',
                            background: '#0d1117',
                            color: '#e6edf3',
                            fontSize: '0.95rem',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        />
                      </label>
                    ))}
                  </div>
                )}
                {recruitError != null && (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.84rem', color: '#ff7b72' }}>{recruitError}</p>
                )}
                {onWorldRefresh == null ? (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', opacity: 0.65 }}>
                    Обновление карты не подключено — найм недоступен.
                  </p>
                ) : (
                  recruitTypes.length > 0 && (
                    <button
                      type="button"
                      disabled={recruitSubmitting}
                      onClick={() => void confirmRecruit()}
                      style={{
                        marginTop: '1rem',
                        padding: '0.5rem 1rem',
                        borderRadius: 6,
                        border: '1px solid #238636',
                        background: recruitSubmitting ? '#21262d' : '#238636',
                        color: '#e6edf3',
                        font: 'inherit',
                        fontWeight: 600,
                        cursor: recruitSubmitting ? 'not-allowed' : 'pointer',
                        opacity: recruitSubmitting ? 0.65 : 1,
                      }}
                    >
                      {recruitSubmitting ? 'Отправка…' : 'Подтвердить найм'}
                    </button>
                  )
                )}
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', opacity: 0.6 }}>
                  Esc или фон — закрыть (если не идёт отправка).
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {moveWarriorsModal != null && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1220,
            background: 'rgba(1, 4, 9, 0.62)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !moveSubmitting) {
              setMoveWarriorsModal(null);
              setMoveError(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="move-warriors-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: 'min(90vh, 560px)',
              overflowY: 'auto',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: '#161b22',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              padding: '1.1rem 1.2rem',
              color: '#e6edf3',
            }}
          >
            {moveFromLand == null ? (
              <>
                <div id="move-warriors-title" style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Перемещение войск
                </div>
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem' }}>Исходная земля не найдена.</p>
                <button
                  type="button"
                  onClick={() => {
                    setMoveWarriorsModal(null);
                    setMoveError(null);
                  }}
                  style={{
                    marginTop: '1rem',
                    padding: '0.45rem 1rem',
                    borderRadius: 6,
                    border: '1px solid #30363d',
                    background: '#21262d',
                    color: '#e6edf3',
                    font: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  Закрыть
                </button>
              </>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    marginBottom: '0.85rem',
                  }}
                >
                  <div id="move-warriors-title" style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.35 }}>
                    Войска: земля #{moveWarriorsModal.fromId} → #{moveWarriorsModal.toId}
                  </div>
                  <button
                    type="button"
                    aria-label="Закрыть"
                    disabled={moveSubmitting}
                    onClick={() => {
                      setMoveWarriorsModal(null);
                      setMoveError(null);
                    }}
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      padding: 0,
                      borderRadius: 6,
                      border: '1px solid #30363d',
                      background: '#21262d',
                      color: '#e6edf3',
                      cursor: moveSubmitting ? 'not-allowed' : 'pointer',
                      fontSize: '1.2rem',
                      lineHeight: 1,
                      opacity: moveSubmitting ? 0.55 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
                <p style={{ margin: '0 0 0.85rem', fontSize: '0.8rem', opacity: 0.8 }}>
                  Для каждого типа: слева — сколько останется на исходной клетке, справа — сколько уйдёт на цель. Ползунок задаёт
                  объём отправки. Запрос: <code style={{ fontSize: '0.78rem' }}>moveWarriors</code>.
                </p>
                {moveWarriorsList.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.85 }}>На этой земле нет войск.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
                    {moveWarriorsList.map((w) => {
                      const key = warriorRowKey(w);
                      const max = w.count ?? 0;
                      const send = moveCounts[key] ?? 0;
                      const stay = max - send;
                      const lv = w.level != null && w.level !== 0 ? ` · ур. ${w.level}` : '';
                      return (
                        <div
                          key={key}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            width: '100%',
                          }}
                        >
                          <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                            {warriorTypeLabel(w.type)}
                            {lv !== '' && <span style={{ fontWeight: 400, opacity: 0.8 }}>{lv}</span>}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.65rem',
                              width: '100%',
                              flexWrap: 'wrap',
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.8rem',
                                fontVariantNumeric: 'tabular-nums',
                                opacity: 0.9,
                                minWidth: '7.5rem',
                                flexShrink: 0,
                              }}
                              title={`Останется на исходной земле после перемещения (сейчас на клетке: ${max})`}
                            >
                              Останется: <strong>{stay}</strong>
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={max}
                              step={1}
                              disabled={moveSubmitting}
                              value={send}
                              onChange={(e) => {
                                const v = Number.parseInt(e.target.value, 10);
                                setMoveCounts((prev) => ({
                                  ...prev,
                                  [key]: Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0,
                                }));
                              }}
                              aria-valuemin={0}
                              aria-valuemax={max}
                              aria-valuenow={send}
                              aria-label={`${warriorTypeLabel(w.type)}: переместить на другую землю`}
                              style={{
                                flex: '1 1 120px',
                                minWidth: 80,
                                height: 8,
                                accentColor: '#58a6ff',
                              }}
                            />
                            <span
                              style={{
                                fontSize: '0.8rem',
                                fontVariantNumeric: 'tabular-nums',
                                minWidth: '7rem',
                                flexShrink: 0,
                                textAlign: 'right',
                              }}
                              title="Сколько уйдёт на целевую землю"
                            >
                              Переместить: <strong>{send}</strong>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {moveError != null && (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.84rem', color: '#ff7b72' }}>{moveError}</p>
                )}
                {onWorldRefresh == null ? (
                  <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', opacity: 0.65 }}>
                    Обновление карты не подключено.
                  </p>
                ) : (
                  moveWarriorsList.length > 0 && (
                    <button
                      type="button"
                      disabled={moveSubmitting}
                      onClick={() => void confirmMoveWarriors()}
                      style={{
                        marginTop: '1rem',
                        padding: '0.5rem 1rem',
                        borderRadius: 6,
                        border: '1px solid #238636',
                        background: moveSubmitting ? '#21262d' : '#238636',
                        color: '#e6edf3',
                        font: 'inherit',
                        fontWeight: 600,
                        cursor: moveSubmitting ? 'not-allowed' : 'pointer',
                        opacity: moveSubmitting ? 0.65 : 1,
                      }}
                    >
                      {moveSubmitting ? 'Отправка…' : 'Переместить'}
                    </button>
                  )
                )}
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.72rem', opacity: 0.6 }}>
                  Esc или фон — закрыть (если не идёт отправка).
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {selectedLand != null && (
        <div
          role="presentation"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(1, 4, 9, 0.62)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedLandId(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="land-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 440,
              maxHeight: 'min(90vh, 640px)',
              overflowY: 'auto',
              borderRadius: 10,
              border: '1px solid #30363d',
              background: '#161b22',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.5)',
              padding: '1.1rem 1.2rem',
              color: '#e6edf3',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '0.75rem',
                marginBottom: '0.65rem',
              }}
            >
              <div id="land-modal-title" style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.35 }}>
                Земля #{selectedLand.id}
                {selectedLand.name ? ` · ${selectedLand.name}` : ''}
              </div>
              <button
                type="button"
                aria-label="Закрыть"
                onClick={() => setSelectedLandId(null)}
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: 6,
                  border: '1px solid #30363d',
                  background: '#21262d',
                  color: '#e6edf3',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
            {selectedHasCastle && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '0.65rem',
                  padding: '0.35rem 0',
                }}
              >
                <CastleGlyph size={52} />
                <span style={{ fontSize: '0.88rem', opacity: 0.9 }}>Замок</span>
              </div>
            )}
            {selectedHasWall && selectedWallCaption != null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '0.65rem',
                  padding: '0.35rem 0',
                }}
              >
                <WallGlyph size={52} />
                <span style={{ fontSize: '0.88rem', opacity: 0.9 }}>
                  {selectedWallCaption === 'стена' ? 'Стена' : `Стена (${selectedWallCaption})`}
                </span>
              </div>
            )}
            {selectedHasBarrack && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  marginBottom: '0.65rem',
                  padding: '0.35rem 0',
                }}
              >
                <BarrackGlyph size={52} />
                <span style={{ fontSize: '0.88rem', opacity: 0.9 }}>
                  {selectedBarrackCount > 1 ? `Казармы ×${selectedBarrackCount}` : 'Казарма'}
                </span>
              </div>
            )}
            <dl style={{ margin: 0, fontSize: '0.84rem', display: 'grid', gap: '0.5rem' }}>
              <div style={{ margin: 0 }}>
                {selectedLand.player ? (
                  <>
                    <strong style={{ color: playerLandBackgroundFromId(selectedLand.player.id) }}>
                      {selectedLand.player.name?.trim()
                        ? selectedLand.player.name
                        : `Игрок #${selectedLand.player.id}`}
                    </strong>
                    {selectedLand.player.level != null ? ` · ур. ${selectedLand.player.level}` : null}
                  </>
                ) : (
                  '—'
                )}
              </div>
              {selectedLand.costs != null && (
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                  <dt style={{ margin: 0, opacity: 0.75 }}>Доход</dt>
                  <dd style={{ margin: 0 }}>{selectedLand.costs}</dd>
                </div>
              )}
              {neighborIds != null && neighborIds.length > 0 && (
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <dt style={{ margin: 0, opacity: 0.75 }}>Соседи</dt>
                  <dd style={{ margin: 0 }}>{neighborIds.join(', ')}</dd>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <dt style={{ margin: 0, opacity: 0.75 }}>Здания</dt>
                <dd style={{ margin: 0 }}>
                  {buildingLines.length > 0 ? buildingLines.join(' · ') : 'нет построек'}
                </dd>
              </div>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                <dt style={{ margin: 0, opacity: 0.75 }}>Войска</dt>
                <dd style={{ margin: 0 }}>
                  {warriorsList.length > 0 ? warriorsList.map(formatWarriorLine).join('; ') : 'нет'}
                </dd>
              </div>
              {accessTypes != null && accessTypes.length > 0 && (
                <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
                  <dt style={{ margin: 0, opacity: 0.75 }}>Доступный набор</dt>
                  <dd style={{ margin: 0 }}>{accessTypes.map(warriorTypeLabel).join(', ')}</dd>
                </div>
              )}
            </dl>
            <p style={{ margin: '0.85rem 0 0', fontSize: '0.72rem', opacity: 0.6 }}>Нажмите Esc или фон вне окна, чтобы закрыть.</p>
          </div>
        </div>
      )}
    </div>
  );
}

type LegendPlayer = { id: number; name?: string };

function collectPlayersForLegend(lands: LandDto[]): LegendPlayer[] {
  const map = new Map<number, LegendPlayer>();
  for (const land of lands) {
    const pl = land.player;
    if (pl?.id != null && !map.has(pl.id)) {
      map.set(pl.id, { id: pl.id, name: pl.name });
    }
  }
  return [...map.values()].sort((a, b) => a.id - b.id);
}

function buildingSummaryLines(b: BuildingsDto | null | undefined): string[] {
  if (b == null) return [];
  const lines: string[] = [];
  if (landHasCastle(b)) {
    lines.push('Замок');
  }
  const barr = b.barrackCount ?? 0;
  if (barr > 0) {
    lines.push(`Казармы ×${barr}`);
  }
  const magic = b.magicCastleCount ?? 0;
  if (magic > 0) {
    lines.push(`Магический замок ×${magic}`);
  }
  const cler = b.clericCastleCount ?? 0;
  if (cler > 0) {
    lines.push(`Замок клирика ×${cler}`);
  }
  if (landHasWall(b)) {
    const cap = landWallLevelDisplay(b);
    lines.push(cap === 'стена' ? 'Стена' : `Стена (${cap})`);
  }
  return lines;
}

function formatWarriorLine(w: WarriorDto): string {
  const t = warriorTypeLabel(w.type);
  const n = w.count ?? 0;
  const lv = w.level != null ? `, ур. ${w.level}` : '';
  return `${t} ×${n}${lv}`;
}
