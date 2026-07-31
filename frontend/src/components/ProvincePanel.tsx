import type { LandDto, WorldDetail } from '../api/client';
import {
  availableBuildActions,
  buildingSummaryLines,
  formatWarriorLine,
  landBarrackCount,
  landHasCastle,
  landHasWall,
  landOwnerLabel,
  landWallLevelDisplay,
  playerLandBackgroundFromId,
  warriorTypeLabel,
} from '../land/helpers';
import { BarrackGlyph, CastleGlyph, WallGlyph } from './icons';

type Props = {
  world: WorldDetail | null;
  land: LandDto | null;
  currentPlayerId: number | null;
  loading?: boolean;
  busy?: boolean;
  onRecruit: (landId: number) => void;
  onCapture: (landId: number) => void;
  onBuild: (landId: number, buildingType: string, wallLevel?: number) => void;
};

export function ProvincePanel({
  world,
  land,
  currentPlayerId,
  loading,
  busy,
  onRecruit,
  onCapture,
  onBuild,
}: Props) {
  if (loading && world == null) {
    return <p className="fe-muted">Загрузка провинции…</p>;
  }
  if (land == null) {
    return (
      <div className="fe-frame">
        <div className="fe-title" style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>
          Провинция
        </div>
        <p className="fe-muted" style={{ margin: 0 }}>
          Выберите провинцию на карте (левый клик). Правый клик — быстрое меню.
        </p>
      </div>
    );
  }

  const owner = landOwnerLabel(land);
  const isOwn = currentPlayerId != null && land.player?.id === currentPlayerId;
  const isEnemyOrNeutral = currentPlayerId != null && land.player?.id !== currentPlayerId;
  const neighborIds = world?.neighbors?.[String(land.id)];
  const buildingLines = buildingSummaryLines(land.buildings);
  const warriorsList = land.warriors?.filter((w) => (w.count ?? 0) > 0) ?? [];
  const accessTypes = land.accessBuildWarriorTypes ?? [];
  const hasCastle = landHasCastle(land.buildings);
  const hasWall = landHasWall(land.buildings);
  const wallCaption = landWallLevelDisplay(land.buildings);
  const barrackCount = landBarrackCount(land.buildings);
  const buildActions = availableBuildActions(land.buildings);

  return (
    <div className="fe-frame" style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      <div>
        <div className="fe-title" style={{ fontSize: '0.95rem' }}>
          Провинция #{land.id}
          {land.name ? ` · ${land.name}` : ''}
        </div>
        <div style={{ marginTop: '0.35rem', fontSize: '0.88rem' }}>
          {land.player ? (
            <strong style={{ color: playerLandBackgroundFromId(land.player.id) }}>
              {owner}
              {land.player.level != null ? ` · ур. ${land.player.level}` : ''}
            </strong>
          ) : (
            <span className="fe-muted">Нейтральная земля</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
        {hasCastle && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
            <CastleGlyph size={28} /> Замок
          </span>
        )}
        {barrackCount > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
            <BarrackGlyph size={28} /> {barrackCount > 1 ? `Казармы ×${barrackCount}` : 'Казарма'}
          </span>
        )}
        {hasWall && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}>
            <WallGlyph size={28} /> {wallCaption === 'стена' ? 'Стена' : `Стена (${wallCaption})`}
          </span>
        )}
      </div>

      <dl style={{ margin: 0, fontSize: '0.82rem', display: 'grid', gap: '0.35rem' }}>
        {land.costs != null && (
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <dt className="fe-muted" style={{ margin: 0 }}>
              Доход
            </dt>
            <dd style={{ margin: 0 }}>{land.costs}</dd>
          </div>
        )}
        {neighborIds != null && neighborIds.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <dt className="fe-muted" style={{ margin: 0 }}>
              Соседи
            </dt>
            <dd style={{ margin: 0 }}>{neighborIds.join(', ')}</dd>
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <dt className="fe-muted" style={{ margin: 0 }}>
            Здания
          </dt>
          <dd style={{ margin: 0 }}>{buildingLines.length > 0 ? buildingLines.join(' · ') : 'нет'}</dd>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <dt className="fe-muted" style={{ margin: 0 }}>
            Войска
          </dt>
          <dd style={{ margin: 0 }}>
            {warriorsList.length > 0 ? warriorsList.map(formatWarriorLine).join('; ') : 'нет'}
          </dd>
        </div>
        {accessTypes.length > 0 && (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <dt className="fe-muted" style={{ margin: 0 }}>
              Найм
            </dt>
            <dd style={{ margin: 0 }}>{accessTypes.map(warriorTypeLabel).join(', ')}</dd>
          </div>
        )}
      </dl>

      {currentPlayerId != null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: '0.25rem' }}>
          {isOwn && (
            <>
              <div className="fe-muted" style={{ fontSize: '0.75rem' }}>
                Постройка
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {buildActions.length === 0 ? (
                  <span className="fe-muted" style={{ fontSize: '0.75rem' }}>
                    Нет доступных построек
                  </span>
                ) : (
                  buildActions.map((b) => (
                    <button
                      key={`${b.type}-${b.wallLevel ?? ''}`}
                      type="button"
                      className="fe-btn"
                      disabled={busy}
                      onClick={() => onBuild(land.id, b.type, b.wallLevel)}
                    >
                      {b.label}
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                className="fe-btn fe-btn-ok"
                disabled={busy}
                onClick={() => onRecruit(land.id)}
              >
                Нанять войска
              </button>
            </>
          )}
          {isEnemyOrNeutral && (
            <button
              type="button"
              className="fe-btn fe-btn-danger"
              disabled={busy}
              onClick={() => onCapture(land.id)}
            >
              Захватить / перебросить войска
            </button>
          )}
        </div>
      )}
    </div>
  );
}
