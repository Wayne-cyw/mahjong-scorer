'use client';

import { Button } from '@/components/ui/button';

export interface ManualFanEntryProps {
  fan: number;
  minFan: number;
  capFan: number;
  onChange: (fan: number) => void;
}

/**
 * Direct fan entry (this phase's only scoring path; ADR-40): a stepper from 0
 * up to `capFan`, with Confirm gated elsewhere on reaching `minFan`. Phase 2
 * replaces this with the tile review screen.
 */
export function ManualFanEntry({ fan, minFan, capFan, onChange }: ManualFanEntryProps) {
  const decrement = (): void => onChange(Math.max(0, fan - 1));
  const increment = (): void => onChange(Math.min(capFan, fan + 1));
  const belowMinimum = fan < minFan;

  return (
    <section aria-label="Fan" className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={decrement}
          disabled={fan <= 0}
          aria-label="Decrease fan"
          className="h-12 w-12 px-0 text-xl"
        >
          −
        </Button>
        <span
          data-testid="fan-value"
          className="min-w-[3ch] text-center text-3xl font-bold tabular-nums"
        >
          {fan}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={increment}
          disabled={fan >= capFan}
          aria-label="Increase fan"
          className="h-12 w-12 px-0 text-xl"
        >
          +
        </Button>
        <span className="text-muted-foreground text-sm">fan</span>
      </div>
      {belowMinimum && (
        <p className="text-muted-foreground text-sm">Needs at least {minFan} fan to win.</p>
      )}
    </section>
  );
}
