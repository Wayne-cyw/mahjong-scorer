'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StatusScreen } from '@/components/hk/status-screen';
import { InstallNudge } from '@/components/settings/install-nudge';
import { TableView } from '@/components/table/table-view';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';

export interface GameClientProps {
  gameId: string;
}

/**
 * Client shell for the table screen: loads the game's events on mount (ADR-02).
 * Only a failed load (or a game with no events) replaces the table with a
 * full-screen error; errors from actions on a loaded game show inline, so the
 * table and its controls (e.g. End game) always stay reachable.
 */
export function GameClient({ gameId }: GameClientProps) {
  const router = useRouter();
  const loadGame = useGameStore((s) => s.loadGame);
  const error = useGameStore((s) => s.error);
  const eventCount = useGameStore((s) => s.events.length);
  const playerIds = useGameStore((s) => s.state.playerIds);
  const [initializing, setInitializing] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});

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
      <StatusScreen>
        <p>Loading game…</p>
      </StatusScreen>
    );
  }

  if (loadFailed || eventCount === 0) {
    return (
      <StatusScreen>
        <p role="alert">
          {loadFailed ? (error ?? 'Could not load this game.') : 'Game not found.'}
        </p>
        <Button type="button" onClick={() => router.push('/')} className="h-12 px-6 text-base">
          Home
        </Button>
      </StatusScreen>
    );
  }

  return (
    <main className="min-h-dvh">
      <InstallNudge />
      <TableView
        playerNames={playerNames}
        onHandOver={() => router.push(`/game/${gameId}/hand`)}
        onHistory={() => router.push(`/game/${gameId}/history`)}
        onGameEnded={() => router.push(`/game/${gameId}/summary`)}
      />
    </main>
  );
}
