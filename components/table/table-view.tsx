'use client';

import { useState } from 'react';
import { handLabel, seatWind } from '@/lib/game';
import type { Seat } from '@/lib/tiles';
import { useGameStore } from '@/stores/game-store';
import { Button } from '@/components/ui/button';
import { DicePanel } from '@/components/dice/dice-panel';
import { SeatCard, WIND_LABEL } from './seat-card';

const SEATS: readonly Seat[] = [0, 1, 2, 3];
const ORIENTATIONS = [0, 90, 180, 270] as const;

export interface TableViewProps {
  /** Display name for each seated player, keyed by player id. Falls back to "Player N" when missing. */
  playerNames?: Record<string, string>;
}

/**
 * The table screen: four seats, prevailing wind and hand counter, a rotate
 * control so the phone can face any seat (PD-06), hand-over/end-now buttons
 * (placeholders wired by Tasks 10 and 11) and the dice panel (PD-07).
 */
export function TableView({ playerNames = {} }: TableViewProps) {
  const state = useGameStore((s) => s.state);
  const [orientationIndex, setOrientationIndex] = useState(0);
  const orientation = ORIENTATIONS[orientationIndex % ORIENTATIONS.length] ?? 0;

  const rotate = () => setOrientationIndex((i) => (i + 1) % ORIENTATIONS.length);

  // TODO(Task 10): replace with navigation into the real hand-over flow (winner/discarder/fan entry).
  const handleHandOver = () => {
    // Placeholder until Task 10 wires the hand-over flow.
  };

  // TODO(Task 11): replace with a confirmation step that calls `endGame('manual')`.
  const handleEndNow = () => {
    // Placeholder until Task 11 wires the end-game flow.
  };

  const playerIdBySeat = new Map<Seat, string>();
  for (const [playerId, seat] of Object.entries(state.seatOf)) {
    playerIdBySeat.set(seat, playerId);
  }

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
          onClick={handleEndNow}
          className="h-12 flex-1 px-4 text-base"
        >
          End now
        </Button>
      </div>

      <DicePanel />
    </div>
  );
}
