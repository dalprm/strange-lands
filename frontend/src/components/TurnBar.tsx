import type { Player, Turn, WorldDetail } from '../api/client';

type Props = {
  turn: Turn | null;
  players: Player[];
  world: WorldDetail | null;
  loading?: boolean;
  onEndTurn: () => void;
  onBackToLobby: () => void;
};

export function TurnBar({ turn, players, world, loading, onEndTurn, onBackToLobby }: Props) {
  const cur =
    turn?.currentPlayerId != null ? players.find((p) => p.id === turn.currentPlayerId) : undefined;
  const who =
    cur != null
      ? cur.name
      : turn?.currentPlayerId != null
        ? `#${turn.currentPlayerId}`
        : 'нет владельцев';
  const goldKey = turn?.currentPlayerId != null ? String(turn.currentPlayerId) : null;
  const gold = goldKey != null ? (world?.playerWorldResources?.[goldKey]?.gold ?? 0) : null;

  return (
    <div className="fe-frame" style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'flex-start' }}>
        <div>
          <div className="fe-title" style={{ fontSize: '0.95rem', marginBottom: '0.2rem' }}>
            Странные земли
          </div>
          <div className="fe-muted" style={{ fontSize: '0.8rem' }}>
            {turn != null ? (
              <>
                Раунд <strong style={{ color: 'var(--fe-ink)' }}>{turn.turnNumber}</strong>
                {' · '}
                ход: <strong style={{ color: 'var(--fe-turn)' }}>{who}</strong>
                {gold != null && (
                  <>
                    {' · '}
                    золото: <strong style={{ color: 'var(--fe-accent)' }}>{gold}</strong>
                  </>
                )}
                <br />
                в очереди: {turn.pendingActionsCount}
              </>
            ) : (
              'Загрузка хода…'
            )}
          </div>
        </div>
        <img src="/ui/shield.svg" alt="" width={28} height={34} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        <button type="button" className="fe-btn fe-btn-primary" disabled={loading || turn == null} onClick={onEndTurn}>
          Завершить ход
        </button>
        <button type="button" className="fe-btn" disabled={loading} onClick={onBackToLobby}>
          В лобби
        </button>
      </div>
    </div>
  );
}
