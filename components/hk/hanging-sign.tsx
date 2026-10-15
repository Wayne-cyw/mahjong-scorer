import { cn } from '@/lib/utils';

export interface HangingSignProps {
  /** Characters stacked top to bottom, as on a 直招牌 hung from a shopfront. */
  text: string;
  className?: string;
}

/**
 * A vertical shop signboard: lacquer ground, signboard-yellow characters, two fixing lugs.
 * It swings once into place on mount (CSS only, switched off for reduced motion).
 */
export function HangingSign({ text, className }: HangingSignProps) {
  return (
    <div aria-hidden="true" className={cn('anim-sign-swing relative shrink-0', className)}>
      <span className="bg-sign-deep absolute -top-3 left-3 h-4 w-2" />
      <span className="bg-sign-deep absolute -top-3 right-3 h-4 w-2" />
      <div className="bg-green-deep border-sign font-display text-ivory flex w-[4.5rem] flex-col items-center gap-1 rounded-md border-4 px-1 py-3 text-[2.35rem] leading-[1.08] font-black">
        {Array.from(text).map((char, i) => (
          <span key={`${char}-${i}`}>{char}</span>
        ))}
      </div>
    </div>
  );
}
