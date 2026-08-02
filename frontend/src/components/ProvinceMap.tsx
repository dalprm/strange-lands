import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { LandDto, RecruitOptionsDto, WorldDetail } from '../api/client';
import { getRecruitOptions, moveWarriors, recruitWarriorsBatch } from '../api/client';
import {
  empireSelectionRing,
  empireSlotForPlayer,
  orderedEmpirePlayerIds,
} from '../land/heraldry';
import {
  FOG_BLOCKED_MESSAGE,
  collectPlayersForLegend,
  computeFogOfWarVisibleLandIds,
  landBarrackCount,
  landHasCastle,
  landPotentialIncome,
  landTurnIncome,
  landHasWall,
  landOwnerLabel,
  playerLandBackgroundFromId,
  warriorRowKey,
  warriorTypeLabel,
} from '../land/helpers';
import {
  MAP_FRAME_TILES,
  SUBTILE,
  buildDecorLayout,
  buildTerrainLayout,
} from '../land/terrainTiles';
import { FogOfWarOverlay } from './icons';
import { LandHoverTooltipLayer, type LandHoverTooltipApi } from './LandHoverTooltipLayer';
import {
  BannerShield,
  ContentsShield,
  EmptyShieldOutline,
  LegendBannerShield,
  resolveShieldFocusColor,
} from './ProvinceShield';

/** banner = щит империи; contents = здания и войска внутри щита */
type MapTileViewMode = 'banner' | 'contents';

/**
 * Масштаб провинции ближе к FE: в VGA (~640×480) в окне карты было ~8–10 провинций,
 * щит занимал заметную долю клетки. На современных экранах — фиксированный px, не «впихнуть всё».
 */
const PROVINCE_TILE_PX = 120;
const MAP_FRAME_X_PX = 36;
const MAP_FRAME_TOP_PX = 36;
const MAP_FRAME_BOTTOM_PX = 44;
/** Один размер для «Империя» и «Здания и войска» — почти на всю клетку. */
const SHIELD_BANNER_PX = 108;
const SHIELD_CONTENTS_PX = 108;
const PAN_DRAG_THRESHOLD_PX = 6;

type Props = {
  world: WorldDetail | null;
  currentPlayerId: number | null;
  /** Меняется при смене хода — карта фокусируется на земле активного игрока */
  turnNumber?: number | null;
  selectedLandId: number | null;
  loading?: boolean;
  onSelectLand: (landId: number | null) => void;
  onWorldRefresh?: () => Promise<void>;
  onActionMessage?: (kind: 'recruit' | 'move' | 'fog' | 'error', detail?: string) => void;
  /** Внешний запрос открыть найм с панели */
  recruitRequestId?: number | null;
  onRecruitRequestHandled?: () => void;
  /** Инкремент — переключить режим перемещения (кнопка в TurnBar) */
  moveModeToggleRequest?: number;
  onMoveModeActiveChange?: (active: boolean) => void;
};

type LandContextMenuState = {
  x: number;
  y: number;
  landId: number;
  kind: 'own' | 'neighbor';
};

/** Источник → цели: сначала свои земли с войсками, затем соседи-цели. */
type MoveFlowState =
  | { phase: 'pick-source'; sourceIds: number[] }
  | { phase: 'pick-target'; fromId: number; sourceIds: number[]; targetIds: number[] };

type RecruitDraftSlot = {
  id: string;
  warriorType: string;
  count: number;
  turnCount: number;
  slotPool: string;
};

/** Сколько строк очереди без скролла в одной колонке (средняя / правая). */
const RECRUIT_QUEUE_COL_CAPACITY = 9;

let recruitDraftSeq = 0;

