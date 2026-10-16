'use client';

import { useState } from 'react';
import { Shuffle } from 'lucide-react';
import { m } from 'motion/react';
import { SPRING_SOFT, stagger } from '@/components/motion/tokens';
import type { Seat } from '@/lib/tiles';
import { Button } from '@/components/ui/button';

/** Seconds between each seat's field sliding in. */
const SEAT_STAGGER = 0.06;

const SEATS: readonly Seat[] = [0, 1, 2, 3];

/** Seat order is play order: the first seat is East at the start of the game. */
const SEAT_GLYPH = ['東', '南', '西', '北'] as const;

export interface PlayerFieldsProps {
  /** Names in seat order: `names[seat]` is the player sitting seat `seat`. */
  names: readonly string[];
  onNameChange: (seat: Seat, value: string) => void;
  onShuffle: () => void;
  /** Saved-player names offered as autocomplete suggestions (PD-03). */
  suggestions?: readonly string[];
}

/** Four name fields in seat order, with saved-player suggestions and a shuffle control (PD-03/04). */
export function PlayerFields({
  names,
  onNameChange,
  onShuffle,
  suggestions = [],
}: PlayerFieldsProps) {
  // Each shuffle re-keys the seat tiles so they flip, which is the only feedback a swap needs.
  const [shuffles, setShuffles] = useState(0);

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="font-display mb-3 text-xl font-black">Players</legend>
      {SEATS.map((seat) => (
        <div key={seat} className="flex items-end gap-3">
          <m.span
            key={`${seat}-${shuffles}`}
            aria-hidden="true"
            initial={shuffles > 0 ? { rotateY: 180, scale: 0.8 } : false}
            animate={{ rotateY: 0, scale: 1 }}
            transition={{ ...SPRING_SOFT, delay: stagger(seat, SEAT_STAGGER) }}
            className="bg-ivory text-lacquer font-display border-green grid h-16 w-12 shrink-0 place-items-center rounded-[7px] border-b-[5px] text-3xl leading-none font-black"
          >
            {SEAT_GLYPH[seat]}
          </m.span>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor={`player-${seat}`} className="text-ink-dim text-sm font-medium">
              Seat {seat + 1}
            </label>
            <input
              id={`player-${seat}`}
              name={`player-${seat}`}
              type="text"
              list="saved-players"
              autoComplete="off"
              value={names[seat] ?? ''}
              onChange={(event) => onNameChange(seat, event.target.value)}
              placeholder={`Player ${seat + 1}`}
              className="bg-cream-deep border-cream-edge text-foreground placeholder:text-ink-dim/70 focus-visible:border-sign focus-visible:bg-cream h-14 rounded-md border-b-4 px-3 text-lg font-bold transition-colors outline-none"
            />
          </div>
        </div>
      ))}
      <datalist id="saved-players">
        {suggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setShuffles((n) => n + 1);
          onShuffle();
        }}
        className="h-14 px-4 text-lg"
      >
        <Shuffle aria-hidden="true" className="size-5" />
        Shuffle seats
      </Button>
    </fieldset>
  );
}

/**
 * Fisher-Yates shuffle of `items`, keeping the same elements and only reordering them.
 * `random` is a parameter (ADR-62 style) so tests can supply a deterministic source.
 */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const a = result[i]!;
    const b = result[j]!;
    result[i] = b;
    result[j] = a;
  }
  return result;
}
