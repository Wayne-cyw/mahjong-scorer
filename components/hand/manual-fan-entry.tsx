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
    <section aria-label="Fan" className="bg-felt-raised flex flex-col gap-3 rounded-md p-4">
      <div className="flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={decrement}
          disabled={fan <= 0}
          aria-label="Decrease fan"
          className="h-14 w-14 px-0 text-2xl"
        >
          −
        </Button>
        <span
          data-testid="fan-value"
          className="numerals min-w-[3ch] text-center text-6xl leading-none"
        >
          {fan}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={increment}
          disabled={fan >= capFan}
          aria-label="Increase fan"
          className="h-14 w-14 px-0 text-2xl"
        >
          +
        </Button>
      </div>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: capFan }, (_, i) => (
          <span
            key={i}
            style={{ transitionDelay: `${i * 18}ms` }}
            className={
              i < fan
                ? 'bg-sign h-3 flex-1 rounded-sm transition-colors duration-200'
                : 'bg-felt-deep h-3 flex-1 rounded-sm transition-colors duration-200'
            }
          />
        ))}
      </div>
      <p className="text-ivory-dim text-sm">fan · cap {capFan}</p>
      {belowMinimum && (
        <p className="text-ivory-dim text-sm">Needs at least {minFan} fan to win.</p>
      )}
    </section>
  );
}
