'use client';

import { useState } from 'react';
import { handLabel, seatWind } from '@/lib/game';
import type { Seat } from '@/lib/tiles';
import { useGameStore } from '@/stores/game-store';
import { Button } from '@/components/ui/button';
import { DicePanel } from '@/components/dice/dice-panel';
import { OverrideSheet, type OverrideValues } from './override-sheet';
import { seatNames } from './seat-names';
import { SeatCard, WIND_LABEL } from './seat-card';

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const ORIENTATIONS = [0, 90, 180, 270] as const;

export interface TableViewProps {
  /** Display name for each seated player, keyed by player id. Falls back to "Player N" when missing. */
  playerNames?: Record<string, string>;
  /** Invoked when "Hand over" is tapped; the caller navigates into the hand-over flow. */
  onHandOver?: () => void;
  /** Invoked when "History" is tapped; the caller navigates to the history screen. */
  onHistory?: () => void;
  /** Invoked after the game has been ended (manually or on completion). */
  onGameEnded?: () => void;
}

/**
 * The table screen: four seats, prevailing wind and hand counter, a rotate
 * control so the phone can face any seat (PD-06), hand-over/end-now buttons
 * and the dice panel (PD-07). "Hand over" delegates to `onHandOver` (wired by
 * the page to navigate into `/game/[gameId]/hand`, Task 10). "End now" asks
 * for confirmation before `endGame('manual')`; a completed game prompts
 * `endGame('completed')`. "Override" corrects dealer, wind and repeat (PD-17).
 */
export function TableView({
  playerNames = {},
  onHandOver,
  onHistory,
  onGameEnded,
}: TableViewProps) {
  const state = useGameStore((s) => s.state);
  const endGame = useGameStore((s) => s.endGame);
  const overrideState = useGameStore((s) => s.overrideState);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [orientationIndex, setOrientationIndex] = useState(0);
  const orientation = ORIENTATIONS[orientationIndex % ORIENTATIONS.length] ?? 0;

  const rotate = () => setOrientationIndex((i) => (i + 1) % ORIENTATIONS.length);

  const handleHandOver = () => {
    onHandOver?.();
  };

  const finish = async (reason: 'completed' | 'manual'): Promise<void> => {
    setActionError(null);
    try {
      await endGame(reason);
      setConfirmingEnd(false);
      onGameEnded?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const applyOverride = async (values: OverrideValues): Promise<void> => {
    setActionError(null);
    try {
      await overrideState(values);
      setOverriding(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const playerIdBySeat = new Map<Seat, string>();
  for (const [playerId, seat] of Object.entries(state.seatOf)) {
    playerIdBySeat.set(seat, playerId);
  }

  const names = seatNames(state.seatOf, playerNames);
  const { round, hand, repeat } = handLabel(state);
  const roundLabel = WIND_LABEL[round];

  return (
    <div
      data-testid="table-view-root"
      data-orientation={orientation}
      style={{ transform: `rotate(${orientation}deg)` }}
      className="flex w-full flex-col gap-4 p-4"
    >
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">
            {roundLabel.en} round ({roundLabel.zh}), hand {hand}, dealer repeat {repeat}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={rotate}
          className="h-12 min-w-[3rem] px-4 text-base"
          aria-label="Rotate table"
        >
          Rotate
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {SEATS.map((seat) => {
          const playerId = playerIdBySeat.get(seat);
          const name = (playerId && playerNames[playerId]) || `Player ${seat + 1}`;
          return (
            <SeatCard
              key={seat}
              seat={seat}
              name={name}
              score={state.scores[seat]}
              wind={seatWind(seat, state.dealer)}
              isDealer={seat === state.dealer}
              dealerRepeat={state.dealerRepeat}
            />
          );
        })}
      </div>

      <div className="flex gap-3">
        <Button type="button" onClick={handleHandOver} className="h-12 flex-1 px-4 text-base">
          Hand over
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmingEnd(true)}
          className="h-12 flex-1 px-4 text-base"
        >
          End now
        </Button>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onHistory}
          className="h-12 flex-1 px-4 text-base"
        >
          History
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setOverriding(true)}
          className="h-12 flex-1 px-4 text-base"
        >
          Override
        </Button>
      </div>

      {state.status === 'complete' && (
        <section className="border-border bg-card flex flex-col gap-2 rounded-lg border-2 p-4">
          <p className="text-lg font-semibold">Game complete — end game?</p>
          <Button type="button" onClick={() => void finish('completed')} className="h-12 text-base">
            End game
          </Button>
        </section>
      )}

      {confirmingEnd && (
        <section className="border-border bg-card flex flex-col gap-2 rounded-lg border-2 p-4">
          <p className="text-lg font-semibold">End the game now?</p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmingEnd(false)}
              className="h-12 flex-1 text-base"
            >
              Keep playing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void finish('manual')}
              className="h-12 flex-1 text-base"
            >
              Confirm end
            </Button>
          </div>
        </section>
      )}

      {overriding && (
        <OverrideSheet
          seatNames={names}
          initial={{
            dealer: state.dealer,
            prevailing: state.prevailing,
            dealerRepeat: state.dealerRepeat,
          }}
          onSubmit={applyOverride}
          onCancel={() => setOverriding(false)}
        />
      )}

      {actionError && (
        <p role="alert" className="text-red-700">
          {actionError}
        </p>
      )}

      <DicePanel />
    </div>
  );
}
