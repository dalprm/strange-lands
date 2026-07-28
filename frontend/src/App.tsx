import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import * as api from './api/client';
import type { Player, World, WorldDetail } from './api/client';
import { WorldGrid } from './WorldGrid';

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

function formatTurnLine(t: api.Turn, playerList: Player[], world: api.WorldDetail | null): string {
  const cur = t.currentPlayerId != null ? playerList.find((p) => p.id === t.currentPlayerId) : undefined;
  const who =
    cur != null
      ? `${cur.name} (#${cur.id})`
      : t.currentPlayerId != null
        ? `#${t.currentPlayerId}`
        : 'нет владельцев земель — добавьте игрока в мир';
  let line = `Раунд ${t.turnNumber}, ход: ${who}, в очереди: ${t.pendingActionsCount}`;
  if (t.currentPlayerId != null) {
    const key = String(t.currentPlayerId);
    const gold = world?.playerWorldResources?.[key]?.gold ?? 0;
    line += ` · золото: ${gold}`;
  }
  return line;
}

export function App() {
  const [worlds, setWorlds] = useState<World[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<number | null>(null);
  const [includeInNewWorld, setIncludeInNewWorld] = useState<Set<number>>(new Set());
  const [turnLabel, setTurnLabel] = useState<string>('');
  const [worldDetail, setWorldDetail] = useState<WorldDetail | null>(null);
  const [worldDetailLoading, setWorldDetailLoading] = useState(false);
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sizeXInput, setSizeXInput] = useState('4');
  const [sizeYInput, setSizeYInput] = useState('4');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerLevel, setNewPlayerLevel] = useState('1');
  const [attachPlayerId, setAttachPlayerId] = useState<string>('');

  const effectiveSizeX = clampWorldSize(parseOptionalSize(sizeXInput) ?? MIN_WORLD);
  const effectiveSizeY = clampWorldSize(parseOptionalSize(sizeYInput) ?? MIN_WORLD);

  function commitSizeInputs() {
    setSizeXInput(String(clampWorldSize(parseOptionalSize(sizeXInput) ?? MIN_WORLD)));
    setSizeYInput(String(clampWorldSize(parseOptionalSize(sizeYInput) ?? MIN_WORLD)));
  }

  const refreshWorlds = useCallback(async () => {
    setError(null);
    const list = await api.getWorlds();
    setWorlds(list);
    setSelectedWorldId((id) => (id != null && list.some((w) => w.id === id) ? id : null));
  }, []);

  const refreshPlayers = useCallback(async () => {
    setError(null);
    setPlayers(await api.getPlayers());
  }, []);

  useEffect(() => {
    Promise.all([refreshWorlds(), refreshPlayers()]).catch((e) => {
      setError(e instanceof Error ? e.message : String(e));
    });
  }, [refreshWorlds, refreshPlayers]);

  useEffect(() => {
    if (selectedWorldId == null) {
      setTurnLabel('');
      setWorldDetail(null);
      setCurrentTurnPlayerId(null);
      setWorldDetailLoading(false);
      return;
    }
    let cancelled = false;
    setWorldDetailLoading(true);
    Promise.all([api.getWorld(selectedWorldId), api.getCurrentTurn(selectedWorldId)])
      .then(([w, t]) => {
        if (!cancelled) {
          setWorldDetail(w);
          setCurrentTurnPlayerId(t.currentPlayerId ?? null);
          setTurnLabel(formatTurnLine(t, players, w));
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setWorldDetail(null);
          setCurrentTurnPlayerId(null);
          setTurnLabel(`не удалось загрузить мир / ход: ${e instanceof Error ? e.message : e}`);
        }
      })
      .finally(() => {
        if (!cancelled) setWorldDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedWorldId, players]);

  const refreshSelectedWorldMap = useCallback(async () => {
    if (selectedWorldId == null) return;
    setError(null);
    try {
      const [w, t] = await Promise.all([
        api.getWorld(selectedWorldId),
        api.getCurrentTurn(selectedWorldId),
      ]);
      setWorldDetail(w);
      setCurrentTurnPlayerId(t.currentPlayerId ?? null);
      setTurnLabel(formatTurnLine(t, players, w));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [selectedWorldId, players]);

  function toggleIncludePlayer(id: number) {
    setIncludeInNewWorld((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onCreatePlayer() {
    const name = newPlayerName.trim();
    if (!name) {
      setError('Введите имя игрока');
      return;
    }
    const level = Math.max(1, Number.parseInt(newPlayerLevel, 10) || 1);
    setLoading(true);
    setError(null);
    try {
      await api.createPlayer(name, level);
      setNewPlayerName('');
      setNewPlayerLevel('1');
      await refreshPlayers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onCreateWorld() {
    const sx = clampWorldSize(parseOptionalSize(sizeXInput) ?? MIN_WORLD);
    const sy = clampWorldSize(parseOptionalSize(sizeYInput) ?? MIN_WORLD);
    setSizeXInput(String(sx));
    setSizeYInput(String(sy));
    const ids = players.filter((p) => includeInNewWorld.has(p.id)).map((p) => p.id);
    setLoading(true);
    setError(null);
    try {
      const w = await api.createWorld(sx, sy, ids.length > 0 ? ids : undefined);
      await refreshWorlds();
      setSelectedWorldId(w.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onAddPlayerToSelectedWorld() {
    if (selectedWorldId == null || attachPlayerId === '') return;
    setLoading(true);
    setError(null);
    try {
      await api.addPlayerToWorld(selectedWorldId, Number(attachPlayerId));
      setAttachPlayerId('');
      await refreshWorlds();
      await refreshSelectedWorldMap();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onEndTurn() {
    if (selectedWorldId == null) return;
    setLoading(true);
    setError(null);
    try {
      await api.executeTurn(selectedWorldId);
      await Promise.all([refreshWorlds(), refreshSelectedWorldMap()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1100 }}>
      <h1 style={{ fontWeight: 600, fontSize: '1.5rem' }}>Fantasy</h1>
      <p style={{ opacity: 0.85, marginTop: 0 }}>
        Клиент на <strong>TypeScript</strong> + <strong>React</strong>. Запросы к <code>/api</code> проксируются на Spring Boot (:8080).
      </p>

      {error && (
        <pre
          style={{
            background: '#3d1a1a',
            color: '#ffb4b4',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          {error}
        </pre>
      )}

      <section style={sectionStyle}>
        <h2 style={h2Style}>Игроки</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', opacity: 0.8 }}>
          Создайте игрока, отметьте галочками, кого поселить в <strong>новом</strong> мире, или добавьте игрока в уже выбранный мир ниже.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <label style={labelStyle}>
            Имя
            <input
              type="text"
              value={newPlayerName}
              disabled={loading}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Например, Арагорн"
              style={{ ...inputStyle, width: '12rem' }}
            />
          </label>
          <label style={labelStyle}>
            Уровень
            <input
              type="number"
              min={1}
              value={newPlayerLevel}
              disabled={loading}
              onChange={(e) => setNewPlayerLevel(e.target.value)}
              style={inputStyle}
            />
          </label>
          <button type="button" disabled={loading} onClick={onCreatePlayer}>
            Создать игрока
          </button>
        </div>
        {players.length > 0 && (
          <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.25rem', listStyle: 'none' }}>
            {players.map((p) => (
              <li key={p.id} style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input
                    type="checkbox"
                    checked={includeInNewWorld.has(p.id)}
                    disabled={loading}
                    onChange={() => toggleIncludePlayer(p.id)}
                  />
                  <span>
                    <strong>#{p.id}</strong> {p.name} <span style={{ opacity: 0.7 }}>(ур. {p.level})</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {players.length === 0 && <p style={{ margin: '0.75rem 0 0', opacity: 0.7 }}>Пока нет игроков — добавьте первого.</p>}
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Новый мир</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <label style={labelStyle}>
            Ширина (X)
            <input
              type="number"
              min={MIN_WORLD}
              max={MAX_WORLD}
              value={sizeXInput}
              disabled={loading}
              onChange={(e) => setSizeXInput(e.target.value)}
              onBlur={commitSizeInputs}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            Высота (Y)
            <input
              type="number"
              min={MIN_WORLD}
              max={MAX_WORLD}
              value={sizeYInput}
              disabled={loading}
              onChange={(e) => setSizeYInput(e.target.value)}
              onBlur={commitSizeInputs}
              style={inputStyle}
            />
          </label>
          <button type="button" disabled={loading} onClick={onCreateWorld}>
            Создать мир {effectiveSizeX}×{effectiveSizeY}
            {includeInNewWorld.size > 0 ? ` · игроков: ${includeInNewWorld.size}` : ''}
          </button>
        </div>
        <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', opacity: 0.75 }}>
          Минимум {MIN_WORLD}×{MIN_WORLD}. Отмеченные игроки получат случайные свободные стартовые земли.
        </p>
      </section>

      <h2 style={{ fontSize: '1.1rem', marginTop: '1.5rem' }}>Миры</h2>
      <ul style={{ paddingLeft: '1.25rem' }}>
        {worlds.map((w) => (
          <li key={w.id} style={{ marginBottom: '0.35rem' }}>
            <button
              type="button"
              style={{
                background: selectedWorldId === w.id ? '#238636' : 'transparent',
                border: '1px solid #30363d',
                color: 'inherit',
                borderRadius: 6,
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
              }}
              onClick={() => setSelectedWorldId(w.id)}
            >
              #{w.id}
              {w.size ? ` (${w.size.width}×${w.size.height})` : ''}
            </button>
          </li>
        ))}
      </ul>
      {worlds.length === 0 && <p style={{ opacity: 0.7 }}>Пока нет миров — создайте первый.</p>}

      <section style={{ ...sectionStyle, marginTop: '1rem' }}>
        <h2 style={h2Style}>Выбранный мир</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <label style={labelStyle}>
            Добавить игрока
            <select
              value={attachPlayerId}
              disabled={loading || selectedWorldId == null}
              onChange={(e) => setAttachPlayerId(e.target.value)}
              style={{ ...inputStyle, width: 'auto', minWidth: '11rem' }}
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
            disabled={loading || selectedWorldId == null || attachPlayerId === ''}
            onClick={onAddPlayerToSelectedWorld}
          >
            Поселить на свободную землю
          </button>
        </div>
        {selectedWorldId == null && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', opacity: 0.7 }}>Сначала выберите мир в списке выше.</p>
        )}
      </section>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <button type="button" disabled={loading || selectedWorldId == null} onClick={onEndTurn}>
          Завершить ход
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => {
            refreshWorlds().catch((e) => setError(e instanceof Error ? e.message : String(e)));
            refreshPlayers().catch((e) => setError(e instanceof Error ? e.message : String(e)));
          }}
        >
          Обновить миры и игроков
        </button>
      </div>

      {selectedWorldId != null && (
        <p style={{ marginTop: '1rem', fontSize: '0.95rem' }}>
          Мир <strong>#{selectedWorldId}</strong>
          {turnLabel ? ` — ${turnLabel}` : null}
        </p>
      )}

      <WorldGrid
        world={worldDetail}
        currentPlayerId={currentTurnPlayerId}
        loading={worldDetailLoading}
        onWorldRefresh={refreshSelectedWorldMap}
      />
    </div>
  );
}

const sectionStyle: CSSProperties = {
  marginTop: '1.25rem',
  padding: '1rem',
  borderRadius: 8,
  border: '1px solid #30363d',
  background: '#161b22',
};

const h2Style: CSSProperties = { fontSize: '1rem', margin: '0 0 0.75rem', fontWeight: 600 };

const labelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  fontSize: '0.875rem',
};

const inputStyle: CSSProperties = {
  width: '5.5rem',
  padding: '0.45rem 0.5rem',
  borderRadius: 6,
  border: '1px solid #30363d',
  background: '#0d1117',
  color: '#e6edf3',
  fontSize: '1rem',
};
