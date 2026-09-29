'use client';

import { useEffect, useState } from 'react';
import { TableView } from '@/components/table/table-view';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';

export interface GameClientProps {
  gameId: string;
}

/** Client shell for the table screen: loads the game's events on mount (ADR-02). */
export function GameClient({ gameId }: GameClientProps) {
  const loadGame = useGameStore((s) => s.loadGame);
  const error = useGameStore((s) => s.error);
  const playerIds = useGameStore((s) => s.state.playerIds);
  const [initializing, setInitializing] = useState(true);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void loadGame(gameId).finally(() => {
      if (!cancelled) setInitializing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, loadGame]);

  const playerIdsKey = playerIds.join(',');

  useEffect(() => {
    const ids = playerIdsKey.split(',').filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    void listPlayers().then((players) => {
      if (cancelled) return;
      const known = new Set(ids);
      const names: Record<string, string> = {};
      for (const player of players) {
        if (known.has(player.id)) names[player.id] = player.name;
      }
      setPlayerNames(names);
    });
    return () => {
      cancelled = true;
    };
  }, [playerIdsKey]);

  if (initializing) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p>Loading game…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p role="alert">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <TableView playerNames={playerNames} />
    </main>
  );
}
