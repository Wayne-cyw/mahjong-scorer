'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';
import { HandList } from '@/components/history/hand-list';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/hk/screen';
import { StatusScreen } from '@/components/hk/status-screen';

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
      <StatusScreen>
        <p>Loading history…</p>
      </StatusScreen>
    );
  }

  return (
    <Screen
      title="History"
      glyph="譜"
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/game/${gameId}`)}
          className="h-11 px-3 text-base"
        >
          Back to table
        </Button>
      }
    >
      {storeError && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
          {storeError}
        </p>
      )}
      <HandList playerNames={playerNames} />
    </Screen>
  );
}
