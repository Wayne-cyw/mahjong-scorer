'use client';

import { useState } from 'react';
import type { Seat } from '@/lib/tiles';
import { rollDie, tiedPlayers } from '@/lib/game';
import { Button } from '@/components/ui/button';
import { Die } from '@/components/dice/die';
import { GlyphTile } from '@/components/hk/glyph-tile';

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
type RollMap = Partial<Record<Seat, number>>;
type InputMap = Partial<Record<Seat, string>>;

/** Faces of one die; a physical roll outside this range is rejected. */
const DIE_MIN = 1;
const DIE_MAX = 6;

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

const isDieFace = (roll: number): boolean =>
  Number.isInteger(roll) && roll >= DIE_MIN && roll <= DIE_MAX;

const INPUT_CLASS =
  'bg-cream-deep border-cream-edge text-foreground focus-visible:border-sign focus-visible:bg-cream h-14 w-20 rounded-md border-b-4 px-3 text-center text-xl font-bold outline-none disabled:opacity-50';

/**
 * Roll-off state: who is still in contention, their latest rolls and any typed physical
 * rolls. Each settled round either reports the single winner or narrows to the tied seats.
 */
function useRollOff(
  players: readonly FirstDealerPlayer[],
  chooseSeat: (seat: Seat) => void,
  disabled: boolean,
) {
  const [candidates, setCandidates] = useState<Seat[]>(players.map((p) => p.seat));
  const [lastRolls, setLastRolls] = useState<RollMap>({});
  const [rollRound, setRollRound] = useState(0);
  const [physicalInputs, setPhysicalInputs] = useState<InputMap>({});

  function settleRound(rolls: number[]): void {
    const winners = nextCandidates(candidates, rolls);
    const rollMap: RollMap = { ...lastRolls };
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
    setPhysicalInputs({});
  }

  function rollInApp(): void {
    if (disabled) return;
    settleRound(candidates.map(() => rollDie()));
  }

  function submitPhysical(): void {
    if (disabled) return;
    const rolls = candidates.map((seat) => Number(physicalInputs[seat]));
    if (!rolls.every(isDieFace)) return;
    settleRound(rolls);
  }

  const setPhysicalInput = (seat: Seat, value: string): void =>
    setPhysicalInputs((prev) => ({ ...prev, [seat]: value }));

  return {
    candidates,
    lastRolls,
    rollRound,
    physicalInputs,
    rerolling: candidates.length < players.length,
    rollInApp,
    submitPhysical,
    setPhysicalInput,
  };
}

function ChooseMethod({
  players,
  disabled,
  onMode,
  onChoose,
}: {
  players: readonly FirstDealerPlayer[];
  disabled: boolean;
  onMode: (mode: Mode) => void;
  onChoose: (seat: Seat) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        onClick={() => onMode('app-roll')}
        disabled={disabled}
        className="h-14 px-4 text-lg"
      >
        Roll in the app
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => onMode('physical')}
        disabled={disabled}
        className="h-14 px-4 text-lg"
      >
        Enter a physical roll
      </Button>
      <p className="text-ink-dim mt-2 text-base">Or tap a seat to choose directly:</p>
      <div className="grid grid-cols-2 gap-3">
        {players.map((p) => (
          <Button
            key={p.seat}
            type="button"
            variant="secondary"
            onClick={() => onChoose(p.seat)}
            disabled={disabled}
            className="font-display h-16 min-w-0 justify-start gap-3 px-3 text-lg font-black"
          >
            <GlyphTile glyph={WIND_GLYPH[p.seat]} size="sm" />
            <span className="truncate">{p.name}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

function AppRoll({
  candidates,
  lastRolls,
  rollRound,
  rerolling,
  disabled,
  nameOf,
  onRoll,
}: {
  candidates: readonly Seat[];
  lastRolls: RollMap;
  rollRound: number;
  rerolling: boolean;
  disabled: boolean;
  nameOf: (seat: Seat) => string;
  onRoll: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-base">
        {rerolling ? 'Tied — rolling again for: ' : 'Rolling for: '}
        {candidates.map(nameOf).join(', ')}
      </p>
      <Button type="button" onClick={onRoll} disabled={disabled} className="h-14 px-4 text-lg">
        Roll dice
      </Button>
      <ul className="flex flex-col gap-2">
        {candidates.map((seat) => (
          <li
            key={seat}
            className="bg-cream-raised flex min-h-16 items-center justify-between gap-3 rounded-md px-4"
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
  );
}

function PhysicalRoll({
  candidates,
  inputs,
  rerolling,
  disabled,
  nameOf,
  onInput,
  onSubmit,
}: {
  candidates: readonly Seat[];
  inputs: InputMap;
  rerolling: boolean;
  disabled: boolean;
  nameOf: (seat: Seat) => string;
  onInput: (seat: Seat, value: string) => void;
  onSubmit: () => void;
}) {
  return (
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
            min={DIE_MIN}
            max={DIE_MAX}
            value={inputs[seat] ?? ''}
            onChange={(event) => onInput(seat, event.target.value)}
            disabled={disabled}
            className={INPUT_CLASS}
          />
        </div>
      ))}
      <Button type="button" onClick={onSubmit} disabled={disabled} className="h-14 px-4 text-lg">
        Submit rolls
      </Button>
    </div>
  );
}

/**
 * The first-dealer step: roll in the app, enter a physical roll, or tap a seat directly
 * (PD-05). Both rolling methods re-roll only the players tied for the top roll.
 */
export function FirstDealer({ players, onChosen, disabled = false }: FirstDealerProps) {
  const [mode, setMode] = useState<Mode>('choose');

  /** Reports the chosen seat, unless a submission is already in flight (guards double-taps). */
  function chooseSeat(seat: Seat): void {
    if (disabled) return;
    onChosen(seat);
  }

  const rollOff = useRollOff(players, chooseSeat, disabled);

  const nameOf = (seat: Seat): string =>
    players.find((p) => p.seat === seat)?.name ?? `Seat ${seat + 1}`;

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-black">First dealer</h2>

      {mode === 'choose' && (
        <ChooseMethod
          players={players}
          disabled={disabled}
          onMode={setMode}
          onChoose={chooseSeat}
        />
      )}

      {mode === 'app-roll' && (
        <AppRoll
          candidates={rollOff.candidates}
          lastRolls={rollOff.lastRolls}
          rollRound={rollOff.rollRound}
          rerolling={rollOff.rerolling}
          disabled={disabled}
          nameOf={nameOf}
          onRoll={rollOff.rollInApp}
        />
      )}

      {mode === 'physical' && (
        <PhysicalRoll
          candidates={rollOff.candidates}
          inputs={rollOff.physicalInputs}
          rerolling={rollOff.rerolling}
          disabled={disabled}
          nameOf={nameOf}
          onInput={rollOff.setPhysicalInput}
          onSubmit={rollOff.submitPhysical}
        />
      )}
    </div>
  );
}
