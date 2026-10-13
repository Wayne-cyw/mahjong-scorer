'use client';

import { useState, type FormEvent } from 'react';
import { breakPointStacks, seatWind, wallToBreak } from '@/lib/game';
import { useGameStore } from '@/stores/game-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Die } from './die';
import { WIND_LABEL } from '@/components/table/seat-card';

const MIN_TOTAL = 3;
const MAX_TOTAL = 18;

/**
 * Dice roller: a virtual roll or a physical total entered by hand, showing
 * the total, which seat's wall breaks and the stack count — all derived from
 * the roll, never stored separately (PD-07, ADR-30/31).
 */
export function DicePanel() {
  const dealer = useGameStore((s) => s.state.dealer);
  const lastRoll = useGameStore((s) => s.state.lastRoll);
  const rollDice = useGameStore((s) => s.rollDice);
  const [physicalTotal, setPhysicalTotal] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Counts throws made on this screen, so dice already on the table do not replay on mount.
  const [throws, setThrows] = useState(0);

  /** Runs a roll, surfacing a refusal or a failed write here instead of as an unhandled rejection. */
  const roll = async (args?: { physicalTotal: number }): Promise<void> => {
    try {
      const appended = await (args ? rollDice(args) : rollDice());
      if (appended === false) setError('The game is not in progress, so the dice were not rolled.');
      else setThrows((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleVirtualRoll = () => {
    setError(null);
    void roll();
  };

  const handlePhysicalSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const total = Number(physicalTotal);
    if (!Number.isInteger(total) || total < MIN_TOTAL || total > MAX_TOTAL) {
      setError(`Enter a total between ${MIN_TOTAL} and ${MAX_TOTAL}.`);
      return;
    }
    setError(null);
    void roll({ physicalTotal: total });
    setPhysicalTotal('');
  };

  const breakSeat = lastRoll ? wallToBreak(dealer, lastRoll.total) : null;
  const breakWind = breakSeat !== null ? seatWind(breakSeat, dealer) : null;
  const stacks = lastRoll ? breakPointStacks(lastRoll.total) : null;

  const dice = lastRoll?.dice ?? [];

  return (
    <section aria-label="Dice" className="bg-felt-raised flex flex-col gap-4 rounded-md p-4">
      <div className="flex items-stretch gap-3">
        <div className="bg-felt-deep flex min-h-[5.5rem] flex-1 items-center justify-center gap-2.5 rounded-md">
          {dice.length === 3 ? (
            dice.map((value, i) => (
              <Die key={`${throws}-${i}`} value={value} index={i} tumble={throws > 0} />
            ))
          ) : lastRoll ? (
            <span className="numerals text-5xl" aria-hidden="true">
              {lastRoll.total}
            </span>
          ) : (
            <span className="font-display text-ivory-dim text-2xl font-black" aria-hidden="true">
              骰
            </span>
          )}
        </div>
        <Button type="button" onClick={handleVirtualRoll} className="h-auto w-28 px-3 text-lg">
          Roll dice
        </Button>
      </div>

      <form onSubmit={handlePhysicalSubmit} noValidate className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="physical-total" className="text-ivory-dim">
            Physical total
          </Label>
          <Input
            id="physical-total"
            type="number"
            inputMode="numeric"
            min={MIN_TOTAL}
            max={MAX_TOTAL}
            value={physicalTotal}
            onChange={(event) => setPhysicalTotal(event.target.value)}
            className="h-12 text-lg"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-12 px-4 text-base">
          Use physical total
        </Button>
      </form>

      {error && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 text-sm font-medium">
          {error}
        </p>
      )}

      {lastRoll && breakWind && stacks !== null && (
        <p className="text-base">
          Total {lastRoll.total} — breaks {WIND_LABEL[breakWind].en} {WIND_LABEL[breakWind].zh}
          &apos;s wall, {stacks} {stacks === 1 ? 'stack' : 'stacks'} in.
        </p>
      )}
    </section>
  );
}
