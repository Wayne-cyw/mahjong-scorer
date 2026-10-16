'use client';

import { m } from 'motion/react';
import { SPRING_BOUNCE } from '@/components/motion/tokens';
import { cn } from '@/lib/utils';

export interface SealProps {
  /** The character carved in the seal, e.g. 莊 for the dealer. */
  glyph: string;
  /** Spoken label; the glyph itself is decorative. */
  label: string;
  className?: string;
}

/** A square lacquer-red chop, the mark every parlour uses for "this one is the banker". */
export function Seal({ glyph, label, className }: SealProps) {
  return (
    <m.span
      initial={{ scale: 1.8, rotate: -14, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={SPRING_BOUNCE}
      className={cn(
        'bg-lacquer text-ivory font-display border-lacquer-deep inline-flex h-11 w-8 shrink-0 items-center justify-center rounded-[6px] border-b-4 text-xl leading-none font-black',
        className,
      )}
    >
      <span aria-hidden="true">{glyph}</span>
      <span className="sr-only">{label}</span>
    </m.span>
  );
}
