'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';
import { HandList } from '@/components/history/hand-list';
import { Button } from '@/components/ui/button';

export interface HistoryClientProps {
  gameId: string;
}

/** The `/game/[gameId]/history` screen: effective hands with Undo and Edit (PD-15). */
export function HistoryClient({ gameId }: HistoryClientProps) {
  const router = useRouter();
  const loadGame = useGameStore((s) => s.loadGame);
  const playerIds = useGameStore((s) => s.state.playerIds);
  const storeError = useGameStore((s) => s.error);
  const [initializing, setInitializing] = useState(true);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void loadGame(gameId)
      .catch(() => undefined)
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
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p>Loading history…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">History</h1>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/game/${gameId}`)}
          className="h-12 px-4 text-base"
        >
          Back to table
        </Button>
      </header>
      {storeError && (
        <p role="alert" className="text-red-700">
          {storeError}
        </p>
      )}
      <HandList playerNames={playerNames} />
    </main>
  );
}
