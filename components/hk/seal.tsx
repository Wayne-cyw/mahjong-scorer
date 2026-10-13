'use client';

import { m } from 'motion/react';
import { cn } from '@/lib/utils';

export interface SealProps {
  /** The character carved in the seal, e.g. 莊 for the dealer. */
  glyph: string;
  /** Spoken label; the glyph itself is decorative. */
  label: string;
  /** Shared id so the same seal glides between seats instead of blinking out and in. */
  layoutId?: string;
  className?: string;
}

/** A square lacquer-red chop, the mark every parlour uses for "this one is the banker". */
export function Seal({ glyph, label, layoutId, className }: SealProps) {
  return (
    <m.span
      layoutId={layoutId}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      className={cn(
        'bg-lacquer text-ivory font-display inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-xl leading-none font-black',
        className,
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{label}</span>
    </m.span>
  );
}
