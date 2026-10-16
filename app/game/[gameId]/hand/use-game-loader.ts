'use client';

import { useEffect, useState } from 'react';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';

export interface GameLoadStatus {
  initializing: boolean;
  loadFailed: boolean;
}

/** Loads the game into the store once per `gameId` and reports whether that is done or failed. */
export function useGameLoader(gameId: string): GameLoadStatus {
  const loadGame = useGameStore((s) => s.loadGame);
  const [initializing, setInitializing] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadGame(gameId)
      .then(
        () => {
          if (!cancelled) setLoadFailed(false);
        },
        () => {
          if (!cancelled) setLoadFailed(true);
        },
      )
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, loadGame]);

  return { initializing, loadFailed };
}

/** Looks up the display names of the given players, keyed by player id. */
export function usePlayerNames(playerIds: readonly string[]): Record<string, string> {
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
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

  return playerNames;
}
