import { useCallback, useEffect, useState } from 'react';
import * as api from './api/client';
import type { Player, World } from './api/client';
import { LobbyScreen } from './screens/LobbyScreen';
import { PartyScreen } from './screens/PartyScreen';

type Screen = 'lobby' | 'party';

export function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [activeWorldId, setActiveWorldId] = useState<number | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshWorlds = useCallback(async () => {
    setWorlds(await api.getWorlds());
  }, []);

  const refreshPlayers = useCallback(async () => {
    setPlayers(await api.getPlayers());
  }, []);

  const refreshAll = useCallback(async () => {
    setError(null);
    await Promise.all([refreshWorlds(), refreshPlayers()]);
  }, [refreshWorlds, refreshPlayers]);

  useEffect(() => {
    refreshAll().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [refreshAll]);

  async function onCreatePlayer(name: string, level: number) {
    setLoading(true);
    setError(null);
    try {
      await api.createPlayer(name, level);
      await refreshPlayers();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function onCreateWorld(sizeX: number, sizeY: number, playerIds: number[]) {
    setLoading(true);
    setError(null);
    try {
      const w = await api.createWorld(sizeX, sizeY, playerIds.length > 0 ? playerIds : undefined);
      await refreshWorlds();
      return w.id;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function onAddPlayerToWorld(worldId: number, playerId: number) {
    setLoading(true);
    setError(null);
    try {
      await api.addPlayerToWorld(worldId, playerId);
      await refreshWorlds();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setLoading(false);
    }
  }

  if (screen === 'party' && activeWorldId != null) {
    return (
      <PartyScreen
        worldId={activeWorldId}
        players={players}
        onBackToLobby={() => {
          setScreen('lobby');
          setActiveWorldId(null);
          refreshAll().catch((e) => setError(e instanceof Error ? e.message : String(e)));
        }}
      />
    );
  }

  return (
    <LobbyScreen
      worlds={worlds}
      players={players}
      loading={loading}
      error={error}
      onCreatePlayer={onCreatePlayer}
      onCreateWorld={onCreateWorld}
      onAddPlayerToWorld={onAddPlayerToWorld}
      onRefresh={() => {
        refreshAll().catch((e) => setError(e instanceof Error ? e.message : String(e)));
      }}
      onEnterParty={(worldId) => {
        setActiveWorldId(worldId);
        setScreen('party');
      }}
    />
  );
}
