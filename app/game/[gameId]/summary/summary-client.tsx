'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Standings } from '@/components/summary/standings';
import { seatNames } from '@/components/table/seat-names';
import { listPlayers } from '@/lib/db';
import { computeStandings, planRematch, startingPointsOf } from '@/lib/game';
import { DEFAULT_PRESET_ID } from '@/lib/scoring';
import type { Seat } from '@/lib/tiles';
import { useGameStore } from '@/stores/game-store';

export interface SummaryClientProps {
  gameId: string;
}

/**
 * End-of-game screen: standings, net result and rematch (PD-19). A rematch starts a new
 * game with the same four players in the same seats and the same preset; the previous
 * first dealer's neighbour deals first.
 */
export function SummaryClient({ gameId }: SummaryClientProps) {
  const router = useRouter();
  const loadGame = useGameStore((s) => s.loadGame);
  const createGame = useGameStore((s) => s.createGame);
  const assignSeats = useGameStore((s) => s.assignSeats);
  const chooseFirstDealer = useGameStore((s) => s.chooseFirstDealer);
  const state = useGameStore((s) => s.state);
  const events = useGameStore((s) => s.events);
  const storeError = useGameStore((s) => s.error);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [rematching, setRematching] = useState(false);
  const [rematchError, setRematchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadGame(gameId)
      .then(
        () => !cancelled && setLoadFailed(false),
        () => !cancelled && setLoadFailed(true),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [gameId, loadGame]);

  useEffect(() => {
    let cancelled = false;
    void listPlayers().then((players) => {
      if (cancelled) return;
      setPlayerNames(Object.fromEntries(players.map((p) => [p.id, p.name])));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startingPoints = startingPointsOf(events);

  if (loading) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p>Loading standings…</p>
      </main>
    );
  }

  if (loadFailed || events.length === 0 || startingPoints === null) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p role="alert">
          {loadFailed ? (storeError ?? 'Could not load this game.') : 'Game not found.'}
        </p>
        <Button type="button" onClick={() => router.push('/')} className="h-12 px-6 text-base">
          Home
        </Button>
      </main>
    );
  }

  const names = seatNames(state.seatOf, playerNames);
  const rows = computeStandings(state.scores, startingPoints).map((row) => ({
    ...row,
    name: names[row.seat] ?? `Player ${row.seat + 1}`,
  }));

  const rematch = async (): Promise<void> => {
    if (rematching) return;
    const plan = planRematch(state);
    if (!plan) {
      setRematchError('This game has no seating to reuse.');
      return;
    }
    const playerNamesBySeat = plan.playerIdsBySeat.map((id) => playerNames[id]);
    if (playerNamesBySeat.some((name) => !name)) {
      setRematchError('Player names are still loading. Try again in a moment.');
      return;
    }
    setRematching(true);
    setRematchError(null);
    try {
      const newId = await createGame({
        playerNames: playerNamesBySeat as string[],
        presetId: state.ruleset?.id ?? DEFAULT_PRESET_ID,
        startingPoints,
      });
      const playerIds = useGameStore.getState().state.playerIds;
      const seatOf: Record<string, Seat> = {};
      playerIds.forEach((id, i) => {
        seatOf[id] = i as Seat;
      });
      await assignSeats(seatOf);
      await chooseFirstDealer(plan.firstDealer);
      router.push(`/game/${newId}`);
    } catch (error) {
      setRematchError(error instanceof Error ? error.message : String(error));
      setRematching(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <Standings
        rows={rows}
        final={state.status === 'ended' || state.status === 'complete'}
        onRematch={() => void rematch()}
        onHome={() => router.push('/')}
        rematching={rematching}
        error={rematchError}
      />
    </main>
  );
}
