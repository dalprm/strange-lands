import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { LandDto, RecruitOptionsDto, WorldDetail } from '../api/client';
import { getMoveSourceLands, getRecruitOptions, moveWarriors, recruitWarriorsBatch } from '../api/client';
import {
  FOG_BLOCKED_MESSAGE,
  collectPlayersForLegend,
  computeFogOfWarVisibleLandIds,
  landBarrackCount,
  landHasCastle,
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
import { BarrackGlyphTileWithCount, CastleGlyph, FogOfWarOverlay, WallGlyph } from './icons';

type MapTileViewMode = 'economy' | 'buildings';

type Props = {
  world: WorldDetail | null;
  currentPlayerId: number | null;
  selectedLandId: number | null;
  loading?: boolean;
  onSelectLand: (landId: number | null) => void;
  onWorldRefresh?: () => Promise<void>;
  onActionMessage?: (kind: 'recruit' | 'move' | 'fog' | 'error', detail?: string) => void;
  /** Внешний запрос открыть найм / захват с панели */
  recruitRequestId?: number | null;
  captureRequestId?: number | null;
  onRecruitRequestHandled?: () => void;
  onCaptureRequestHandled?: () => void;
};

type LandContextMenuState = {
  x: number;
  y: number;
  landId: number;
  kind: 'own' | 'neighbor';
};

type CaptureMoveState = { targetId: number; sourceIds: number[] };

type LandHoverTooltip = {
  x: number;
  y: number;
  title: string;
  lines: string[];
};

type RecruitDraftSlot = {
  id: string;
  warriorType: string;
  count: number;
  turnCount: number;
  slotPool: string;
};

let recruitDraftSeq = 0;

export function ProvinceMap({
  world,
  currentPlayerId,
  selectedLandId,
  loading,
  onSelectLand,
  onWorldRefresh,
  onActionMessage,
  recruitRequestId,
  captureRequestId,
  onRecruitRequestHandled,
  onCaptureRequestHandled,
}: Props) {
  const [mapViewMode, setMapViewMode] = useState<MapTileViewMode>('economy');
  const [landContextMenu, setLandContextMenu] = useState<LandContextMenuState | null>(null);
  const [fogBlockedModalOpen, setFogBlockedModalOpen] = useState(false);
  const [recruitLandId, setRecruitLandId] = useState<number | null>(null);
  const [recruitOptions, setRecruitOptions] = useState<RecruitOptionsDto | null>(null);
  const [recruitOptionsLoading, setRecruitOptionsLoading] = useState(false);
  const [selectedRecruitType, setSelectedRecruitType] = useState<string | null>(null);
  const [recruitDraft, setRecruitDraft] = useState<RecruitDraftSlot[]>([]);
  const [recruitSubmitting, setRecruitSubmitting] = useState(false);
  const [recruitError, setRecruitError] = useState<string | null>(null);
  const [captureMove, setCaptureMove] = useState<CaptureMoveState | null>(null);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [captureInitError, setCaptureInitError] = useState<string | null>(null);
  const [moveWarriorsModal, setMoveWarriorsModal] = useState<null | { fromId: number; toId: number }>(null);
  const [moveCounts, setMoveCounts] = useState<Record<string, number>>({});
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [hoverTooltip, setHoverTooltip] = useState<LandHoverTooltip | null>(null);

  const fogVisibleLandIds = useMemo(() => {
    if (world == null || !world.lands?.length || currentPlayerId == null) return null;
    return computeFogOfWarVisibleLandIds(world.lands, world.neighbors, currentPlayerId);
  }, [world, currentPlayerId]);

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
  }, [world]);

  useEffect(() => {
    setMapViewMode('economy');
    setLandContextMenu(null);
    setFogBlockedModalOpen(false);
    setRecruitLandId(null);
    setRecruitError(null);
    setRecruitOptions(null);
    setSelectedRecruitType(null);
    setRecruitDraft([]);
    setCaptureMove(null);
    setCaptureInitError(null);
    setMoveWarriorsModal(null);
    setMoveError(null);
    setHoverTooltip(null);
  }, [world?.id]);

  useEffect(() => {
    if (recruitRequestId != null) {
      setRecruitLandId(recruitRequestId);
      setRecruitError(null);
      onRecruitRequestHandled?.();
    }
  }, [recruitRequestId, onRecruitRequestHandled]);

  useEffect(() => {
    if (captureRequestId != null) {
      void startCaptureFromContext(captureRequestId);
      onCaptureRequestHandled?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot from panel
  }, [captureRequestId]);

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
      captureMove != null ||
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
      setCaptureMove(null);
      setCaptureInitError(null);
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
    captureMove,
    moveWarriorsModal,
    moveSubmitting,
  ]);

  function handleLandContextMenu(e: ReactMouseEvent, land: LandDto, isFogged: boolean) {
    if (currentPlayerId == null) return;
    e.preventDefault();
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
        const msg = 'Нет ваших соседних земель с войсками для этого перемещения.';
        setCaptureInitError(msg);
        onActionMessage?.('error', msg);
        return;
      }
      setCaptureMove({ targetId: targetLandId, sourceIds });
      onSelectLand(targetLandId);
    } catch (e) {
      setCaptureMove(null);
      const msg = e instanceof Error ? e.message : String(e);
      setCaptureInitError(msg);
      onActionMessage?.('error', msg);
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
      setCaptureMove(null);
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
  const canConfirmRecruit = recruitDraft.length > 0 && !recruitSubmitting;
  const displayBarrackFree =
    recruitOptions == null ? 0 : Math.max(0, recruitOptions.barrackSlotsFree - draftSlotsInPool('BARRACK'));
  const displayClericFree =
    recruitOptions == null ? 0 : Math.max(0, recruitOptions.clericSlotsFree - draftSlotsInPool('CLERIC'));
  const displayMagicFree =
    recruitOptions == null ? 0 : Math.max(0, recruitOptions.magicSlotsFree - draftSlotsInPool('MAGIC'));
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <span className="fe-muted">Просмотр:</span>
        <button
          type="button"
          className="fe-btn"
          aria-pressed={mapViewMode === 'economy'}
          style={mapViewMode === 'economy' ? { borderColor: 'var(--fe-accent)' } : undefined}
          onClick={() => setMapViewMode('economy')}
        >
          Экономика
        </button>
        <button
          type="button"
          className="fe-btn"
          aria-pressed={mapViewMode === 'buildings'}
          style={mapViewMode === 'buildings' ? { borderColor: 'var(--fe-accent)' } : undefined}
          onClick={() => setMapViewMode('buildings')}
        >
          Здания
        </button>
        {legendPlayers.map((p) => (
          <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 2,
                border: '1px solid var(--fe-accent-dim)',
                background: playerLandBackgroundFromId(p.id),
              }}
            />
            #{p.id} {p.name ?? ''}
          </span>
        ))}
      </div>

      {captureLoading && <p className="fe-muted">Проверка земель для захвата…</p>}
      {captureMove != null && (
        <p className="fe-muted" style={{ color: 'var(--fe-capture)', margin: 0 }}>
          Захват: кликните клетку с оранжевой рамкой (источник). Цель — фиолетовая. Esc — отмена.
        </p>
      )}
      {captureInitError != null && (
        <p style={{ color: 'var(--fe-danger)', margin: 0, fontSize: '0.82rem' }}>{captureInitError}</p>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '0.35rem',
          background: 'var(--fe-bg-map)',
          border: '2px solid var(--fe-accent-dim)',
          borderRadius: 'var(--fe-radius)',
        }}
      >
        <div
          className="fe-map-island"
          style={{
            maxWidth: `min(${cols * 96}px, 100%)`,
            aspectRatio: `${cols} / ${rows}`,
            backgroundImage: `url(${MAP_FRAME_TILES.water})`,
            display: 'grid',
            // Тонкая рамка в px — не fr, иначе края больше поля
            gridTemplateColumns: '28px 1fr 28px',
            gridTemplateRows: '28px 1fr 36px',
            gap: 0,
            width: '100%',
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
                const isCurrentTurn = currentPlayerId != null && pid === currentPlayerId;
                const isSelected = selectedLandId === land.id;
                const isFogged = fogVisibleLandIds != null && !fogVisibleLandIds.has(land.id);
                let borderColor = isFogged
                  ? 'rgba(40, 32, 20, 0.55)'
                  : isCurrentTurn
                    ? 'var(--fe-turn)'
                    : pid != null
                      ? playerLandBackgroundFromId(pid)
                      : 'rgba(201, 162, 39, 0.28)';
                let borderWidth = isFogged ? 1 : isCurrentTurn || pid != null ? 2 : 1;
                const isCaptureSource = captureMove != null && captureMove.sourceIds.includes(land.id);
                const isCaptureTarget = captureMove != null && land.id === captureMove.targetId;
                if (captureMove != null) {
                  if (isCaptureSource) {
                    borderWidth = 3;
                    borderColor = 'var(--fe-capture)';
                  } else if (isCaptureTarget) {
                    borderWidth = 3;
                    borderColor = 'var(--fe-target)';
                  }
                }
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
                if (hasCastle) buildingBits.push('замок');
                if (barrackCount > 0) buildingBits.push(`казармы ×${barrackCount}`);
                if (hasWall) buildingBits.push('стена');
                const tipTitle = isFogged
                  ? 'Туман войны'
                  : `#${land.id} · ${ownerLabel ?? 'нейтрал'}`;
                const tipLines = isFogged
                  ? []
                  : [
                      `Доход ${land.costs ?? '—'}`,
                      `Найм: ${recruitText}`,
                      buildingBits.length > 0 ? `Здания: ${buildingBits.join(', ')}` : null,
                      sampleTerrain != null
                        ? `Местность: ${biomeLabel[sampleTerrain.biome] ?? sampleTerrain.biome}`
                        : null,
                    ].filter((x): x is string => x != null);

                const showTip = (e: ReactMouseEvent) => {
                  if (landContextMenu != null) return;
                  const pad = 12;
                  const x = Math.min(e.clientX + pad, window.innerWidth - 260);
                  const y = Math.min(e.clientY + pad, window.innerHeight - 140);
                  setHoverTooltip({ x, y, title: tipTitle, lines: tipLines });
                };

                return (
                  <button
                    key={land.id}
                    type="button"
                    className={`fe-province-tile${isSelected ? ' is-selected' : ''}`}
                    style={{
                      borderWidth,
                      borderColor,
                      background: 'transparent',
                      minHeight: 0,
                      borderRadius: 0,
                    }}
                    onClick={() => handleLandTileClick(land, isFogged)}
                    onContextMenu={(e) => {
                      setHoverTooltip(null);
                      handleLandContextMenu(e, land, isFogged);
                    }}
                    onMouseEnter={showTip}
                    onMouseMove={showTip}
                    onMouseLeave={() => setHoverTooltip(null)}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        pointerEvents: 'none',
                        ...(isFogged
                          ? { background: 'rgba(180, 170, 140, 0.22)' }
                          : pid != null
                            ? {
                                background: playerLandBackgroundFromId(pid),
                                opacity: 0.22,
                                mixBlendMode: 'multiply',
                              }
                            : { background: 'transparent' }),
                      }}
                    />
                    {!isFogged &&
                      mapViewMode === 'buildings' &&
                      (hasCastle || barrackCount > 0 || hasWall) && (
                        <div
                          style={{
                            position: 'relative',
                            zIndex: 2,
                            padding: '0.2rem',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.2rem',
                            alignItems: 'flex-start',
                            height: '100%',
                            boxSizing: 'border-box',
                            pointerEvents: 'none',
                          }}
                        >
                          {hasCastle && <CastleGlyph size={22} tile />}
                          {barrackCount > 0 && <BarrackGlyphTileWithCount count={barrackCount} size={22} />}
                          {hasWall && <WallGlyph size={22} tile />}
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
      <p className="fe-muted" style={{ margin: 0, fontSize: '0.7rem' }}>
        Карта {rows}×{cols} · плато {SUBTILE}×{SUBTILE}, обрыв снизу. ЛКМ — выбрать, ПКМ — меню.
      </p>

      {hoverTooltip != null && landContextMenu == null && (
        <div
          className="fe-tooltip"
          role="tooltip"
          style={{ left: hoverTooltip.x, top: hoverTooltip.y }}
        >
          <div className="fe-tooltip-title">{hoverTooltip.title}</div>
          {hoverTooltip.lines.map((line) => (
            <div key={line} className="fe-tooltip-line">
              {line}
            </div>
          ))}
        </div>
      )}

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
            <>
              <button
                type="button"
                role="menuitem"
                disabled={captureLoading}
                onClick={() => void startCaptureFromContext(landContextMenu.landId)}
              >
                Захватить
              </button>
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
            </>
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
                  <div className="fe-recruit-panel">
                    <div className="fe-muted" style={{ fontSize: '0.72rem', marginBottom: '0.35rem' }}>
                      Тип войск — клик добавляет в очередь
                    </div>
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
                              <span className="fe-muted" style={{ fontSize: '0.72rem' }}>
                                нет слотов
                              </span>
                            ) : (
                              <span className="fe-muted" style={{ fontSize: '0.72rem' }}>
                                +{opt.unitsPerSlot}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="fe-recruit-panel">
                    <div className="fe-muted" style={{ fontSize: '0.72rem', marginBottom: '0.35rem' }}>
                      Очередь (1 строка = 1 слот)
                    </div>
                    <div className="fe-recruit-queue">
                      {recruitPending.length === 0 && recruitDraft.length === 0 ? (
                        <p className="fe-muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                          Пока пусто — кликните тип слева.
                        </p>
                      ) : (
                        <>
                          {recruitPending.map((p, i) => (
                            <div
                              key={`srv-${p.warriorType}-${i}-${p.turnsRemaining}`}
                              className="fe-recruit-queue-row fe-recruit-queue-row-server"
                              title="Уже в найме — удалить нельзя"
                            >
                              <span>
                                {warriorTypeLabel(p.warriorType)}
                                {p.count > 1 ? ` ×${p.count}` : ''}
                              </span>
                              <span className="fe-muted">
                                {p.turnsRemaining === 1
                                  ? 'через 1 ход'
                                  : `через ${p.turnsRemaining} хода`}
                              </span>
                            </div>
                          ))}
                          {recruitDraft.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              className="fe-recruit-queue-row fe-recruit-queue-row-draft"
                              disabled={recruitSubmitting}
                              title="Клик — убрать из черновика"
                              onClick={() => removeDraftSlot(d.id)}
                            >
                              <span>
                                {warriorTypeLabel(d.warriorType)}
                                {d.count > 1 ? ` ×${d.count}` : ''}
                              </span>
                              <span className="fe-muted">
                                {d.turnCount === 1 ? 'через 1 ход' : `через ${d.turnCount} хода`} · новый
                              </span>
                            </button>
                          ))}
                        </>
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
                      </span>
                    </p>
                  ) : (
                    <p className="fe-muted" style={{ margin: 0, fontSize: '0.84rem' }}>
                      Клик по типу добавляет слот в очередь справа.
                    </p>
                  )}
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
