'use client';

import { useState } from 'react';
import type { Seat, Wind } from '@/lib/tiles';
import { Button } from '@/components/ui/button';
import { WIND_LABEL } from './seat-card';

export const MAX_DEALER_REPEAT = 20;

const WIND_ORDER: readonly Wind[] = ['E', 'S', 'W', 'N'];

export interface OverrideValues {
  dealer: Seat;
  prevailing: Wind;
  dealerRepeat: number;
}

export interface OverrideSheetProps {
  seatNames: readonly string[];
  initial: OverrideValues;
  onSubmit: (values: OverrideValues) => Promise<void> | void;
  onCancel: () => void;
}

/** Manual correction of dealer, prevailing wind and dealer repeat (PD-17, ADR-34). */
export function OverrideSheet({ seatNames, initial, onSubmit, onCancel }: OverrideSheetProps) {
  const [dealer, setDealer] = useState(String(initial.dealer));
  const [prevailing, setPrevailing] = useState<string>(initial.prevailing);
  const [repeat, setRepeat] = useState(String(initial.dealerRepeat));
  const [error, setError] = useState<string | null>(null);

  const apply = async (): Promise<void> => {
    const dealerNum = Number(dealer);
    const repeatNum = Number(repeat);
    if (![0, 1, 2, 3].includes(dealerNum)) return setError('Pick a dealer.');
    if (!WIND_ORDER.includes(prevailing as Wind)) return setError('Pick a prevailing wind.');
    if (
      repeat.trim() === '' ||
      !Number.isInteger(repeatNum) ||
      repeatNum < 0 ||
      repeatNum > MAX_DEALER_REPEAT
    ) {
      return setError(`Dealer repeat must be a whole number from 0 to ${MAX_DEALER_REPEAT}.`);
    }
    setError(null);
    await onSubmit({
      dealer: dealerNum as Seat,
      prevailing: prevailing as Wind,
      dealerRepeat: repeatNum,
    });
  };

  const fieldClass =
    'bg-cream border-cream-edge focus-visible:border-sign h-12 rounded-md border-b-4 px-3 text-lg outline-none';

  return (
    <section
      aria-label="Override table state"
      className="bg-cream-raised flex flex-col gap-3 rounded-md p-4"
    >
      <h3 className="font-display text-xl font-black">Override table state</h3>
      <label className="flex flex-col gap-1 text-base">
        Dealer
        <select value={dealer} onChange={(e) => setDealer(e.target.value)} className={fieldClass}>
          {[0, 1, 2, 3].map((seat) => (
            <option key={seat} value={String(seat)}>
              {seatNames[seat]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-base">
        Prevailing wind
        <select
          value={prevailing}
          onChange={(e) => setPrevailing(e.target.value)}
          className={fieldClass}
        >
          {WIND_ORDER.map((wind) => (
            <option key={wind} value={wind}>
              {WIND_LABEL[wind].en} ({WIND_LABEL[wind].zh})
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-base">
        Dealer repeat
        <input
          type="number"
          inputMode="numeric"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className={fieldClass}
        />
      </label>
      {error && (
        <p role="alert" className="bg-lacquer text-ivory rounded-md p-3 font-medium">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="h-12 flex-1 text-base"
        >
          Cancel
        </Button>
        <Button type="button" onClick={() => void apply()} className="h-12 flex-1 text-base">
          Apply
        </Button>
      </div>
    </section>
  );
}