export function ProvinceMap({
  world,
  currentPlayerId,
  turnNumber,
  selectedLandId,
  loading,
  onSelectLand,
  onWorldRefresh,
  onActionMessage,
  recruitRequestId,
  onRecruitRequestHandled,
  moveModeToggleRequest,
  onMoveModeActiveChange,
}: Props) {
  const [mapViewMode, setMapViewMode] = useState<MapTileViewMode>('banner');
  const [landContextMenu, setLandContextMenu] = useState<LandContextMenuState | null>(null);
  const [fogBlockedModalOpen, setFogBlockedModalOpen] = useState(false);
  const [recruitLandId, setRecruitLandId] = useState<number | null>(null);
  const [recruitOptions, setRecruitOptions] = useState<RecruitOptionsDto | null>(null);
  const [recruitOptionsLoading, setRecruitOptionsLoading] = useState(false);
  const [selectedRecruitType, setSelectedRecruitType] = useState<string | null>(null);
  const [recruitDraft, setRecruitDraft] = useState<RecruitDraftSlot[]>([]);
  const [recruitSubmitting, setRecruitSubmitting] = useState(false);
  const [recruitError, setRecruitError] = useState<string | null>(null);
  const [moveFlow, setMoveFlow] = useState<MoveFlowState | null>(null);
  const [moveFlowError, setMoveFlowError] = useState<string | null>(null);
  const lastMoveToggleRequest = useRef(0);
  const [moveWarriorsModal, setMoveWarriorsModal] = useState<null | { fromId: number; toId: number }>(null);
  const [moveCounts, setMoveCounts] = useState<Record<string, number>>({});
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [mapPanning, setMapPanning] = useState(false);
  const hoverTooltipApiRef = useRef<LandHoverTooltipApi | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const mapPanSession = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const suppressContextMenuRef = useRef(false);
  const lastTurnFocusKey = useRef<string>('');

  const fogVisibleLandIds = useMemo(() => {
    if (world == null || !world.lands?.length || currentPlayerId == null) return null;
    return computeFogOfWarVisibleLandIds(world.lands, world.neighbors, currentPlayerId);
  }, [world?.lands, world?.neighbors, currentPlayerId]);

  const terrainPack = useMemo(() => {
    if (world == null || world.size == null) {
      return { cells: [], hRows: 0, hCols: 0, decor: [] as ReturnType<typeof buildDecorLayout> };
    }
    const layout = buildTerrainLayout(world.id, world.size.width, world.size.height);
    const decor = buildDecorLayout(
      world.id,
      world.size.width,
      world.size.height,
      layout.cells,
      layout.hRows,
      layout.hCols,
    );
    return { ...layout, decor };
    // Terrain seed = worldId + geometry; ownership/troops must not rebuild tiles.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable key
  }, [world?.id, world?.size?.width, world?.size?.height]);

  useEffect(() => {
    setMapViewMode('banner');
    setLandContextMenu(null);
    setFogBlockedModalOpen(false);
    setRecruitLandId(null);
    setRecruitError(null);
    setRecruitOptions(null);
    setSelectedRecruitType(null);
    setRecruitDraft([]);
    setMoveFlow(null);
    setMoveFlowError(null);
    setMoveWarriorsModal(null);
    setMoveError(null);
    hoverTooltipApiRef.current?.hide();
    setMapPan({ x: 0, y: 0 });
    setMapPanning(false);
    mapPanSession.current = null;
    suppressContextMenuRef.current = false;
    lastTurnFocusKey.current = '';
    onMoveModeActiveChange?.(false);
  }, [world?.id]);

  useEffect(() => {
    if (world?.size == null || !world.lands?.length) return;
    const focusKey = `${world.id}:${turnNumber ?? ''}:${currentPlayerId ?? 'none'}`;
    if (focusKey === lastTurnFocusKey.current) return;

    const cols = world.size.height;
    const rows = world.size.width;
    const mapW = cols * PROVINCE_TILE_PX + MAP_FRAME_X_PX * 2;
    const mapH = rows * PROVINCE_TILE_PX + MAP_FRAME_TOP_PX + MAP_FRAME_BOTTOM_PX;

    const id = window.requestAnimationFrame(() => {
      lastTurnFocusKey.current = focusKey;
      if (currentPlayerId == null) {
        centerMapPan(mapW, mapH);
        return;
      }
      const landIndex = world.lands!.findIndex((l) => l.player?.id === currentPlayerId);
      if (landIndex < 0) {
        centerMapPan(mapW, mapH);
        return;
      }
      const land = world.lands![landIndex]!;
      focusLandIndex(landIndex, cols, mapW, mapH);
      onSelectLand(land.id);
    });
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- focus on turn / world geometry
  }, [world?.id, world?.size?.width, world?.size?.height, turnNumber, currentPlayerId]);

  useEffect(() => {
    if (recruitRequestId != null) {
      setRecruitLandId(recruitRequestId);
      setRecruitError(null);
      onRecruitRequestHandled?.();
    }
  }, [recruitRequestId, onRecruitRequestHandled]);

  useEffect(() => {
    onMoveModeActiveChange?.(moveFlow != null || moveFlowError != null);
  }, [moveFlow, moveFlowError, onMoveModeActiveChange]);

  useEffect(() => {
    clearMoveFlow();
    setMoveWarriorsModal(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset move UX when turn changes
  }, [turnNumber, currentPlayerId]);

  useEffect(() => {
    if (moveModeToggleRequest == null || moveModeToggleRequest === lastMoveToggleRequest.current) return;
    lastMoveToggleRequest.current = moveModeToggleRequest;
    if (moveFlow != null || moveFlowError != null) {
      clearMoveFlow();
    } else {
      beginMoveFlow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle signal from TurnBar
  }, [moveModeToggleRequest]);

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
    if (recruitLandId == null || world == null) {
      setRecruitOptions(null);
      setSelectedRecruitType(null);
      setRecruitDraft([]);
      return;
    }
    let cancelled = false;
    setRecruitOptionsLoading(true);
    setRecruitError(null);
    setRecruitDraft([]);
    getRecruitOptions(world.id, recruitLandId)
      .then((opts) => {
        if (cancelled) return;
        setRecruitOptions(opts);
        setSelectedRecruitType((prev) => {
          if (prev != null && opts.types.some((t) => t.warriorType === prev)) return prev;
          return opts.types[0]?.warriorType ?? null;
        });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : String(e);
        setRecruitOptions(null);
        setSelectedRecruitType(null);
        setRecruitError(msg);
      })
      .finally(() => {
        if (!cancelled) setRecruitOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [recruitLandId, world?.id]);

  function closeRecruitModal() {
    setRecruitLandId(null);
    setRecruitError(null);
    setSelectedRecruitType(null);
    setRecruitDraft([]);
  }

  function draftSlotsInPool(pool: string): number {
    return recruitDraft.filter((d) => d.slotPool === pool).length;
  }

  function freeSlotsForPool(pool: string): number {
    if (recruitOptions == null) return 0;
    const base =
      pool === 'CLERIC'
        ? recruitOptions.clericSlotsFree
        : pool === 'MAGIC'
          ? recruitOptions.magicSlotsFree
          : recruitOptions.barrackSlotsFree;
    return Math.max(0, base - draftSlotsInPool(pool));
  }

  function addDraftSlot(warriorType: string) {
    const opt = recruitOptions?.types.find((t) => t.warriorType === warriorType);
    if (opt == null || recruitSubmitting) return;
    if (freeSlotsForPool(opt.slotPool) < 1) {
      setRecruitError('Недостаточно свободных слотов.');
      return;
    }
    setRecruitError(null);
    setSelectedRecruitType(warriorType);
    recruitDraftSeq += 1;
    setRecruitDraft((prev) => [
      ...prev,
      {
        id: `draft-${recruitDraftSeq}`,
        warriorType: opt.warriorType,
        count: opt.unitsPerSlot,
        turnCount: opt.turnCount,
        slotPool: opt.slotPool,
      },
    ]);
  }

  function removeDraftSlot(id: string) {
    if (recruitSubmitting) return;
    setRecruitDraft((prev) => prev.filter((d) => d.id !== id));
    setRecruitError(null);
  }

  async function confirmRecruitBatch() {
    if (world == null || recruitLandId == null || onWorldRefresh == null || recruitDraft.length === 0) return;
    const collapsed = new Map<string, number>();
    for (const d of recruitDraft) {
      collapsed.set(d.warriorType, (collapsed.get(d.warriorType) ?? 0) + d.count);
    }
    const items = [...collapsed.entries()].map(([warriorType, count]) => ({ warriorType, count }));
    setRecruitSubmitting(true);
    setRecruitError(null);
    try {
      await recruitWarriorsBatch(world.id, recruitLandId, items);
      await onWorldRefresh();
      closeRecruitModal();
      onActionMessage?.('recruit');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRecruitError(msg);
      onActionMessage?.('error', msg);
    } finally {
      setRecruitSubmitting(false);
    }
  }

  useEffect(() => {
    if (landContextMenu == null) return;
    function onPointerDown() {
      setLandContextMenu(null);
    }
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [landContextMenu]);

  useEffect(() => {
    const needEsc =
      landContextMenu != null ||
      fogBlockedModalOpen ||
      recruitLandId != null ||
      moveFlow != null ||
      moveFlowError != null ||
      moveWarriorsModal != null;
    if (!needEsc) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (recruitSubmitting || moveSubmitting) return;
      setLandContextMenu(null);
      setFogBlockedModalOpen(false);
      setRecruitLandId(null);
      setRecruitError(null);
      setSelectedRecruitType(null);
      setRecruitDraft([]);
      clearMoveFlow();
      setMoveWarriorsModal(null);
      setMoveError(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    landContextMenu,
    fogBlockedModalOpen,
    recruitLandId,
    recruitSubmitting,
    moveFlow,
    moveFlowError,
    moveWarriorsModal,
    moveSubmitting,
  ]);

  function handleLandContextMenu(e: ReactMouseEvent, land: LandDto, isFogged: boolean) {
    e.preventDefault();
    if (suppressContextMenuRef.current || mapPanSession.current?.moved) {
      suppressContextMenuRef.current = false;
      return;
    }
    if (currentPlayerId == null) return;
    setLandContextMenu(null);
    if (isFogged) {
      setFogBlockedModalOpen(true);
      onActionMessage?.('fog');
      return;
    }
    const ownerId = land.player?.id ?? null;
    if (ownerId === currentPlayerId) {
      setLandContextMenu({ x: e.clientX, y: e.clientY, landId: land.id, kind: 'own' });
    } else {
      setLandContextMenu({ x: e.clientX, y: e.clientY, landId: land.id, kind: 'neighbor' });
    }
  }

  function clampMapPan(x: number, y: number, mapW: number, mapH: number) {
    const view = mapViewportRef.current?.getBoundingClientRect();
    if (view == null || view.width < 8 || view.height < 8) return { x, y };
    const pad = 48;
    // Keep at least `pad` of the map inside the viewport.
    const loX = view.width - mapW - pad;
    const hiX = pad;
    const loY = view.height - mapH - pad;
    const hiY = pad;
    return {
      x: Math.min(hiX, Math.max(loX, x)),
      y: Math.min(hiY, Math.max(loY, y)),
    };
  }

  function centerMapPan(mapW: number, mapH: number) {
    const view = mapViewportRef.current?.getBoundingClientRect();
    if (view == null) {
      setMapPan({ x: 0, y: 0 });
      return;
    }
    setMapPan(
      clampMapPan((view.width - mapW) / 2, (view.height - mapH) / 2, mapW, mapH),
    );
  }

  /** Центрирует viewport на провинции (индекс в lands = row-major). */
  function focusLandIndex(landIndex: number, cols: number, mapW: number, mapH: number) {
    const view = mapViewportRef.current?.getBoundingClientRect();
    if (view == null) {
      setMapPan({ x: 0, y: 0 });
      return;
    }
    const pc = landIndex % cols;
    const pr = Math.floor(landIndex / cols);
    const landCenterX = MAP_FRAME_X_PX + pc * PROVINCE_TILE_PX + PROVINCE_TILE_PX / 2;
    const landCenterY = MAP_FRAME_TOP_PX + pr * PROVINCE_TILE_PX + PROVINCE_TILE_PX / 2;
    setMapPan(
      clampMapPan(view.width / 2 - landCenterX, view.height / 2 - landCenterY, mapW, mapH),
    );
  }

  function onMapViewportPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 2) return;
    e.preventDefault();
    hoverTooltipApiRef.current?.hide();
    setLandContextMenu(null);
    suppressContextMenuRef.current = false;
    mapPanSession.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: mapPan.x,
      origY: mapPan.y,
      moved: false,
    };
    setMapPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onMapViewportPointerMove(e: ReactPointerEvent<HTMLDivElement>, mapW: number, mapH: number) {
    const session = mapPanSession.current;
    if (session == null || session.pointerId !== e.pointerId) return;
    const dx = e.clientX - session.startX;
    const dy = e.clientY - session.startY;
    if (!session.moved && dx * dx + dy * dy >= PAN_DRAG_THRESHOLD_PX * PAN_DRAG_THRESHOLD_PX) {
      session.moved = true;
      suppressContextMenuRef.current = true;
    }
    if (!session.moved) return;
    setMapPan(clampMapPan(session.origX + dx, session.origY + dy, mapW, mapH));
  }

  function onMapViewportPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const session = mapPanSession.current;
    if (session == null || session.pointerId !== e.pointerId) return;
    if (session.moved) {
      suppressContextMenuRef.current = true;
      window.setTimeout(() => {
        suppressContextMenuRef.current = false;
      }, 0);
    }
    mapPanSession.current = null;
    setMapPanning(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  function clearMoveFlow() {
    setMoveFlow(null);
    setMoveFlowError(null);
  }

  function collectOwnLandsWithTroops(): number[] {
    if (world?.lands == null || currentPlayerId == null) return [];
    return world.lands
      .filter((l) => l.player?.id === currentPlayerId)
      .filter((l) => (l.warriors ?? []).some((w) => (w.count ?? 0) > 0))
      .map((l) => l.id);
  }

  function beginMoveFlow() {
    setLandContextMenu(null);
    setMoveFlowError(null);
    const sourceIds = collectOwnLandsWithTroops();
    if (sourceIds.length === 0) {
      const msg = 'Нет ваших земель с войсками для перемещения.';
      setMoveFlowError(msg);
      onActionMessage?.('error', msg);
      setMoveFlow(null);
      return;
    }
    setMoveFlow({ phase: 'pick-source', sourceIds });
  }

  function selectMoveSource(fromId: number, sourceIds: number[]) {
    if (world == null) return;
    setMoveFlowError(null);
    // Цели = соседи из снимка мира (тот же набор, что GET move-targets).
    // Сервер всё равно валидирует фактический POST move.
    const raw = world.neighbors?.[String(fromId)] ?? [];
    const targetIds = raw
      .map((n) => (typeof n === 'number' ? n : Number(n)))
      .filter((id): id is number => !Number.isNaN(id) && id !== fromId);
    if (targetIds.length === 0) {
      const msg = 'Нет соседних земель для перемещения с этой провинции.';
      setMoveFlowError(msg);
      onActionMessage?.('error', msg);
      setMoveFlow({ phase: 'pick-source', sourceIds });
      return;
    }
    setMoveFlow({ phase: 'pick-target', fromId, sourceIds, targetIds });
    onSelectLand(fromId);
  }

  function handleLandTileClick(land: LandDto, isFogged: boolean) {
    if (moveFlow != null) {
      if (isFogged) {
        onActionMessage?.('fog');
        return;
      }
      if (moveFlow.phase === 'pick-source') {
        if (moveFlow.sourceIds.includes(land.id)) {
          void selectMoveSource(land.id, moveFlow.sourceIds);
        } else {
          clearMoveFlow();
        }
        return;
      }
      // pick-target: сначала цели (в т.ч. свои земли с войсками — они же в sourceIds)
      if (land.id === moveFlow.fromId) {
        return;
      }
      if (moveFlow.targetIds.includes(land.id)) {
        setMoveWarriorsModal({ fromId: moveFlow.fromId, toId: land.id });
        setMoveError(null);
        return;
      }
      if (moveFlow.sourceIds.includes(land.id)) {
        void selectMoveSource(land.id, moveFlow.sourceIds);
        return;
      }
      clearMoveFlow();
      return;
    }
    if (isFogged) {
      onActionMessage?.('fog');
      return;
    }
    onSelectLand(land.id);
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
      if (want > 0) payload.push({ type: w.type, count: want, level: w.level ?? 0 });
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
      clearMoveFlow();
      setMoveCounts({});
      onActionMessage?.('move');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMoveError(msg);
      onActionMessage?.('error', msg);
    } finally {
      setMoveSubmitting(false);
    }
  }

  const recruitTypes = recruitOptions?.types ?? [];
  const recruitPending = recruitOptions?.pending ?? [];
  const selectedOpt = recruitTypes.find((t) => t.warriorType === selectedRecruitType) ?? null;
  const draftGoldTotal = recruitDraft.reduce((sum, d) => {
    const opt = recruitTypes.find((t) => t.warriorType === d.warriorType);
    return sum + (opt?.goldCost ?? 0);
  }, 0);
  const playerGold =
    currentPlayerId != null
      ? (world?.playerWorldResources?.[String(currentPlayerId)]?.gold ?? 0)
      : 0;
  const canConfirmRecruit =
    recruitDraft.length > 0 && !recruitSubmitting && draftGoldTotal <= playerGold;
  const displayBarrackFree =
    recruitOptions == null ? 0 : Math.max(0, recruitOptions.barrackSlotsFree - draftSlotsInPool('BARRACK'));
  const displayClericFree =
    recruitOptions == null ? 0 : Math.max(0, recruitOptions.clericSlotsFree - draftSlotsInPool('CLERIC'));
  const displayMagicFree =
    recruitOptions == null ? 0 : Math.max(0, recruitOptions.magicSlotsFree - draftSlotsInPool('MAGIC'));

  type RecruitQueueEntry =
    | {
        kind: 'server';
        key: string;
        warriorType: string;
        count: number;
        turnsRemaining: number;
      }
    | {
        kind: 'draft';
        id: string;
        warriorType: string;
        count: number;
        turnCount: number;
        goldCost: number | string;
      };

  const recruitQueueEntries: RecruitQueueEntry[] = [
    ...recruitPending.map((p, i) => ({
      kind: 'server' as const,
      key: `srv-${p.warriorType}-${i}-${p.turnsRemaining}`,
      warriorType: p.warriorType,
      count: p.count,
      turnsRemaining: p.turnsRemaining,
    })),
    ...recruitDraft.map((d) => ({
      kind: 'draft' as const,
      id: d.id,
      warriorType: d.warriorType,
      count: d.count,
      turnCount: d.turnCount,
      goldCost: recruitTypes.find((t) => t.warriorType === d.warriorType)?.goldCost ?? '?',
    })),
  ];
  const recruitQueueColMid = recruitQueueEntries.slice(0, RECRUIT_QUEUE_COL_CAPACITY);
  const recruitQueueColRight = recruitQueueEntries.slice(RECRUIT_QUEUE_COL_CAPACITY);
  const recruitQueueRightNeedsScroll = recruitQueueColRight.length > RECRUIT_QUEUE_COL_CAPACITY;

  function renderRecruitQueueRow(entry: RecruitQueueEntry) {
    if (entry.kind === 'server') {
      return (
        <div
          key={entry.key}
          className="fe-recruit-queue-row fe-recruit-queue-row-server"
          title="Уже в найме — удалить нельзя"
        >
          <span>
            {warriorTypeLabel(entry.warriorType)}
            {entry.count > 1 ? ` ×${entry.count}` : ''}
          </span>
          <span className="fe-muted">
            {entry.turnsRemaining === 1
              ? 'через 1 ход'
              : `через ${entry.turnsRemaining} хода`}
          </span>
        </div>
      );
    }
    return (
      <button
        key={entry.id}
        type="button"
        className="fe-recruit-queue-row fe-recruit-queue-row-draft"
        disabled={recruitSubmitting}
        title="Клик — убрать из черновика"
        onClick={() => removeDraftSlot(entry.id)}
      >
        <span>
          {warriorTypeLabel(entry.warriorType)}
          {entry.count > 1 ? ` ×${entry.count}` : ''}
        </span>
        <span className="fe-muted">
          {entry.turnCount === 1 ? 'через 1 ход' : `через ${entry.turnCount} хода`} · новый
          {' · '}
          {entry.goldCost} GP
        </span>
      </button>
    );
  }
  const moveFromLand =
    moveWarriorsModal != null && world != null
      ? (world.lands?.find((l) => l.id === moveWarriorsModal.fromId) ?? null)
      : null;
  const moveWarriorsList =
    moveFromLand?.warriors?.filter((w) => (w.count ?? 0) > 0 && w.type != null && w.type !== '') ?? [];

  if (loading && !world) {
    return <p className="fe-muted">Загрузка карты…</p>;
  }
  if (!world?.lands?.length || world.size == null) {
    return null;
  }

  const rows = world.size.width;
  const cols = world.size.height;
  const lands = world.lands;
  const legendPlayers = collectPlayersForLegend(lands);
  const empirePlayerIds = orderedEmpirePlayerIds(legendPlayers.map((p) => p.id));
  const playW = cols * PROVINCE_TILE_PX;
  const playH = rows * PROVINCE_TILE_PX;
  const mapPixelW = MAP_FRAME_X_PX * 2 + playW;
  const mapPixelH = MAP_FRAME_TOP_PX + MAP_FRAME_BOTTOM_PX + playH;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <span className="fe-muted">Щиты:</span>
        <button
          type="button"
          className="fe-btn"
          aria-pressed={mapViewMode === 'banner'}
          style={mapViewMode === 'banner' ? { borderColor: 'var(--fe-accent)' } : undefined}
          onClick={() => setMapViewMode('banner')}
        >
          Империя
        </button>
        <button
          type="button"
          className="fe-btn"
          aria-pressed={mapViewMode === 'contents'}
          style={mapViewMode === 'contents' ? { borderColor: 'var(--fe-accent)' } : undefined}
          onClick={() => setMapViewMode('contents')}
        >
          Здания и войска
        </button>
        {legendPlayers.map((p) => {
          const slot = empireSlotForPlayer(p.id, empirePlayerIds);
          return (
            <span
              key={p.id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
            >
              {slot != null ? (
                <LegendBannerShield slot={slot} size={18} />
              ) : (
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    border: '1px solid var(--fe-accent-dim)',
                    background: playerLandBackgroundFromId(p.id),
                  }}
                />
              )}
              #{p.id} {p.name ?? ''}
            </span>
          );
        })}
      </div>

      {moveFlow?.phase === 'pick-source' && (
        <p className="fe-muted" style={{ color: 'var(--fe-capture)', margin: 0 }}>
          Перемещение: кликните свою землю с оранжевым щитом (откуда отправить). Esc — отмена.
        </p>
      )}
      {moveFlow?.phase === 'pick-target' && (
        <p className="fe-muted" style={{ color: 'var(--fe-capture)', margin: 0 }}>
          Перемещение: фиолетовый щит — куда можно отправить; оранжевый — сменить источник. Esc —
          отмена.
        </p>
      )}
      {moveFlowError != null && (
        <p style={{ color: 'var(--fe-danger)', margin: 0, fontSize: '0.82rem' }}>{moveFlowError}</p>
      )}

      <p className="fe-muted" style={{ margin: 0, fontSize: '0.75rem' }}>
        ПКМ + перетаскивание — двигать карту · короткий ПКМ — меню провинции · ЛКМ — выбрать
      </p>

      <div
        ref={mapViewportRef}
        className="fe-map-viewport"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          padding: '0.35rem',
          background: 'var(--fe-bg-map)',
          border: '2px solid var(--fe-accent-dim)',
          borderRadius: 'var(--fe-radius)',
          cursor: mapPanning ? 'grabbing' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerDown={onMapViewportPointerDown}
        onPointerMove={(e) => onMapViewportPointerMove(e, mapPixelW, mapPixelH)}
        onPointerUp={onMapViewportPointerUp}
        onPointerCancel={onMapViewportPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div
          className="fe-map-pan-layer"
          style={{
            transform: `translate(${mapPan.x}px, ${mapPan.y}px)`,
            width: mapPixelW,
            height: mapPixelH,
            willChange: 'transform',
          }}
        >
        <div
          className="fe-map-island"
          style={{
            width: mapPixelW,
            height: mapPixelH,
            backgroundImage: `url(${MAP_FRAME_TILES.water})`,
            display: 'grid',
            gridTemplateColumns: `${MAP_FRAME_X_PX}px ${playW}px ${MAP_FRAME_X_PX}px`,
            gridTemplateRows: `${MAP_FRAME_TOP_PX}px ${playH}px ${MAP_FRAME_BOTTOM_PX}px`,
            gap: 0,
          }}
        >
          <div aria-hidden className="fe-map-frame-cell" style={{ backgroundImage: `url(${MAP_FRAME_TILES.tl})` }} />
          <div
            aria-hidden
            className="fe-map-frame-cell"
            style={{
              backgroundImage: `url(${MAP_FRAME_TILES.t})`,
              backgroundRepeat: 'repeat-x',
              backgroundSize: 'auto 100%',
            }}
          />
          <div aria-hidden className="fe-map-frame-cell" style={{ backgroundImage: `url(${MAP_FRAME_TILES.tr})` }} />

          <div
            aria-hidden
            className="fe-map-frame-cell"
            style={{
              backgroundImage: `url(${MAP_FRAME_TILES.l})`,
              backgroundRepeat: 'repeat-y',
              backgroundSize: '100% auto',
            }}
          />

          <div className="fe-map-playfield">
            <div
              aria-hidden
              className="fe-map-terrain"
              style={{
                gridTemplateColumns: `repeat(${terrainPack.hCols || cols * SUBTILE}, 1fr)`,
                gridTemplateRows: `repeat(${terrainPack.hRows || rows * SUBTILE}, 1fr)`,
              }}
            >
              {terrainPack.cells.map((cell, i) => (
                <div
                  key={`t-${i}`}
                  className="fe-map-terrain-cell"
                  style={{
                    backgroundColor: '#2ec973',
                    backgroundImage:
                      cell.underlayUrl != null
                        ? `url(${cell.tileUrl}), url(${cell.underlayUrl})`
                        : `url(${cell.tileUrl})`,
                    backgroundSize: cell.underlayUrl != null ? '100% 100%, 100% 100%' : '100% 100%',
                  }}
                />
              ))}
            </div>

            <div
              aria-hidden
              className="fe-map-decor"
              style={{
                gridTemplateColumns: `repeat(${terrainPack.hCols || cols * SUBTILE}, 1fr)`,
                gridTemplateRows: `repeat(${terrainPack.hRows || rows * SUBTILE}, 1fr)`,
              }}
            >
              {terrainPack.decor.map((d) => {
                const r = Math.floor(d.index / (terrainPack.hCols || 1));
                const c = d.index % (terrainPack.hCols || 1);
                return (
                  <div
                    key={`d-${d.index}-${d.kind}`}
                    className="fe-map-decor-item"
                    style={{
                      gridColumn: c + 1,
                      gridRow: r + 1,
                      backgroundImage: `url(${d.url})`,
                    }}
                  />
                );
              })}
            </div>

            <div
              className="fe-map-provinces"
              style={{
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
              }}
            >
              {lands.map((land, landIndex) => {
                const pid = land.player?.id ?? null;
                const isOwnLand = pid != null && currentPlayerId != null && pid === currentPlayerId;
                const isSelected = selectedLandId === land.id;
                const isFogged = fogVisibleLandIds != null && !fogVisibleLandIds.has(land.id);
                const empireSlot = pid != null ? empireSlotForPlayer(pid, empirePlayerIds) : null;
                /** Режим contents — только земли текущего игрока; видимые чужие щиты всегда «Империя». */
                const showContents = mapViewMode === 'contents' && isOwnLand;
                const isMoveSource =
                  moveFlow == null
                    ? false
                    : moveFlow.phase === 'pick-source'
                      ? moveFlow.sourceIds.includes(land.id)
                      : moveFlow.fromId === land.id;
                const isMoveTarget =
                  moveFlow?.phase === 'pick-target' && moveFlow.targetIds.includes(land.id);
                const selectedOwnRing =
                  isSelected && empireSlot != null ? empireSelectionRing(empireSlot) : null;
                const shieldFocus = resolveShieldFocusColor({
                  isCaptureSource: isMoveSource,
                  isCaptureTarget: isMoveTarget,
                  isSelected: isSelected && moveFlow == null,
                  selectedOwnRing: moveFlow == null ? selectedOwnRing : null,
                });
                /* Клетка без квадратных рамок состояний — только лёгкий край / туман */
                const borderColor = isFogged
                  ? 'rgba(40, 32, 20, 0.55)'
                  : 'rgba(201, 162, 39, 0.18)';
                const borderWidth = 1;
                const shieldSize = showContents ? SHIELD_CONTENTS_PX : SHIELD_BANNER_PX;
                const ownerLabel = landOwnerLabel(land);
                const recruitTypesLocal = land.accessBuildWarriorTypes ?? [];
                const recruitText =
                  recruitTypesLocal.length > 0 ? recruitTypesLocal.map(warriorTypeLabel).join(', ') : 'нет';
                const hasCastle = landHasCastle(land.buildings);
                const hasWall = landHasWall(land.buildings);
                const barrackCount = landBarrackCount(land.buildings);

                const pr = Math.floor(landIndex / cols);
                const pc = landIndex % cols;
                const sampleTerrain =
                  terrainPack.cells[
                    (pr * SUBTILE + 1) * (terrainPack.hCols || cols * SUBTILE) + (pc * SUBTILE + 1)
                  ];
                const biomeLabel: Record<string, string> = {
                  plains: 'равнины',
                  forest: 'лес',
                  hills: 'холмы',
                  swamp: 'низменность',
                };
                const buildingBits: string[] = [];
                if (hasCastle) buildingBits.push('ратуша');
                if (barrackCount > 0) buildingBits.push(`казармы ×${barrackCount}`);
                if (hasWall) buildingBits.push('стена');
                const tipTitle = isFogged
                  ? 'Туман войны'
                  : `#${land.id} · ${ownerLabel ?? 'нейтрал'}`;
                const tipLines = isFogged
                  ? []
                  : [
                      land.claimPending
                        ? 'Гарнизон в пути'
                        : hasCastle
                          ? `Доход ${landTurnIncome(land)}`
                          : `Потенциал ${landPotentialIncome(land)} (нужна Ратуша)`,
                      land.claimPending ? null : `Найм: ${recruitText}`,
                      buildingBits.length > 0 ? `Здания: ${buildingBits.join(', ')}` : null,
                      sampleTerrain != null
                        ? `Местность: ${biomeLabel[sampleTerrain.biome] ?? sampleTerrain.biome}`
                        : null,
                    ].filter((x): x is string => x != null);

                return (
                  <button
                    key={land.id}
                    type="button"
                    className={`fe-province-tile${shieldFocus != null ? ' has-shield-focus' : ''}`}
                    style={{
                      borderWidth,
                      borderColor,
                      background: 'transparent',
                      minHeight: 0,
                      borderRadius: 0,
                      zIndex: shieldFocus != null ? 3 : undefined,
                    }}
                    onClick={() => handleLandTileClick(land, isFogged)}
                    onContextMenu={(e) => {
                      hoverTooltipApiRef.current?.hide();
                      handleLandContextMenu(e, land, isFogged);
                    }}
                    onMouseEnter={(e: ReactMouseEvent) => {
                      if (landContextMenu != null || mapPanning) return;
                      hoverTooltipApiRef.current?.show(tipTitle, tipLines, e.clientX, e.clientY);
                    }}
                    onMouseMove={(e: ReactMouseEvent) => {
                      if (landContextMenu != null || mapPanning) return;
                      hoverTooltipApiRef.current?.move(e.clientX, e.clientY);
                    }}
                    onMouseLeave={() => hoverTooltipApiRef.current?.hide()}
                  >
                    {isFogged && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          zIndex: 1,
                          pointerEvents: 'none',
                          background: 'rgba(180, 170, 140, 0.22)',
                        }}
                      />
                    )}
                    {!isFogged &&
                      (pid != null || shieldFocus != null) && (
                        <div
                          className="fe-province-shield"
                          style={{
                            position: 'absolute',
                            zIndex: 2,
                            left: '50%',
                            top: '50%',
                            transform: 'translate(-50%, -52%)',
                            pointerEvents: 'none',
                            opacity: shieldFocus != null ? 1 : 0.92,
                          }}
                        >
                          {pid != null && showContents && empireSlot != null ? (
                            <ContentsShield
                              land={land}
                              slot={empireSlot}
                              size={SHIELD_CONTENTS_PX}
                              focusColor={shieldFocus}
                            />
                          ) : pid != null && empireSlot != null ? (
                            <BannerShield
                              slot={empireSlot}
                              size={SHIELD_BANNER_PX}
                              focusColor={shieldFocus}
                            />
                          ) : shieldFocus != null ? (
                            <EmptyShieldOutline size={shieldSize} focusColor={shieldFocus} />
                          ) : null}
                        </div>
                      )}
                    {isFogged && (
                      <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
                        <FogOfWarOverlay worldId={world.id} landId={land.id} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            aria-hidden
            className="fe-map-frame-cell"
            style={{
              backgroundImage: `url(${MAP_FRAME_TILES.r})`,
              backgroundRepeat: 'repeat-y',
              backgroundSize: '100% auto',
            }}
          />

          <div aria-hidden className="fe-map-frame-cell" style={{ backgroundImage: `url(${MAP_FRAME_TILES.bl})` }} />
          <div
            aria-hidden
            className="fe-map-frame-cell"
            style={{
              backgroundImage: `url(${MAP_FRAME_TILES.b})`,
              backgroundRepeat: 'repeat-x',
              backgroundSize: 'auto 100%',
            }}
          />
          <div aria-hidden className="fe-map-frame-cell" style={{ backgroundImage: `url(${MAP_FRAME_TILES.br})` }} />
        </div>
        </div>
      </div>
      <p className="fe-muted" style={{ margin: 0, fontSize: '0.7rem' }}>
        Карта {rows}×{cols} · клетка {PROVINCE_TILE_PX}px · плато {SUBTILE}×{SUBTILE}.
      </p>

      <LandHoverTooltipLayer
        apiRef={hoverTooltipApiRef}
        hidden={landContextMenu != null || mapPanning}
      />

      {landContextMenu != null && (
        <div
          role="menu"
          className="fe-panel fe-menu"
          style={{ left: landContextMenu.x, top: landContextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {landContextMenu.kind === 'own' ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelectLand(landContextMenu.landId);
                  setLandContextMenu(null);
                }}
              >
                Выбрать / строить
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setRecruitLandId(landContextMenu.landId);
                  setLandContextMenu(null);
                }}
              >
                Нанять
              </button>
            </>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onSelectLand(landContextMenu.landId);
                setLandContextMenu(null);
              }}
            >
              Инфо
            </button>
          )}
        </div>
      )}

      {fogBlockedModalOpen && (
        <div
          className="fe-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFogBlockedModalOpen(false);
          }}
        >
          <div className="fe-panel fe-modal" role="dialog" aria-modal="true">
            <p style={{ margin: 0 }}>{FOG_BLOCKED_MESSAGE}</p>
            <button type="button" className="fe-btn" style={{ marginTop: '1rem' }} onClick={() => setFogBlockedModalOpen(false)}>
              Понятно
            </button>
          </div>
        </div>
      )}

      {recruitLandId != null && (
        <div
          className="fe-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !recruitSubmitting) {
              closeRecruitModal();
            }
          }}
        >
          <div className="fe-panel fe-modal fe-modal-recruit" role="dialog" aria-modal="true">
            <div className="fe-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
              Найм на земле #{recruitLandId}
            </div>
            {recruitOptions != null && (
              <p className="fe-muted" style={{ fontSize: '0.78rem', marginTop: 0, marginBottom: '0.65rem' }}>
                Слоты: казарма {displayBarrackFree}/{recruitOptions.barrackSlotsCapacity}
                {', '}
                клерик {displayClericFree}/{recruitOptions.clericSlotsCapacity}
                {', '}
                маг {displayMagicFree}/{recruitOptions.magicSlotsCapacity}
              </p>
            )}
            {recruitOptionsLoading ? (
              <p className="fe-muted">Загрузка вариантов найма…</p>
            ) : recruitTypes.length === 0 && recruitPending.length === 0 && recruitDraft.length === 0 ? (
              <p className="fe-muted">Нет доступных типов для найма.</p>
            ) : (
              <>
                <div className="fe-recruit-panels">
                  <div className="fe-recruit-panel fe-recruit-panel-types">
                    <div className="fe-muted fe-recruit-panel-label">Тип войск</div>
                    <div className="fe-recruit-type-list" role="listbox" aria-label="Тип войск">
                      {recruitTypes.map((opt) => {
                        const selected = opt.warriorType === selectedRecruitType;
                        const noSlots = freeSlotsForPool(opt.slotPool) < 1;
                        return (
                          <button
                            key={opt.warriorType}
                            type="button"
                            role="option"
                            aria-selected={selected}
                            className="fe-recruit-type-btn"
                            disabled={recruitSubmitting || noSlots}
                            style={
                              selected
                                ? { borderColor: 'var(--fe-accent)', background: 'rgba(201, 162, 39, 0.14)' }
                                : undefined
                            }
                            onClick={() => addDraftSlot(opt.warriorType)}
                          >
                            <span>{warriorTypeLabel(opt.warriorType)}</span>
                            {noSlots ? (
                              <span className="fe-muted" style={{ fontSize: '0.65rem' }}>
                                нет слотов
                              </span>
                            ) : (
                              <span className="fe-muted" style={{ fontSize: '0.65rem' }}>
                                +{opt.unitsPerSlot} · {opt.goldCost} GP
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="fe-recruit-panel fe-recruit-panel-queue">
                    <div className="fe-muted fe-recruit-panel-label">Очередь 1–{RECRUIT_QUEUE_COL_CAPACITY}</div>
                    <div className="fe-recruit-queue">
                      {recruitQueueEntries.length === 0 ? (
                        <p className="fe-muted fe-recruit-queue-empty">Пока пусто — клик слева.</p>
                      ) : (
                        recruitQueueColMid.map(renderRecruitQueueRow)
                      )}
                    </div>
                  </div>
                  <div className="fe-recruit-panel fe-recruit-panel-queue">
                    <div className="fe-muted fe-recruit-panel-label">
                      Очередь {RECRUIT_QUEUE_COL_CAPACITY + 1}–{RECRUIT_QUEUE_COL_CAPACITY * 2}
                    </div>
                    <div
                      className={`fe-recruit-queue${recruitQueueRightNeedsScroll ? ' fe-recruit-queue-scroll' : ''}`}
                    >
                      {recruitQueueColRight.length === 0 ? (
                        <p className="fe-muted fe-recruit-queue-empty">Продолжение очереди</p>
                      ) : (
                        recruitQueueColRight.map(renderRecruitQueueRow)
                      )}
                    </div>
                  </div>
                </div>
                <div className="fe-recruit-footer">
                  {selectedOpt != null ? (
                    <p style={{ margin: 0, fontSize: '0.84rem' }}>
                      <strong>{warriorTypeLabel(selectedOpt.warriorType)}</strong>
                      <span className="fe-muted">
                        {' '}
                        · найм {selectedOpt.turnCount}{' '}
                        {selectedOpt.turnCount === 1 ? 'ход' : selectedOpt.turnCount < 5 ? 'хода' : 'ходов'}
                        {' · '}
                        свободно слотов {freeSlotsForPool(selectedOpt.slotPool)}
                        {' · '}за клик {selectedOpt.unitsPerSlot}
                        {' · '}
                        {selectedOpt.goldCost} GP
                      </span>
                    </p>
                  ) : (
                    <p className="fe-muted" style={{ margin: 0, fontSize: '0.84rem' }}>
                      Клик по типу добавляет слот в очередь (сначала средняя колонка, затем правая).
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: '0.84rem' }} className="fe-muted">
                    Черновик: <strong style={{ color: 'var(--fe-ink)' }}>{draftGoldTotal} GP</strong>
                    {' · '}
                    казна: {playerGold} GP
                    {recruitDraft.length > 0 && draftGoldTotal > playerGold ? (
                      <span style={{ color: 'var(--fe-danger)' }}> — недостаточно золота</span>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    className="fe-btn fe-btn-ok"
                    disabled={!canConfirmRecruit || onWorldRefresh == null || recruitOptionsLoading}
                    onClick={() => void confirmRecruitBatch()}
                  >
                    {recruitSubmitting ? 'Найм…' : 'Нанять'}
                  </button>
                </div>
              </>
            )}
            {recruitError != null && (
              <p style={{ color: 'var(--fe-danger)', fontSize: '0.84rem', marginBottom: 0 }}>{recruitError}</p>
            )}
          </div>
        </div>
      )}

      {moveWarriorsModal != null && (
        <div
          className="fe-modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !moveSubmitting) {
              setMoveWarriorsModal(null);
              setMoveError(null);
            }
          }}
        >
          <div className="fe-panel fe-modal" role="dialog" aria-modal="true">
            <div className="fe-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
              Войска: #{moveWarriorsModal.fromId} → #{moveWarriorsModal.toId}
            </div>
            {moveWarriorsList.length === 0 ? (
              <p className="fe-muted">На этой земле нет войск.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {moveWarriorsList.map((w) => {
                  const key = warriorRowKey(w);
                  const max = w.count ?? 0;
                  const send = moveCounts[key] ?? 0;
                  const stay = max - send;
                  return (
                    <div key={key}>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        {warriorTypeLabel(w.type)}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem' }}>
                          Останется: <strong>{stay}</strong>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={max}
                          value={send}
                          disabled={moveSubmitting}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value, 10);
                            setMoveCounts((prev) => ({
                              ...prev,
                              [key]: Number.isFinite(v) ? Math.min(max, Math.max(0, v)) : 0,
                            }));
                          }}
                          style={{ flex: '1 1 100px', accentColor: 'var(--fe-accent)' }}
                        />
                        <span style={{ fontSize: '0.8rem' }}>
                          Переместить: <strong>{send}</strong>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {moveError != null && <p style={{ color: 'var(--fe-danger)', fontSize: '0.84rem' }}>{moveError}</p>}
            {moveWarriorsList.length > 0 && (
              <button
                type="button"
                className="fe-btn fe-btn-ok"
                disabled={moveSubmitting || onWorldRefresh == null}
                style={{ marginTop: '0.85rem' }}
                onClick={() => void confirmMoveWarriors()}
              >
                {moveSubmitting ? 'Отправка…' : 'Переместить'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
