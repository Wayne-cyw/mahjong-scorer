'use client';

import { useState } from 'react';
import type { Seat } from '@/lib/tiles';
import { rollDie, tiedPlayers } from '@/lib/game';
import { Button } from '@/components/ui/button';
import { Die } from '@/components/dice/die';

export interface FirstDealerPlayer {
  seat: Seat;
  name: string;
}

export interface FirstDealerProps {
  /** The four players, in seat order. */
  players: readonly FirstDealerPlayer[];
  onChosen: (seat: Seat) => void;
  /** True while a choice is being submitted; disables every interactive control to block double-taps. */
  disabled?: boolean;
}

type Mode = 'choose' | 'app-roll' | 'physical';

/**
 * Given the seats still in contention and one roll per seat (same order), returns the seats
 * tied for the highest roll — the seats that roll again. A single element is the winner
 * (PD-05; ties re-roll only among tied players, ADR-32).
 */
export function nextCandidates(candidates: readonly Seat[], rolls: readonly number[]): Seat[] {
  const tiedIndexes = tiedPlayers([...rolls]);
  return tiedIndexes.map((i) => candidates[i]!);
}

const WIND_GLYPH = ['東', '南', '西', '北'] as const;

const emptyRollMap = (): Partial<Record<Seat, number>> => ({});
const emptyInputMap = (): Partial<Record<Seat, string>> => ({});

/**
 * The first-dealer step: roll in the app, enter a physical roll, or tap a seat directly
 * (PD-05). Both rolling methods re-roll only the players tied for the top roll.
 */
export function FirstDealer({ players, onChosen, disabled = false }: FirstDealerProps) {
  const [mode, setMode] = useState<Mode>('choose');
  const [candidates, setCandidates] = useState<Seat[]>(players.map((p) => p.seat));
  const [lastRolls, setLastRolls] = useState<Partial<Record<Seat, number>>>(emptyRollMap());
  const [rollRound, setRollRound] = useState(0);
  const [physicalInputs, setPhysicalInputs] =
    useState<Partial<Record<Seat, string>>>(emptyInputMap());

  const nameOf = (seat: Seat): string =>
    players.find((p) => p.seat === seat)?.name ?? `Seat ${seat + 1}`;

  /** Reports the chosen seat, unless a submission is already in flight (guards double-taps). */
  function chooseSeat(seat: Seat): void {
    if (disabled) return;
    onChosen(seat);
  }

  function settleRound(rolls: number[]): void {
    const winners = nextCandidates(candidates, rolls);
    const rollMap: Partial<Record<Seat, number>> = { ...lastRolls };
    candidates.forEach((seat, i) => {
      rollMap[seat] = rolls[i];
    });
    setLastRolls(rollMap);
    setRollRound((n) => n + 1);
    if (winners.length === 1) {
      chooseSeat(winners[0]!);
      return;
    }
    setCandidates(winners);
    setPhysicalInputs(emptyInputMap());
  }

  function rollInApp(): void {
    if (disabled) return;
    const rolls = candidates.map(() => rollDie());
    settleRound(rolls);
  }

  function submitPhysical(): void {
    if (disabled) return;
    const rolls = candidates.map((seat) => Number(physicalInputs[seat]));
    if (rolls.some((r) => !Number.isInteger(r) || r < 1 || r > 6)) return;
    settleRound(rolls);
  }

  const rerolling = candidates.length < players.length;
  const inputClass =
    'bg-felt-deep border-felt-deep text-foreground focus-visible:border-sign focus-visible:bg-felt h-14 w-20 rounded-md border-b-4 px-3 text-center text-xl font-bold outline-none disabled:opacity-50';

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-black">First dealer</h2>

      {mode === 'choose' && (
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            onClick={() => setMode('app-roll')}
            disabled={disabled}
            className="h-14 px-4 text-lg"
          >
            Roll in the app
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setMode('physical')}
            disabled={disabled}
            className="h-14 px-4 text-lg"
          >
            Enter a physical roll
          </Button>
          <p className="text-ivory-dim mt-2 text-base">Or tap a seat to choose directly:</p>
          <div className="grid grid-cols-2 gap-3">
            {players.map((p) => (
              <Button
                key={p.seat}
                type="button"
                variant="secondary"
                onClick={() => chooseSeat(p.seat)}
                disabled={disabled}
                className="font-display h-16 min-w-0 justify-start gap-3 px-3 text-lg font-black"
              >
                <span
                  aria-hidden="true"
                  className="bg-ivory text-lacquer grid size-10 shrink-0 place-items-center rounded-sm text-2xl leading-none"
                >
                  {WIND_GLYPH[p.seat]}
                </span>
                <span className="truncate">{p.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {mode === 'app-roll' && (
        <div className="flex flex-col gap-4">
          <p className="text-base">
            {rerolling ? 'Tied — rolling again for: ' : 'Rolling for: '}
            {candidates.map(nameOf).join(', ')}
          </p>
          <Button
            type="button"
            onClick={rollInApp}
            disabled={disabled}
            className="h-14 px-4 text-lg"
          >
            Roll dice
          </Button>
          <ul className="flex flex-col gap-2">
            {candidates.map((seat) => (
              <li
                key={seat}
                className="bg-felt-raised flex min-h-16 items-center justify-between gap-3 rounded-md px-4"
              >
                <span className="font-display text-lg font-black">
                  {nameOf(seat)}: {lastRolls[seat] ?? '—'}
                </span>
                {lastRolls[seat] !== undefined && (
                  <Die key={`${seat}-${rollRound}`} value={lastRolls[seat]!} index={seat} tumble />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'physical' && (
        <div className="flex flex-col gap-3">
          <p className="text-base">
            {rerolling ? 'Tied — enter a new roll for: ' : 'Enter each roll (1-6): '}
            {rerolling ? candidates.map(nameOf).join(', ') : ''}
          </p>
          {candidates.map((seat) => (
            <div key={seat} className="flex items-center justify-between gap-3">
              <label htmlFor={`roll-${seat}`} className="font-display text-lg font-black">
                {nameOf(seat)}
              </label>
              <input
                id={`roll-${seat}`}
                type="number"
                inputMode="numeric"
                min={1}
                max={6}
                value={physicalInputs[seat] ?? ''}
                onChange={(event) =>
                  setPhysicalInputs((prev) => ({ ...prev, [seat]: event.target.value }))
                }
                disabled={disabled}
                className={inputClass}
              />
            </div>
          ))}
          <Button
            type="button"
            onClick={submitPhysical}
            disabled={disabled}
            className="h-14 px-4 text-lg"
          >
            Submit rolls
          </Button>
        </div>
      )}
    </div>
  );
}
