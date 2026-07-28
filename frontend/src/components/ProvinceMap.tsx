import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { LandDto, WorldDetail } from '../api/client';
import { getMoveSourceLands, moveWarriors, recruitWarriors } from '../api/client';
import {
  FOG_BLOCKED_MESSAGE,
  RECRUIT_COUNT_STEP,
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
import { provinceClipPath } from '../land/provinceClip';
import { buildLandToneGrid, buildProceduralLandTileSvg } from '../proceduralLandTile';
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
    if (world == null || !world.lands?.length || currentPlayerId == null) return null;
    return computeFogOfWarVisibleLandIds(world.lands, world.neighbors, currentPlayerId);
  }, [world, currentPlayerId]);

  const tileByLandId = useMemo(() => {
    if (world == null || !world.lands?.length || world.size == null) return new Map<number, string>();
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
    setMapViewMode('economy');
    setLandContextMenu(null);
    setFogBlockedModalOpen(false);
    setRecruitLandId(null);
    setRecruitError(null);
    setRecruitCounts({});
    setCaptureMove(null);
    setCaptureInitError(null);
    setMoveWarriorsModal(null);
    setMoveError(null);
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
    if (recruitLandId == null || world == null || !world.lands?.length) {
      setRecruitCounts({});
      return;
    }
    const land = world.lands.find((l) => l.id === recruitLandId);
    const types = land?.accessBuildWarriorTypes ?? [];
    const next: Record<string, number> = {};
    for (const t of types) next[t] = 0;
    setRecruitCounts(next);
    setRecruitError(null);
  }, [recruitLandId, world]);

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
      onActionMessage?.('recruit');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setRecruitError(msg);
      onActionMessage?.('error', msg);
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

  const recruitLand =
    recruitLandId != null && world != null
      ? (world.lands?.find((l) => l.id === recruitLandId) ?? null)
      : null;
  const recruitTypes = recruitLand?.accessBuildWarriorTypes ?? [];
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
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cols}, minmax(72px, 1fr))`,
            gap: 6,
            maxWidth: `min(${cols * 100 + (cols - 1) * 6}px, 100%)`,
          }}
        >
          {lands.map((land) => {
            const pid = land.player?.id ?? null;
            const isCurrentTurn = currentPlayerId != null && pid === currentPlayerId;
            const isSelected = selectedLandId === land.id;
            const svg = tileByLandId.get(land.id) ?? '';
            const isFogged = fogVisibleLandIds != null && !fogVisibleLandIds.has(land.id);
            const clip = provinceClipPath(land.id);
            let borderColor = isFogged
              ? '#4a4030'
              : isCurrentTurn
                ? 'var(--fe-turn)'
                : pid != null
                  ? playerLandBackgroundFromId(pid)
                  : 'var(--fe-accent-dim)';
            let borderWidth = isFogged ? 1 : pid != null || isCurrentTurn ? 2 : 1;
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

            return (
              <button
                key={land.id}
                type="button"
                className={`fe-province-tile${isSelected ? ' is-selected' : ''}`}
                style={{
                  borderWidth,
                  borderColor,
                  clipPath: clip,
                  WebkitClipPath: clip,
                }}
                title={isFogged ? 'Туман войны' : `#${land.id} · ${ownerLabel ?? 'нейтрал'}`}
                onClick={() => handleLandTileClick(land, isFogged)}
                onContextMenu={(e) => handleLandContextMenu(e, land, isFogged)}
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
                      ? { background: 'rgba(15, 12, 8, 0.65)' }
                      : {
                          background: playerLandBackgroundFromId(pid),
                          opacity: 0.38,
                          mixBlendMode: 'multiply',
                        }),
                  }}
                />
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    padding: '0.3rem',
                    fontSize: '0.66rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: mapViewMode === 'economy' ? 'center' : 'flex-start',
                    gap: '0.15rem',
                    minHeight: 72,
                  }}
                >
                  {!isFogged &&
                    (mapViewMode === 'economy' ? (
                      <>
                        <span className="fe-tile-text">
                          <strong>{ownerLabel ?? '—'}</strong>
                        </span>
                        <span className="fe-tile-text">
                          Доход <strong>{land.costs ?? '—'}</strong>
                        </span>
                        <span className="fe-tile-text" style={{ fontSize: '0.58rem' }}>
                          Найм {recruitText}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="fe-tile-text">
                          <strong>{ownerLabel ?? '—'}</strong>
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {hasCastle && <CastleGlyph size={24} tile />}
                          {barrackCount > 0 && <BarrackGlyphTileWithCount count={barrackCount} size={24} />}
                          {hasWall && <WallGlyph size={24} tile />}
                        </div>
                      </>
                    ))}
                </div>
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
      <p className="fe-muted" style={{ margin: 0, fontSize: '0.7rem' }}>
        Сетка {rows}×{cols} · провинции — визуальный слой. ЛКМ — выбрать, ПКМ — меню.
      </p>

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
              setRecruitLandId(null);
              setRecruitError(null);
            }
          }}
        >
          <div className="fe-panel fe-modal" role="dialog" aria-modal="true">
            <div className="fe-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
              Найм на земле #{recruitLandId}
            </div>
            {recruitTypes.length === 0 ? (
              <p className="fe-muted">Нет доступных типов для найма.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                {recruitTypes.map((warriorType) => (
                  <label key={warriorType} className="fe-label" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{warriorTypeLabel(warriorType)}</span>
                    <input
                      className="fe-input"
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
                      style={{ width: '6rem' }}
                    />
                  </label>
                ))}
              </div>
            )}
            {recruitError != null && <p style={{ color: 'var(--fe-danger)', fontSize: '0.84rem' }}>{recruitError}</p>}
            {recruitTypes.length > 0 && (
              <button
                type="button"
                className="fe-btn fe-btn-ok"
                disabled={recruitSubmitting || onWorldRefresh == null}
                style={{ marginTop: '0.85rem' }}
                onClick={() => void confirmRecruit()}
              >
                {recruitSubmitting ? 'Отправка…' : 'Подтвердить найм'}
              </button>
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
