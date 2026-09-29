'use client';

import { useState } from 'react';
import type { Seat } from '@/lib/tiles';
import { rollDie, tiedPlayers } from '@/lib/game';

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

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">First dealer</h2>

      {mode === 'choose' && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => setMode('app-roll')}
            disabled={disabled}
            className="min-h-12 rounded border border-neutral-500 px-4 font-medium disabled:opacity-50"
          >
            Roll in the app
          </button>
          <button
            type="button"
            onClick={() => setMode('physical')}
            disabled={disabled}
            className="min-h-12 rounded border border-neutral-500 px-4 font-medium disabled:opacity-50"
          >
            Enter a physical roll
          </button>
          <p className="text-sm text-neutral-600">Or tap a seat to choose directly:</p>
          <div className="flex flex-col gap-2">
            {players.map((p) => (
              <button
                key={p.seat}
                type="button"
                onClick={() => chooseSeat(p.seat)}
                disabled={disabled}
                className="min-h-12 rounded border border-neutral-400 px-4 text-left font-medium disabled:opacity-50"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'app-roll' && (
        <div className="flex flex-col gap-3">
          <p>
            {rerolling ? 'Tied — rolling again for: ' : 'Rolling for: '}
            {candidates.map(nameOf).join(', ')}
          </p>
          <button
            type="button"
            onClick={rollInApp}
            disabled={disabled}
            className="min-h-12 rounded border border-neutral-500 px-4 font-medium disabled:opacity-50"
          >
            Roll dice
          </button>
          <ul>
            {candidates.map((seat) => (
              <li key={seat}>
                {nameOf(seat)}: {lastRolls[seat] ?? '—'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'physical' && (
        <div className="flex flex-col gap-3">
          <p>
            {rerolling ? 'Tied — enter a new roll for: ' : 'Enter each roll (1-6): '}
            {rerolling ? candidates.map(nameOf).join(', ') : ''}
          </p>
          {candidates.map((seat) => (
            <div key={seat} className="flex items-center gap-3">
              <label htmlFor={`roll-${seat}`} className="w-32">
                {nameOf(seat)}
              </label>
              <input
                id={`roll-${seat}`}
                type="number"
                min={1}
                max={6}
                value={physicalInputs[seat] ?? ''}
                onChange={(event) =>
                  setPhysicalInputs((prev) => ({ ...prev, [seat]: event.target.value }))
                }
                disabled={disabled}
                className="min-h-12 w-20 rounded border border-neutral-400 px-3 disabled:opacity-50"
              />
            </div>
          ))}
          <button
            type="button"
            onClick={submitPhysical}
            disabled={disabled}
            className="min-h-12 rounded border border-neutral-500 px-4 font-medium disabled:opacity-50"
          >
            Submit rolls
          </button>
        </div>
      )}
    </div>
  );
}
