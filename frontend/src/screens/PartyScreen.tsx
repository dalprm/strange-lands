import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '../api/client';
import type { Player, Turn, WorldDetail } from '../api/client';
import { DungeonMaster } from '../components/DungeonMaster';
import { ProvinceMap } from '../components/ProvinceMap';
import { ProvincePanel } from '../components/ProvincePanel';
import { TurnBar } from '../components/TurnBar';
import type { DmMessage } from '../dm/messages';
import {
  dmBuilt,
  dmEndTurn,
  dmError,
  dmFog,
  dmMoved,
  dmRecruited,
  dmSelectProvince,
  dmTurn,
  dmWelcome,
} from '../dm/messages';
import { BUILDING_TYPE_LABEL, landOwnerLabel } from '../land/helpers';

type Props = {
  worldId: number;
  players: Player[];
  onBackToLobby: () => void;
};

export function PartyScreen({ worldId, players, onBackToLobby }: Props) {
  const [world, setWorld] = useState<WorldDetail | null>(null);
  const [turn, setTurn] = useState<Turn | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLandId, setSelectedLandId] = useState<number | null>(null);
  const [dm, setDm] = useState<DmMessage | null>(() => dmWelcome());
  const [recruitRequestId, setRecruitRequestId] = useState<number | null>(null);
  const [captureRequestId, setCaptureRequestId] = useState<number | null>(null);
  const lastTurnKey = useRef<string>('');

  const refresh = useCallback(async () => {
    const [w, t] = await Promise.all([api.getWorld(worldId), api.getCurrentTurn(worldId)]);
    setWorld(w);
    setTurn(t);
    const key = `${t.turnNumber}:${t.currentPlayerId ?? 'none'}`;
    if (lastTurnKey.current && lastTurnKey.current !== key) {
      const cur = t.currentPlayerId != null ? players.find((p) => p.id === t.currentPlayerId) : undefined;
      const name =
        cur?.name ?? (t.currentPlayerId != null ? `#${t.currentPlayerId}` : 'пустому престолу');
      setDm(dmTurn(name, t.turnNumber));
    }
    lastTurnKey.current = key;
  }, [worldId, players]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedLandId(null);
    lastTurnKey.current = '';
    refresh()
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const selectedLand =
    selectedLandId != null ? (world?.lands?.find((l) => l.id === selectedLandId) ?? null) : null;

  function handleSelectLand(id: number | null) {
    setSelectedLandId(id);
    if (id == null || world == null) return;
    const land = world.lands?.find((l) => l.id === id);
    if (land != null) {
      setDm(dmSelectProvince(landOwnerLabel(land) ?? `#${id}`));
    }
  }

  async function handleEndTurn() {
    setBusy(true);
    setError(null);
    try {
      const t = await api.executeTurn(worldId);
      await refresh();
      setDm(dmEndTurn(t.pendingActionsCount));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setDm(dmError(msg));
    } finally {
      setBusy(false);
    }
  }

  async function handleBuild(landId: number, buildingType: string, wallLevel?: number) {
    setBusy(true);
    setError(null);
    try {
      await api.buildBuilding(worldId, landId, buildingType, wallLevel);
      await refresh();
      const label = BUILDING_TYPE_LABEL[buildingType] ?? buildingType;
      setDm(dmBuilt(label));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setDm(dmError(msg));
    } finally {
      setBusy(false);
    }
  }

  function handleMapAction(kind: 'recruit' | 'move' | 'fog' | 'error', detail?: string) {
    if (kind === 'recruit') setDm(dmRecruited());
    else if (kind === 'move') setDm(dmMoved());
    else if (kind === 'fog') setDm(dmFog());
    else if (kind === 'error') setDm(dmError(detail ?? 'неизвестная ошибка'));
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr var(--fe-panel-width)',
        height: '100%',
        minHeight: '100vh',
        gap: 0,
      }}
      className="party-layout"
    >
      <main
        style={{
          padding: '0.75rem 0.85rem',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {error && <pre className="fe-error" style={{ marginBottom: '0.5rem' }}>{error}</pre>}
        <ProvinceMap
          world={world}
          currentPlayerId={turn?.currentPlayerId ?? null}
          selectedLandId={selectedLandId}
          loading={loading}
          onSelectLand={handleSelectLand}
          onWorldRefresh={refresh}
          onActionMessage={handleMapAction}
          recruitRequestId={recruitRequestId}
          captureRequestId={captureRequestId}
          onRecruitRequestHandled={() => setRecruitRequestId(null)}
          onCaptureRequestHandled={() => setCaptureRequestId(null)}
        />
      </main>
      <aside
        className="fe-panel"
        style={{
          padding: '0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          overflowY: 'auto',
          borderLeft: '2px solid var(--fe-panel-edge)',
          borderRadius: 0,
        }}
      >
        <TurnBar
          turn={turn}
          players={players}
          world={world}
          loading={busy || loading}
          onEndTurn={() => void handleEndTurn()}
          onBackToLobby={onBackToLobby}
        />
        <DungeonMaster message={dm} />
        <ProvincePanel
          world={world}
          land={selectedLand}
          currentPlayerId={turn?.currentPlayerId ?? null}
          loading={loading}
          busy={busy}
          onRecruit={(id) => setRecruitRequestId(id)}
          onCapture={(id) => setCaptureRequestId(id)}
          onBuild={(id, type, wall) => void handleBuild(id, type, wall)}
        />
      </aside>
      <style>{`
        @media (max-width: 840px) {
          .party-layout {
            grid-template-columns: 1fr !important;
            grid-template-rows: minmax(45vh, 1fr) auto;
          }
          .party-layout > aside {
            border-left: none !important;
            border-top: 2px solid var(--fe-panel-edge);
            max-height: 50vh;
          }
        }
      `}</style>
    </div>
  );
}
