'use client';

import { useState, type ReactNode } from 'react';
import { RotateCw } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import { handLabel, seatWind, wallToBreak } from '@/lib/game';
import type { Seat } from '@/lib/tiles';
import { useGameStore } from '@/stores/game-store';
import { Compass, SLOTS, seatAtSlot, type Slot } from '@/components/hk/compass';
import { Button } from '@/components/ui/button';
import { DicePanel } from '@/components/dice/dice-panel';
import { OverrideSheet, type OverrideValues } from './override-sheet';
import { RoundMarker } from './round-marker';
import { seatNames } from './seat-names';
import { SeatCard, WIND_LABEL } from './seat-card';

const ORIENTATIONS = [0, 90, 180, 270] as const;

/** The seat whose wall the last roll breaks, or null when there is no usable roll. */
function breakingSeat(dealer: Seat, total: number | undefined): Seat | null {
  if (total === undefined) return null;
  try {
    return wallToBreak(dealer, total);
  } catch {
    return null;
  }
}

const panel = {
  initial: { opacity: 0, y: 14, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 8 },
  transition: { type: 'spring', stiffness: 380, damping: 30 },
} as const;

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
 * The table screen: four seats around a centre marker with the prevailing wind and hand
 * counter, each seat turned to face its player. A rotate control brings the next seat to the
 * phone's own edge (PD-06); hand-over/end-now sit in a bar that stays under the thumb, and the
 * dice panel (PD-07) sits below the table. "Hand over" delegates to `onHandOver` (wired by
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
  const storeError = useGameStore((s) => s.error);
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
      // A refusal resolves false and sets the store's error, shown below.
      if (!(await endGame(reason))) return;
      setConfirmingEnd(false);
      onGameEnded?.();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error));
    }
  };

  const applyOverride = async (values: OverrideValues): Promise<void> => {
    setActionError(null);
    try {
      if (!(await overrideState(values))) return;
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
  const inProgress = state.status === 'playing';
  // Action failures and refusals (which set the store's error) show inline:
  // the table and its controls stay usable.
  const shownError = actionError ?? storeError;

  const rollTotal = state.lastRoll?.total;
  const breaking = inProgress ? breakingSeat(state.dealer, rollTotal) : null;

  const seatFor = (slot: Slot) => {
    const seat = seatAtSlot(slot, orientationIndex % 4);
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
        breaking={breaking === seat}
        compact={slot === 'left' || slot === 'right'}
      />
    );
  };

  const slots = Object.fromEntries(SLOTS.map((slot) => [slot, seatFor(slot)])) as Record<
    Slot,
    ReactNode
  >;

  return (
    <div
      data-testid="table-view-root"
      data-orientation={orientation}
      className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4"
    >
      <header className="flex items-center justify-between gap-3">
        <p className="font-display text-lg leading-tight font-black">
          {roundLabel.en} round ({roundLabel.zh}), hand {hand}, dealer repeat {repeat}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={rotate}
          className="size-12 shrink-0 px-0"
          aria-label="Rotate table"
        >
          <m.span
            key={orientationIndex}
            initial={{ rotate: -90 }}
            animate={{ rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="inline-flex"
          >
            <RotateCw className="size-6" aria-hidden="true" />
          </m.span>
        </Button>
      </header>

      <Compass
        slots={slots}
        center={<RoundMarker prevailing={round} hand={hand} repeat={repeat} />}
      />

      {inProgress && <DicePanel />}

      <AnimatePresence>
        {state.status === 'complete' && (
          <m.section
            key="complete"
            {...panel}
            className="bg-cream-raised flex flex-col gap-3 rounded-md p-4"
          >
            <p className="font-display text-xl font-black">Game complete — end game?</p>
            <Button
              type="button"
              onClick={() => void finish('completed')}
              className="h-12 text-base"
            >
              End game
            </Button>
          </m.section>
        )}

        {confirmingEnd && (
          <m.section
            key="confirm-end"
            {...panel}
            className="bg-cream-raised flex flex-col gap-3 rounded-md p-4"
          >
            <p className="font-display text-xl font-black">End the game now?</p>
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
          </m.section>
        )}

        {overriding && (
          <m.div key="override" {...panel}>
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
          </m.div>
        )}
      </AnimatePresence>

      {shownError && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
          {shownError}
        </p>
      )}

      <div className="bg-background sticky bottom-0 -mx-4 mt-auto flex flex-col gap-3 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <span className="trim-canvas -mx-4 block h-2" aria-hidden="true" />
        {inProgress && (
          <Button
            type="button"
            onClick={handleHandOver}
            className="h-16 w-full px-4 text-2xl tracking-wide"
          >
            <span aria-hidden="true" className="font-display font-black">
              胡
            </span>
            Hand over
          </Button>
        )}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onHistory}
            className="h-12 flex-1 px-3 text-base"
          >
            History
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOverriding(true)}
            className="h-12 flex-1 px-3 text-base"
          >
            Override
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setConfirmingEnd(true)}
            className="h-12 flex-1 px-3 text-base"
          >
            End now
          </Button>
        </div>
      </div>
    </div>
  );
}
