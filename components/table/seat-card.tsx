'use client';

import { AnimatePresence, m } from 'motion/react';
import { SPRING_SOFT } from '@/components/motion/tokens';
import type { Seat, Wind } from '@/lib/tiles';
import { cn } from '@/lib/utils';
import { Seal } from '@/components/hk/seal';
import { ScoreFlip } from '@/components/hk/score-flip';

/** Bilingual compass label for each wind, independent of the honor-tile names in `tileName`. */
export const WIND_LABEL: Record<Wind, { en: string; zh: string }> = {
  E: { en: 'East', zh: '東' },
  S: { en: 'South', zh: '南' },
  W: { en: 'West', zh: '西' },
  N: { en: 'North', zh: '北' },
};

export interface SeatCardProps {
  seat: Seat;
  name: string;
  score: number;
  wind: Wind;
  isDealer: boolean;
  dealerRepeat: number;
  /** This seat's wall is the one the last dice roll breaks. */
  breaking?: boolean;
  /** Two-row layout for the narrow sideways seats. */
  compact?: boolean;
}

/**
 * One seat: player name, score (large, legible at arm's length), seat wind and dealer marker
 * (PD-06, PD-26). The card is a landscape strip; the table turns it to face its player.
 */
export function SeatCard({
  seat,
  name,
  score,
  wind,
  isDealer,
  dealerRepeat,
  breaking = false,
  compact = false,
}: SeatCardProps) {
  const label = WIND_LABEL[wind];

  const windBlock = (
    <span
      aria-hidden="true"
      className={cn(
        'font-display grid shrink-0 place-items-center rounded-[7px] border-b-[5px] leading-none font-black',
        compact ? 'h-10 w-8 text-xl' : 'h-[3.75rem] w-12 text-3xl',
        isDealer
          ? 'bg-sign border-sign-deep text-green-deep'
          : 'bg-green border-green-deep text-ivory',
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={wind}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }}
          transition={SPRING_SOFT}
        >
          {label.zh}
        </m.span>
      </AnimatePresence>
    </span>
  );

  const caption = (
    <span className={cn('text-ink-dim leading-tight', compact ? 'text-xs' : 'text-sm')}>
      {label.en} {label.zh}
      {isDealer && dealerRepeat > 0 ? ` · repeat ${dealerRepeat}` : null}
    </span>
  );

  const nameEl = (
    <span
      className={cn(
        'font-display truncate leading-tight font-black',
        compact ? 'text-base' : 'text-xl',
      )}
      title={name}
    >
      {name}
    </span>
  );

  const scoreEl = (
    <ScoreFlip
      value={score}
      label={`${name} score`}
      className={cn('shrink-0 leading-none', compact ? 'text-3xl' : 'text-4xl')}
    />
  );

  return (
    <m.div
      layout="position"
      data-testid={`seat-card-${seat}`}
      data-dealer={isDealer}
      className={cn(
        'relative flex size-full min-h-0 overflow-hidden rounded-md transition-colors duration-500',
        isDealer ? 'bg-green-soft' : 'bg-cream-raised',
        compact ? 'flex-col justify-between px-2.5 py-2' : 'items-center gap-3 px-3',
      )}
    >
      {compact ? (
        <>
          <div className="flex min-w-0 items-center gap-2 pr-6">
            {windBlock}
            {nameEl}
          </div>
          <div className="flex items-end justify-between gap-2">
            {caption}
            {scoreEl}
          </div>
        </>
      ) : (
        <>
          {windBlock}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
            {nameEl}
            {caption}
          </div>
          {scoreEl}
        </>
      )}

      {isDealer && (
        <Seal
          glyph="莊"
          label="Dealer 莊"
          className="absolute top-0 right-2 h-9 w-7 rounded-t-none text-base"
        />
      )}

      <AnimatePresence>
        {breaking && (
          <m.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: 'left' }}
            className="bg-green absolute inset-x-0 bottom-0 flex h-1.5"
          >
            <span className="sr-only">Wall breaks here</span>
          </m.span>
        )}
      </AnimatePresence>
    </m.div>
  );
}
