'use client';

import { useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { SPRING_SNAP } from '@/components/motion/tokens';
import { cn } from '@/lib/utils';

export interface ScoreFlipProps {
  value: number;
  className?: string;
  /** Accessible name for the number, e.g. "Alice score". */
  label?: string;
}

const signed = (n: number): string => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

/**
 * A score that rolls over like a parlour tally board when it changes: the old figure leaves
 * upward for a gain and downward for a loss, and the difference floats off the number.
 * The number itself stays one text node, so it reads as plain text everywhere.
 */
export function ScoreFlip({ value, className, label }: ScoreFlipProps) {
  // Derived state: remember the last figure so a change can be read as a gain or a loss.
  const [track, setTrack] = useState({ value, delta: 0 });
  if (track.value !== value) setTrack({ value, delta: value - track.value });
  const { delta } = track;
  const direction = delta >= 0 ? 1 : -1;

  return (
    <span className={cn('relative inline-flex', className)}>
      {label && (
        <span className="sr-only">
          {label}: {value}
        </span>
      )}
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <m.span
          key={value}
          custom={direction}
          aria-hidden={label ? true : undefined}
          className="numerals inline-block"
          variants={{
            enter: (d: number) => ({ y: `${d * -55}%`, opacity: 0, scale: 0.85 }),
            show: { y: '0%', opacity: 1, scale: 1 },
            leave: (d: number) => ({ y: `${d * 55}%`, opacity: 0, scale: 0.85 }),
          }}
          initial="enter"
          animate="show"
          exit="leave"
          transition={SPRING_SNAP}
        >
          {value}
        </m.span>
      </AnimatePresence>
      <AnimatePresence>
        {delta !== 0 && (
          <m.span
            key={`delta-${value}`}
            aria-hidden="true"
            className={cn(
              'numerals pointer-events-none absolute -top-1 right-0 text-base leading-none',
              delta > 0 ? 'text-green' : 'text-lacquer',
            )}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [6, -10, -22, -34] }}
            transition={{ duration: 1.4, times: [0, 0.2, 0.7, 1], ease: 'easeOut' }}
            onAnimationComplete={() => setTrack((t) => ({ ...t, delta: 0 }))}
          >
            {signed(delta)}
          </m.span>
        )}
      </AnimatePresence>
    </span>
  );
}
