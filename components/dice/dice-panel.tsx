'use client';

import { useState, type FormEvent } from 'react';
import { breakPointStacks, seatWind, wallToBreak } from '@/lib/game';
import { useGameStore } from '@/stores/game-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  /** Runs a roll, surfacing a refusal or a failed write here instead of as an unhandled rejection. */
  const roll = async (args?: { physicalTotal: number }): Promise<void> => {
    try {
      const appended = await (args ? rollDice(args) : rollDice());
      if (appended === false) setError('The game is not in progress, so the dice were not rolled.');
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

  return (
    <section
      aria-label="Dice"
      className="border-border flex flex-col gap-3 rounded-lg border-2 p-4"
    >
      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" onClick={handleVirtualRoll} className="h-12 px-6 text-base">
          Roll dice
        </Button>
        <form onSubmit={handlePhysicalSubmit} noValidate className="flex items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="physical-total">Physical total</Label>
            <Input
              id="physical-total"
              type="number"
              inputMode="numeric"
              min={MIN_TOTAL}
              max={MAX_TOTAL}
              value={physicalTotal}
              onChange={(event) => setPhysicalTotal(event.target.value)}
              className="h-12 w-20 text-base"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-12 px-4 text-base">
            Use physical total
          </Button>
        </form>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {lastRoll && breakWind && stacks !== null && (
        <p className="text-sm">
          Total {lastRoll.total} — breaks {WIND_LABEL[breakWind].en} {WIND_LABEL[breakWind].zh}
          &apos;s wall, {stacks} {stacks === 1 ? 'stack' : 'stacks'} in.
        </p>
      )}
    </section>
  );
}
