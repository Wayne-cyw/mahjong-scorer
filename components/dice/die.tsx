'use client';

import { m } from 'motion/react';
import { SPRING_TUMBLE, stagger } from '@/components/motion/tokens';
import { cn } from '@/lib/utils';

/** Pip positions on a 3x3 grid, indexed row by row. */
const PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export interface DieProps {
  value: number;
  /** Play the tumble-in; false renders the die at rest (a roll already on the table). */
  tumble: boolean;
  /** Position in the throw, used to stagger the three dice. */
  index: number;
}

/** Spin in degrees on the first die; each later die spins a little further. */
const SPIN_BASE_DEGREES = 540;
const SPIN_STEP_DEGREES = 90;

/** Seconds between each die landing. */
const DIE_STAGGER = 0.09;

/** An ivory die with the red single pip of Hong Kong sets; it tumbles in when thrown. */
export function Die({ value, tumble, index }: DieProps) {
  const pips = PIPS[value] ?? [];
  const spin = (index % 2 === 0 ? 1 : -1) * (SPIN_BASE_DEGREES + index * SPIN_STEP_DEGREES);
  return (
    <m.span
      aria-hidden="true"
      data-testid="die"
      initial={tumble ? { y: -70, rotate: spin, scale: 0.5, opacity: 0 } : false}
      animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
      transition={{ ...SPRING_TUMBLE, delay: tumble ? stagger(index, DIE_STAGGER) : 0 }}
      className="bg-ivory grid size-14 grid-cols-3 grid-rows-3 place-items-center gap-0.5 rounded-lg border-b-4 border-[#b9b39a] p-2"
    >
      {Array.from({ length: 9 }, (_, cell) => (
        <span
          key={cell}
          className={cn(
            'rounded-full',
            pips.includes(cell)
              ? value === 1
                ? 'bg-lacquer size-5'
                : 'bg-green-deep size-2.5'
              : 'size-2.5 bg-transparent',
          )}
        />
      ))}
    </m.span>
  );
}
