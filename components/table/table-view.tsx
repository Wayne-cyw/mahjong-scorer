'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { handLabel, seatWind, wallToBreak } from '@/lib/game';
import type { Seat } from '@/lib/tiles';
import { useGameStore } from '@/stores/game-store';
import { Compass, SLOTS, seatAtSlot, type Slot } from '@/components/hk/compass';
import { Button } from '@/components/ui/button';
import { DicePanel } from '@/components/dice/dice-panel';
import { OverrideSheet } from './override-sheet';
import { RoundMarker } from './round-marker';
import { seatNames } from './seat-names';
import { SeatCard, WIND_LABEL } from './seat-card';
import { ActionBar, PanelSection, RotateButton, panelMotion } from './table-parts';
import { useTableActions } from './use-table-actions';

/** Table rotations in degrees, one per seat; each tap of "Rotate" advances one step. */
const ORIENTATION_DEGREES = [0, 90, 180, 270] as const;
const ORIENTATION_STEPS = ORIENTATION_DEGREES.length;

/** The seat whose wall the last roll breaks, or null when there is no usable roll. */
function breakingSeat(dealer: Seat, total: number | undefined): Seat | null {
  if (total === undefined) return null;
  try {
    return wallToBreak(dealer, total);
  } catch {
    return null;
  }
}

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
  const storeError = useGameStore((s) => s.error);
  const {
    confirmingEnd,
    setConfirmingEnd,
    overriding,
    setOverriding,
    actionError,
    finish,
    applyOverride,
  } = useTableActions(onGameEnded);
  const [orientationIndex, setOrientationIndex] = useState(0);
  const step = orientationIndex % ORIENTATION_STEPS;
  const orientation = ORIENTATION_DEGREES[step] ?? 0;

  const rotate = () => setOrientationIndex((i) => (i + 1) % ORIENTATION_STEPS);

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
    const seat = seatAtSlot(slot, step);
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
      className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 md:max-w-3xl lg:max-w-6xl lg:px-8 lg:pt-8"
    >
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,36rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <div className="flex flex-col gap-4">
          <header className="flex items-center justify-between gap-3">
            <p className="font-display text-lg leading-tight font-black">
              {roundLabel.en} round ({roundLabel.zh}), hand {hand}, dealer repeat {repeat}
            </p>
            <RotateButton turn={orientationIndex} onRotate={rotate} />
          </header>

          <Compass
            slots={slots}
            center={<RoundMarker prevailing={round} hand={hand} repeat={repeat} />}
          />
        </div>

        <div className="flex flex-col gap-4">
          {inProgress && <DicePanel />}

          <AnimatePresence>
            {state.status === 'complete' && (
              <PanelSection key="complete">
                <p className="font-display text-xl font-black">Game complete — end game?</p>
                <Button
                  type="button"
                  onClick={() => void finish('completed')}
                  className="h-12 text-base"
                >
                  End game
                </Button>
              </PanelSection>
            )}

            {confirmingEnd && (
              <PanelSection key="confirm-end">
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
              </PanelSection>
            )}

            {overriding && (
              <m.div key="override" {...panelMotion}>
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
        </div>
      </div>

      <ActionBar
        inProgress={inProgress}
        onHandOver={onHandOver}
        onHistory={onHistory}
        onOverride={() => setOverriding(true)}
        onEndNow={() => setConfirmingEnd(true)}
      />
    </div>
  );
}
