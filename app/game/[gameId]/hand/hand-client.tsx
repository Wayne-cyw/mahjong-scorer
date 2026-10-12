'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Seat } from '@/lib/tiles';
import { basePointsFor, settle } from '@/lib/scoring';
import { listPlayers } from '@/lib/db';
import { useGameStore } from '@/stores/game-store';
import { Button } from '@/components/ui/button';
import { WinnerPicker, type WinnerPickerResult } from '@/components/hand/winner-picker';
import { ManualFanEntry } from '@/components/hand/manual-fan-entry';
import { PaymentsPreview } from '@/components/hand/payments-preview';

const SEATS: readonly Seat[] = [0, 1, 2, 3];

export interface HandClientProps {
  gameId: string;
}

/**
 * The `/game/[gameId]/hand` flow (PD-09, PD-13, PD-14): tap the winner, then
 * self-drawn/discard, then (for a discard) the discarder, then enter fan
 * directly and review the payments preview before an explicit Confirm, which
 * is the only thing that appends a `HandWon` event. A Draw button appends
 * `HandDrawn` after its own confirmation. Cancelling at any point before that
 * appends nothing and returns to the table. A refused or failed write keeps
 * the user on this page with the reason shown and Cancel available; only a
 * failed load replaces the flow with a full-screen error.
 */
export function HandClient({ gameId }: HandClientProps) {
  const router = useRouter();
  const loadGame = useGameStore((s) => s.loadGame);
  const state = useGameStore((s) => s.state);
  const recordWin = useGameStore((s) => s.recordWin);
  const recordDraw = useGameStore((s) => s.recordDraw);
  const storeError = useGameStore((s) => s.error);
  const eventCount = useGameStore((s) => s.events.length);

  const [initializing, setInitializing] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [playerNames, setPlayerNames] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<WinnerPickerResult | null>(null);
  const [fan, setFan] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmingDraw, setConfirmingDraw] = useState(false);

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

  const playerIdsKey = state.playerIds.join(',');

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

  const playerIdBySeat = new Map<Seat, string>();
  for (const [playerId, seat] of Object.entries(state.seatOf)) {
    playerIdBySeat.set(seat, playerId);
  }
  const seatLabel = (seat: Seat): string => {
    const playerId = playerIdBySeat.get(seat);
    return (playerId && playerNames[playerId]) || `Player ${seat + 1}`;
  };

  const ruleset = state.ruleset;

  const goToTable = (): void => {
    router.push(`/game/${gameId}`);
  };

  const handleWinnerComplete = (result: WinnerPickerResult): void => {
    setSelection(result);
    setFan(0);
    setSubmitError(null);
  };

  const handleBackToWinner = (): void => {
    setSelection(null);
    setFan(0);
    setSubmitError(null);
  };

  /** A refused action resolves false and leaves its reason in the store's error. */
  const refusalMessage = (): string => useGameStore.getState().error ?? 'This hand was not saved.';

  const handleConfirm = async (): Promise<void> => {
    if (!selection || !ruleset) return;
    if (fan < ruleset.minFan || fan > ruleset.capFan) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const appended = await recordWin({
        winner: selection.winner,
        discarder: selection.discarder,
        fan,
      });
      if (!appended) {
        setSubmitError(refusalMessage());
        setSubmitting(false);
        return;
      }
      goToTable();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      setSubmitting(false);
    }
  };

  const handleDrawConfirmed = async (): Promise<void> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (!(await recordDraw())) {
        setSubmitError(refusalMessage());
        setSubmitting(false);
        return;
      }
      goToTable();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
      setSubmitting(false);
    } finally {
      setConfirmingDraw(false);
    }
  };

  if (initializing) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p>Loading game…</p>
      </main>
    );
  }

  if (loadFailed || eventCount === 0) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p role="alert">
          {loadFailed ? (storeError ?? 'Could not load this game.') : 'Game not found.'}
        </p>
        <Button type="button" onClick={goToTable} className="h-12 px-6 text-base">
          Back to table
        </Button>
      </main>
    );
  }

  if (state.status !== 'playing') {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
        <p>This game is not in progress, so no hand can be recorded.</p>
        <Button type="button" onClick={goToTable} className="h-12 px-6 text-base">
          Back to table
        </Button>
      </main>
    );
  }

  if (!ruleset) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p role="alert">No ruleset for this game.</p>
      </main>
    );
  }

  const canPreview = selection !== null && fan >= 1;
  const payments = canPreview
    ? settle({
        winner: selection.winner,
        discarder: selection.discarder,
        basePoints: basePointsFor(fan, ruleset),
        model: ruleset.payment,
      })
    : null;

  const canConfirm =
    selection !== null && fan >= ruleset.minFan && fan <= ruleset.capFan && !submitting;

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Hand over</h1>
        <Button
          type="button"
          variant="outline"
          onClick={goToTable}
          disabled={submitting}
          className="h-12 px-4 text-base"
        >
          Cancel
        </Button>
      </header>

      {submitError && (
        <p role="alert" className="text-destructive text-sm">
          {submitError}
        </p>
      )}

      {selection === null ? (
        <>
          <WinnerPicker seats={SEATS} seatLabel={seatLabel} onComplete={handleWinnerComplete} />

          <div className="border-border mt-2 flex flex-col gap-3 border-t pt-4">
            {!confirmingDraw ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setConfirmingDraw(true)}
                className="h-12 px-4 text-base"
              >
                Draw
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                <p>Record this hand as a draw?</p>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={() => void handleDrawConfirmed()}
                    disabled={submitting}
                    className="h-12 flex-1 px-4 text-base"
                  >
                    Confirm draw
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmingDraw(false)}
                    disabled={submitting}
                    className="h-12 flex-1 px-4 text-base"
                  >
                    Never mind
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-base">
            {seatLabel(selection.winner)} won
            {selection.discarder === undefined
              ? ' by self-draw'
              : ` off ${seatLabel(selection.discarder)}'s discard`}
            .
          </p>

          <ManualFanEntry
            fan={fan}
            minFan={ruleset.minFan}
            capFan={ruleset.capFan}
            onChange={setFan}
          />

          {payments && <PaymentsPreview payments={payments} seatLabel={seatLabel} />}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleBackToWinner}
              disabled={submitting}
              className="h-12 flex-1 px-4 text-base"
            >
              Back
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={!canConfirm}
              className="h-12 flex-1 px-4 text-base"
            >
              Confirm
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
