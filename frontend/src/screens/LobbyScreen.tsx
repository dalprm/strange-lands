import { useState, type CSSProperties } from 'react';
import type { Player, World } from '../api/client';

const MIN_WORLD = 2;
const MAX_WORLD = 64;

function clampWorldSize(n: number): number {
  if (!Number.isFinite(n)) return MIN_WORLD;
  return Math.min(MAX_WORLD, Math.max(MIN_WORLD, Math.trunc(n)));
}

function parseOptionalSize(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

type Props = {
  worlds: World[];
  players: Player[];
  loading: boolean;
  error: string | null;
  onCreatePlayer: (name: string, level: number) => Promise<void>;
  onCreateWorld: (sizeX: number, sizeY: number, playerIds: number[]) => Promise<number>;
  onAddPlayerToWorld: (worldId: number, playerId: number) => Promise<void>;
  onRefresh: () => void;
  onEnterParty: (worldId: number) => void;
};

export function LobbyScreen({
  worlds,
  players,
  loading,
  error,
  onCreatePlayer,
  onCreateWorld,
  onAddPlayerToWorld,
  onRefresh,
  onEnterParty,
}: Props) {
  const [sizeXInput, setSizeXInput] = useState('4');
  const [sizeYInput, setSizeYInput] = useState('4');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerLevel, setNewPlayerLevel] = useState('1');
  const [includeInNewWorld, setIncludeInNewWorld] = useState<Set<number>>(new Set());
  const [selectedWorldId, setSelectedWorldId] = useState<number | null>(null);
  const [attachPlayerId, setAttachPlayerId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const effectiveSizeX = clampWorldSize(parseOptionalSize(sizeXInput) ?? MIN_WORLD);
  const effectiveSizeY = clampWorldSize(parseOptionalSize(sizeYInput) ?? MIN_WORLD);
  const displayError = localError ?? error;

  function toggleIncludePlayer(id: number) {
    setIncludeInNewWorld((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreatePlayer() {
    const name = newPlayerName.trim();
    if (!name) {
      setLocalError('Введите имя игрока');
      return;
    }
    setLocalError(null);
    const level = Math.max(1, Number.parseInt(newPlayerLevel, 10) || 1);
    try {
      await onCreatePlayer(name, level);
      setNewPlayerName('');
      setNewPlayerLevel('1');
    } catch {
      /* error already on parent */
    }
  }

  async function handleCreateWorld() {
    setLocalError(null);
    const sx = clampWorldSize(parseOptionalSize(sizeXInput) ?? MIN_WORLD);
    const sy = clampWorldSize(parseOptionalSize(sizeYInput) ?? MIN_WORLD);
    setSizeXInput(String(sx));
    setSizeYInput(String(sy));
    const ids = players.filter((p) => includeInNewWorld.has(p.id)).map((p) => p.id);
    try {
      const id = await onCreateWorld(sx, sy, ids);
      setSelectedWorldId(id);
    } catch {
      /* error already on parent */
    }
  }

  async function handleAttach() {
    if (selectedWorldId == null || attachPlayerId === '') return;
    setLocalError(null);
    try {
      await onAddPlayerToWorld(selectedWorldId, Number(attachPlayerId));
      setAttachPlayerId('');
    } catch {
      /* error already on parent */
    }
  }

  return (
    <div style={lobbyWrap}>
      <header style={{ marginBottom: '1.25rem' }}>
        <h1 className="fe-title" style={{ fontSize: '1.85rem', margin: '0 0 0.35rem' }}>
          Strange Lands
        </h1>
        <p className="fe-muted" style={{ margin: 0 }}>
          Лобби кампании — соберите правителей и откройте карту провинций.
        </p>
      </header>

      {displayError && <pre className="fe-error">{displayError}</pre>}

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        <section className="fe-panel" style={{ padding: '1rem' }}>
          <h2 className="fe-title" style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>
            Правители
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'flex-end' }}>
            <label className="fe-label">
              Имя
              <input
                className="fe-input"
                value={newPlayerName}
                disabled={loading}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Арагорн"
                style={{ width: '11rem' }}
              />
            </label>
            <label className="fe-label">
              Уровень
              <input
                className="fe-input"
                type="number"
                min={1}
                value={newPlayerLevel}
                disabled={loading}
                onChange={(e) => setNewPlayerLevel(e.target.value)}
                style={{ width: '5rem' }}
              />
            </label>
            <button type="button" className="fe-btn fe-btn-primary" disabled={loading} onClick={() => void handleCreatePlayer()}>
              Создать
            </button>
          </div>
          <ul style={{ margin: '0.85rem 0 0', padding: 0, listStyle: 'none' }}>
            {players.map((p) => (
              <li key={p.id} style={{ marginBottom: '0.35rem' }}>
                <label style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={includeInNewWorld.has(p.id)}
                    disabled={loading}
                    onChange={() => toggleIncludePlayer(p.id)}
                  />
                  <span>
                    <strong>#{p.id}</strong> {p.name} <span className="fe-muted">(ур. {p.level})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {players.length === 0 && <p className="fe-muted">Пока нет игроков.</p>}
        </section>

        <section className="fe-panel" style={{ padding: '1rem' }}>
          <h2 className="fe-title" style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>
            Новый мир
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'flex-end' }}>
            <label className="fe-label">
              Ширина
              <input
                className="fe-input"
                type="number"
                min={MIN_WORLD}
                max={MAX_WORLD}
                value={sizeXInput}
                disabled={loading}
                onChange={(e) => setSizeXInput(e.target.value)}
                style={{ width: '5rem' }}
              />
            </label>
            <label className="fe-label">
              Высота
              <input
                className="fe-input"
                type="number"
                min={MIN_WORLD}
                max={MAX_WORLD}
                value={sizeYInput}
                disabled={loading}
                onChange={(e) => setSizeYInput(e.target.value)}
                style={{ width: '5rem' }}
              />
            </label>
            <button type="button" className="fe-btn fe-btn-primary" disabled={loading} onClick={() => void handleCreateWorld()}>
              Создать {effectiveSizeX}×{effectiveSizeY}
              {includeInNewWorld.size > 0 ? ` · ${includeInNewWorld.size}` : ''}
            </button>
          </div>
          <p className="fe-muted" style={{ margin: '0.65rem 0 0' }}>
            Отмеченные правители получат стартовые земли.
          </p>
        </section>
      </div>

      <section className="fe-panel" style={{ padding: '1rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <h2 className="fe-title" style={{ fontSize: '1rem', margin: 0 }}>
            Миры
          </h2>
          <button type="button" className="fe-btn" disabled={loading} onClick={onRefresh}>
            Обновить
          </button>
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          {worlds.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="fe-btn"
                style={
                  selectedWorldId === w.id
                    ? { borderColor: 'var(--fe-accent)', background: 'linear-gradient(180deg, #5a4820, #3a3010)' }
                    : undefined
                }
                onClick={() => setSelectedWorldId(w.id)}
              >
                #{w.id}
                {w.size ? ` (${w.size.width}×${w.size.height})` : ''}
              </button>
            </li>
          ))}
        </ul>
        {worlds.length === 0 && <p className="fe-muted">Миров пока нет.</p>}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem', alignItems: 'flex-end', marginTop: '1rem' }}>
          <label className="fe-label">
            Поселить в выбранный мир
            <select
              className="fe-select"
              value={attachPlayerId}
              disabled={loading || selectedWorldId == null}
              onChange={(e) => setAttachPlayerId(e.target.value)}
            >
              <option value="">— выберите —</option>
              {players.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  #{p.id} {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="fe-btn"
            disabled={loading || selectedWorldId == null || attachPlayerId === ''}
            onClick={() => void handleAttach()}
          >
            Поселить
          </button>
          <button
            type="button"
            className="fe-btn fe-btn-ok"
            disabled={loading || selectedWorldId == null}
            onClick={() => selectedWorldId != null && onEnterParty(selectedWorldId)}
          >
            В партию
          </button>
        </div>
      </section>
    </div>
  );
}

const lobbyWrap: CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  padding: '1.5rem 1.25rem 2.5rem',
};
